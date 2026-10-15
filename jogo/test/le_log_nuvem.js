// Lê um log guardado no Firestore pelo código dele e salva em arquivo. Uso: node test/le_log_nuvem.js CODIGO [saida.json]
// Usa apiKey/projectId de js/firebase-config.js (ou as variáveis FIREBASE_API_KEY e FIREBASE_PROJECT_ID).
const fs = require('fs'), path = require('path');
const cod = process.argv[2], saida = process.argv[3] || `log-${cod}.json`;
if (!cod) { console.error('Uso: node test/le_log_nuvem.js CODIGO [saida.json]'); process.exit(1); }
let cfg = { apiKey: process.env.FIREBASE_API_KEY, projectId: process.env.FIREBASE_PROJECT_ID };
if (!cfg.apiKey) { global.window = {}; eval(fs.readFileSync(path.join(__dirname, '../js/firebase-config.js'), 'utf8')); cfg = global.window.FIREBASE_CFG; }
(async () => {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${cfg.projectId}/databases/(default)/documents/logs/${encodeURIComponent(cod)}?key=${cfg.apiKey}`);
  if (!r.ok) { console.error('Erro', r.status, (await r.text()).slice(0, 300)); process.exit(1); }
  const d = await r.json();
  fs.writeFileSync(saida, JSON.stringify(JSON.parse(d.fields.json.stringValue), null, 1));
  console.log('salvo em', saida);
})();
