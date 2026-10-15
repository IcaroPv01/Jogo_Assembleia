/* Motor do jogo Assembleia (baralho Economia). Lógica pura: sem DOM, estado = JSON.
 * Roda no navegador (window.Engine) e no Node (testes com bots).
 * A interface (js/ui.js) só lê o estado e chama Engine.acao(D, estado, {...}).
 * Para plugar uma versão de celular depois: cada celular manda as mesmas ações
 * (votar, jogar, passar...) para o mesmo estado; ver jogo/README.md.
 *
 * Regras: regras/decisoes.md (Módulo 1) + economia/balanceamento.md e paises.json (Módulo 5). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Engine = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Constantes de regra. Ajuste aqui, não espalhado no código. ----
  const R = {
    JOGADORES: 5, RODADAS: 5, MAO: 3, MAO_GRANDE: 4,
    RODADAS_COM_CRISE: [1, 3, 5],       // 1 = fixa, 3 e 5 = aleatórias
    META: 13, TRILHA_MAX: 13,           // trilha de 14 casas (0 a 13), igual ao tabuleiro impresso
    PTS_NAO_RESOLVIDA: -2,              // na trilha
    BONUS_META: 2,                      // pontos para todos
    MAIORIA: 3,                         // votos "sim" para aprovar (5 jogadores)
    // Ações (balanceamento.md §1)
    LEVE_PTS: 1,
    AJUDA_MEDIA: 1, AJUDA_PESADA: 2,
    PESADA_CUSTO: 1, PESADA_PTS: 2, PESADA_REPROVADA_TIRA: 1,
    PTS_AJUDANTE: 1,                    // cada país que ajudou, se a crise for resolvida ou atenuada
    TEMPOS: { presidencia: 30, crise: 30, debate: 180, troca: 90, jogar: 120 }, // segundos (decisoes.md 2.1)
  };

  // ---- Aleatório com semente (estado serializável) ----
  function rnd(s) { // mulberry32
    s.rng = (s.rng + 0x6D2B79F5) >>> 0;
    let t = s.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function embaralha(s, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const porId = (lista, id) => lista.find(x => x.id === id);

  // ---- Criação ----
  function novoJogo(dados, { paises, nomes = [], seed, relogio = 'aviso' }) {
    if (!paises || paises.length !== R.JOGADORES) throw new Error('Precisa de ' + R.JOGADORES + ' países.');
    const s = { v: 2, rng: (seed ?? Math.floor(Math.random() * 4294967296)) >>> 0, relogio };
    s.seed = s.rng;
    s.assentos = paises.map((pid, i) => ({ i, pais: pid, jogador: (nomes[i] || '').trim() }));
    s.rodada = 0;
    s.fase = 'objetivos';
    s.presidente = Math.floor(rnd(s) * R.JOGADORES);
    s.votoModo = null;
    s.trilha = 0;
    s.pts = s.assentos.map(a => (porId(dados.paises, a.pais).modelo || {}).inicio ? 1 : 0);
    const objs = embaralha(s, dados.objetivos.map(o => o.id));
    s.objetivos = s.assentos.map((_, i) => objs[i]);
    s.objManual = {};
    // cada país leva as suas 3 cartas de ação; as dos 3 países fora da mesa viram a pilha de compra
    s.mao = s.assentos.map(a => dados.acoes.filter(c => c.pais === a.pais).map(c => c.id));
    s.compra = embaralha(s, dados.acoes.filter(c => !paises.includes(c.pais)).map(c => c.id));
    s.descarte = [];
    s.crisePool = embaralha(s, dados.eventos.filter(e => e.tipo !== 'fixa').map(e => e.id));
    s.crise = null;
    s.crisesHist = [];
    s.est = s.assentos.map(() => ({ parceiros: [], acordos: 0, pesadas: 0, rodadasAprovadas: [], leveAceitas: 0, pedagioUsado: false, votoExtraUsado: false }));
    s.turno = null; s.pend = null; s.trocas = []; s.resumo = null; s.final = null; s.log = [];
    return s;
  }

  const log = (s, txt) => { s.log.push({ r: s.rodada, txt }); };
  const paisDe = (D, s, i) => porId(D.paises, s.assentos[i].pais);
  const nomePais = (D, s, i) => paisDe(D, s, i).nome;
  const hab = (D, s, i) => paisDe(D, s, i).modelo || {};
  const maoMax = (D, s, i) => (hab(D, s, i).hand4 ? R.MAO_GRANDE : R.MAO);

  // ---- Consultas ----
  function ordemJogo(D, s) {
    // força crescente (fraco primeiro); empate: mais perto do presidente, sentido horário
    const dist = i => (i - s.presidente + R.JOGADORES) % R.JOGADORES;
    return s.assentos.map(a => a.i).sort((a, b) => paisDe(D, s, a).forca - paisDe(D, s, b).forca || dist(a) - dist(b));
  }
  const ehRodadaCrise = r => R.RODADAS_COM_CRISE.includes(r);
  const infoCrise = (D, c) => porId(D.eventos, c.id);
  const totalAjudas = c => Math.max(0, Object.values(c.ajudas).reduce((a, b) => a + b, 0) - c.penal);
  const ajudantes = c => Object.keys(c.ajudas).filter(k => c.ajudas[k] > 0).map(Number);
  const ultimaRodadaDaCrise = (s, c) => s.rodada >= c.aberta + 1 || s.rodada >= R.RODADAS;

  // ---- Fluxo de fases ----
  function iniciaRodada(D, s) {
    s.rodada += 1;
    if (s.rodada > 1) s.presidente = (s.presidente + 1) % R.JOGADORES;
    s.votoModo = null; s.turno = null; s.pend = null; s.resumo = null; s.trocas = [];
    s.antesTrilha = s.trilha; s.antesPts = s.pts.slice();
    for (let i = 0; i < R.JOGADORES; i++) { // completa a mão (3, ou 4 para quem tem "mão grande")
      while (s.mao[i].length < maoMax(D, s, i)) {
        if (!s.compra.length) { if (!s.descarte.length) break; s.compra = embaralha(s, s.descarte); s.descarte = []; }
        s.mao[i].push(s.compra.shift());
      }
    }
    s.fase = 'presidencia';
    log(s, `Rodada ${s.rodada}. Presidente: ${nomePais(D, s, s.presidente)}.`);
  }

  function revelaCrise(D, s) {
    const id = s.rodada === 1 ? D.eventos.find(e => e.tipo === 'fixa').id : s.crisePool.shift();
    s.crise = { id, aberta: s.rodada, ajudas: {}, penal: 0 };
    log(s, `Crise revelada: ${infoCrise(D, s.crise).titulo}.`);
  }

  function entraFase(D, s, fase) {
    s.fase = fase;
    if (fase === 'crise') { if (ehRodadaCrise(s.rodada)) revelaCrise(D, s); else s.fase = 'debate'; }
    if (fase === 'jogar') { s.turno = { ordem: ordemJogo(D, s), idx: 0 }; s.pend = null; }
  }

  function proximaFase(D, s) {
    switch (s.fase) {
      case 'objetivos': iniciaRodada(D, s); return;
      case 'presidencia': entraFase(D, s, ehRodadaCrise(s.rodada) ? 'crise' : 'debate'); return;
      case 'crise': entraFase(D, s, 'debate'); return;
      case 'debate': entraFase(D, s, 'troca'); return;
      case 'troca': entraFase(D, s, 'jogar'); return;
      case 'jogar': fecharRodada(D, s); return;
      case 'fecho': if (s.rodada >= R.RODADAS) finalizar(D, s); else iniciaRodada(D, s); return;
    }
  }

  // ---- Fim da rodada: avalia a crise aberta ----
  function encerraCrise(D, s, status) {
    const c = s.crise, e = infoCrise(D, c);
    c.status = status; c.total = totalAjudas(c);
    if (status === 'resolvida' || status === 'atenuada') {
      s.trilha = Math.min(R.TRILHA_MAX, s.trilha + (status === 'resolvida' ? e.pts_resolver : e.pts_atenuar));
      for (const q of ajudantes(c)) s.pts[q] += R.PTS_AJUDANTE;
    } else s.trilha = Math.max(0, s.trilha + R.PTS_NAO_RESOLVIDA);
    c.fechouNaRodada = s.rodada;
    log(s, `Crise "${e.titulo}": ${status.replace('_', ' ')} (${c.total} de ${e.n} ajudas).`);
    s.crisesHist.push(c); s.crise = null;
  }
  function fecharRodada(D, s) {
    s.fase = 'fecho'; s.turno = null; s.pend = null;
    const c = s.crise;
    if (c) {
      const e = infoCrise(D, c), t = totalAjudas(c);
      if (t >= e.n) encerraCrise(D, s, 'resolvida');
      else if (ultimaRodadaDaCrise(s, c)) encerraCrise(D, s, t >= 1 ? 'atenuada' : 'nao_resolvida');
    }
    const ult = s.crisesHist[s.crisesHist.length - 1];
    s.resumo = {
      trilhaAntes: s.antesTrilha, trilhaDepois: s.trilha, ptsAntes: s.antesPts, ptsDepois: s.pts.slice(),
      crise: ult && ult.fechouNaRodada === s.rodada ? ult : null, criseAberta: s.crise ? s.crise.id : null,
    };
  }

  // ---- Turnos da fase "jogar" ----
  const seatDaVez = s => (s.turno && s.turno.idx < s.turno.ordem.length ? s.turno.ordem[s.turno.idx] : null);
  function avancaTurno(D, s) { s.turno.idx++; if (s.turno.idx >= s.turno.ordem.length) proximaFase(D, s); }
  function podeJogar(D, s, seat, cartaId) {
    const carta = porId(D.acoes, cartaId);
    if (!carta || !s.mao[seat].includes(cartaId)) return 'Carta não está na mão.';
    if (carta.tipo !== 'troca' && !s.crise) return 'Sem crise aberta: só troca (carta leve) pode ser jogada.';
    return null;
  }

  // ---- Votação de proposta (cartas média e pesada) ----
  function novoVoto(s, extra) {
    s.pend = Object.assign({ tipo: 'voto', votos: s.assentos.map(() => null), resultado: null }, extra);
  }
  function resolveVoto(D, s) {
    const p = s.pend;
    let sim = p.votos.filter(v => v === true).length, extra = false;
    // Grécia (voto_extra): 1x por partida, +1 voto a favor se isso aprovar a proposta
    if (sim === R.MAIORIA - 1 && hab(D, s, p.quem).voto_extra && !s.est[p.quem].votoExtraUsado) {
      s.est[p.quem].votoExtraUsado = true; sim++; extra = true;
      log(s, `${nomePais(D, s, p.quem)} usou o voto extra.`);
    }
    p.resultado = { sim, nao: R.JOGADORES - p.votos.filter(v => v === true).length, aprovado: sim >= R.MAIORIA, votoExtra: extra };
  }
  function ajuda(s, quem, peso) { const c = s.crise; c.ajudas[quem] = Math.max(c.ajudas[quem] || 0, peso); }

  function aposVoto(D, s) {
    const p = s.pend, quem = p.quem, carta = porId(D.acoes, p.carta), h = hab(D, s, quem), e = s.est[quem];
    const nm = nomePais(D, s, quem), ap = p.resultado.aprovado, placar = `${p.resultado.sim} x ${p.resultado.nao}`;
    if (ap) {
      if (carta.tipo === 'media') {
        ajuda(s, quem, h.peso2 ? 2 : R.AJUDA_MEDIA);
        e.acordos++; if (p.parceiro != null) s.est[p.parceiro].acordos++;
      } else { // pesada: devolve o custo, +2 pontos, 2 ajudas
        s.pts[quem] += R.PESADA_CUSTO + R.PESADA_PTS;
        ajuda(s, quem, R.AJUDA_PESADA);
      }
      if (!e.rodadasAprovadas.includes(s.rodada)) e.rodadasAprovadas.push(s.rodada);
      for (const y of s.assentos.map(a => a.i)) { // Egito (pedagio): 1x por partida, ganha 1 ponto quando outro tem ajuda aprovada
        if (y !== quem && hab(D, s, y).pedagio && !s.est[y].pedagioUsado) { s.est[y].pedagioUsado = true; s.pts[y] += 1; log(s, `${nomePais(D, s, y)} cobra pedágio: +1 ponto.`); }
      }
      log(s, `${nm}: "${carta.nome}" aprovada (${placar}).`);
    } else {
      if (carta.tipo === 'pesada') {
        s.crise.penal += R.PESADA_REPROVADA_TIRA;
        if (h.seguro) s.pts[quem] += R.PESADA_CUSTO;          // não perde o ponto do custo
        else if (h.inflacao) s.pts[quem] -= R.PESADA_CUSTO;    // perde o custo em dobro
      }
      log(s, `${nm}: "${carta.nome}" reprovada (${placar}).`);
    }
    s.pend = null;
    avancaTurno(D, s);
  }

  // ---- Ações (único ponto de entrada da interface) ----
  function acao(D, s, a) {
    const erro = m => ({ ok: false, erro: m });
    switch (a.tipo) {
      case 'objetivos_ok':
        if (s.fase !== 'objetivos') return erro('Fase errada.');
        proximaFase(D, s); return { ok: true };

      case 'voto_modo':
        if (s.fase !== 'presidencia') return erro('Fase errada.');
        s.votoModo = a.modo === 'fechado' ? 'fechado' : 'aberto';
        log(s, `Voto ${s.votoModo}.`); return { ok: true };

      case 'avancar':
        if (s.fase === 'presidencia' && !s.votoModo) return erro('O presidente precisa escolher voto aberto ou fechado.');
        if (s.fase === 'jogar') return erro('Use as ações da fase.');
        proximaFase(D, s); return { ok: true };

      case 'trocar': { // troca combinada na fase de troca
        if (s.fase !== 'troca') return erro('Só na fase de troca.');
        const { a: A, b: B, cartaA, cartaB } = a;
        if (A === B) return erro('Escolha outro país.');
        if (!s.mao[A].includes(cartaA) || !s.mao[B].includes(cartaB)) return erro('Carta não está na mão.');
        s.mao[A][s.mao[A].indexOf(cartaA)] = cartaB; s.mao[B][s.mao[B].indexOf(cartaB)] = cartaA;
        for (const [x, y] of [[A, B], [B, A]]) if (!s.est[x].parceiros.includes(y)) s.est[x].parceiros.push(y);
        s.trocas.push({ a: A, b: B });
        log(s, `Troca: ${nomePais(D, s, A)} ⇄ ${nomePais(D, s, B)}.`); return { ok: true };
      }

      case 'passar': {
        if (s.fase !== 'jogar' || s.pend) return erro('Agora não.');
        log(s, `${nomePais(D, s, seatDaVez(s))} passou.`);
        avancaTurno(D, s); return { ok: true };
      }

      case 'jogar': { // { seat, carta, parceiro?, alvo? }
        if (s.fase !== 'jogar' || s.pend) return erro('Agora não.');
        const seat = seatDaVez(s);
        if (a.seat != null && a.seat !== seat) return erro('Não é a vez desse país.');
        const e1 = podeJogar(D, s, seat, a.carta); if (e1) return erro(e1);
        const carta = porId(D.acoes, a.carta);
        if ((carta.tipo === 'troca' || carta.tipo === 'media') && (a.parceiro == null || a.parceiro === seat)) return erro('Escolha outro país.');
        if (carta.tipo === 'troca') { // o parceiro decide; a carta passa para ele se aceitar
          s.pend = { tipo: 'troca', quem: seat, parceiro: a.parceiro, carta: a.carta, resultado: null };
          return { ok: true };
        }
        s.mao[seat] = s.mao[seat].filter(c => c !== a.carta); s.descarte.push(a.carta);
        if (carta.tipo === 'pesada') { s.pts[seat] -= R.PESADA_CUSTO; s.est[seat].pesadas++; } // paga o custo (pode virar dívida)
        novoVoto(s, { quem: seat, carta: a.carta, parceiro: a.parceiro ?? null });
        return { ok: true };
      }

      case 'resposta_troca': { // { aceita, cartaDevolve }
        const p = s.pend;
        if (!p || p.tipo !== 'troca' || p.resultado) return erro('Sem troca pendente.');
        const { quem, parceiro, carta } = p, h = hab(D, s, quem), e = s.est[quem];
        if (!a.aceita || !s.mao[parceiro].length) {
          const auto = !!h.leve_auto; // EUA, China, Portugal, Egito, Uruguai: o ponto vale mesmo se recusarem
          if (auto) s.pts[quem] += R.LEVE_PTS;
          log(s, `${nomePais(D, s, parceiro)} recusou a troca de ${nomePais(D, s, quem)}.${auto ? ` (${nomePais(D, s, quem)} ganha o ponto mesmo assim.)` : ''}`);
          p.resultado = { aceita: false, ponto: auto ? R.LEVE_PTS : 0 };
        } else {
          if (!s.mao[parceiro].includes(a.cartaDevolve)) return erro('Escolha uma carta sua.');
          s.mao[quem].splice(s.mao[quem].indexOf(carta), 1);
          s.mao[parceiro].splice(s.mao[parceiro].indexOf(a.cartaDevolve), 1);
          s.mao[parceiro].push(carta); s.mao[quem].push(a.cartaDevolve);
          const pts = h.leve_bonus1x && e.leveAceitas === 0 ? 2 * R.LEVE_PTS : R.LEVE_PTS;
          e.leveAceitas++; s.pts[quem] += pts;
          for (const [x, y] of [[quem, parceiro], [parceiro, quem]]) if (!s.est[x].parceiros.includes(y)) s.est[x].parceiros.push(y);
          s.trocas.push({ a: quem, b: parceiro });
          log(s, `Troca aceita: ${nomePais(D, s, quem)} ⇄ ${nomePais(D, s, parceiro)} (+${pts} para ${nomePais(D, s, quem)}).`);
          p.resultado = { aceita: true, ponto: pts };
        }
        return { ok: true };
      }

      case 'troca_ok': {
        const p = s.pend;
        if (!p || p.tipo !== 'troca' || !p.resultado) return erro('Sem troca pendente.');
        s.pend = null; avancaTurno(D, s); return { ok: true };
      }

      case 'votar': { // { seat, voto } ou { votos: [...] } de uma vez (voto aberto)
        const p = s.pend;
        if (!p || p.tipo !== 'voto' || p.resultado) return erro('Sem votação aberta.');
        if (a.votos) a.votos.forEach((v, i) => { p.votos[i] = !!v; }); else p.votos[a.seat] = !!a.voto;
        if (p.votos.every(v => v !== null)) resolveVoto(D, s);
        return { ok: true };
      }

      case 'voto_ok': { // a mesa viu o resultado
        const p = s.pend;
        if (!p || p.tipo !== 'voto' || !p.resultado) return erro('Sem resultado.');
        aposVoto(D, s); return { ok: true };
      }

      case 'confirmar_objetivo': // objetivos "manuais" no fim: a mesa confirma
        s.objManual[a.seat] = !!a.cumpriu;
        if (s.final) calculaFinal(D, s);
        return { ok: true };
    }
    return erro('Ação desconhecida: ' + a.tipo);
  }

  // ---- Fim de partida ----
  const contribuiu = (c, seat) => (c.ajudas[seat] || 0) > 0;
  function objetivoCumprido(D, s, seat) {
    const o = porId(D.objetivos, s.objetivos[seat]), e = s.est[seat], res = s.crisesHist;
    const contr = filtro => res.filter(c => filtro(c.status) && contribuiu(c, seat)).length;
    switch (o.id) {
      case 'ECO-O01': return e.acordos >= 2;
      case 'ECO-O02': return e.pesadas === 0;                       // pesada = proposta cara (empréstimo)
      case 'ECO-O03': return e.rodadasAprovadas.length >= 2;
      case 'ECO-O04': return e.parceiros.length >= 3;
      case 'ECO-O05': return contr(st => st === 'resolvida') >= 2;
      case 'ECO-O07': return res.some(c => c.status === 'nao_resolvida' && !contribuiu(c, seat));
      case 'ECO-O08': return contr(st => st === 'resolvida' || st === 'atenuada') >= 2;
      case 'ECO-O09': return s.mao[seat].length >= 3;
      default: return !!s.objManual[seat];                          // manuais (O06, O10)
    }
  }
  function finalizar(D, s) { s.fase = 'fim'; s.final = { revelados: 0 }; calculaFinal(D, s); log(s, 'Fim da partida.'); }
  function calculaFinal(D, s) {
    const meta = s.trilha >= R.META;
    const linhas = s.assentos.map(a => {
      const i = a.i, o = porId(D.objetivos, s.objetivos[i]), cumpriu = objetivoCumprido(D, s, i);
      const extra = cumpriu ? (hab(D, s, i).obj_bonus || 0) : 0;
      const pontosObj = cumpriu ? o.pts + extra : 0, bonus = meta ? R.BONUS_META : 0;
      const crises = s.crisesHist.filter(c => c.status === 'resolvida' && contribuiu(c, i)).length;
      return { seat: i, base: s.pts[i], objetivo: o, cumpriu, pontosObj, bonus, total: s.pts[i] + pontosObj + bonus, crises };
    });
    const ordenado = linhas.slice().sort((x, y) => y.total - x.total || y.crises - x.crises);
    const topo = ordenado[0];
    const vencedores = ordenado.filter(l => l.total === topo.total && l.crises === topo.crises).map(l => l.seat);
    s.final = Object.assign(s.final || {}, { meta, linhas, ranking: ordenado.map(l => l.seat), vencedores });
  }

  return { R, novoJogo, acao, ordemJogo, seatDaVez, porId, nomePais, paisDe, hab, maoMax, infoCrise, ehRodadaCrise, objetivoCumprido, podeJogar, totalAjudas, ajudantes, ultimaRodadaDaCrise, rnd, embaralha };
});
