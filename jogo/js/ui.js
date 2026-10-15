/* Interface "uma tela" (computador/projetor, passa-e-joga). Só desenha o estado do motor e envia ações.
 * Tudo que for privado (objetivo secreto, mão de cartas, voto fechado) fica atrás de uma tela de privacidade. */
(function () {
  const D = DADOS, E = Engine, R = E.R, C = Cartas, esc = C.esc;
  const KEY = 'assembleia.economia.v1';
  const $app = document.getElementById('app');
  const U = { tela: 'inicio', sel: [], nomes: ['', '', '', '', ''], relogio: 'aviso', S: null, gateOk: null, modal: null,
    carta: null, parceiro: null, alvo: null, votosTmp: [], votoIdx: 0, troca: null, timer: null, timerKey: null,
    pk: '', objIdx: 0, revelado: false, toast: null, painel: null, salvo: null };

  // ---------- atalhos ----------
  const P = i => E.paisDe(D, U.S, i);
  const nome = i => esc(P(i).nome) + (U.S.assentos[i].jogador ? ` <span class="mudo">(${esc(U.S.assentos[i].jogador)})</span>` : '');
  const nomeTxt = i => P(i).nome;
  const flag = (i, c = '') => C.bandeira(P(i), c);
  const carta = id => E.porId(D.acoes, id);
  const evt = id => E.porId(D.eventos, id);
  const mmss = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const sinal = n => (n > 0 ? '+' : '') + n;

  function salva() { try { localStorage.setItem(KEY, JSON.stringify({ S: U.S })); } catch (e) { /* sem armazenamento: tudo bem */ } }
  function carrega() { try { const j = localStorage.getItem(KEY); return j ? JSON.parse(j) : null; } catch (e) { return null; } }
  function limpa() { try { localStorage.removeItem(KEY); } catch (e) { /* ok */ } }
  function toast(t) { U.toast = t; setTimeout(() => { U.toast = null; render(); }, 3200); }
  function A(a) { const r = E.acao(D, U.S, a); if (!r.ok) toast(r.erro); salva(); render(); return r; }

  // ---------- relógio das fases (só aviso; decisoes.md 2.1) ----------
  const GRUPO = { presidencia: 'presidencia', crise: 'crise', debate: 'debate', troca: 'troca', jogar: 'jogar' };
  function syncTimer() {
    const S = U.S; if (!S || U.tela !== 'jogo') return;
    const g = GRUPO[S.fase]; const key = g ? S.rodada + ':' + g : '';
    if (key === U.timerKey) return;
    U.timerKey = key;
    const t = g && S.relogio !== 'off' ? R.TEMPOS[g] : 0;
    U.timer = t ? { total: t, fim: Date.now() + t * 1000, pausadoEm: null, apitou: false } : null;
  }
  function restante() { const t = U.timer; if (!t) return null; const agora = t.pausadoEm || Date.now(); return Math.max(0, Math.ceil((t.fim - agora) / 1000)); }
  function beep() { try { const c = new (window.AudioContext || window.webkitAudioContext)(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 660; g.gain.value = .15; o.start(); setTimeout(() => { o.stop(); c.close(); }, 450); } catch (e) { /* mudo */ } }
  function tick() {
    const el = document.getElementById('relogio'); if (!el || !U.timer) return;
    const r = restante(); el.textContent = mmss(r);
    el.className = 'relogio' + (r === 0 ? ' fim' : r <= 15 ? ' pouco' : '');
    if (r === 0 && !U.timer.apitou) { U.timer.apitou = true; beep(); }
  }
  setInterval(tick, 250);

  // ---------- sincroniza estados de UI quando o motor muda ----------
  function pendKey() { const S = U.S, p = S.pend; return [S.rodada, S.fase, S.turno ? S.turno.idx : '', p ? p.tipo : '', p && p.segunda ? 's' : ''].join(':'); }
  function sync() {
    if (U.tela !== 'jogo' || !U.S) return;
    const k = pendKey(); if (k !== U.pk) { U.pk = k; U.votosTmp = []; U.votoIdx = 0; U.carta = null; U.parceiro = null; U.alvo = null; }
    syncTimer();
  }

  // ---------- peças visuais ----------
  const topoJogo = () => {
    const S = U.S;
    const fases = [['presidencia', 'Presidência'], ['crise', 'Crise'], ['debate', 'Debate'], ['troca', 'Troca'], ['jogar', 'Jogar e votar'], ['fecho', 'Resumo']];
    const idx = f => ({ presidencia: 0, crise: 1, debate: 2, troca: 3, jogar: 4, fecho: 5 }[f] ?? -1);
    const cur = idx(S.fase);
    const semCrise = !E.ehRodadaCrise(S.rodada);
    return `<div class="topo"><div class="tit">ASSEMBLEIA · ${esc(D.baralho.nome)}</div>
      <div class="rod">${[1, 2, 3, 4, 5].map(r => `<i class="${r === S.rodada ? 'cur' : r < S.rodada ? 'ok' : ''} ${E.ehRodadaCrise(r) ? 'crise' : ''}" title="Rodada ${r}${E.ehRodadaCrise(r) ? ' (crise nova)' : ''}">${r}</i>`).join('')}</div>
      <div class="fases">${S.fase === 'objetivos' ? '<span class="cur">Objetivos secretos</span>' : S.fase === 'fim' ? '<span class="cur">Fim da partida</span>' : fases.map(([f, n], i) => `<span class="${i === cur ? 'cur' : i < cur ? 'ok' : ''}" ${i === 1 && semCrise ? 'style="opacity:.35"' : ''}>${n}</span>`).join('')}</div>
      ${U.timer ? `<button class="relogio" id="relogio" data-a="pausa" title="Clique para pausar">${mmss(restante())}</button>` : ''}
      <div class="menu"><button class="btn sec" data-a="regras">Regras</button><button class="btn sec" data-a="diario">Diário</button><button class="btn sec" data-a="menuSair">Sair</button></div></div>`;
  };

  // Trilha em volta, como no tabuleiro impresso: 0 a 4 em cima, 5 e 6 à direita, 7 a 11 embaixo, 12 e 13 à esquerda (13 = META).
  function trilhaHTML() {
    const S = U.S;
    const lugar = i => i <= 4 ? [1, i + 1] : i <= 6 ? [i - 3, 5] : i <= 11 ? [4, 5 - (i - 7)] : [4 - (i - 11), 1]; // [linha, coluna]
    let cel = '';
    for (let i = 0; i <= R.TRILHA_MAX; i++) {
      const [l, c] = lugar(i);
      const k = i === 0 ? 'ini' : i === R.META ? 'meta' : i <= S.trilha ? 'ate' : '';
      cel += `<div class="casa ${k} ${i === S.trilha ? 'aqui' : ''}" style="grid-row:${l};grid-column:${c}"><span>${i === 0 ? 'INÍCIO' : i === R.META ? '★' : i}</span>${i === 0 || i === R.META ? '' : ''}${i === S.trilha ? `<b class="peao" title="Trilha mundial">${C.icone('world')}</b>` : ''}</div>`;
    }
    return `<div class="trilha">${cel}<div class="trilha-miolo"><small>TRILHA MUNDIAL</small><strong>${S.trilha}</strong><small>meta: casa ${R.META} ★</small></div></div>`;
  }

  function statusCrise(id) {
    const S = U.S; const h = S.crisesHist.find(c => c.id === id);
    if (h) return h.status; if (S.crise && S.crise.id === id) return 'aberta'; return null;
  }
  const ROT = { aberta: ['ABERTA', 'ouro'], resolvida: ['RESOLVIDA', 'verde'], atenuada: ['ATENUADA', 'ouro'], nao_resolvida: ['NÃO RESOLVIDA', 'verm'] };
  const chipStatus = st => st ? `<span class="chip ${ROT[st][1]}">${ROT[st][0]}</span>` : '<span class="chip">aguardando</span>';

  function painelCrise() {
    const S = U.S, c = S.crise;
    if (!c) {
      const ult = S.crisesHist[S.crisesHist.length - 1];
      return `<div class="painel"><h3>Crise</h3><p class="mudo">${ult ? `A crise "${esc(evt(ult.id).titulo)}" foi encerrada (${ROT[ult.status][0].toLowerCase()}).` : 'Nenhuma crise aberta ainda.'}</p></div>`;
    }
    const e = evt(c.id), t = E.totalAjudas(c);
    const ultima = E.ultimaRodadaDaCrise(S, c);
    return `<div class="painel"><h3>${C.icone(e.icone)} ${esc(e.titulo)}</h3>
      <div class="medidor"><span class="chip ${t >= e.n ? 'verde' : 'ouro'}">Ajudas: ${t} de ${e.n}</span>${c.penal ? `<span class="chip verm">${c.penal} tirada(s) por plano reprovado</span>` : ''}</div>
      <div class="peq mudo">Ajudaram: ${E.ajudantes(c).length ? E.ajudantes(c).map(i => nomeTxt(i) + (c.ajudas[i] > 1 ? ' (×2)' : '')).join(', ') : 'ninguém ainda'}</div>
      <p class="peq" style="margin:.5em 0 0">${ultima ? '<b style="color:var(--ouro)">Última chance:</b> ' + (S.rodada >= R.RODADAS ? 'a partida acaba nesta rodada.' : 'se não resolver nesta rodada, perde ' + Math.abs(R.PTS_NAO_RESOLVIDA) + ' casas.') + ' Com pelo menos 1 ajuda ela fica atenuada.' : 'Se não resolver agora, fica aberta mais 1 rodada.'}</p>
      <button class="btn sec peq" data-a="cartaModal" data-t="evento" data-id="${e.id}">Ver carta da crise</button></div>`;
  }

  function colDelegados() {
    const S = U.S, vez = S.fase === 'jogar' ? E.seatDaVez(S) : null;
    return `<div class="painel"><h3>Delegados</h3><div style="display:flex;flex-direction:column;gap:.55em;margin-top:.6em">${S.assentos.map(a => {
      const i = a.i, p = P(i);
      return `<button class="deleg ${vez === i ? 'vez' : ''}" data-a="cartaModal" data-t="pais" data-id="${p.id}">${flag(i, 'g')}
        <div><div class="nm">${i === S.presidente ? '<span class="coroa" title="Presidente da rodada">♛</span> ' : ''}${nome(i)}</div>
        <div class="forca" title="Força ${p.forca}">${[1, 2, 3, 4, 5, 6].map(k => `<b class="${k <= p.forca ? 'on' : ''}"></b>`).join('')}</div></div>
        <div><div class="pt ${S.pts[i] < 0 ? 'neg' : ''}" title="Pontos">${S.pts[i]}</div><div class="pips" title="Cartas de ação na mão">${Array.from({ length: E.maoMax(D, S, i) }, (_, k) => `<b class="${k < S.mao[i].length ? '' : 'v'}"></b>`).join('')}</div></div></button>`;
    }).join('')}</div><p class="mudo peq" style="margin:.7em 0 0">♛ presidente · pontinhos = força · barras = cartas na mão · número = pontos</p></div>`;
  }

  function mesaCartas() {
    const S = U.S; const fixa = D.eventos.find(e => e.tipo === 'fixa');
    const ultimaAleat = S.crise && S.crise.id !== fixa.id ? S.crise : S.crisesHist.filter(c => c.id !== fixa.id).slice(-1)[0];
    const atual = ultimaAleat ? evt(ultimaAleat.id) : null;
    const slot = (tit, corpo, extra = '') => `<div style="text-align:center">${corpo}<div class="peq mudo" style="margin-top:.4em">${tit}</div>${extra}</div>`;
    return `<div class="painel mesa-cartas" style="display:flex;gap:1.6em;justify-content:center;align-items:flex-start;padding:.8em">
      ${slot('Evento fixo', `<div data-a="cartaModal" data-t="evento" data-id="${fixa.id}" style="cursor:pointer">${C.evento(fixa, 104)}</div>`, `<div>${chipStatus(statusCrise(fixa.id))}</div>`)}
      ${slot(atual ? 'Crise sorteada' : 'Crise sorteada (rodadas 3 e 5)', atual ? `<div data-a="cartaModal" data-t="evento" data-id="${atual.id}" style="cursor:pointer">${C.evento(atual, 104)}</div>` : C.verso(104, '?'), `<div>${atual ? chipStatus(statusCrise(atual.id)) : ''}</div>`)}
      ${slot(`Baralho de crises (${S.crisePool.length})`, C.verso(104, 'CRISES'))}
      ${slot(`Ações: compra ${S.compra.length} · descarte ${S.descarte.length}`, C.verso(104, 'AÇÕES'))}</div>`;
  }

  // ---------- privacidade ----------
  const liberado = key => U.gateOk === key;
  function gate(key, seat, msg) {
    if (liberado(key)) return '';
    return `<div class="gate"><div class="caixa">${flag(seat, 'xg')}<h2>Passe a tela para<br>${nome(seat)}</h2>
      <p class="mudo">${msg || 'Só essa pessoa deve olhar a tela agora. Os outros olham para o lado.'}</p>
      <button class="btn grande" data-a="abrirGate" data-key="${key}">Sou eu — mostrar</button></div></div>`;
  }

  // ---------- telas ----------
  function telaInicio() {
    const salvo = carrega();
    const outros = [['Direitos Humanos', 'Em breve — depois que Economia estiver pronta'], ['Governança', 'Em breve'], ['Guerra', 'Fase 2'], ['Tecnologia', 'Fase 2'], ['Meio Ambiente', 'Fase 2']];
    return `<div class="tela"><div class="logo">ASSEMBLEIA</div>
      <p class="sub">Jogo de negociação diplomática no estilo das simulações da ONU. Cada jogador é um país. Cinco rodadas, uma crise para resolver, objetivos secretos e muita conversa. Partida de 30 a 45 minutos, numa tela só, passando a vez.</p>
      <div class="baralhos"><button class="bar ativo" data-a="iniciarDeck"><span class="tag">jogável (versão de teste)</span>${C.icone('coin', 'xg')}<h3>Economia</h3><div class="mudo peq">8 países · 11 crises · 24 ações · 10 objetivos</div></button>
      ${outros.map(([n, t]) => `<div class="bar off"><span class="tag">${t.startsWith('Fase') ? 'fase 2' : 'em breve'}</span><h3>${n}</h3><div class="mudo peq">${t}</div></div>`).join('')}</div>
      ${salvo && salvo.S && salvo.S.fase !== 'fim' ? `<p><button class="btn" data-a="continuar">Continuar partida salva (rodada ${salvo.S.rodada || 0})</button></p>` : ''}
      <p class="rodape-t">Versão de teste · textos e força dos países em revisão · <a style="color:var(--ouro)" href="../">cartas para imprimir</a></p></div>`;
  }

  function telaSetup() {
    const ordem = id => U.sel.indexOf(id) + 1;
    return `<div class="tela"><h1 style="font-size:2.2em;color:var(--ouro)">Escolha os 5 países da mesa</h1>
      <p class="sub">Clique em 5 países. A ordem do clique define os lugares na mesa (sentido horário). Países fortes jogam por último em cada rodada.</p>
      <div class="grade-paises">${D.paises.map(p => `<button class="pcard ${ordem(p.id) ? 'sel' : ''}" data-a="selPais" data-id="${p.id}">${ordem(p.id) ? `<span class="ordem">${ordem(p.id)}</span>` : ''}${C.bandeira(p, 'xg')}<b>${esc(p.nome)}</b><small>força ${p.forca}${p.provisorio ? ' (provisória)' : ''} · ${esc(p.figura)}</small></button>`).join('')}</div>
      <div style="display:flex;gap:.8em;margin:1em 0"><button class="btn sec" data-a="sortear">Sortear 5 países</button></div>
      <p class="mudo peq" style="margin:.3em 0">Nome de quem joga cada país (opcional):</p>
      <div class="nomes">${[0, 1, 2, 3, 4].map(i => `<div><div class="peq mudo">${U.sel[i] ? esc(E.porId(D.paises, U.sel[i]).nome) : 'Lugar ' + (i + 1)}</div><input data-i="${i}" maxlength="18" placeholder="nome" value="${esc(U.nomes[i])}"></div>`).join('')}</div>
      <div style="display:flex;gap:1em;align-items:center;margin:.6em 0"><span class="mudo">Relógio das fases:</span>
        <button class="opt ${U.relogio === 'aviso' ? 'sel' : ''}" data-a="relogio" data-v="aviso">Ligado (só avisa)</button><button class="opt ${U.relogio === 'off' ? 'sel' : ''}" data-a="relogio" data-v="off">Desligado</button></div>
      <div style="display:flex;gap:1em;margin-top:1em"><button class="btn sec" data-a="voltarInicio">Voltar</button><button class="btn grande" data-a="comecar" ${U.sel.length === 5 ? '' : 'disabled'}>Começar a partida</button></div></div>`;
  }

  function telaJogo() {
    const S = U.S;
    const esq = `<div class="painel">${trilhaHTML()}</div>${painelCrise()}<div class="painel"><h3>Últimos lances</h3><div class="diario">${S.log.slice(-8).reverse().map(l => `<div><span class="mudo">R${l.r}</span> ${esc(l.txt)}</div>`).join('') || '<span class="mudo">Nada ainda.</span>'}</div></div>`;
    return `${topoJogo()}<div class="mesa"><div class="col">${esq}</div><div class="centro-mesa">${S.fase === 'objetivos' ? '' : mesaCartas()}<div class="painel fase" id="painel">${painelFase()}</div></div><div class="col">${colDelegados()}</div></div>${gateAtual()}${modalHTML()}${U.toast ? `<div class="toast">${esc(U.toast)}</div>` : ''}`;
  }

  function gateAtual() {
    const S = U.S;
    if (S.fase === 'objetivos' && U.objIdx < 5) return gate('obj:' + U.objIdx, U.objIdx, 'Você vai ver seu objetivo secreto. Não mostre para ninguém!');
    if (S.fase === 'jogar' && !S.pend) { const seat = E.seatDaVez(S); if (seat != null) return gate(`mao:${S.rodada}:${S.turno.idx}`, seat, 'Você vai ver suas cartas de ação. Não mostre para ninguém!'); }
    if (S.pend && S.pend.tipo === 'troca' && !S.pend.resultado) return gate(`resp:${pendKey()}`, S.pend.parceiro, `${nomeTxt(S.pend.quem)} quer trocar uma carta com você.`);
    if (S.pend && S.pend.tipo === 'voto' && !S.pend.resultado && S.votoModo === 'fechado' && U.votoIdx < 5) return gate(`voto:${pendKey()}:${U.votoIdx}`, U.votoIdx, 'Voto fechado: só você vê a tela.');
    if (U.troca && U.troca.passo === 2) return gate('t2:' + U.troca.a, U.troca.a, 'Escolha a carta que você oferece.');
    if (U.troca && U.troca.passo === 3) return gate('t3:' + U.troca.b, U.troca.b, `${nomeTxt(U.troca.a)} fez uma oferta para você.`);
    return '';
  }

  // ---------- painéis de fase ----------
  function fila(ordemSeats, atual) {
    return `<div class="ordem-fala">${ordemSeats.map((i, k) => `<div class="ic ${i === atual ? 'vez' : (atual != null && k < ordemSeats.indexOf(atual)) ? 'feito' : ''}">${flag(i, 'g')}<span>${esc(nomeTxt(i))}</span></div>`).join('')}</div>`;
  }
  function painelFase() {
    const S = U.S;
    switch (S.fase) {
      case 'objetivos': return pObjetivos();
      case 'presidencia': return pPresidencia();
      case 'crise': return pCrise();
      case 'debate': return pDebate();
      case 'troca': return U.troca ? pTrocaFluxo() : pTroca();
      case 'jogar': return pJogar();
      case 'fecho': return pFecho();
      case 'fim': return pFim();
    }
    return '';
  }

  function pObjetivos() {
    const S = U.S;
    if (U.objIdx >= 5) return '';
    const i = U.objIdx, key = 'obj:' + i;
    if (!liberado(key)) return `<h2>Objetivos secretos</h2><p class="lead">Cada jogador recebe 1 carta de objetivo. Ela vale pontos no fim da partida e <b>ninguém mais vê</b>.</p>`;
    const o = E.porId(D.objetivos, S.objetivos[i]);
    return `<div style="display:flex;gap:2em;align-items:center;justify-content:center;height:100%">${C.objetivo(o, 300)}
      <div style="max-width:24em"><h2>${nome(i)}</h2><h3 style="font-size:1.5em;line-height:1.3">${esc(o.texto)}</h3><p class="lead">Vale <b>${o.pts} pontos</b> se você cumprir até o fim da rodada 5.</p>
      <p class="mudo">${o.verifica === 'manual' ? 'A mesa confirma no fim se você cumpriu.' : 'O jogo confere sozinho no fim.'}</p>
      <button class="btn grande" data-a="objProx">${i < 4 ? 'Guardei. Esconder e passar' : 'Guardei. Começar o jogo'}</button></div></div>`;
  }

  function pPresidencia() {
    const S = U.S, pr = S.presidente;
    return `<h2>Rodada ${S.rodada} · Presidência</h2>
      <div style="display:flex;gap:1.2em;align-items:center">${flag(pr, 'xg')}<div><div class="lead"><b>${nome(pr)}</b> é a presidente desta rodada.</div><div class="mudo">Ela abre a sessão e escolhe como a mesa vai votar nesta rodada.</div></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1em;max-width:46em">
        <button class="opt ${S.votoModo === 'aberto' ? 'sel' : ''}" data-a="modo" data-v="aberto"><b>Voto aberto</b><br><span class="mudo">Todos votam na frente de todos. Dá para negociar apoio.</span></button>
        <button class="opt ${S.votoModo === 'fechado' ? 'sel' : ''}" data-a="modo" data-v="fechado"><b>Voto fechado</b><br><span class="mudo">Cada um vota em segredo. Ninguém sabe quem apoiou.</span></button></div>
      <div class="acoes"><button class="btn grande" data-a="avancar" ${S.votoModo ? '' : 'disabled'}>${E.ehRodadaCrise(S.rodada) ? 'Revelar a crise →' : 'Abrir o debate →'}</button>${S.votoModo ? '' : '<span class="mudo">Escolha o tipo de voto para continuar.</span>'}</div>`;
  }

  function pCrise() {
    const S = U.S, e = evt(S.crise.id);
    return `<h2>Rodada ${S.rodada} · Crise revelada</h2>
      <div style="display:flex;gap:1.6em;align-items:flex-start"><div data-a="cartaModal" data-t="evento" data-id="${e.id}" style="cursor:pointer">${C.evento(e, 250, 'vira')}</div>
      <div style="flex:1"><h3 style="font-size:1.6em">${esc(e.titulo)} ${e.titulo.includes(e.ano) ? '' : `<span class="mudo">${esc(e.ano)}</span>`}</h3><p class="lead">${esc(e.descricao)}</p>
        <p><b style="color:var(--ouro)">Para resolver (+${e.pts_resolver}):</b> ${esc(e.requisito)}</p><p><b style="color:var(--ouro)">Para atenuar (+${e.pts_atenuar}):</b> ${esc(e.requisito_atenuar)}</p>
        <p class="peq"><b>Como fazer no jogo:</b> as cartas de ação <b>média</b> e <b>pesada</b> aprovadas em voto são <b>ajudas</b>. Precisa de <b>${e.n} ajudas</b> para resolver; com 1 ou mais fica atenuada.</p>
        <p class="mudo peq">Resolva até o fim da próxima rodada. Se não resolver: −${Math.abs(R.PTS_NAO_RESOLVIDA)} casas na trilha.</p></div></div>
      <div class="acoes"><button class="btn grande" data-a="avancar">Abrir o debate →</button></div>`;
  }

  function pDebate() {
    const S = U.S, ord = E.ordemJogo(D, S), c = S.crise, e = c ? evt(c.id) : null;
    return `<h2>Rodada ${S.rodada} · Debate</h2>
      <p class="lead">Cada país fala, <b>do mais fraco ao mais forte</b>. Conversem, negociem votos e combinem quem vai ajudar a crise.</p>${fila(ord)}
      ${e ? `<div><b style="color:var(--ouro)">${esc(e.titulo)} — pontos de debate:</b><ul class="topicos">${e.topicos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="peq mudo">Para resolver: ${esc(e.requisito)} (${e.n} ajudas)</div></div>` : '<p class="mudo">Nenhuma crise aberta nesta rodada. Aproveitem para negociar, trocar cartas e se preparar.</p>'}
      <div class="acoes"><button class="btn grande" data-a="avancar">Encerrar debate →</button></div>`;
  }

  function pTroca() {
    const S = U.S;
    return `<h2>Rodada ${S.rodada} · Troca de cartas</h2>
      <p class="lead">Quem quiser pode trocar uma carta de ação com outro país. Negociem em voz alta, depois registrem aqui.</p>
      <div><button class="btn" data-a="trocaIni">Registrar uma troca</button></div>
      <div class="painel"><b>Trocas desta rodada:</b> ${S.trocas.length ? S.trocas.map(t => `<span class="chip">${flag(t.a)} ⇄ ${flag(t.b)}</span>`).join(' ') : '<span class="mudo">nenhuma ainda</span>'}</div>
      <div class="acoes"><button class="btn grande" data-a="avancar">Encerrar trocas →</button></div>`;
  }

  function pTrocaFluxo() {
    const S = U.S, t = U.troca;
    if (t.passo === 1) {
      return `<h2>Registrar troca</h2><p class="lead">Quem oferece uma carta?</p><div class="flags-sel">${S.assentos.map(a => `<button class="opt ${t.a === a.i ? 'sel' : ''}" data-a="trocaA" data-s="${a.i}">${flag(a.i)} ${nome(a.i)}</button>`).join('')}</div>
        <p class="lead">Com quem?</p><div class="flags-sel">${S.assentos.map(a => `<button class="opt ${t.b === a.i ? 'sel' : ''}" data-a="trocaB" data-s="${a.i}" ${t.a === a.i ? 'disabled' : ''}>${flag(a.i)} ${nome(a.i)}</button>`).join('')}</div>
        <div class="acoes"><button class="btn sec" data-a="trocaCancelar">Cancelar</button><button class="btn grande" data-a="trocaPasso2" ${t.a != null && t.b != null ? '' : 'disabled'}>Continuar →</button></div>`;
    }
    if (t.passo === 2) {
      if (!liberado('t2:' + t.a)) return `<h2>Registrar troca</h2><p class="mudo">Aguardando ${nome(t.a)}…</p>`;
      return `<h2>${nome(t.a)}: que carta você oferece?</h2><div class="hand">${S.mao[t.a].map(id => `<div class="carta-w" data-a="trocaCartaA" data-id="${id}">${C.acao(carta(id), 170, t.cartaA === id ? 'sel' : '')}</div>`).join('')}</div>
        <div class="acoes"><button class="btn sec" data-a="trocaCancelar">Cancelar</button><button class="btn grande" data-a="trocaOferecer" ${t.cartaA ? '' : 'disabled'}>Oferecer para ${esc(nomeTxt(t.b))} →</button></div>`;
    }
    if (!liberado('t3:' + t.b)) return `<h2>Registrar troca</h2><p class="mudo">Aguardando ${nome(t.b)}…</p>`;
    return `<h2>${nome(t.b)}: ${esc(nomeTxt(t.a))} oferece esta carta</h2><div style="display:flex;gap:2em;align-items:flex-start"><div>${C.acao(carta(t.cartaA), 190)}</div>
      <div><p class="lead">Aceita? Então escolha uma das suas cartas para dar em troca:</p><div class="hand">${S.mao[t.b].map(id => `<div data-a="trocaCartaB" data-id="${id}">${C.acao(carta(id), 150, t.cartaB === id ? 'sel' : '')}</div>`).join('')}</div></div></div>
      <div class="acoes"><button class="btn nao" data-a="trocaRecusar">Recusar</button><button class="btn sim grande" data-a="trocaAceitar" ${t.cartaB ? '' : 'disabled'}>Aceitar a troca</button></div>`;
  }

  // descrição legível dos efeitos de uma carta (números em Engine.R; habilidades do país entram por cima)
  function efeitoJogo(a) {
    const seatsHab = U.S ? U.S.assentos.map(x => x.i).filter(i => P(i).id === a.pais) : [];
    const extra = seatsHab.length ? hab(seatsHab[0]) : {};
    if (a.tipo === 'troca') return `<b>No jogo:</b> escolha um país. Se ele aceitar, vocês trocam cartas e você ganha <b>+${R.LEVE_PTS} ponto</b>.${extra.leve_auto ? ' (Mesmo se recusar, o ponto é seu: habilidade do país.)' : ''} Não precisa de crise aberta.`;
    if (a.tipo === 'media') return `<b>No jogo:</b> escolha um parceiro e a mesa vota. Aprovada: <b>${extra.peso2 ? '2 ajudas' : '1 ajuda'}</b> na crise (e o parceiro conta como "acordo fechado"). Se a crise acabar resolvida ou atenuada, cada país que ajudou ganha +${R.PTS_AJUDANTE} ponto.`;
    return `<b>No jogo:</b> custa <b>${R.PESADA_CUSTO} ponto</b> agora (pode virar dívida) e a mesa vota. Aprovada: devolve o custo, <b>+${R.PESADA_PTS} pontos</b> e <b>${R.AJUDA_PESADA} ajudas</b> na crise. Reprovada: perde o custo${extra.seguro ? ' (menos você: habilidade do país)' : extra.inflacao ? ' em dobro (fraqueza do país)' : ''} e tira ${R.PESADA_REPROVADA_TIRA} ajuda da crise.`;
  }
  const hab = i => P(i).modelo || {};

  function pJogar() {
    const S = U.S, seat = E.seatDaVez(S), p = S.pend;
    const cab = `<h2>Rodada ${S.rodada} · Jogar cartas</h2>${fila(S.turno.ordem, p ? p.quem ?? seat : seat)}`;
    if (p && p.tipo === 'voto') return cab + pVoto(p);
    if (p && p.tipo === 'troca') return cab + pTrocaLeve(p);
    if (seat == null) return cab;
    const key = `mao:${S.rodada}:${S.turno.idx}`;
    if (!liberado(key)) return cab + `<p class="lead">Vez de <b>${nome(seat)}</b>…</p>`;
    const mao = S.mao[seat], sel = U.carta ? carta(U.carta) : null;
    const semCrise = !S.crise;
    const precisaParceiro = sel && (sel.tipo === 'troca' || sel.tipo === 'media');
    const ok = sel && !E.podeJogar(D, S, seat, sel.id) && (!precisaParceiro || U.parceiro != null);
    const escolha = (campo, rot) => `<div><div class="mudo">${rot}</div><div class="flags-sel">${S.assentos.filter(a => a.i !== seat).map(a => `<button class="opt ${U[campo] === a.i ? 'sel' : ''}" data-a="sel_${campo}" data-s="${a.i}">${flag(a.i)} ${esc(nomeTxt(a.i))}</button>`).join('')}</div></div>`;
    return `${cab}<p class="lead"><b>${nome(seat)}</b>, escolha uma carta para jogar — ou passe a vez.${semCrise ? ' <span class="mudo">(Sem crise aberta: só cartas leves.)</span>' : ''}</p>
      <div class="jogada"><div class="hand">${mao.map(id => { const c = carta(id); const bloq = E.podeJogar(D, S, seat, id); return `<div data-a="selCarta" data-id="${id}" ${bloq ? 'title="' + esc(bloq) + '"' : ''}>${C.acao(c, 150, (U.carta === id ? 'sel ' : '') + (bloq ? 'bloq' : ''))}</div>`; }).join('') || '<span class="mudo">Você está sem cartas.</span>'}</div>
      <div class="lado">${sel ? `<div class="painel" style="font-size:1em"><b style="color:var(--ouro)">${esc(sel.nome)}</b> <span class="chip">${sel.tier}</span><p style="margin:.4em 0">${esc(sel.efeito)}</p><div class="peq">${efeitoJogo(sel)}</div></div>` : `<div class="painel peq">${mao.map(id => { const c = carta(id); return `<p style="margin:.2em 0 .6em"><b style="color:var(--ouro)">${esc(c.nome)}</b> <span class="chip">${c.tier}</span><br>${esc(c.efeito)}</p>`; }).join('')}<span class="mudo">Clique numa carta para escolher.</span></div>`}
        ${precisaParceiro ? escolha('parceiro', sel.tipo === 'troca' ? 'Com quem trocar?' : 'Qual país fecha o acordo com você?') : ''}
        <div class="acoes"><button class="btn grande" data-a="jogar" ${ok ? '' : 'disabled'}>Jogar carta</button><button class="btn sec" data-a="passar">Passar a vez</button></div></div></div>`;
  }

  function pTrocaLeve(p) {
    const S = U.S, c = carta(p.carta);
    if (p.resultado) return `<div class="resultado ${p.resultado.aceita ? 'ok' : 'no'}">${p.resultado.aceita ? 'Troca aceita!' : 'Troca recusada'}</div>
      <p class="centro lead">${p.resultado.aceita ? `${nome(p.quem)} ganha <b>+${p.resultado.ponto} ponto${p.resultado.ponto > 1 ? 's' : ''}</b>. As cartas mudaram de mão.` : `${nome(p.parceiro)} recusou. A carta continua com ${nome(p.quem)}.${p.resultado.ponto ? ` Mesmo assim ${nome(p.quem)} ganha <b>+${p.resultado.ponto}</b> (habilidade do país).` : ''}`}</p>
      <div class="acoes" style="justify-content:center"><button class="btn grande" data-a="trocaOk">Continuar →</button></div>`;
    const key = `resp:${pendKey()}`;
    if (!liberado(key)) return `<p class="lead">${nome(p.quem)} oferece "${esc(c.nome)}" para ${nome(p.parceiro)}…</p>`;
    return `<p class="lead"><b>${nome(p.quem)}</b> oferece esta carta para <b>${nome(p.parceiro)}</b>. Se aceitar, escolha uma das suas para dar em troca.</p>
      <div style="display:flex;gap:2em;align-items:flex-start"><div>${C.acao(c, 180)}</div><div class="hand">${S.mao[p.parceiro].map(id => `<div data-a="respCarta" data-id="${id}">${C.acao(carta(id), 150, U.carta === id ? 'sel' : '')}</div>`).join('')}</div></div>
      <div class="acoes"><button class="btn nao" data-a="respRecusa">Recusar</button><button class="btn sim grande" data-a="respAceita" ${U.carta ? '' : 'disabled'}>Aceitar a troca</button></div>`;
  }

  // ---------- votação ----------
  function pVoto(p) {
    const S = U.S; if (!p) return '';
    const c = carta(p.carta), tit = `${nomeTxt(p.quem)} propõe: ${c.nome}`;
    const cab = `<h3 style="font-size:1.4em">${esc(tit)}</h3><p class="lead">${esc(c.efeito)}</p><p class="peq mudo">${efeitoJogo(c)}${p.parceiro != null ? ` Parceiro: ${esc(nomeTxt(p.parceiro))}.` : ''}</p>`;
    if (p.resultado) {
      const r = p.resultado, aberto = S.votoModo !== 'fechado';
      return `${cab}<div class="resultado ${r.aprovado ? 'ok' : 'no'}">${r.aprovado ? 'APROVADO' : 'REPROVADO'} · ${r.sim} × ${r.nao}</div>${r.votoExtra ? '<p class="centro lead">Grécia usou o <b>voto extra</b> (1 vez por partida) e virou o resultado.</p>' : ''}
        ${aberto ? `<div class="flags-sel" style="justify-content:center">${S.assentos.map(a => `<span class="chip ${p.votos[a.i] ? 'verde' : 'verm'}">${flag(a.i)} ${esc(nomeTxt(a.i))}: ${p.votos[a.i] ? 'sim' : 'não'}</span>`).join('')}</div>` : '<p class="centro mudo">Voto fechado: só o total aparece.</p>'}
        <div class="acoes" style="justify-content:center"><button class="btn grande" data-a="votoOk">Continuar →</button></div>`;
    }
    if (S.votoModo === 'fechado') {
      const i = U.votoIdx; if (i >= 5) return cab;
      if (!liberado(`voto:${pendKey()}:${i}`)) return `${cab}<p class="lead">Votando em segredo: ${i} de 5…</p>`;
      return `${cab}<div style="display:flex;gap:1.2em;align-items:center">${flag(i, 'xg')}<div class="lead"><b>${nome(i)}</b>, como você vota?</div></div>
        <div class="acoes"><button class="btn sim grande" data-a="votoSeat" data-v="1">Sim</button><button class="btn nao grande" data-a="votoSeat" data-v="0">Não</button></div>`;
    }
    const todos = S.assentos.every(a => U.votosTmp[a.i] != null);
    return `${cab}<div class="painel">${S.assentos.map(a => `<div class="voto-linha"><div class="nm">${flag(a.i)} ${nome(a.i)}</div>
        <button class="btn sim ${U.votosTmp[a.i] === true ? 'sel' : ''}" data-a="votoTmp" data-s="${a.i}" data-v="1">Sim</button><button class="btn nao ${U.votosTmp[a.i] === false ? 'sel' : ''}" data-a="votoTmp" data-s="${a.i}" data-v="0">Não</button></div>`).join('')}</div>
      <div class="acoes"><span class="mudo">Voto aberto: cada país diz em voz alta e alguém marca aqui.</span><button class="btn grande" data-a="votoEnviar" ${todos ? '' : 'disabled'}>Contar votos</button></div>`;
  }

  function pFecho() {
    const S = U.S, r = S.resumo || {};
    const cr = r.crise;
    const linhas = S.assentos.map(a => ({ i: a.i, d: S.pts[a.i] - (r.ptsAntes ? r.ptsAntes[a.i] : 0) }));
    return `<h2>Fim da rodada ${S.rodada}</h2>
      ${cr ? `<div class="resultado ${cr.status === 'nao_resolvida' ? 'no' : 'ok'}" style="font-size:2em">${esc(evt(cr.id).titulo)}: ${ROT[cr.status][0]}</div>` : (S.crise ? `<p class="lead">A crise "<b>${esc(evt(S.crise.id).titulo)}</b>" continua aberta para a próxima rodada. Ajudas até agora: <b>${E.totalAjudas(S.crise)} de ${evt(S.crise.id).n}</b>.</p>` : '<p class="lead mudo">Nenhuma crise aberta.</p>')}
      <p class="lead">Trilha mundial: <b>${r.trilhaAntes} → ${r.trilhaDepois}</b> (meta ${R.META}) ${r.trilhaDepois >= R.META ? '★ META atingida!' : ''}</p>
      <div class="flags-sel">${linhas.map(l => `<span class="chip">${flag(l.i)} ${esc(nomeTxt(l.i))}: <b>${S.pts[l.i]}</b> ${l.d ? `<span class="dif ${l.d < 0 ? 'neg' : ''}">(${sinal(l.d)})</span>` : ''}</span>`).join('')}</div>
      <div class="acoes"><button class="btn grande" data-a="avancar">${S.rodada >= R.RODADAS ? 'Ver resultado final →' : 'Próxima rodada →'}</button></div>`;
  }

  function pFim() {
    const S = U.S, F = S.final;
    const linhas = F.ranking.map(i => F.linhas.find(l => l.seat === i));
    if (!U.revelado) return `<h2>Fim da partida</h2>
      <p class="lead">Trilha mundial: <b>${S.trilha}</b> de ${R.META}. ${F.meta ? '★ A mesa atingiu a META: todos ganham +' + R.BONUS_META + ' pontos.' : 'A mesa não atingiu a META. Sem bônus, mas o jogo ainda tem um vencedor.'}</p>
      <p class="lead">Hora de revelar os objetivos secretos.</p><div class="acoes"><button class="btn grande" data-a="revelar">Revelar objetivos</button></div>`;
    const topo = F.vencedores;
    return `<h2>Resultado final</h2><div class="resultado ok" style="font-size:2.2em">${topo.length > 1 ? 'Empate: ' : 'Vencedor: '}${topo.map(i => esc(nomeTxt(i))).join(' e ')}</div>
      <table class="tabela"><tr><th>País</th><th>Pontos</th><th>Objetivo secreto</th><th>+Obj</th><th>+Meta</th><th>Total</th></tr>
      ${linhas.map(l => `<tr style="${topo.includes(l.seat) ? 'background:rgba(232,194,122,.14)' : ''}"><td>${flag(l.seat)} ${nome(l.seat)}</td><td>${l.base}</td>
        <td class="peq">${esc(l.objetivo.texto)}<br>${l.objetivo.verifica === 'manual' ? `<span class="mudo">A mesa confirma:</span> <button class="btn sim peq ${S.objManual[l.seat] ? 'sel' : ''}" data-a="confObj" data-s="${l.seat}" data-v="1">Cumpriu</button> <button class="btn nao peq ${S.objManual[l.seat] === false ? 'sel' : ''}" data-a="confObj" data-s="${l.seat}" data-v="0">Não</button>` : (l.cumpriu ? '<b class="dif">cumprido</b>' : '<b class="dif neg">não cumprido</b>')}</td>
        <td>${sinal(l.pontosObj)}</td><td>${sinal(l.bonus)}</td><td><b style="font-size:1.3em;color:var(--ouro)">${l.total}</b></td></tr>`).join('')}</table>
      <p class="peq mudo">Empate: vence quem ajudou a resolver mais crises; se continuar empatado, dividem a vitória.</p>
      <div class="acoes"><button class="btn grande" data-a="jogarNovo">Jogar de novo</button><button class="btn sec" data-a="menuSair">Menu inicial</button></div>`;
  }

  // ---------- modal ----------
  function modalHTML() {
    const m = U.modal; if (!m) return '';
    let corpo = '';
    if (m.t === 'regras') corpo = `<div class="ficha" style="max-width:46em"><h2>Como jogar (resumo)</h2>
      <p>Cada jogador é um <b>país</b> e recebe um <b>objetivo secreto</b>. A mesa toda tenta resolver <b>crises</b> reais da história da economia, negociando como numa simulação da ONU.</p>
      <ol style="padding-left:1.2em;line-height:1.5"><li><b>Presidência</b> (muda a cada rodada): escolhe voto aberto ou fechado.</li><li><b>Crise</b> (rodadas 1, 3 e 5): uma carta de crise é revelada.</li><li><b>Debate</b>: fala do país mais fraco ao mais forte.</li><li><b>Troca</b>: países trocam cartas de ação.</li><li><b>Jogar e votar</b>: do mais fraco ao mais forte, cada país joga 1 carta de ação (ou passa).</li></ol>
      <p><b>Cartas de ação:</b></p><ul style="line-height:1.5"><li><b>Leve</b> (troca): oferece uma carta a outro país. Aceitou: +${R.LEVE_PTS} ponto para quem ofereceu.</li><li><b>Média</b> (acordo): a mesa vota. Aprovada = <b>1 ajuda</b> na crise.</li><li><b>Pesada</b> (plano caro): paga ${R.PESADA_CUSTO} ponto (pode virar dívida) e a mesa vota. Aprovada: devolve o custo, +${R.PESADA_PTS} pontos e <b>2 ajudas</b>. Reprovada: perde o custo e tira 1 ajuda.</li></ul>
      <p><b>Crise:</b> com as <b>ajudas</b> pedidas pela carta (2 ou 3) ela é <b>resolvida</b> (+5 na trilha); com 1 ou mais ao fim do prazo, <b>atenuada</b> (+3). Não resolvida: −${Math.abs(R.PTS_NAO_RESOLVIDA)}. Cada país que ajudou ganha +${R.PTS_AJUDANTE} ponto. A crise dura a rodada em que aparece e mais uma.</p>
      <p>Se a trilha chegar à casa <b>${R.META}</b> até o fim da rodada 5, todos ganham +${R.BONUS_META} pontos. Vence quem tiver mais <b>pontos individuais</b> (ajudas, trocas, objetivo secreto, bônus). Dá para ganhar sozinho mesmo sem a META.</p></div>`;
    else if (m.t === 'diario') corpo = `<div class="ficha" style="max-width:44em"><h2>Diário da mesa</h2>${U.S.log.slice().reverse().map(l => `<div class="peq"><span class="mudo">R${l.r}</span> ${esc(l.txt)}</div>`).join('') || '<p class="mudo">Nada ainda.</p>'}</div>`;
    else if (m.t === 'sair') corpo = `<div class="ficha"><h2>Sair da partida?</h2><p>A partida fica salva neste navegador e dá para continuar depois.</p><div class="acoes"><button class="btn grande" data-a="voltarInicio">Menu inicial</button><button class="btn nao" data-a="descartar">Apagar partida</button></div></div>`;
    else if (m.t === 'pais') { const p = E.porId(D.paises, m.id); corpo = `${C.pais(p, 380)}<div class="ficha"><h2>${esc(p.nome)}</h2><dl><dt>Força</dt><dd>${p.forca} de 6 ${p.provisorio ? '(provisória)' : ''}</dd><dt>Capital</dt><dd>${esc(p.capital)}</dd><dt>Moeda</dt><dd>${esc(p.moeda)}</dd><dt>Sistema</dt><dd>${esc(p.sistema)}</dd><dt>Figura</dt><dd>${esc(p.figura)}</dd></dl><p>${esc(p.resumo)}</p><b>Habilidades</b><ul>${p.habilidades.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>`; }
    else if (m.t === 'evento') { const e = evt(m.id); corpo = `${C.evento(e, 380)}<div class="ficha"><h2>${esc(e.titulo)} ${e.titulo.includes(e.ano) ? '' : `<span class="mudo">${esc(e.ano)}</span>`}</h2><p>${esc(e.descricao)}</p><b>Tópicos de debate</b><ul>${e.topicos.map(t => `<li>${esc(t)}</li>`).join('')}</ul><p><b>Para resolver (+${e.pts_resolver}):</b> ${esc(e.requisito)}</p><p><b>Para atenuar (+${e.pts_atenuar}):</b> ${esc(e.requisito_atenuar)}</p><p class="mudo peq">Resolve com ${e.n} ajudas (cartas média ou pesada aprovadas em voto). Com 1 ou mais fica atenuada.</p></div>`; }
    return `<div class="modal" data-a="fecharModal"><div class="conteudo" data-a="nada">${corpo}<button class="fechar" data-a="fecharModal" aria-label="Fechar">×</button></div></div>`;
  }

  // ---------- ações da interface ----------
  const H = {
    nada() {},
    iniciarDeck() { U.tela = 'setup'; U.sel = []; },
    voltarInicio() { U.tela = 'inicio'; U.modal = null; },
    selPais(d) { const i = U.sel.indexOf(d.id); if (i >= 0) U.sel.splice(i, 1); else if (U.sel.length < 5) U.sel.push(d.id); },
    sortear() { const ids = D.paises.map(p => p.id); const s = { rng: (Math.random() * 4294967296) >>> 0 }; U.sel = E.embaralha(s, ids).slice(0, 5); },
    relogio(d) { U.relogio = d.v; },
    comecar() {
      if (U.sel.length !== 5) return;
      U.S = E.novoJogo(D, { paises: U.sel, nomes: U.nomes, relogio: U.relogio });
      U.tela = 'jogo'; U.objIdx = 0; U.gateOk = null; U.revelado = false; U.timerKey = null; U.pk = ''; U.troca = null; salva();
    },
    continuar() { const s = carrega(); if (s && s.S) { U.S = s.S; U.tela = 'jogo'; U.objIdx = U.S.fase === 'objetivos' ? 0 : 5; U.gateOk = null; U.revelado = false; U.timerKey = null; U.pk = ''; U.troca = null; } },
    abrirGate(d) { U.gateOk = d.key; },
    objProx() { U.objIdx++; U.gateOk = null; if (U.objIdx >= 5) A({ tipo: 'objetivos_ok' }); },
    modo(d) { A({ tipo: 'voto_modo', modo: d.v }); },
    avancar() { A({ tipo: 'avancar' }); },
    pausa() { const t = U.timer; if (!t) return; if (t.pausadoEm) { t.fim += Date.now() - t.pausadoEm; t.pausadoEm = null; } else t.pausadoEm = Date.now(); },
    cartaModal(d) { U.modal = { t: d.t, id: d.id }; },
    regras() { U.modal = { t: 'regras' }; }, diario() { U.modal = { t: 'diario' }; }, menuSair() { U.modal = { t: 'sair' }; },
    fecharModal(d, ev) { if (ev.target.closest('.conteudo') && !ev.target.classList.contains('fechar')) return; U.modal = null; },
    descartar() { limpa(); U.S = null; U.tela = 'inicio'; U.modal = null; },
    // troca (fase de troca)
    trocaIni() { U.troca = { passo: 1, a: null, b: null, cartaA: null, cartaB: null }; },
    trocaA(d) { U.troca.a = +d.s; if (U.troca.b === +d.s) U.troca.b = null; }, trocaB(d) { U.troca.b = +d.s; },
    trocaPasso2() { U.troca.passo = 2; U.gateOk = null; },
    trocaCartaA(d) { U.troca.cartaA = d.id; },
    trocaOferecer() { U.troca.passo = 3; U.gateOk = null; },
    trocaCartaB(d) { U.troca.cartaB = d.id; },
    trocaAceitar() { const t = U.troca; U.troca = null; U.gateOk = null; A({ tipo: 'trocar', a: t.a, b: t.b, cartaA: t.cartaA, cartaB: t.cartaB }); toast('Troca registrada.'); },
    trocaRecusar() { U.troca = null; U.gateOk = null; toast('Troca recusada.'); },
    trocaCancelar() { U.troca = null; U.gateOk = null; },
    // jogar
    selCarta(d) { const seat = E.seatDaVez(U.S); if (E.podeJogar(D, U.S, seat, d.id)) { toast(E.podeJogar(D, U.S, seat, d.id)); return; } U.carta = d.id; U.parceiro = null; U.alvo = null; },
    sel_parceiro(d) { U.parceiro = +d.s; }, sel_alvo(d) { U.alvo = +d.s; },
    jogar() { const seat = E.seatDaVez(U.S); A({ tipo: 'jogar', seat, carta: U.carta, parceiro: U.parceiro, alvo: U.alvo }); U.carta = null; },
    passar() { A({ tipo: 'passar' }); },
    respCarta(d) { U.carta = d.id; },
    respAceita() { A({ tipo: 'resposta_troca', aceita: true, cartaDevolve: U.carta }); U.carta = null; },
    respRecusa() { A({ tipo: 'resposta_troca', aceita: false }); },
    trocaOk() { A({ tipo: 'troca_ok' }); },
    // votos
    votoTmp(d) { U.votosTmp[+d.s] = d.v === '1'; },
    votoEnviar() { A({ tipo: 'votar', votos: U.S.assentos.map(a => U.votosTmp[a.i]) }); },
    votoSeat(d) { const i = U.votoIdx; U.votoIdx++; U.gateOk = null; A({ tipo: 'votar', seat: i, voto: d.v === '1' }); },
    votoOk() { A({ tipo: 'voto_ok' }); },
    revelar() { U.revelado = true; },
    confObj(d) { A({ tipo: 'confirmar_objetivo', seat: +d.s, cumpriu: d.v === '1' }); },
    jogarNovo() { limpa(); U.S = null; U.tela = 'setup'; U.sel = []; },
  };
  // as ações que mexem só na interface não passam por A(): re-renderiza aqui
  document.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]'); if (!el) return;
    const f = H[el.dataset.a]; if (!f) return;
    f(el.dataset, ev); render();
  });
  document.addEventListener('input', ev => { const i = ev.target.dataset && ev.target.dataset.i; if (i != null && ev.target.tagName === 'INPUT') U.nomes[+i] = ev.target.value; });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && U.modal) { U.modal = null; render(); } });

  function render() {
    sync();
    const foco = document.activeElement && document.activeElement.tagName === 'INPUT' ? [document.activeElement.dataset.i, document.activeElement.selectionStart] : null;
    $app.innerHTML = U.tela === 'inicio' ? telaInicio() + modalHTML() : U.tela === 'setup' ? telaSetup() : telaJogo();
    if (foco) { const el = $app.querySelector(`input[data-i="${foco[0]}"]`); if (el) { el.focus(); try { el.setSelectionRange(foco[1], foco[1]); } catch (e) { /* ok */ } } }
    tick();
  }
  window.__jogo = { U, E, D, A, render };
  render();
})();
