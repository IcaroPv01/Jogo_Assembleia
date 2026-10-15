#!/usr/bin/env node
// Monta jogo/dados/economia.js a partir dos textos do baralho (Módulo 4), fichas (Módulo 6)
// e, quando existir, economia/paises.json (Módulo 5: força e habilidades finais).
// Uso: node montar_dados.js [cartas.json] [fichas.json] [paises.json]
const fs = require('fs');
const path = require('path');
const DEF = '/mnt/project-files';
const [cartasArq = `${DEF}/economia/cartas.json`, fichasArq = `${DEF}/paises/fichas.json`, paisesArq = `${DEF}/economia/paises.json`] = process.argv.slice(2);
const lerJson = a => JSON.parse(fs.readFileSync(a, 'utf8'));
const base = lerJson(path.join(__dirname, '..', 'ferramentas', 'economia_baralho.json')); // identidade visual + dados fixos
const cartas = lerJson(cartasArq);
const fichas = lerJson(fichasArq).fichas;

// Força PROVISÓRIA (1 fraco … 6 forte) usada só se faltar economia/paises.json (Módulo 5: força final, habilidades e códigos de regra).
const FORCA_PROVISORIA = { ITA: 4, POR: 2, URU: 1, EGI: 3, CHN: 5, EUA: 6, ARG: 3, GRE: 2 };
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

let finais = {};
if (fs.existsSync(paisesArq)) {
  const p = lerJson(paisesArq); const arr = Array.isArray(p) ? p : (p.paises || []);
  for (const x of arr) finais[x.id] = x;
  console.log('Usando', paisesArq);
}

const paises = base.cartas.filter(c => c.carta === 'pais').map(c => {
  const f = fichas.find(x => norm(x.nome) === norm(c.nome) || (c.id === 'EUA' && x.id === 'eua')) || {};
  const fin = finais[c.id] || {};
  return {
    id: c.id, nome: c.nome, bandeira: c.bandeira,
    forca: fin.forca ?? FORCA_PROVISORIA[c.id],
    resumo: c.resumo,
    habilidades: fin.habilidades || (f.habilidades_passivas && f.habilidades_passivas.length ? f.habilidades_passivas : c.habilidades),
    figura: (f.personalidade_historica && f.personalidade_historica.nome) || c.figura,
    capital: c.capital, moeda: c.moeda, sistema: c.sistema,
    modelo: fin.modelo_simulacao || {},
    provisorio: !fin.forca,
  };
});
const idPorNome = Object.fromEntries(paises.map(p => [norm(p.nome), p.id]));
const nomeCurto = n => n;

// Ícone dos eventos (Tabler disponíveis em assets/icons).
const ICONES = { 'ECO-F01': 'trending-down', 'ECO-A01': 'chart-line', 'ECO-A02': 'world', 'ECO-A03': 'ship', 'ECO-A04': 'coin',
  'ECO-A05': 'robot', 'ECO-A06': 'scale', 'ECO-A07': 'currency-bitcoin', 'ECO-A08': 'users', 'ECO-A09': 'cash', 'ECO-A10': 'leaf' };
const NATUREZA = { 'ECO-A05': 'oportunidade', 'ECO-A07': 'oportunidade', 'ECO-A09': 'oportunidade', 'ECO-A10': 'oportunidade' };

// Crise: N = quantas "ajudas" resolvem (nº de países citado no requisito: 2 ou 3). Atenuar = pelo menos 1 ajuda.
function numeroDaCrise(e) {
  const m = e.requisito.match(/(\d+) (?:países|acordos)/);
  return m ? +m[1] : 2;
}
const eventos = cartas.eventos.map(e => ({
  id: e.id, tipo: e.tipo, titulo: e.titulo, ano: e.ano, descricao: e.descricao, topicos: e.topicos_debate,
  requisito: e.requisito, requisito_atenuar: e.requisito_atenuar, pts_resolver: e.pts_resolver ?? 5, pts_atenuar: e.pts_atenuar ?? 3,
  icone: ICONES[e.id] || 'alert-triangle', natureza: e.tipo === 'fixa' ? 'fixo' : (NATUREZA[e.id] || 'crise'),
  n: numeroDaCrise(e),
}));

// Ações: leve = troca; médio = proposta/acordo votado; pesado = proposta cara votada.
// Os números (pontos, custo, ajudas) estão em engine.js (R), copiados de economia/balanceamento.md (Módulo 5).
const TIPO = { leve: 'troca', medio: 'media', pesado: 'pesada' };
const acoes = cartas.acoes.map(a => ({ id: a.id, pais: idPorNome[norm(a.pais)], paisNome: a.pais, bandeira: a.bandeira, tier: a.tier, nome: a.nome, efeito: a.efeito, tipo: TIPO[a.tier] }));

// Objetivos: verificação automática pelo jogo ('auto') ou confirmada pela mesa no fim ('manual').
const MANUAL = new Set(['ECO-O06', 'ECO-O10']);
const objetivos = cartas.objetivos.map(o => ({ id: o.id, texto: o.texto, pts: o.pts, verifica: MANUAL.has(o.id) ? 'manual' : 'auto' }));

// Ícones inline (Tabler, sem metadados c2pa).
const icDir = path.join(__dirname, '..', 'ferramentas', 'assets', 'icons');
const nomesIcones = new Set([...Object.values(ICONES), 'star', 'cards', 'building-bank', 'clock-hour-4', 'users', 'gavel', 'shield-check', 'bolt', 'flame', 'alert-triangle', 'coin', 'world']);
const icones = {};
for (const n of nomesIcones) {
  const svg = fs.readFileSync(path.join(icDir, n + '.svg'), 'utf8');
  icones[n] = [...svg.matchAll(/<(path|circle|line|rect|polyline|polygon)\b[^>]*\/>/g)].map(m => m[0]).join('');
}
// Bandeiras: copia só as usadas.
const flDir = path.join(__dirname, '..', 'ferramentas', 'assets', 'flags');
fs.mkdirSync(path.join(__dirname, 'assets', 'flags'), { recursive: true });
for (const p of paises) {
  const s = fs.readFileSync(path.join(flDir, p.bandeira + '.svg'), 'utf8').replace(/<metadata>[\s\S]*?<\/metadata>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  fs.writeFileSync(path.join(__dirname, 'assets', 'flags', p.bandeira + '.svg'), s);
}

const dados = { baralho: base.baralho, versao: cartas.versao, provisorio: true, paises, eventos, acoes, objetivos, icones };
fs.mkdirSync(path.join(__dirname, 'dados'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'dados', 'economia.js'), '// GERADO por montar_dados.js — não editar à mão.\nvar DADOS = ' + JSON.stringify(dados) + ';\nif (typeof module === "object") module.exports = DADOS;\n');
console.log(`ok: ${paises.length} países, ${eventos.length} eventos, ${acoes.length} ações, ${objetivos.length} objetivos`);
