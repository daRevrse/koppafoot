"""Planches d'aperçu d'un PDF : python3 apercu-pdf.py <pdf> <sortie-prefixe> [pages par planche]"""
import sys
import pymupdf
from PIL import Image
pdf, prefix = sys.argv[1], sys.argv[2]
per = int(sys.argv[3]) if len(sys.argv) > 3 else 8
doc = pymupdf.open(pdf)
imgs = []
for pg in doc:
    pix = pg.get_pixmap(dpi=45)
    imgs.append(Image.frombytes("RGB", (pix.width, pix.height), pix.samples))
cols = 4
for k in range(0, len(imgs), per):
    chunk = imgs[k:k + per]
    w, h = chunk[0].size
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (w + 10) + 10, rows * (h + 10) + 10), (200, 200, 200))
    for i, im in enumerate(chunk):
        sheet.paste(im, (10 + (i % cols) * (w + 10), 10 + (i // cols) * (h + 10)))
    sheet.save(f"{prefix}-{k // per + 1:02d}.jpg", quality=80)
print(len(doc), "pages")
