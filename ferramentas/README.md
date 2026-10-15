# Ferramentas Assembleia (cartas + PDF)

Serve aos 3 baralhos. Carta = 63x88 mm (poker). Bandeiras: HatScripts/circle-flags. Ícones: Tabler. Fontes: Caladea (títulos) + Carlito (corpo).

## Rodar
1. `npm install` (uma vez; precisa Node 18+)
2. `node gen_cartas.js economia_baralho.json` → `saida/economia/*.png|svg` + `index.html` (galeria)
3. `python3 gen_pdf.py saida/economia` → `impressao.pdf` (A4, 3x3, marcas de corte). Imprimir em 100%.
   (precisa `pip install reportlab`)

## JSON do baralho
`baralho`: id, nome, sigla, cor, cor2, icone. `cartas`: lista de 3 tipos.
- `carta`: `pais`|`evento`|`acao`|`objetivo` (formato fechado no Módulo 1, regras/decisoes.md §3)
- **pais**: id, nome, bandeira (ISO), forca (1-6), resumo, habilidades[], figura (+ opcionais capital, moeda, sistema)
- **evento**: id, titulo, tipo (`fixa`|`aleatoria`), ano, descricao, topicos_debate[], requisito, pts_resolver, pts_atenuar (+ icone Tabler, natureza `crise`|`oportunidade`)
- **acao**: id, nome, efeito, custo (opcional) (+ pais, bandeira, tier `leve`|`medio`|`pesado`, flavor)
- **objetivo**: id, texto, pts
- `provisorio: true` → carimbo vermelho "PROVISÓRIO". Tirar quando a carta for final.

## Novo baralho
Copiar `economia_baralho.json`, trocar `baralho` (cor/ícone) e as cartas. Bandeira nova: baixar `https://raw.githubusercontent.com/HatScripts/circle-flags/gh-pages/flags/{cod}.svg` para `assets/flags/`. Ícone novo: Tabler `icons/outline/{nome}.svg` para `assets/icons/`.

Título longo: fonte encolhe; se ainda não couber, quebra em 2 linhas. Selo da bandeira fica à direita.
