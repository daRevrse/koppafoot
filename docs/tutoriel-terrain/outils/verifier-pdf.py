"""Repère les débris en bas de page (bordure d'un bloc repoussé à la page suivante)."""
import sys
import pymupdf
doc = pymupdf.open(sys.argv[1])
bad = 0
for i, pg in enumerate(doc):
    H = pg.rect.height
    bas = H - 17 * 72 / 25.4  # début de la marge basse
    for d in pg.get_drawings():
        r = d["rect"]
        filet = r.height < 2 and r.width > 400  # un trait de séparation voulu
        if r.y1 > bas - 12 and r.y0 > bas - 30 and r.height < 25 and not filet:
            bad += 1
            print(f"page {i + 1}: tracé {tuple(round(v) for v in r)}")
print("débris :", bad, "| pages :", len(doc))
