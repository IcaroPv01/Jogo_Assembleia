# Assembleia online (baralho Economia)

Versão jogável no navegador. **Uma tela só**, passa-e-joga (computador ou projetor). 100% estático: sem servidor, sem instalação.

- Jogar: abrir `index.html` (funciona até com duplo clique) ou o site do GitHub Pages: `/jogo/`.
- Regras que o jogo aplica e escolhas em aberto: `regras/jogo-online.md` (na pasta do projeto).

## Pastas
- `index.html`, `css/jogo.css`: tela.
- `js/engine.js`: **motor das regras** (sem tela, estado em JSON). Constantes de regra no topo (`R`).
- `js/cartas.js`: desenho das cartas em HTML/CSS (mesmo visual aprovado do gerador de cartas).
- `js/bot.js`: **bots** (funções puras: jogar, votar, trocar, escolher voto aberto/fechado). Cada decisão vem com uma frase curta que a tela mostra.
- `js/nuvem.js`, `js/firebase-config.js`: envio do log da partida para o Firestore (Firebase, plano grátis) pela API REST. Config vazia = desligado.
- `firestore.rules`: regras do Firestore para colar no console do Firebase.
- `js/ui.js`: interface (início, escolha de países, mesa, fases, telas de privacidade).
- `dados/economia.js`: **gerado** por `montar_dados.js` (não editar à mão).
- `montar_dados.js`: junta `economia/cartas.json` (textos), `paises/fichas.json` (fichas) e, se existir, `economia/paises.json` (Módulo 5: força final e habilidades). Rodar de novo quando esses arquivos mudarem: `node jogo/montar_dados.js [cartas.json] [fichas.json] [paises.json]`.
- `assets/flags`: bandeiras usadas.
- `test/sim.js`: partidas com bots direto no motor (confere regras e mostra equilíbrio). `node test/sim.js 500 0.65`
- `test/bots.js`: partidas só com os bots de `js/bot.js` (confere regras e mostra equilíbrio). `node test/bots.js 500`
- `test/le_log_nuvem.js`: baixa um log guardado na nuvem pelo código. `node test/le_log_nuvem.js CODIGO`
- `test/analisa_log.js`: resumo legível de um log baixado do jogo. `node test/analisa_log.js arquivo.json`
- `test/ui.js`: abre no Chromium e joga partidas clicando ao acaso (precisa `playwright-core`).

## Log da partida
O motor guarda cada ação aceita (quem jogou qual carta, votos, trocas, pontos e trilha depois de cada ação, crise aberta) em `estado.hist`. `Engine.relatorio(D, estado)` monta o arquivo JSON (mesa, objetivos, crises, final, eventos, diário). No jogo: botão **Baixar log desta partida** no fim da partida e no menu "Sair"; na tela inicial, **Baixar log das últimas partidas** (guarda as 5 últimas no navegador). Para analisar: `node test/analisa_log.js arquivo.json`.

## Logs na nuvem (Firebase)
Quando a partida termina, o jogo envia o log sozinho para o Firestore e mostra um **código** na tela de resultado. Se não houver internet, o log fica guardado no navegador e é enviado na próxima vez (e dá para usar "Baixar log"). Nada que identifique pessoas vai junto: o nome digitado de cada jogador é removido antes do envio; o log só tem país, jogadas, votos e pontos.

Como ligar (uma vez, com a conta Google do dono do projeto):
1. console.firebase.google.com → Adicionar projeto → nome qualquer → desligar o Google Analytics → Criar.
2. Menu Criação → Firestore Database → Criar banco de dados → modo de produção → região São Paulo (southamerica-east1) → Ativar.
3. Aba Regras → apagar tudo, colar o conteúdo de `jogo/firestore.rules` → Publicar.
4. Engrenagem → Configurações do projeto → Seus aplicativos → ícone web `</>` → apelido → Registrar (sem Hosting) → copiar `apiKey` e `projectId`.
5. Colocar os dois em `jogo/js/firebase-config.js` e fazer merge. (Esses dois não são segredo; as regras protegem os dados.)

Regras: qualquer pessoa pode criar um log novo (máx. ~400 KB, só os campos esperados); ler só com o código do log (não lista); ninguém altera nem apaga pelo site. Para ver todos os logs, o dono usa o console do Firebase (Firestore Database → logs).

## Bots
Na escolha dos países dá para marcar quantas pessoas jogam (1 a 5); os outros lugares viram bots. Bot não vê a mão nem o objetivo dos outros. Ele usa a própria mão, o próprio objetivo secreto e o que está na mesa. As decisões são funções do estado (sem sorteio escondido), então a tela mostra a jogada, a frase que explica e só depois manda a ação ao motor.

## Celular depois
O motor não conhece a tela. Para uma versão em celulares: cada celular manda as mesmas ações (`votar`, `jogar`, `assinar`, `passar`...) para o mesmo estado, e vê só a sua parte (objetivo, mão, voto). A `ui.js` de uma tela só já separa o que é privado atrás de telas de "passe a tela para". Falta só um canal entre aparelhos.
