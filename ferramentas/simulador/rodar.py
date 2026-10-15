"""Roda o simulador do baralho Economia (Módulo 5).
Uso: python3 rodar.py [N] [seed] [pM] [pP]
Lê economia_paises.json (força + habilidades em código) e imprime vitórias por país.
"""
import json, sys, os
import sim

aqui = os.path.dirname(os.path.abspath(__file__))
P = json.load(open(os.path.join(aqui, 'economia_paises.json')))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 60000
seed = int(sys.argv[2]) if len(sys.argv) > 2 else 1
base = dict(sim.BASE)
if len(sys.argv) > 3: base['pM'] = float(sys.argv[3])
if len(sys.argv) > 4: base['pP'] = float(sys.argv[4])
r = sim.run(P, N=N, seed=seed, base=base)
print(f"partidas={N} pM={base['pM']} pP={base['pP']}")
for c in sorted(P, key=lambda c: -P[c]['f']):
    print(f"{c} força {P[c]['f']}  vitórias {r['win'][c]*100:5.1f}%  pts médios {r['pi'][c]:.1f}")
print('vitórias por posição de jogo (1º..5º):', [round(r['pos'][i]*100, 1) for i in range(5)])
print(f"mesa bate META: {r['meta']*100:.0f}%  crises (R/A/U):", {k: round(v*100) for k, v in r['res'].items()})
