// Teste de navegador: abre o jogo (file://) e joga partidas inteiras clicando em botões ao acaso.
// Uso: node test/ui.js [partidas=3] [pastaCapturas]   (precisa de playwright-core e Chromium)
// Cada partida usa um nº diferente de pessoas (1, 2, 5, 3, 4... o resto vira bot).
const HUMANOS = [1, 2, 5, 3, 4];
const path = require('path');
const fs = require('fs');
let pw; try { pw = require('playwright-core'); } catch (e) { pw = require(path.join(process.env.PW_DIR || '/tmp/claude-0/pw', 'node_modules/playwright-core')); }
const N = +process.argv[2] || 3, SHOTS = process.argv[3];
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
(async () => {
  const exe = process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const br = await pw.chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox'] });
  let falhas = 0;
  for (let g = 0; g < N; g++) {
    const pg = await br.newPage({ viewport: { width: 1600, height: 900 } });
    const erros = [];
    // nuvem simulada: confere o que seria enviado ao Firestore (sem internet)
    const enviados = [];
    await pg.addInitScript(() => { window.FIREBASE_CFG = { apiKey: 'chave-teste', projectId: 'projeto-teste' }; });
    await pg.route('https://firestore.googleapis.com/**', async route => {
      const rq = route.request(); enviados.push({ url: rq.url(), corpo: rq.postDataJSON() });
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'projects/projeto-teste/databases/(default)/documents/logs/CODIGO' + g }) });
    });
    pg.on('pageerror', e => erros.push(e.message)); pg.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    await pg.goto(URL);
    const shot = async n => { if (SHOTS && g === 0) { fs.mkdirSync(SHOTS, { recursive: true }); await pg.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
    await shot('01-inicio');
    await pg.click('[data-a=iniciarDeck]'); await pg.click('[data-a=sortear]'); await pg.click(`[data-a=humanos][data-v="${HUMANOS[g % HUMANOS.length]}"]`); await shot('02-setup');
    await pg.fill('input[data-i="0"]', 'Maria Secreta');
    await pg.click('[data-a=comecar]');
    let passos = 0, ult = '', vistos = new Set();
    for (; passos < 600; passos++) {
      const fase = await pg.evaluate(() => { const S = __jogo.U.S; return S.fase; });
      if (fase === 'fim') break;
      const st = await pg.evaluate(() => { const S = __jogo.U.S; return `${S.rodada}/${S.fase}/${S.turno ? S.turno.idx : ''}/${S.pend ? S.pend.tipo : ''}`; });
      const chave = st + ':' + (await pg.evaluate(() => document.querySelectorAll('[data-a]').length));
      const gateAberto = await pg.$('.gate'); const modo = await pg.evaluate(() => __jogo.U.S.votoModo + (document.querySelector('#painel .carta.sel') ? '+sel' : '') + (document.querySelector('#painel .resultado') ? '+res' : ''));
      const vk = st + '|' + modo;
      if (!gateAberto && !vistos.has(vk)) { vistos.add(vk); if (g === 0 && SHOTS) await shot('f-' + String(vistos.size).padStart(3, '0') + '-' + vk.replace(/\//g, '_').replace(/[:|+]/g, '-')); }
      // escolhe e clica um botão visível (gate/modal primeiro; prioriza botões de avanço)
      const feito = await pg.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.disabled; };
        const gate = document.querySelector('.gate [data-a]'); if (gate) { gate.click(); return 'gate'; }
        const modal = document.querySelector('.modal .fechar'); if (modal) { modal.click(); return 'modal'; }
        if (Math.random() < 0.08) { const m = [...document.querySelectorAll('[data-a=cartaModal],[data-a=regras],[data-a=diario]')].filter(vis); if (m.length) { m[Math.floor(Math.random() * m.length)].click(); return 'abriu-modal'; } }
        const els = [...document.querySelectorAll('#painel [data-a]')].filter(vis).filter(e => !['cartaModal', 'pausa', 'nada'].includes(e.dataset.a));
        if (!els.length) return null;
        const pri = els.filter(e => ['avancar', 'objProx', 'votoOk', 'assOk', 'trocaOk', 'revelar'].includes(e.dataset.a));
        const pool = Math.random() < 0.55 && pri.length ? pri : els;
        const e = pool[Math.floor(Math.random() * pool.length)]; e.click(); return e.dataset.a;
      });
      if (!feito) { erros.push('sem botão em ' + st); break; }
      ult = st + ' ' + feito;
    }
    const fim = await pg.evaluate(() => __jogo.U.S.fase);
    if (fim !== 'fim') { falhas++; erros.push('não terminou: ' + ult); }
    if (fim === 'fim') {
      await pg.click('[data-a=revelar]'); await shot('99-final');
      // botão "Baixar log desta partida": o arquivo tem que ser JSON válido e completo
      const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('[data-a=baixarLog]')]);
      const f = path.join(require('os').tmpdir(), `log-${g}.json`); await dl.saveAs(f);
      const lg = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!lg.detalhado || lg.eventos.length < 20 || !lg.final) erros.push('log baixado incompleto');
      if (SHOTS && g === 0) fs.copyFileSync(f, path.join(SHOTS, 'log-exemplo.json'));
      // envio automático: 1 documento, no formato certo, sem o nome digitado
      await pg.waitForFunction(() => /Código:/.test(document.body.innerText), null, { timeout: 5000 }).catch(() => erros.push('tela não mostrou o código do log'));
      if (enviados.length !== 1) erros.push('envios à nuvem: ' + enviados.length);
      else {
        const e = enviados[0], f2 = e.corpo.fields;
        if (!/projects\/projeto-teste\/databases\/\(default\)\/documents\/logs\?key=chave-teste$/.test(e.url)) erros.push('url da nuvem errada: ' + e.url);
        if (f2.formato.stringValue !== 'assembleia-log-1' || !f2.json.stringValue || f2.json.stringValue.length > 400000) erros.push('documento da nuvem inválido');
        if (/Maria Secreta/.test(f2.json.stringValue) || /Maria Secreta/.test(JSON.stringify(e.corpo))) erros.push('NOME VAZOU para a nuvem');
        if (Object.keys(f2).sort().join() !== 'fase,formato,json,pessoas,quando,rodada,versao') erros.push('campos fora da regra: ' + Object.keys(f2));
      }
    }
    const r = await pg.evaluate(() => ({ trilha: __jogo.U.S.trilha, meta: __jogo.U.S.final && __jogo.U.S.final.meta, vit: __jogo.U.S.final && __jogo.U.S.final.vencedores }));
    console.log(`partida ${g + 1} (${HUMANOS[g % HUMANOS.length]} pessoa(s)): fase ${fim}, ${passos} cliques, trilha ${r.trilha}, venc ${JSON.stringify(r.vit)}${erros.length ? ' ERROS: ' + erros.slice(0, 5).join(' | ') : ''}`);
    if (erros.length) falhas++;
    await pg.close();
  }
  await br.close();
  process.exit(falhas ? 1 : 0);
})();
