# Assembleia online (baralho Economia)

Versão jogável no navegador. **Uma tela só**, passa-e-joga (computador ou projetor). 100% estático: sem servidor, sem instalação.

- Jogar: abrir `index.html` (funciona até com duplo clique) ou o site do GitHub Pages: `/jogo/`.
- Regras que o jogo aplica e escolhas em aberto: `regras/jogo-online.md` (na pasta do projeto).

## Pastas
- `index.html`, `css/jogo.css`: tela.
- `js/engine.js`: **motor das regras** (sem tela, estado em JSON). Constantes de regra no topo (`R`).
- `js/cartas.js`: desenho das cartas em HTML/CSS (mesmo visual aprovado do gerador de cartas).
- `js/ui.js`: interface (início, escolha de países, mesa, fases, telas de privacidade).
- `dados/economia.js`: **gerado** por `montar_dados.js` (não editar à mão).
- `montar_dados.js`: junta `economia/cartas.json` (textos), `paises/fichas.json` (fichas) e, se existir, `economia/paises.json` (Módulo 5: força final e habilidades). Rodar de novo quando esses arquivos mudarem: `node jogo/montar_dados.js [cartas.json] [fichas.json] [paises.json]`.
- `assets/flags`: bandeiras usadas.
- `test/sim.js`: partidas com bots direto no motor (confere regras e mostra equilíbrio). `node test/sim.js 500 0.65`
- `test/ui.js`: abre no Chromium e joga partidas clicando ao acaso (precisa `playwright-core`).

## Celular depois
O motor não conhece a tela. Para uma versão em celulares: cada celular manda as mesmas ações (`votar`, `jogar`, `assinar`, `passar`...) para o mesmo estado, e vê só a sua parte (objetivo, mão, voto). A `ui.js` de uma tela só já separa o que é privado atrás de telas de "passe a tela para". Falta só um canal entre aparelhos.
