/* Desenho das cartas em HTML/CSS (mesmo visual aprovado do gerador: pergaminho, moldura, selo à direita). */
(function () {
  const D = DADOS;
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const TIER = { leve: ['#4f8f5b', 'LEVE', 1], medio: ['#c98a1b', 'MÉDIO', 2], pesado: ['#a63a2e', 'PESADO', 3] };
  const SUB = { fixo: ['#1f3a5f', 'FIXO'], crise: ['#7a2e2e', 'CRISE'], oportunidade: ['#2f6b46', 'OPORTUNIDADE'] };
  const icone = (n, cls = '') => `<svg class="ico ${cls}" viewBox="0 0 24 24">${D.icones[n] || ''}</svg>`;
  const bandeira = (p, cls = '') => `<img class="flag ${cls}" src="assets/flags/${p.bandeira}.svg" alt="${esc(p.nome)}">`;
  const porId = (l, id) => l.find(x => x.id === id);
  const carimbo = () => (D.provisorio ? '<div class="c-carimbo">PROVISÓRIO</div>' : '');
  const cls = t => (t.length > 20 ? 'muito' : t.length > 13 ? 'longo' : '');
  const estilo = (cw, c1, cs) => `style="--cw:${cw}px;--c1:${c1};--cs:${cs}"`;
  const B = D.baralho;

  function topo(titulo, selo) { return `<div class="c-topo"><div class="c-titulo ${cls(titulo)}">${esc(titulo)}</div><div class="c-selo">${selo}</div></div>`; }

  function pais(p, cw = 300, extra = '') {
    return `<div class="carta ${extra}" ${estilo(cw, B.cor, B.cor)}>${topo(p.nome, `<img src="assets/flags/${p.bandeira}.svg" alt="">`)}
      <div class="c-tipo">DELEGADO · ${esc(B.nome.toUpperCase())}</div>
      <div class="c-arte"><div class="disco"><img src="assets/flags/${p.bandeira}.svg" alt=""></div></div>
      <div class="c-corpo">
        <div class="kv"><b>FORÇA</b><span class="c-forca">${[1, 2, 3, 4, 5, 6].map(i => `<i class="${i <= p.forca ? 'on' : ''}"></i>`).join('')}</span></div>
        <div class="kv"><b>CAPITAL</b><span>${esc(p.capital)}</span></div><div class="kv"><b>MOEDA</b><span>${esc(p.moeda)}</span></div>
        <div class="it">${esc(p.resumo)}</div><div class="rot">HABILIDADES</div>
        <ul>${p.habilidades.map(h => `<li>${esc(h)}</li>`).join('')}</ul></div>
      <div class="c-rodape"><span>Figura: ${esc(p.figura || '')}</span><span>${B.sigla}</span></div>${carimbo()}</div>`;
  }
  function evento(e, cw = 300, extra = '') {
    const [cor, nome] = SUB[e.natureza] || SUB.crise;
    return `<div class="carta ${extra}" ${estilo(cw, cor, cor)}>${topo(e.titulo, icone(e.icone))}
      <div class="c-tipo">EVENTO · ${e.tipo === 'fixa' ? 'FIXO' : 'ALEATÓRIO · ' + nome}${e.ano ? ' · ' + esc(e.ano) : ''}</div>
      <div class="c-arte"><div class="disco">${icone(e.icone)}</div></div>
      <div class="c-corpo" style="font-size:.66em"><div class="it">${esc(e.descricao)}</div>
        <div class="rot">TÓPICOS DE DEBATE</div><ul>${e.topicos.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="rot">PARA ELIMINAR</div><div>${esc(e.requisito)}</div></div>
      <div class="c-rodape"><span>Resolver +${e.pts_resolver} · Atenuar +${e.pts_atenuar}</span><span>${B.sigla}</span></div>${carimbo()}</div>`;
  }
  function acao(a, cw = 300, extra = '') {
    const [cor, nomeT, n] = TIER[a.tier];
    const p = porId(D.paises, a.pais);
    return `<div class="carta ${extra}" ${estilo(cw, B.cor, cor)}>${topo(a.nome, `<img src="assets/flags/${a.bandeira}.svg" alt="">`)}
      <div class="c-tipo">AÇÃO · ${esc((p ? p.nome : a.paisNome).toUpperCase())}</div>
      <div class="c-arte"><div class="disco"><div class="tier">${'<i></i>'.repeat(n)}<br>${nomeT}</div></div></div>
      <div class="c-corpo"><div class="rot">EFEITO</div><div class="grande">${esc(a.efeito)}</div></div>
      <div class="c-rodape"><span>${a.tipo === 'pesada' ? 'Custa 1 ponto' : 'País: ' + esc(a.paisNome)}</span><span>${B.sigla}</span></div>${carimbo()}</div>`;
  }
  function objetivo(o, cw = 300, extra = '') {
    return `<div class="carta ${extra}" ${estilo(cw, B.cor, B.cor)}>${topo('Objetivo', icone('star'))}
      <div class="c-tipo">OBJETIVO SECRETO · ${esc(B.nome.toUpperCase())}</div>
      <div class="c-arte"><div class="disco">${icone('star')}</div></div>
      <div class="c-corpo"><div class="grande" style="margin-top:.4em">${esc(o.texto)}</div></div>
      <div class="c-pontos">${o.pts} pts</div>
      <div class="c-rodape"><span></span><span>${B.sigla}</span></div>${carimbo()}</div>`;
  }
  function verso(cw = 150, rotulo = 'ASSEMBLEIA', extra = '') {
    return `<div class="carta verso ${extra}" ${estilo(cw, B.cor2, B.cor2)}><div class="logo-verso">${esc(rotulo)}<br>${icone('coin')}</div></div>`;
  }
  window.Cartas = { pais, evento, acao, objetivo, verso, icone, bandeira, esc, TIER, SUB };
})();
