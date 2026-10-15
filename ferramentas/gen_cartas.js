#!/usr/bin/env node
// Gerador de cartas Assembleia: JSON do baralho -> SVG + PNG (63x88mm) + galeria HTML.
// Uso: node gen_cartas.js economia_baralho.json [--saida pasta] [--escala 2] [--so ITA,E01]
const fs = require('fs');
const path = require('path');
let sharp;
try { sharp = require('sharp'); } catch (e) { console.error('Falta o pacote sharp. Rode: npm install sharp'); process.exit(1); }

const W = 630, H = 880; // 10 unidades = 1 mm
const args = process.argv.slice(2);
const arq = args.find(a => !a.startsWith('--'));
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
if (!arq) { console.error('Uso: node gen_cartas.js baralho.json [--saida pasta] [--escala 2] [--so ID,ID]'); process.exit(1); }
const raiz = __dirname;
const dados = JSON.parse(fs.readFileSync(arq, 'utf8'));
const B = dados.baralho;
const saida = opt('saida', path.join(raiz, 'saida', B.id));
const escala = parseFloat(opt('escala', '2'));
const so = opt('so', '') ? opt('so', '').split(',') : null;
fs.mkdirSync(saida, { recursive: true });

const FT = "Caladea, 'DejaVu Serif', serif";   // títulos
const FB = "Carlito, 'DejaVu Sans', sans-serif"; // corpo
const PERG = '#f5eddb', TINTA = '#2a1f14', CINZA = '#6b5d4c';
const TIER = { leve: ['#4f8f5b', 'LEVE', 1], medio: ['#c98a1b', 'MÉDIO', 2], pesado: ['#a63a2e', 'PESADO', 3] };
const SUB = { fixo: ['#1f3a5f', 'EVENTO FIXO'], crise: ['#7a2e2e', 'CRISE'], oportunidade: ['#2f6b46', 'OPORTUNIDADE'] };

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// largura estimada de texto (sem medir fonte): fator por fonte
const larg = (t, tam, fator) => t.length * tam * fator;
function quebrar(texto, tam, maxW, fator = 0.47) {
  const out = []; let linha = '';
  for (const p of String(texto).split(/\s+/)) {
    const t = linha ? linha + ' ' + p : p;
    if (larg(t, tam, fator) > maxW && linha) { out.push(linha); linha = p; } else linha = t;
  }
  if (linha) out.push(linha);
  return out;
}
// bloco de texto com fonte adaptativa: cabe em maxH reduzindo a fonte
function bloco(texto, x, y, maxW, maxH, { tamMax = 26, tamMin = 15, fam = FB, fator = 0.47, cor = TINTA, estilo = '', peso = 400, entre = 1.28 } = {}) {
  let tam = tamMax, linhas;
  for (; tam >= tamMin; tam -= 1) {
    linhas = quebrar(texto, tam, maxW, fator);
    if (linhas.length * tam * entre <= maxH) break;
  }
  const alt = linhas.length * tam * entre;
  const svg = linhas.map((l, i) => `<text x="${x}" y="${y + tam + i * tam * entre}" font-family="${fam}" font-size="${tam}" font-weight="${peso}" ${estilo} fill="${cor}">${esc(l)}</text>`).join('');
  return { svg, alt };
}
// título adaptativo: 1 linha na largura toda; se não couber, 2 linhas
function titulo(nome, x, yTopo, maxW, altBanda) {
  const cx = 0.53; let tam = 48;
  while (tam > 30 && larg(nome, tam, cx) > maxW) tam -= 1;
  if (larg(nome, tam, cx) <= maxW) {
    return `<text x="${x}" y="${yTopo + altBanda / 2 + tam * 0.33}" font-family="${FT}" font-weight="700" font-size="${tam}" fill="${TINTA}">${esc(nome)}</text>`;
  }
  const palavras = nome.split(' '); let melhor = null;
  for (let i = 1; i < palavras.length; i++) {
    const a = palavras.slice(0, i).join(' '), b = palavras.slice(i).join(' ');
    const m = Math.max(a.length, b.length);
    if (!melhor || m < melhor.m) melhor = { a, b, m };
  }
  let t2 = 36;
  while (t2 > 20 && larg(melhor.m ? (melhor.a.length > melhor.b.length ? melhor.a : melhor.b) : nome, t2, cx) > maxW) t2 -= 1;
  const y0 = yTopo + altBanda / 2 - t2 * 0.1;
  return `<text x="${x}" y="${y0}" font-family="${FT}" font-weight="700" font-size="${t2}" fill="${TINTA}">${esc(melhor.a)}</text>` +
         `<text x="${x}" y="${y0 + t2 * 1.08}" font-family="${FT}" font-weight="700" font-size="${t2}" fill="${TINTA}">${esc(melhor.b)}</text>`;
}

// ---------- assets ----------
const cacheFlag = {};
async function bandeiraURI(cod) {
  if (cacheFlag[cod]) return cacheFlag[cod];
  const f = path.join(raiz, 'assets', 'flags', cod + '.svg');
  if (!fs.existsSync(f)) throw new Error(`Bandeira faltando: assets/flags/${cod}.svg (baixe de HatScripts/circle-flags)`);
  const limpo = fs.readFileSync(f, 'utf8').replace(/<metadata[\s\S]*?<\/metadata>/g, '');
  const png = await sharp(Buffer.from(limpo), { density: 300 }).resize(512, 512).png().toBuffer();
  return (cacheFlag[cod] = 'data:image/png;base64,' + png.toString('base64'));
}
function icone(nome, cx, cy, tam, cor, largTraco = 1.5) {
  const f = path.join(raiz, 'assets', 'icons', nome + '.svg');
  if (!fs.existsSync(f)) throw new Error(`Ícone faltando: assets/icons/${nome}.svg (baixe de tabler-icons)`);
  const interno = fs.readFileSync(f, 'utf8').replace(/<metadata[\s\S]*?<\/metadata>/g, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const s = tam / 24;
  return `<g transform="translate(${cx - tam / 2} ${cy - tam / 2}) scale(${s})" fill="none" stroke="${cor}" stroke-width="${largTraco}" stroke-linecap="round" stroke-linejoin="round">${interno}</g>`;
}

// ---------- peças comuns ----------
function moldura(cor, cor2) {
  return `<rect width="${W}" height="${H}" fill="${PERG}"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="26" fill="none" stroke="${cor}" stroke-width="10"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" rx="16" fill="none" stroke="${cor2}" stroke-width="3"/>`;
}
function selo(cx, cy, r, conteudo, cor, cor2) {
  return `<circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="${cor}"/><circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="none" stroke="${cor2}" stroke-width="2.5"/>${conteudo}`;
}
function faixaTipo(txt, cor, cor2, y = 142) {
  return `<rect x="44" y="${y}" width="${W - 88}" height="34" rx="6" fill="${cor}"/>
  <text x="${W / 2}" y="${y + 24}" text-anchor="middle" font-family="${FB}" font-weight="700" font-size="19" letter-spacing="3" fill="${cor2}">${esc(txt)}</text>`;
}
function rotulo(txt, x, y, cor) {
  return `<text x="${x}" y="${y}" font-family="${FB}" font-weight="700" font-size="19" letter-spacing="2.5" fill="${cor}">${esc(txt)}</text>
  <line x1="${x}" y1="${y + 7}" x2="${W - 56}" y2="${y + 7}" stroke="${cor}" stroke-opacity=".35" stroke-width="1.5"/>`;
}
function rodape(esq, dir, cor) {
  return `<line x1="56" y1="816" x2="${W - 56}" y2="816" stroke="${cor}" stroke-opacity=".5" stroke-width="1.5"/>
  <text x="56" y="843" font-family="${FB}" font-size="17" fill="${CINZA}">${esc(esq)}</text>
  <text x="${W - 56}" y="843" text-anchor="end" font-family="${FB}" font-size="17" fill="${CINZA}">${esc(dir)}</text>`;
}
function carimbo(c) {
  if (!c.provisorio) return '';
  return `<g transform="rotate(-14 ${W / 2} 722)" opacity=".6"><rect x="${W / 2 - 190}" y="682" width="380" height="80" rx="10" fill="none" stroke="#c0392b" stroke-width="7"/>
  <text x="${W / 2}" y="742" text-anchor="middle" font-family="${FB}" font-weight="700" font-size="58" letter-spacing="6" fill="#c0392b">PROVISÓRIO</text></g>`;
}
function raios(cx, cy, r, cor) { // fundo da arte: círculos concêntricos + raios suaves
  let s = '';
  for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; s += `<line x1="${cx + Math.cos(a) * (r + 6)}" y1="${cy + Math.sin(a) * (r + 6)}" x2="${cx + Math.cos(a) * (r + 46)}" y2="${cy + Math.sin(a) * (r + 46)}" stroke="${cor}" stroke-opacity=".28" stroke-width="3"/>`; }
  return s + `<circle cx="${cx}" cy="${cy}" r="${r + 18}" fill="none" stroke="${cor}" stroke-opacity=".35" stroke-width="2"/>`;
}
const num = (c, i, total) => `${String(i + 1).padStart(3, '0')}/${String(total).padStart(3, '0')}`;

// ---------- tipos de carta ----------
function lista(itens, x, y, maxW, maxH, o = {}) { // bullets com fonte comum que cabe
  let tam = o.tamMax || 26, linhas;
  for (; tam >= (o.tamMin || 16); tam--) {
    linhas = itens.map(t => quebrar('• ' + t, tam, maxW, 0.47));
    if (linhas.reduce((a, l) => a + l.length, 0) * tam * 1.28 + (itens.length - 1) * 6 <= maxH) break;
  }
  let yy = y, svg = '';
  for (const l of linhas) { for (const ln of l) { svg += `<text x="${x}" y="${yy + tam}" font-family="${FB}" font-size="${tam}" fill="${TINTA}">${esc(ln)}</text>`; yy += tam * 1.28; } yy += 6; }
  return { svg, alt: yy - y };
}
const pips = (n, x, y, cor) => Array.from({ length: n }, (_, k) => `<circle cx="${x + k * 20}" cy="${y}" r="7" fill="${cor}"/>`).join('');
const cabeca = (c, s0, corM, seloConteudo) => {
  const sealCx = W - 44 - 46, sealCy = 84;
  return moldura(corM, B.cor2) + titulo(c.titulo || c.nome, 48, 36, sealCx - 46 - 20 - 48, 96) + selo(sealCx, sealCy, 40, seloConteudo(sealCx, sealCy), corM, B.cor2);
};
const seloBandeira = uri => (cx, cy) => `<clipPath id="cp"><circle cx="${cx}" cy="${cy}" r="40"/></clipPath><image href="${uri}" x="${cx - 40}" y="${cy - 40}" width="80" height="80" clip-path="url(#cp)"/>`;
const seloIcone = (ic, cor) => (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="40" fill="${PERG}"/>` + icone(ic, cx, cy, 54, cor, 1.6);

async function cartaPais(c, i, total) {
  const { cor, cor2 } = B; const uri = await bandeiraURI(c.bandeira);
  let s = cabeca(c, 0, cor, seloBandeira(uri));
  s += faixaTipo(`DELEGADO · ${B.nome.toUpperCase()}`, cor, cor2);
  const ax = W / 2, ay = 288, ar = 80;
  s += raios(ax, ay, ar, cor);
  s += `<clipPath id="cg"><circle cx="${ax}" cy="${ay}" r="${ar}"/></clipPath><image href="${uri}" x="${ax - ar}" y="${ay - ar}" width="${ar * 2}" height="${ar * 2}" clip-path="url(#cg)"/><circle cx="${ax}" cy="${ay}" r="${ar}" fill="none" stroke="${cor}" stroke-width="5"/>`;
  let y = 408;
  if (c.forca) { s += `<text x="56" y="${y + 20}" font-family="${FB}" font-weight="700" font-size="19" letter-spacing="1.5" fill="${cor}">FORÇA</text>${pips(c.forca, 170, y + 14, cor)}`; y += 33; }
  for (const [k, v] of [['CAPITAL', c.capital], ['MOEDA', c.moeda], ['SISTEMA', c.sistema]].filter(l => l[1])) {
    s += `<text x="56" y="${y + 20}" font-family="${FB}" font-weight="700" font-size="19" letter-spacing="1.5" fill="${cor}">${k}</text><text x="170" y="${y + 20}" font-family="${FB}" font-size="24" fill="${TINTA}">${esc(v)}</text>`; y += 33;
  }
  y += 6;
  const r = bloco(c.resumo || '', 56, y, W - 112, 84, { tamMax: 23, tamMin: 15, estilo: 'font-style="italic"', cor: CINZA }); s += r.svg; y += r.alt + 12;
  s += rotulo('HABILIDADES', 56, y + 14, cor); y += 30;
  s += lista(c.habilidades || [], 56, y, W - 112, 816 - y - 12).svg;
  s += rodape(c.figura ? `Figura: ${c.figura}` : '', `${B.sigla} ${num(c, i, total)}`, cor);
  return s + carimbo(c);
}
async function cartaEvento(c, i, total) {
  const fixa = c.tipo === 'fixa'; const nat = fixa ? 'fixo' : (c.natureza || 'crise');
  const [corSub, nomeSub] = SUB[nat] || SUB.crise; const { cor2 } = B;
  let s = cabeca(c, 0, corSub, seloIcone(c.icone || 'alert-triangle', corSub));
  s += faixaTipo(`EVENTO · ${fixa ? 'FIXO' : 'ALEATÓRIO'}${nat !== 'fixo' ? ' · ' + nomeSub : ''}${c.ano ? ' · ' + c.ano : ''}`, corSub, cor2);
  const ax = W / 2, ay = 288;
  s += raios(ax, ay, 80, corSub);
  s += `<circle cx="${ax}" cy="${ay}" r="80" fill="${corSub}" fill-opacity=".1" stroke="${corSub}" stroke-width="5"/>` + icone(c.icone || 'alert-triangle', ax, ay, 120, corSub, 1.1);
  let y = 410;
  const d = bloco(c.descricao || '', 56, y, W - 112, 130, { tamMax: 24, tamMin: 15, estilo: 'font-style="italic"', cor: CINZA }); s += d.svg; y += d.alt + 12;
  if ((c.topicos_debate || []).length) { s += rotulo('TÓPICOS DE DEBATE', 56, y + 14, corSub); y += 30; const t = lista(c.topicos_debate, 56, y, W - 112, 120, { tamMax: 22 }); s += t.svg; y += t.alt + 8; }
  s += rotulo('PARA ELIMINAR', 56, y + 14, corSub); y += 30;
  s += bloco(c.requisito || '', 56, y, W - 112, 816 - y - 12, { tamMax: 26, tamMin: 15 }).svg;
  s += rodape(`Resolver +${c.pts_resolver ?? 5} pts · Atenuar +${c.pts_atenuar ?? 3} pts`, `${B.sigla} ${num(c, i, total)}`, corSub);
  return s + carimbo(c);
}
async function cartaAcao(c, i, total) {
  const { cor, cor2 } = B; const corT = (TIER[c.tier] || [cor])[0];
  const uri = c.bandeira ? await bandeiraURI(c.bandeira) : null;
  let s = cabeca(c, 0, cor, uri ? seloBandeira(uri) : seloIcone(B.icone || 'cards', cor));
  s += faixaTipo(`AÇÃO${c.pais ? ' · ' + c.pais.toUpperCase() : ''}`, cor, cor2);
  const ay = 288; s += raios(W / 2, ay, 80, corT) + `<circle cx="${W / 2}" cy="${ay}" r="80" fill="${corT}" fill-opacity=".12" stroke="${corT}" stroke-width="5"/>`;
  if (TIER[c.tier]) { const [, nomeT, n] = TIER[c.tier]; for (let k = 0; k < n; k++) s += `<circle cx="${W / 2 + (k - (n - 1) / 2) * 38}" cy="${ay - 8}" r="15" fill="${corT}"/>`; s += `<text x="${W / 2}" y="${ay + 44}" text-anchor="middle" font-family="${FB}" font-weight="700" font-size="30" letter-spacing="4" fill="${corT}">${nomeT}</text>`; }
  else s += icone('cards', W / 2, ay, 100, corT, 1.1);
  let y = 420; s += rotulo('EFEITO', 56, y + 14, corT); y += 30;
  const t = bloco(c.efeito || '', 56, y, W - 112, 270, { tamMax: 30, tamMin: 16 }); s += t.svg; y += t.alt + 14;
  if (c.flavor) s += bloco(c.flavor, 56, y, W - 112, 816 - y - 12, { tamMax: 20, tamMin: 14, estilo: 'font-style="italic"', cor: CINZA }).svg;
  s += rodape(c.custo ? `Custo: ${c.custo}` : (c.pais ? `País: ${c.pais}` : ''), `${B.sigla} ${num(c, i, total)}`, corT);
  return s + carimbo(c);
}
async function cartaObjetivo(c, i, total) {
  const { cor, cor2 } = B;
  let s = cabeca({ titulo: 'Objetivo' }, 0, cor, seloIcone('star', cor));
  s += faixaTipo(`OBJETIVO · ${B.nome.toUpperCase()}`, cor, cor2);
  s += raios(W / 2, 288, 80, cor) + `<circle cx="${W / 2}" cy="288" r="80" fill="${cor}" fill-opacity=".1" stroke="${cor}" stroke-width="5"/>` + icone('star', W / 2, 288, 120, cor, 1.1);
  s += bloco(c.texto || '', 56, 430, W - 112, 280, { tamMax: 32, tamMin: 16 }).svg;
  s += `<text x="${W / 2}" y="640" text-anchor="middle" font-family="${FT}" font-weight="700" font-size="52" fill="${cor}">${c.pts ?? 0} pts</text>`;
  s += rodape('', `${B.sigla} ${num(c, i, total)}`, cor);
  return s + carimbo(c);
}

const FAB = { pais: cartaPais, evento: cartaEvento, acao: cartaAcao, objetivo: cartaObjetivo };

(async () => {
  const total = dados.cartas.length; const feitos = [];
  for (let i = 0; i < total; i++) {
    const c = dados.cartas[i];
    if (so && !so.includes(c.id)) continue;
    const k = c.carta;
    if (!FAB[k]) throw new Error(`Campo 'carta' desconhecido: ${k} (${c.id})`);
    const corpo = await FAB[k](c, i, total);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${corpo}</svg>`;
    const base = `${c.carta}_${c.id}`;
    fs.writeFileSync(path.join(saida, base + '.svg'), svg);
    await sharp(Buffer.from(svg), { density: 72 * escala }).resize(Math.round(W * escala), Math.round(H * escala)).png().toFile(path.join(saida, base + '.png'));
    feitos.push({ base, nome: c.titulo || c.nome || c.id, tipo: c.carta });
  }
  // galeria (serve para GitHub Pages)
  const sec = t => feitos.filter(f => f.tipo === t).map(f => `<figure><img src="${f.base}.png" loading="lazy"><figcaption>${esc(f.nome)}</figcaption></figure>`).join('');
  fs.writeFileSync(path.join(saida, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Assembleia · ${esc(B.nome)}</title>
<style>body{font-family:Carlito,Calibri,sans-serif;background:#1c1713;color:#f5eddb;margin:0;padding:16px}h1,h2{font-family:Georgia,serif}.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}figure{margin:0}img{width:100%;border-radius:10px;box-shadow:0 4px 14px #0008}figcaption{text-align:center;font-size:14px;margin-top:4px;opacity:.8}</style>
<h1>Assembleia · baralho ${esc(B.nome)}</h1><p><a style="color:#e8c27a" href="impressao.pdf">Baixar PDF para impressão (A4)</a></p><h2>Países</h2><div class="g">${sec('pais')}</div><h2>Eventos</h2><div class="g">${sec('evento')}</div><h2>Ações</h2><div class="g">${sec('acao')}</div><h2>Objetivos</h2><div class="g">${sec('objetivo')}</div>`);
  console.log(`${feitos.length} cartas -> ${saida}`);
})().catch(e => { console.error('ERRO:', e.message); process.exit(1); });
