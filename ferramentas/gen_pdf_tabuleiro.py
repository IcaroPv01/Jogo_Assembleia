#!/usr/bin/env python3
"""tabuleiro.png -> tabuleiro_A3.pdf (1 pagina A3 paisagem) e tabuleiro_A4.pdf (2 paginas A4 retrato; cole lado a lado).
Uso: python3 gen_pdf_tabuleiro.py saida/economia"""
import sys, os
from PIL import Image
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
pasta = sys.argv[1] if len(sys.argv) > 1 else "saida/economia"
im = Image.open(os.path.join(pasta, "tabuleiro.png")).convert("RGB")
w, h = im.size
c = canvas.Canvas(os.path.join(pasta, "tabuleiro_A3.pdf"), pagesize=landscape(A3))
c.drawImage(ImageReader(im), 0, 0, *landscape(A3)); c.save()
c = canvas.Canvas(os.path.join(pasta, "tabuleiro_A4.pdf"), pagesize=A4)
for k, box in enumerate([(0, 0, w // 2, h), (w // 2, 0, w, h)]):
    c.drawImage(ImageReader(im.crop(box)), 0, 0, *A4)
    c.setFont("Helvetica", 7); c.drawString(8, 6, f"Tabuleiro A4 - parte {k + 1}/2 (cole a parte 1 a esquerda da parte 2; imprimir em 100%)")
    c.showPage()
c.save()
print("tabuleiro_A3.pdf, tabuleiro_A4.pdf ->", pasta)
