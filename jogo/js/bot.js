/* Bots do jogo Assembleia. Cada decisão é uma função PURA do estado (não mexe no estado nem no sorteio do jogo):
 * a interface mostra a decisão com a frase ("nota") e só então manda a ação ao motor.
 * O "acaso" do bot vem de um hash da semente da partida + rodada + lugar, então a mesma tela sempre mostra a mesma decisão.
 * Os bots só usam o que um jogador vê na mesa mais a própria mão e o próprio objetivo secreto. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(require('./engine.js'));
  else raiz.Bot = fabrica(raiz.Engine);
})(typeof self !== 'undefined' ? self : this, function (E) {
  'use strict';
  const R = E.R;

  // ---- acaso determinístico (0 a 1) ----
  function alea(s, ...ks) {
    let h = (s.seed ^ 0x9e3779b9) >>> 0;
    for (const k of ks) { h = Math.imul(h ^ (k | 0), 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; }
    return (h >>> 0) / 4294967296;
  }
  const hs = str => { let a = 7; for (let i = 0; i < str.length; i++) a = (a * 31 + str.charCodeAt(i)) | 0; return a; };

  // ---- consultas ----
  const carta = (D, id) => E.porId(D.acoes, id);
  const nm = (D, s, i) => E.nomePais(D, s, i);
  const idxTurno = s => (s.turno ? s.turno.idx : 0);
  const falta = (D, s) => { const c = s.crise; return c ? Math.max(0, E.infoCrise(D, c).n - E.totalAjudas(c)) : 0; };
  const novoParceiro = (s, a, b) => !s.est[a].parceiros.includes(b);

  // quanto uma carta vale para ESTE país agora (as habilidades do país mudam o valor)
  function valor(D, s, seat, id) {
    const c = carta(D, id), h = E.hab(D, s, seat), obj = s.objetivos[seat], cr = s.crise, need = falta(D, s);
    const gosto = alea(s, 77, seat, hs(id)) * 0.3; // preferência pessoal estável: faz os bots trocarem de vez em quando
    if (c.tipo === 'troca') return 1 + (h.leve_auto ? 0.5 : 0) + (h.leve_bonus1x ? 0.4 : 0) + gosto;
    const futuras = R.RODADAS_COM_CRISE.some(r => r > s.rodada);
    const util = cr ? (need > 0 ? 1 : 0.3) : (futuras ? 0.4 : 0);
    if (obj === 'ECO-O07') return 0.1 + gosto;
    if (c.tipo === 'media') return 1.6 * util * (h.peso2 ? 1.5 : 1) + 0.1 + gosto;
    if (obj === 'ECO-O02') return gosto;
    return util * (2.2 + (h.seguro ? 0.8 : 0) - (h.inflacao ? 0.8 : 0)) + gosto;
  }
  const pior = (D, s, seat) => s.mao[seat].slice().sort((x, y) => valor(D, s, seat, x) - valor(D, s, seat, y))[0];

  // ---- presidência ----
  function modo(D, s, seat) {
    const fechado = s.objetivos[seat] === 'ECO-O07' || alea(s, 1, s.rodada, seat) < 0.4;
    return { modo: fechado ? 'fechado' : 'aberto',
      nota: fechado ? 'Escolheu voto fechado: ninguém fica sabendo quem apoiou cada proposta.' : 'Escolheu voto aberto: todos veem quem apoia cada proposta.' };
  }

  // ---- jogar uma carta (ou passar) ----
  function jogada(D, s, seat) {
    const rod = s.rodada, obj = s.objetivos[seat], h = E.hab(D, s, seat), c = s.crise, need = falta(D, s);
    const ja = c ? (c.ajudas[seat] || 0) : 0, idx = idxTurno(s);
    const jog = s.mao[seat].filter(id => !E.podeJogar(D, s, seat, id));
    const outros = s.assentos.map(a => a.i).filter(i => i !== seat);
    const parceiro = (tag, comCartas) => {
      let melhor = -1, bi = null;
      for (const i of outros) {
        if (comCartas && !s.mao[i].length) continue;
        const v = (novoParceiro(s, seat, i) ? 1 : 0) + alea(s, tag, rod, idx, seat, i);
        if (v > melhor) { melhor = v; bi = i; }
      }
      return bi;
    };
    const poupa = obj === 'ECO-O09' && rod === R.RODADAS; // precisa terminar com 3 cartas: só jogaria troca
    const cand = [];
    for (const id of jog) {
      const t = carta(D, id).tipo, ruido = (alea(s, 5, rod, idx, seat, hs(id)) - 0.5) * 0.4;
      if (t === 'troca') {
        const p = parceiro(11, true); if (p == null) continue;
        cand.push({ id, t, p, sc: 1 + (h.leve_auto ? 0.5 : 0) + (h.leve_bonus1x && s.est[seat].leveAceitas === 0 ? 0.5 : 0) + (obj === 'ECO-O04' && novoParceiro(s, seat, p) ? 0.7 : 0) + (poupa ? 1 : 0) + ruido });
      } else if (t === 'media') {
        if (poupa || obj === 'ECO-O07') continue;
        const peso = h.peso2 ? 2 : 1;
        let sc = ja >= peso ? 0.2 : (need > 0 ? 2 : 0.6) * (h.peso2 ? 1.5 : 1);
        if (obj === 'ECO-O01' || obj === 'ECO-O03') sc += 0.4;
        cand.push({ id, t, p: parceiro(12, false), sc: sc + ruido });
      } else {
        if (poupa || obj === 'ECO-O07' || obj === 'ECO-O02' || ja >= R.AJUDA_PESADA) continue;
        const wAj = need > 0 ? 1.2 : 0.2, prob = need > 0 ? 0.55 : 0.3;
        const ganho = R.PESADA_PTS + (R.AJUDA_PESADA - ja) * wAj;
        const custo = h.seguro ? 0 : h.inflacao ? 2 * R.PESADA_CUSTO : R.PESADA_CUSTO;
        cand.push({ id, t, p: null, sc: prob * ganho - (1 - prob) * (custo + wAj) + (obj === 'ECO-O03' ? 0.4 : 0) + ruido });
      }
    }
    cand.sort((x, y) => y.sc - x.sc);
    const m = cand[0];
    if (!m || m.sc < 0.5) {
      return { tipo: 'passar', nota: !jog.length ? 'Não tem carta que possa jogar agora.' : (c && need === 0) ? 'A crise já tem ajudas suficientes; guardou as cartas.' : 'Nenhuma carta valia o risco; passou a vez.' };
    }
    const cn = carta(D, m.id).nome;
    let nota;
    if (m.t === 'troca') nota = c ? `Ofereceu uma troca a ${nm(D, s, m.p)} para ganhar +${R.LEVE_PTS} ponto.` : `Sem crise aberta, só dá para trocar: ofereceu "${cn}" a ${nm(D, s, m.p)} (+${R.LEVE_PTS} ponto).`;
    else if (m.t === 'media') nota = need > 0 ? `Faltam ${need} ajuda(s) na crise: propôs um acordo (grátis) com ${nm(D, s, m.p)}.` : `A crise já tem ajudas; propôs um acordo com ${nm(D, s, m.p)} para somar pontos.`;
    else nota = need > 0 ? `Faltam ${need} ajuda(s) e o prêmio compensa: arriscou um plano caro (${R.PESADA_CUSTO} ponto).` : 'Arriscou um plano caro pelos pontos extras.';
    return { tipo: 'jogar', carta: m.id, parceiro: m.p, alvo: m.p, nota };
  }

  // ---- votar numa proposta (cartas média e pesada) ----
  function voto(D, s, seat) {
    const p = s.pend, q = p.quem, ct = carta(D, p.carta), need = falta(D, s), obj = s.objetivos[seat];
    if (seat === q) return { voto: true, nota: 'É a proposta dele.' };
    if (obj === 'ECO-O07') return { voto: false, nota: 'Não se convenceu do plano.' };
    if (p.parceiro === seat) return { voto: true, nota: 'É o parceiro do acordo.' };
    let base = 0.5, motivoNao = 'Não se convenceu do plano.';
    const frente = s.pts[q] - s.pts[seat];
    if (frente >= 2) { base -= 0.2; motivoNao = `${nm(D, s, q)} já está bem na frente.`; }
    if (need <= 0) { base -= 0.3; motivoNao = 'A crise já tem ajudas suficientes.'; }
    if (ct.tipo === 'pesada') base -= 0.05;
    if (need > 0 && ct.tipo === 'pesada' && need >= 2) base += 0.1; // crise precisa de muita ajuda: o plano caro tem mais apoio
    const sim = alea(s, 3, s.rodada, idxTurno(s), seat, hs(p.carta)) < base;
    return { voto: sim, nota: sim ? (need > 0 ? 'A crise precisa de ajuda.' : 'Apoiou a proposta.') : motivoNao };
  }

  // ---- responder a uma oferta de troca (cartaRec = carta que o parceiro recebe) ----
  function resposta(D, s, seat, cartaRec, quem) {
    if (!s.mao[seat].length) return { aceita: false, nota: 'Está sem cartas para dar em troca.' };
    const dar = pior(D, s, seat);
    const ganho = valor(D, s, seat, cartaRec) - valor(D, s, seat, dar) + (s.objetivos[seat] === 'ECO-O04' && novoParceiro(s, seat, quem) ? 0.7 : 0);
    if (ganho >= 0) return { aceita: true, cartaDevolve: dar, nota: 'Aceitou: a carta nova serve para ele e a que deu serve menos.' };
    return { aceita: false, nota: 'Recusou: prefere ficar com as cartas que tem.' };
  }

  // ---- fase de troca: próxima troca entre dois bots (ou null) ----
  function proximaTroca(D, s) {
    const bots = s.assentos.filter(a => a.bot).map(a => a.i);
    const usados = new Set(); s.trocas.forEach(t => { usados.add(t.a); usados.add(t.b); });
    const livres = bots.filter(i => !usados.has(i) && s.mao[i].length);
    let melhor = null;
    for (let x = 0; x < livres.length; x++) for (let y = x + 1; y < livres.length; y++) {
      const a = livres[x], b = livres[y], ca = pior(D, s, a), cb = pior(D, s, b);
      const ga = valor(D, s, a, cb) - valor(D, s, a, ca) + (s.objetivos[a] === 'ECO-O04' && novoParceiro(s, a, b) ? 0.7 : 0);
      const gb = valor(D, s, b, ca) - valor(D, s, b, cb) + (s.objetivos[b] === 'ECO-O04' && novoParceiro(s, b, a) ? 0.7 : 0);
      if (ga > 0.3 && gb > 0.3 && (!melhor || ga + gb > melhor.g)) melhor = { a, b, cartaA: ca, cartaB: cb, g: ga + gb };
    }
    if (!melhor) return null;
    return { a: melhor.a, b: melhor.b, cartaA: melhor.cartaA, cartaB: melhor.cartaB, nota: 'Trocaram: cada carta rende mais no outro país.' };
  }

  return { alea, valor, modo, jogada, voto, resposta, proximaTroca };
});
