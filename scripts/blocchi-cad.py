"""Legge Blocchi.pdf: isola le voci della tavola, ne stampa le misure, le ritaglia.

La pagina ha rotation 270: i rect di get_drawings() sono nello spazio non ruotato e
vanno moltiplicati per page.rotation_matrix, altrimenti finiscono tutti in una banda.
Il committente ha confermato che i blocchi sono tutti alla stessa scala fra loro:
i rapporti stampati qui sono quindi confrontabili fra un blocco e l'altro.
"""
import argparse, os, sys
import pymupdf

SRC = os.environ.get(
    "BLOCCHI_PDF",
    r"C:\Users\FrancescoBertin\Desktop\CLAUDE CODE\OFF-TICKET_UT\DOCUMENTAZIONE\relazione\Blocchi.pdf",
)
NOMI = ["compressore", "compressore-disoleatore", "serbatoio-verticale", "serbatoio-orizzontale",
        "essiccatore", "filtro", "filtro-recipiente", "essiccatore-scambiatore", "tanica",
        "separatore", "pacco-bombole", "riduttore", "valvole", "tubazioni", "muro", "freccia",
        "linea-condense"]

def gruppi(page):
    M = page.rotation_matrix
    box = [d["rect"] * M for d in page.get_drawings()]
    box = [r for r in box if r.width < 900 and r.height < 900]
    box.sort(key=lambda r: r.y0)
    fuori, corrente = [], [box[0]]
    for r in box[1:]:
        if r.y0 - max(x.y1 for x in corrente) > 12:
            fuori.append(corrente); corrente = [r]
        else:
            corrente.append(r)
    fuori.append(corrente)
    return fuori

def rettangolo(g):
    return pymupdf.Rect(min(r.x0 for r in g), min(r.y0 for r in g),
                        max(r.x1 for r in g), max(r.y1 for r in g))

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--misure", action="store_true")
    p.add_argument("--ritagli", metavar="CARTELLA")
    a = p.parse_args()

    page = pymupdf.open(SRC)[0]
    g = gruppi(page)
    if len(g) != len(NOMI):
        print(f"attesi {len(NOMI)} gruppi, trovati {len(g)}: la soglia di stacco va rivista",
              file=sys.stderr)
        sys.exit(1)

    base = rettangolo(g[NOMI.index("essiccatore")]).width
    for nome, gruppo in zip(NOMI, g):
        r = rettangolo(gruppo)
        if a.misure:
            print(f"{nome:26} {r.width:7.1f} x {r.height:7.1f}   "
                  f"rapporti sul rombo: {r.width/base:5.2f} x {r.height/base:5.2f}")
        if a.ritagli:
            clip = pymupdf.Rect(r.x0 - 20, r.y0 - 30, r.x1 + 20, r.y1 + 20) & page.rect
            page.get_pixmap(clip=clip, dpi=300).save(os.path.join(a.ritagli, f"cad-{nome}.png"))

main()
