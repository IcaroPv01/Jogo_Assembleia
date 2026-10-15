# Simulador Monte Carlo — baralho Economia (Módulo 5)

Jogadores-robô simples jogam partidas de 5 rodadas e mostram quanto cada país vence. **Serve pra achar país quebrado e comparar habilidades, não pra provar que o jogo é justo.** Leia `economia/balanceamento.md` (project-files) antes de confiar nos números.

## Rodar
```
cd ferramentas/simulador
python3 rodar.py 60000 1        # partidas, semente
python3 rodar.py 60000 1 0.55 0.45   # com mesa aprovando mais (pM, pP)
```
Só precisa de Python 3 (sem pacotes).

## Arquivos
- `sim.py`: motor. Suposições no topo (`BASE`): troca aceita 85%, média aprovada 45%, pesada 35%, objetivo cumprido 55%, META = 13.
- `economia_paises.json`: força (ordem) e habilidades em código (`leve_auto`, `seguro`, `inflacao`, `hand4`, `peso2`, `inicio`, `pedagio`, `voto_extra`, `leve_bonus1x`, `obj_bonus`). Espelha `modelo_simulacao` de `economia/paises.json`.
- `rodar.py`: roda e imprime.

## Regras simuladas
Leve: troca aceita = +1 pt. Média: aprovada = 1 ajuda na crise; crise resolvida/atenuada dá +1 pt a cada ajudante. Pesada: custa 1 pt (pode ficar negativo), aprovada = devolve + 2 pts e 2 ajudas, reprovada perde o custo e tira 1 ajuda. Crise: rodadas 1, 3, 5; resolve com 2–3 ajudas (5 pts), atenua com ≥1 (3 pts), senão −2 (trilha mínimo 0). Fim: META 13 dá +2 a todos. Vence quem tem mais pontos (desempate: mais crises ajudadas).
