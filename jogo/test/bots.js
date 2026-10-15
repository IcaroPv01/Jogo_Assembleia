// Partidas só com bots (decisões de js/bot.js) no motor, sem interface. Uso: node test/bots.js [partidas=300]
// Confere invariantes (24 cartas, trilha em 0..13, nenhuma ação recusada) e imprime estatísticas.
const E = require('../js/engine.js');
const B = require('../js/bot.js');
const D = require('../dados/economia.js');
const N = +process.argv[2] || 300;

function joga(seed, humanos = 0) {
  const ids = E.embaralha({ rng: seed }, D.paises.map(p => p.id)).slice(0, 5);
  const s = E.novoJogo(D, { paises: ids, seed, bots: [0, 1, 2, 3, 4].map(i => i >= humanos) });
  const A = a => { const x = E.acao(D, s, a); if (!x.ok) throw new Error(`${a.tipo}: ${x.erro} (fase ${s.fase})`); };
  let g = 0;
  while (s.fase !== 'fim') {
    if (++g > 3000) throw new Error('loop na fase ' + s.fase);
    const tot = s.mao.reduce((n, m) => n + m.length, 0) + s.compra.length + s.descarte.length;
    if (tot !== 24) throw new Error('cartas perdidas: ' + tot);
    if (s.trilha < 0 || s.trilha > E.R.TRILHA_MAX) throw new Error('trilha fora');
    const p = s.pend;
    if (p && p.tipo === 'voto') {
      if (!p.resultado) { const notas = {}; const votos = s.assentos.map(a => { const v = B.voto(D, s, a.i); notas[a.i] = v.nota; return v.voto; }); A({ tipo: 'votar', votos, notas }); }
      else A({ tipo: 'voto_ok' });
      continue;
    }
    if (p && p.tipo === 'troca') {
      if (!p.resultado) { const r = B.resposta(D, s, p.parceiro, p.carta, p.quem); A({ tipo: 'resposta_troca', aceita: r.aceita, cartaDevolve: r.cartaDevolve, nota: r.nota }); }
      else A({ tipo: 'troca_ok' });
      continue;
    }
    switch (s.fase) {
      case 'objetivos': A({ tipo: 'objetivos_ok' }); break;
      case 'presidencia': { const m = B.modo(D, s, s.presidente); A({ tipo: 'voto_modo', modo: m.modo, nota: m.nota }); A({ tipo: 'avancar' }); break; }
      case 'troca': { let t; while ((t = B.proximaTroca(D, s))) A({ tipo: 'trocar', ...t }); A({ tipo: 'avancar' }); break; }
      case 'jogar': {
        const seat = E.seatDaVez(s), j = B.jogada(D, s, seat);
        if (j.tipo === 'passar') A({ tipo: 'passar', nota: j.nota }); else A({ tipo: 'jogar', seat, carta: j.carta, parceiro: j.parceiro, alvo: j.alvo, nota: j.nota });
        break;
      }
      case 'fecho': case 'crise': case 'debate': A({ tipo: 'avancar' }); break;
      default: throw new Error('fase inesperada ' + s.fase);
    }
  }
  const rel = JSON.parse(JSON.stringify(E.relatorio(D, s)));
  if (!rel.detalhado || rel.eventos.length < 20 || rel.eventos.slice(-1)[0].pts.join() !== s.pts.join()) throw new Error('log incompleto');
  return s;
}

const st = { meta: 0, trilha: 0, res: 0, aten: 0, nao: 0, tr: 0, pass: 0, jog: 0, obj: {}, objn: {}, pts: 0, forcaVit: Array(7).fill(0), forcaN: Array(7).fill(0), pesAprov: 0, pes: 0, medAprov: 0, med: 0 };
for (let i = 0; i < N; i++) {
  const s = joga(5000 + i);
  st.trilha += s.trilha; if (s.final.meta) st.meta++;
  for (const c of s.crisesHist) { if (c.status === 'resolvida') st.res++; else if (c.status === 'atenuada') st.aten++; else st.nao++; }
  st.tr += s.log.filter(l => l.txt.startsWith('Troca')).length;
  st.pass += s.log.filter(l => l.txt.includes(' passou.')).length;
  for (const l of s.final.linhas) {
    st.pts += l.total; st.objn[l.objetivo.id] = (st.objn[l.objetivo.id] || 0) + 1; if (l.cumpriu) st.obj[l.objetivo.id] = (st.obj[l.objetivo.id] || 0) + 1;
    const f = E.paisDe(D, s, l.seat).forca; st.forcaN[f]++; if (s.final.vencedores.includes(l.seat)) st.forcaVit[f] += 1 / s.final.vencedores.length;
  }
  for (const l of s.log) { const m = /"(.+)" (aprovada|reprovada)/.exec(l.txt); if (!m) continue; const a = D.acoes.find(x => x.nome === m[1]); if (!a) continue; const k = a.tipo === 'pesada' ? 'pes' : 'med'; st[k]++; if (m[2] === 'aprovada') st[k + 'Aprov']++; }
}
// também: 1 humano (decisões de humano = as do bot, só para exercitar os caminhos) e 5 humanos
joga(9001, 1); joga(9002, 5);
const pc = x => (100 * x).toFixed(0) + '%';
console.log(`${N} partidas só com bots`);
console.log(`META ${pc(st.meta / N)} | trilha média ${(st.trilha / N).toFixed(1)} | crises: resolvida ${pc(st.res / (st.res + st.aten + st.nao))}, atenuada ${pc(st.aten / (st.res + st.aten + st.nao))}, não resolvida ${pc(st.nao / (st.res + st.aten + st.nao))}`);
console.log(`por partida: trocas ${(st.tr / N).toFixed(1)} · passadas ${(st.pass / N).toFixed(1)} · pontos médios/jogador ${(st.pts / N / 5).toFixed(1)}`);
console.log(`propostas: média ${st.med} (${pc(st.medAprov / st.med)} aprovadas) · pesada ${st.pes} (${pc(st.pesAprov / (st.pes || 1))} aprovadas)`);
console.log('objetivos cumpridos:', Object.keys(st.objn).sort().map(k => `${k.slice(-3)} ${pc((st.obj[k] || 0) / st.objn[k])}`).join(' | '));
console.log('vitórias por força:', st.forcaVit.map((v, f) => f ? `F${f}:${pc(v / (st.forcaN[f] || 1))}` : '').filter(Boolean).join(' '));
