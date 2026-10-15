/* Envio do log da partida para o Firestore (plano grátis do Firebase) pela API REST: sem biblioteca, funciona no GitHub Pages.
 * Privacidade (público = ensino médio): o nome digitado de cada jogador NUNCA vai junto; o log só tem país, jogadas e pontos.
 * As regras do Firestore (jogo/README.md) só deixam CRIAR log novo com tamanho limitado e LER um log pelo código dele; não dá para listar nem apagar. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica(() => ({}));
  else raiz.Nuvem = fabrica(() => raiz.FIREBASE_CFG || {});
})(typeof self !== 'undefined' ? self : this, function (cfg) {
  'use strict';
  const ativo = () => { const c = cfg(); return !!(c.apiKey && c.projectId); };

  // cópia do log sem nada que identifique pessoas
  function anonimiza(log) {
    const l = JSON.parse(JSON.stringify(log));
    (l.mesa || []).forEach(m => { m.jogador = null; });
    return l;
  }

  // documento no formato da API REST do Firestore
  function documento(log) {
    const l = anonimiza(log), json = JSON.stringify(l);
    return { fields: {
      formato: { stringValue: l.formato }, versao: { stringValue: String(l.versaoJogo) }, fase: { stringValue: l.fase },
      rodada: { integerValue: String(l.rodada | 0) }, pessoas: { integerValue: String((l.mesa || []).filter(m => !m.bot).length) },
      quando: { timestampValue: new Date().toISOString() }, json: { stringValue: json } } };
  }

  // devolve { ok, id } ou { ok:false, erro }
  async function enviar(log) {
    if (!ativo()) return { ok: false, erro: 'nuvem não configurada' };
    const c = cfg(), ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), 10000);
    try {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(c.projectId)}/databases/(default)/documents/logs?key=${encodeURIComponent(c.apiKey)}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(documento(log)), signal: ctl ? ctl.signal : undefined });
      if (!r.ok) return { ok: false, erro: 'HTTP ' + r.status };
      const j = await r.json();
      return { ok: true, id: String(j.name || '').split('/').pop() };
    } catch (e) { return { ok: false, erro: String(e.message || e) }; } finally { if (t) clearTimeout(t); }
  }

  return { ativo, anonimiza, documento, enviar };
});
