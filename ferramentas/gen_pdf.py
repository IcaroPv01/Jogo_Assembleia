#!/usr/bin/env python3
"""PNGs das cartas -> PDF A4 de impressao (3x3 por pagina, 63x88mm, marcas de corte).
Uso: python3 gen_pdf.py saida/economia [-o saida/economia/impressao.pdf]
Imprima em 'Tamanho real' / 100% (nao 'ajustar a pagina')."""
import sys, glob, os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

pasta = sys.argv[1] if len(sys.argv) > 1 else "saida/economia"
out = sys.argv[sys.argv.index("-o") + 1] if "-o" in sys.argv else os.path.join(pasta, "impressao.pdf")
ordem = {"pais": 0, "evento": 1, "acao": 2}
arqs = sorted(glob.glob(os.path.join(pasta, "*.png")), key=lambda f: (ordem.get(os.path.basename(f).split("_")[0], 9), f))
CW, CH = 63 * mm, 88 * mm
COLS, LINS = 3, 3
PW, PH = A4
x0 = (PW - COLS * CW) / 2
y0 = (PH - LINS * CH) / 2
c = canvas.Canvas(out, pagesize=A4)
c.setTitle("Assembleia - cartas para impressao")
for p in range(0, len(arqs), COLS * LINS):
    for i, f in enumerate(arqs[p:p + COLS * LINS]):
        col, lin = i % COLS, i // COLS
        c.drawImage(f, x0 + col * CW, PH - y0 - (lin + 1) * CH, CW, CH)
    c.setLineWidth(0.3); c.setStrokeColorRGB(0, 0, 0)
    for k in range(COLS + 1):  # marcas verticais, fora da area das cartas
        x = x0 + k * CW
        c.line(x, PH - y0 + 1.5 * mm, x, PH - y0 + 5 * mm)
        c.line(x, y0 - 1.5 * mm, x, y0 - 5 * mm)
    for k in range(LINS + 1):
        y = PH - y0 - k * CH
        c.line(x0 - 1.5 * mm, y, x0 - 5 * mm, y)
        c.line(x0 + COLS * CW + 1.5 * mm, y, x0 + COLS * CW + 5 * mm, y)
    c.showPage()
c.save()
print(f"{len(arqs)} cartas, {(len(arqs) + 8) // 9} paginas -> {out}")
