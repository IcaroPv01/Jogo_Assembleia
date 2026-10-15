#!/usr/bin/env node
// Tabuleiro imprimível A3 (420x297 mm, 10 unidades = 1 mm). Uso: node gen_tabuleiro.js economia_baralho.json [--saida pasta]
const fs = require('fs'), path = require('path');
let sharp; try { sharp = require('sharp'); } catch (e) { console.error('Falta sharp. Rode: npm install'); process.exit(1); }
const args = process.argv.slice(2);
const arq = args.find(a => !a.startsWith('--'));
if (!arq) { console.error('Uso: node gen_tabuleiro.js baralho.json [--saida pasta]'); process.exit(1); }
const B = JSON.parse(fs.readFileSync(arq, 'utf8')).baralho;
const si = args.indexOf('--saida');
const saida = si >= 0 ? args[si + 1] : path.join(__dirname, 'saida', B.id);
fs.mkdirSync(saida, { recursive: true });

const W = 4200, H = 2970, T = 450, META = 13, NCASAS = 14;
const FT = "Caladea, 'DejaVu Serif', serif", FB = "Carlito, 'DejaVu Sans', sans-serif";
const PERG = '#f5eddb', TINTA = '#2a1f14', CINZA = '#6b5d4c', cor = B.cor, cor2 = B.cor2;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const T_ = (x, y, t, o = {}) => `<text x="${x}" y="${y}" text-anchor="${o.a || 'start'}" font-family="${o.f || FB}" font-size="${o.s || 44}" font-weight="${o.w || 400}" letter-spacing="${o.ls || 0}" fill="${o.c || TINTA}" ${o.i ? 'font-style="italic"' : ''}>${esc(t)}</text>`;

// casas: sentido horário, 0 = INÍCIO (canto superior esquerdo), 13 = META (esquerda, ao lado do início)
const cel = [];
for (let i = 0; i < 5; i++) cel.push({ x: i * 840, y: 0, w: 840, h: T });               // 0-4 topo
for (let i = 0; i < 2; i++) cel.push({ x: W - T, y: T + i * 1035, w: T, h: 1035 });      // 5-6 direita
for (let i = 0; i < 5; i++) cel.push({ x: W - (i + 1) * 840, y: H - T, w: 840, h: T });  // 7-11 base (D→E)
for (let i = 0; i < 2; i++) cel.push({ x: 0, y: H - T - (i + 1) * 1035, w: T, h: 1035 });// 12-13 esquerda (baixo→cima)

let s = `<rect width="${W}" height="${H}" fill="${PERG}"/>`;
// casas
cel.forEach((c, n) => {
  const meta = n === META, ini = n === 0;
  const fill = meta ? '#e8c27a' : ini ? '#cfe3c8' : (n % 2 ? '#efe2c3' : '#f7f0de');
  s += `<rect x="${c.x + 6}" y="${c.y + 6}" width="${c.w - 12}" height="${c.h - 12}" rx="30" fill="${fill}" stroke="${cor}" stroke-width="${meta ? 12 : 7}"/>`;
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  s += T_(cx, cy + (meta || ini ? 20 : 45), String(n), { a: 'middle', f: FT, s: meta || ini ? 150 : 190, w: 700, c: cor });
  if (ini) s += T_(cx, cy + 105, 'INÍCIO', { a: 'middle', s: 50, w: 700, ls: 6, c: '#3f6b3a' }) ;
  if (meta) s += T_(cx, cy + 110, '★ META ★', { a: 'middle', s: 54, w: 700, ls: 6, c: cor });
  if (n > 0 && n < NCASAS - 1) { // seta de sentido
    const horiz = c.h === T && c.w > T, dir = n <= 4 ? 'r' : n <= 6 ? 'd' : n <= 11 ? 'l' : 'u';
    const ax = c.x + c.w - 70, ay = c.y + c.h - 60;
    const pts = { r: [[0, -22], [34, 0], [0, 22]], d: [[-22, 0], [0, 34], [22, 0]], l: [[0, -22], [-34, 0], [0, 22]], u: [[-22, 0], [0, -34], [22, 0]] }[dir];
    const px = dir === 'l' ? c.x + 70 : ax, py = dir === 'u' ? c.y + 70 : ay;
    s += `<polygon points="${pts.map(p => `${px + p[0]},${py + p[1]}`).join(' ')}" fill="${cor}" fill-opacity=".45"/>`;
  }
});
// miolo
s += `<rect x="${T}" y="${T}" width="${W - 2 * T}" height="${H - 2 * T}" fill="#efe5cc"/>`;
const slot = (x, y, rot, tit, sub, destaque) => `<rect x="${x}" y="${y}" width="630" height="880" rx="26" fill="${destaque || '#fbf6ea'}" fill-opacity=".7" stroke="${cor}" stroke-width="5" stroke-dasharray="26 16"/>` +
  T_(x + 315, y + 410, tit, { a: 'middle', s: 54, w: 700, ls: 4, c: cor }) + (sub ? T_(x + 315, y + 480, sub, { a: 'middle', s: 38, i: 1, c: CINZA }) : '');
const lab = (x, t) => T_(x, 510, t, { s: 40, w: 700, ls: 4, c: cor });
s += lab(475, 'EVENTO FIXO') + slot(475, 545, 0, 'CRISE FIXA', 'rodada 1');
s += lab(1130, 'EVENTO ATIVO') + slot(1130, 545, 0, 'CRISE ATIVA', 'aleatória: rodadas 3 e 5');
s += lab(1785, 'BARALHO DE EVENTOS') + slot(1785, 545, 0, 'BARALHO', 'viradas pra baixo');
// painel
const px = 2440, py = 545, pw = 1285, ph = 880;
s += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="26" fill="#fbf6ea" stroke="${cor}" stroke-width="5"/>`;
s += T_(px + pw / 2, py + 90, `ASSEMBLEIA · ${B.nome.toUpperCase()}`, { a: 'middle', f: FT, s: 74, w: 700, c: cor });
s += T_(px + pw / 2, py + 140, 'semi-cooperativo · 5 jogadores · 5 rodadas · 30–45 min', { a: 'middle', s: 40, i: 1, c: CINZA });
s += T_(px + 50, py + 215, 'RODADA (marque com uma ficha)', { s: 38, w: 700, ls: 3, c: cor });
for (let r = 1; r <= 5; r++) {
  const cx = px + 130 + (r - 1) * 265, cy = py + 320, crise = r % 2 === 1;
  s += `<circle cx="${cx}" cy="${cy}" r="85" fill="${crise ? '#e8c27a' : '#f5eddb'}" stroke="${cor}" stroke-width="6"/>` + T_(cx, cy + 40, String(r), { a: 'middle', f: FT, s: 110, w: 700, c: cor });
  s += T_(cx, cy + 135, crise ? (r === 1 ? 'crise fixa' : 'crise nova') : 'sem crise', { a: 'middle', s: 36, c: CINZA });
}
const reg = [['Resolvida: +5 na trilha', 0], ['Atenuada: +3 na trilha', 0], ['Não resolvida: −2 na trilha', 0], ['META (casa 13): todos ganham +2 pts', 1]];
s += T_(px + 50, py + 565, 'PONTOS DA MESA', { s: 38, w: 700, ls: 3, c: cor });
reg.forEach((r, i) => s += T_(px + 50, py + 625 + i * 52, r[0], { s: 42, w: r[1] ? 700 : 400 }));
s += T_(px + 50, py + 850, 'Peão da mesa começa no INÍCIO (0) e anda pela trilha.', { s: 36, i: 1, c: CINZA });
// delegados
s += T_(475, 1495, 'DELEGADOS (carta de país + 3 cartas de ação na mão). Ficha de presidente ★ passa a cada rodada.', { s: 40, w: 700, ls: 2, c: cor });
for (let i = 0; i < 5; i++) s += slot(475 + i * 655, 1520, 0, `DELEGADO ${i + 1}`, 'carta de país', '#f7efdc');
fs.writeFileSync(path.join(saida, 'tabuleiro.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`);
sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`)).png().toFile(path.join(saida, 'tabuleiro.png')).then(() => console.log('tabuleiro ->', saida));
