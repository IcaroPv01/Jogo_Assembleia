// Resumo legível de um log baixado do jogo. Uso: node test/analisa_log.js arquivo.json
// Aceita um log (assembleia-log-1) ou vários (assembleia-logs-1). Serve para conferir o equilíbrio de partidas reais.
const fs = require('fs');
const D = require('../dados/economia.js');
const arq = process.argv[2];
if (!arq) { console.error('Uso: node test/analisa_log.js arquivo.json'); process.exit(1); }
const j = JSON.parse(fs.readFileSync(arq, 'utf8'));
const partidas = j.partidas || [j];
const nomeCarta = id => (D.acoes.find(c => c.id === id) || {}).nome || id;
const tipoCarta = id => (D.acoes.find(c => c.id === id) || {}).tipo || '?';

partidas.forEach((p, k) => {
  const nm = i => p.mesa[i].nome + (p.mesa[i].bot ? ' (bot)' : '');
  console.log(`\n===== Partida ${k + 1} · seed ${p.seed} · versão ${p.versaoJogo} · fase ${p.fase} · trilha ${p.trilha}/${p.meta}${p.detalhado ? '' : ' · SEM histórico detalhado (versão antiga: só diário)'} =====`);
  console.log('Mesa (força · pessoa/bot · objetivo · pontos finais):');
  p.mesa.forEach(m => console.log(`  ${m.nome.padEnd(15)} F${m.forca} ${m.bot ? 'bot   ' : 'pessoa'} ${m.objetivo.id.slice(-3)} ${m.final ? `total ${m.final.total} (base ${m.pontosAgora}, obj ${m.final.cumpriu ? '+' + m.final.pontosObj : 'não'}, meta +${m.final.bonusMeta}, crises ajudadas ${m.final.crisesAjudadas})` : `pontos agora ${m.pontosAgora}`}`));
  if (p.final) console.log(`Vencedor(es): ${p.final.vencedores.map(nm).join(', ')} · META ${p.final.meta ? 'atingida' : 'não atingida'}`);
  console.log('Crises:'); p.crises.forEach(c => console.log(`  ${c.titulo}: ${c.status} (${c.total}/${c.n} ajudas, rodadas ${c.abertaRodada}→${c.fechouNaRodada ?? '-'}) ajudaram: ${Object.keys(c.ajudas).map(s => nm(+s)).join(', ') || 'ninguém'}`));
  if (!p.detalhado) { console.log('Diário:'); p.diario.forEach(l => console.log(`  R${l.r} ${l.txt}`)); return; }
  const ev = p.eventos;
  const jog = ev.filter(e => e.t === 'jogar'), pas = ev.filter(e => e.t === 'passar');
  const aprov = ev.filter(e => e.t === 'voto_ok' && e.resultado), ap = aprov.filter(e => e.resultado.aprovado).length;
  const por = tp => aprov.filter(e => tipoCarta(e.pend.carta) === tp);
  console.log(`\nJogadas: ${jog.length} cartas (${['troca', 'media', 'pesada'].map(t => t + ' ' + jog.filter(e => e.tipoCarta === t).length).join(', ')}) · passadas ${pas.length}`);
  console.log(`Votações: ${aprov.length}, aprovadas ${ap} (média ${por('media').filter(e => e.resultado.aprovado).length}/${por('media').length}, pesada ${por('pesada').filter(e => e.resultado.aprovado).length}/${por('pesada').length})`);
  console.log(`Trocas: ${ev.filter(e => e.t === 'trocar').length} na fase de troca + ${ev.filter(e => e.t === 'resposta_troca' && e.aceita).length} por carta leve (recusadas ${ev.filter(e => e.t === 'resposta_troca' && !e.aceita).length})`);
  console.log('\nLinha do tempo (pontos por lugar e trilha ao fim de cada rodada):');
  for (let r = 1; r <= 5; r++) {
    const ult = ev.filter(e => e.r === r).slice(-1)[0]; if (!ult) continue;
    console.log(`  R${r}: trilha ${ult.trilha} · pts ${p.mesa.map((m, i) => m.nome.slice(0, 3) + ' ' + ult.pts[i]).join(' · ')}`);
  }
  console.log('\nJogadas e votos:');
  ev.forEach(e => {
    if (e.t === 'jogar') console.log(`  R${e.r} ${nm(e.seat)} joga "${nomeCarta(e.carta)}" (${e.tipoCarta})${e.parceiro != null ? ' com ' + nm(e.parceiro) : ''}${e.nota ? ' — ' + e.nota : ''}`);
    else if (e.t === 'passar') console.log(`  R${e.r} ${nm(e.seat)} passa${e.nota ? ' — ' + e.nota : ''}`);
    else if (e.t === 'voto_ok' && e.resultado) console.log(`      voto ${e.resultado.aprovado ? 'APROVADO' : 'reprovado'} ${e.resultado.sim}x${e.resultado.nao}${e.resultado.votoExtra ? ' (voto extra)' : ''}`);
    else if (e.t === 'resposta_troca') console.log(`  R${e.r} troca leve ${nm(e.pend.quem)} → ${nm(e.pend.parceiro)}: ${e.aceita ? 'aceita' : 'recusa'}`);
    else if (e.t === 'trocar') console.log(`  R${e.r} troca ${nm(e.a)} ⇄ ${nm(e.b)}${e.nota ? ' — ' + e.nota : ''}`);
    else if (e.t === 'voto_modo') console.log(`  R${e.r} presidente escolhe voto ${e.modo}`);
  });
});
