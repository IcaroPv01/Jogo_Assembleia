// Simulação com bots no motor (sem interface). Uso: node test/sim.js [partidas=500] [pSim=0.65]
// Confere regras (invariantes) e imprime estatísticas de equilíbrio (insumo para o Módulo 8).
const E = require('../js/engine.js');
const D = require('../dados/economia.js');
const N = +process.argv[2] || 500, PSIM = +process.argv[3] || 0.65;

function jogaPartida(seed) {
  const s = E.novoJogo(D, { paises: E.embaralha({ rng: seed }, D.paises.map(p => p.id)).slice(0, 5), seed });
  const r = () => E.rnd(s);
  const A = a => { const x = E.acao(D, s, a); if (!x.ok) throw new Error(`${a.tipo}: ${x.erro} (fase ${s.fase})`); };
  let guarda = 0;
  while (s.fase !== 'fim') {
    if (++guarda > 3000) throw new Error('loop infinito na fase ' + s.fase);
    // invariante: 24 cartas no total
    const total = s.mao.reduce((n, m) => n + m.length, 0) + s.compra.length + s.descarte.length;
    if (total !== 24) throw new Error('cartas perdidas: ' + total);
    if (s.trilha < 0 || s.trilha > E.R.TRILHA_MAX) throw new Error('trilha fora');
    const p = s.pend;
    if (p && p.tipo === 'voto') {
      if (!p.resultado) A({ tipo: 'votar', votos: s.assentos.map(() => r() < PSIM) });
      else A({ tipo: 'voto_ok' });
      continue;
    }
    if (p && p.tipo === 'troca') {
      if (!p.resultado) {
        const aceita = r() < 0.7 && s.mao[p.parceiro].length > 0;
        A({ tipo: 'resposta_troca', aceita, cartaDevolve: aceita ? s.mao[p.parceiro][0] : null });
      } else A({ tipo: 'troca_ok' });
      continue;
    }
    switch (s.fase) {
      case 'objetivos': A({ tipo: 'objetivos_ok' }); break;
      case 'presidencia': A({ tipo: 'voto_modo', modo: r() < 0.5 ? 'aberto' : 'fechado' }); A({ tipo: 'avancar' }); break;
      case 'troca': {
        for (let k = 0; k < 2; k++) {
          const a = Math.floor(r() * 5), b = (a + 1 + Math.floor(r() * 4)) % 5;
          if (s.mao[a].length && s.mao[b].length && r() < 0.6) A({ tipo: 'trocar', a, b, cartaA: s.mao[a][0], cartaB: s.mao[b][0] });
        }
        A({ tipo: 'avancar' }); break;
      }
      case 'jogar': {
        const seat = E.seatDaVez(s);
        const jogaveis = s.mao[seat].filter(c => !E.podeJogar(D, s, seat, c));
        if (!jogaveis.length || r() < 0.25) { A({ tipo: 'passar' }); break; }
        const carta = jogaveis[Math.floor(r() * jogaveis.length)];
        const parceiro = (seat + 1 + Math.floor(r() * 4)) % 5;
        A({ tipo: 'jogar', seat, carta, parceiro, alvo: parceiro });
        break;
      }
      case 'fecho': case 'crise': case 'debate': A({ tipo: 'avancar' }); break;
      default: throw new Error('fase inesperada ' + s.fase);
    }
  }
  return s;
}

const st = { jogos: 0, meta: 0, trilha: 0, res: 0, aten: 0, nao: 0, vit: 0, obj: {}, objn: {}, totais: 0, rod: 0, forcaVit: Array(7).fill(0), forcaN: Array(7).fill(0) };
for (let i = 0; i < N; i++) {
  const s = jogaPartida(1000 + i);
  st.jogos++; st.trilha += s.trilha; if (s.final.meta) st.meta++;
  for (const c of s.crisesHist) { if (c.status === 'resolvida') st.res++; else if (c.status === 'atenuada') st.aten++; else st.nao++; }
  for (const l of s.final.linhas) {
    st.totais += l.total; st.objn[l.objetivo.id] = (st.objn[l.objetivo.id] || 0) + 1; if (l.cumpriu) st.obj[l.objetivo.id] = (st.obj[l.objetivo.id] || 0) + 1;
    const f = E.paisDe(D, s, l.seat).forca; st.forcaN[f]++; if (s.final.vencedores.includes(l.seat)) st.forcaVit[f] += 1 / s.final.vencedores.length;
  }
}
const pc = x => (100 * x).toFixed(0) + '%';
console.log(`${N} partidas, pSim=${PSIM}`);
console.log(`META atingida: ${pc(st.meta / N)} | trilha média ${(st.trilha / N).toFixed(1)} | crises: resolvida ${pc(st.res / (st.res + st.aten + st.nao))}, atenuada ${pc(st.aten / (st.res + st.aten + st.nao))}, não resolvida ${pc(st.nao / (st.res + st.aten + st.nao))}`);
console.log('pontos médios por jogador:', (st.totais / N / 5).toFixed(1));
console.log('objetivos cumpridos:', Object.keys(st.objn).sort().map(k => `${k.slice(-3)} ${pc((st.obj[k] || 0) / st.objn[k])}`).join(' | '));
console.log('vitórias por força:', st.forcaVit.map((v, f) => f ? `F${f}:${pc(v / (st.forcaN[f] || 1))}` : '').filter(Boolean).join(' '));
