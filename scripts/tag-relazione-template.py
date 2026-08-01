"""
Ricava il template `relazione-dm329.docx` dal documento formattato in Word.

Perché esiste
-------------
La composizione della relazione è chiusa; la formattazione la decide il redattore in Word.
Rigenerare il documento da uno script Python (com'era fino alla Fase 5) distruggerebbe ogni
volta quella formattazione. Ma il documento formattato è un documento *reso*: contiene i
dati di un impianto di esempio, righe di tabella ripetute e un solo ramo di ogni frase
condizionale.

Questo script fa il passaggio inverso: prende il documento formattato e ne ricava il
template, cioè
  - sostituisce i valori con i tag di docxtemplater,
  - collassa le righe ripetute in una sola riga avvolta in un loop,
  - ricrea i rami condizionali che nel documento reso non compaiono,
  - rimette al posto dell'immagine il tag `{%schemaImpianto}`.

Ogni sostituzione dichiara il testo che si aspetta di trovare e **fallisce** se non lo
trova: meglio interrompersi che produrre in silenzio un template mutilo.

Uso
---
    python scripts/tag-relazione-template.py [sorgente.docx]

Il flusso di lavoro previsto: si riformatta il documento di esempio in Word, si rilancia
questo script, si rigenera l'esempio e si confronta. Se un giorno si preferisse curare
direttamente il template, basta smettere di eseguire lo script: da quel momento la sorgente
di verità è il `.docx` in `public/templates/`.
"""

import copy
import os
import re
import shutil
import sys
import zipfile

import docx

# Le valvole di un recipiente vanno una per riga dentro la cella: i tag di loop stanno in
# paragrafi propri, che docxtemplater rimuove lasciando solo le righe ripetute. Scritti di
# seguito nello stesso paragrafo ripeterebbero il testo senza mai andare a capo.
VALVOLE_ANNIDATE = ["{#valvole}", "{pos} · n.f. {nFabbrica}", "{/valvole}"]

SRC_DEFAULT = os.path.join("DOCUMENTAZIONE", "relazione", "ESEMPIO_nuova_struttura_revFB.docx")
OUT = os.path.join("public", "templates", "relazione-dm329.docx")


# ---------------------------------------------------------------------------
# Primitive
# ---------------------------------------------------------------------------

def atteso(condizione, messaggio):
    if not condizione:
        raise SystemExit("Il documento sorgente non ha la forma attesa: " + messaggio)


def testo(p):
    return p.text.strip()


def scrivi(p, nuovo, run_modello=None):
    """
    Sostituisce il contenuto del paragrafo conservando la formattazione del primo run.

    Le celle vuote non hanno alcun run: lì il run va creato, e prende le proprietà da un
    run modello della stessa riga — altrimenti il tag erediterebbe il font di base invece
    di quello della tabella.
    """
    if not p.runs:
        r = p.add_run()
        if run_modello is not None and run_modello._r.rPr is not None:
            r._r.insert(0, copy.deepcopy(run_modello._r.rPr))
    p.runs[0].text = nuovo
    for r in list(p.runs[1:]):
        r._r.getparent().remove(r._r)


def elimina(p):
    p._p.getparent().remove(p._p)


def clona_dopo(p, nuovo_testo=None, evidenzia=None):
    """Duplica il paragrafo (formattazione inclusa) e lo inserisce subito dopo."""
    copia = copy.deepcopy(p._p)
    p._p.addnext(copia)
    clone = docx.text.paragraph.Paragraph(copia, p._parent)
    if nuovo_testo is not None:
        scrivi(clone, nuovo_testo)
    if evidenzia is not None:
        for r in clone.runs:
            r.font.highlight_color = evidenzia
    return clone


def paragrafo_tag(modello, tag, dopo):
    """
    Inserisce un paragrafo che contiene *solo* un tag di sezione.

    docxtemplater con `paragraphLoop` elimina i paragrafi che contengono soltanto un tag di
    apertura o chiusura: è il modo di delimitare un blocco senza inquinare il testo reso.
    """
    copia = copy.deepcopy(modello._p)
    dopo._p.addnext(copia)
    p = docx.text.paragraph.Paragraph(copia, modello._parent)
    scrivi(p, tag)
    p.paragraph_format.space_after = 0
    return p


def avvolgi(p, nome_sezione, modello=None):
    """Circonda un paragrafo con {#sezione} … {/sezione}, senza toccarne i run."""
    base = modello or p
    chiusura = paragrafo_tag(base, "{/%s}" % nome_sezione, p)
    apertura = copy.deepcopy(base._p)
    p._p.addprevious(apertura)
    ap = docx.text.paragraph.Paragraph(apertura, p._parent)
    scrivi(ap, "{#%s}" % nome_sezione)
    ap.paragraph_format.space_after = 0
    return ap, chiusura


def riga_loop(tabella, lista, celle, attesi):
    """
    Riduce una tabella al solo modello di riga: intestazione + una riga di dati, con i tag
    al posto dei valori e il loop che la avvolge.

    `celle` è una lista per colonna: una stringa (cella a un paragrafo) oppure una lista di
    stringhe (cella a più paragrafi, es. costruttore su una riga e modello sull'altra).

    Per i loop annidati dentro una cella (le valvole di un recipiente, i compressori
    connessi a una valvola) i tag vanno in paragrafi propri: `{#valvole}…{/valvole}` scritti
    di seguito nello stesso paragrafo ripeterebbero il testo senza andare a capo.
    """
    atteso(len(tabella.rows) >= 2, "tabella con meno di due righe")
    riga = tabella.rows[1]
    atteso(
        len(riga.cells) == len(celle),
        "attese %d colonne, trovate %d" % (len(celle), len(riga.cells)),
    )
    for j, valore in enumerate(attesi):
        if valore is None:
            continue
        trovato = riga.cells[j].text.strip()
        atteso(trovato == valore, "colonna %d: atteso %r, trovato %r" % (j, valore, trovato))

    for r in list(tabella.rows[2:]):
        tabella._tbl.remove(r._tr)

    # La riga superstite può essere la capofila di una fusione verticale del documento
    # reso. Lasciarla porterebbe `vMerge` in *ogni* riga generata, dove poi `fusioneCelle`
    # ne inietta un'altra: le fusioni le calcola il render, non il template.
    for cella in riga.cells:
        tcPr = cella._tc.tcPr
        if tcPr is None:
            continue
        for vmerge in tcPr.findall(
            "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}vMerge"
        ):
            tcPr.remove(vmerge)

    # Run di riferimento per le celle vuote: la formattazione del testo di tabella sta sui
    # run, non sullo stile, quindi va presa da una cella che ne ha uno.
    run_modello = next(
        (p.runs[0] for c in riga.cells for p in c.paragraphs if p.runs), None
    )

    for j, contenuto in enumerate(celle):
        cella = riga.cells[j]
        pezzi = contenuto if isinstance(contenuto, list) else [contenuto]
        for k, pezzo in enumerate(pezzi):
            if k < len(cella.paragraphs):
                scrivi(cella.paragraphs[k], pezzo, run_modello)
            else:
                nuovo = cella.add_paragraph()
                scrivi(nuovo, pezzo, run_modello)
        for p in list(cella.paragraphs[len(pezzi):]):
            elimina(p)

    prima = riga.cells[0].paragraphs[0]
    prima.runs[0].text = "{#%s}%s" % (lista, prima.runs[0].text)
    ultima = riga.cells[-1].paragraphs[-1]
    ultima.runs[-1].text = "%s{/%s}" % (ultima.runs[-1].text, lista)


# ---------------------------------------------------------------------------
# Conversione
# ---------------------------------------------------------------------------

def converti(sorgente, destinazione):
    d = docx.Document(sorgente)
    P = d.paragraphs
    T = d.tables

    # --- Copertina ---------------------------------------------------------
    atteso(testo(P[7]) == "ESEMPIO S.P.A.", "P7 non è la ragione sociale")
    scrivi(P[7], "{premessa.ragioneSociale}")

    atteso(testo(P[8]).startswith("Via Esempio"), "P8 non è la sede legale")
    atteso(testo(P[9]).startswith("31013"), "P9 non è la località della sede legale")
    # Le due righe diventano un tag solo: il valore porta un a capo e docxtemplater, con
    # `linebreaks: true`, lo rende come <w:br/> dentro lo stesso paragrafo.
    scrivi(P[8], "{premessa.sedeLegaleCopertina}")
    elimina(P[9])

    atteso(testo(P[14]).startswith("Via Esempio"), "P14 non è il sito produttivo")
    scrivi(P[14], "{premessa.sitoProduttivoCopertina}")
    elimina(P[15])

    # --- §1 Premessa -------------------------------------------------------
    atteso(testo(P[22]).startswith("La presente relazione tecnica"), "P22 non è la premessa")
    scrivi(
        P[22],
        "La presente relazione tecnica si riferisce all’impianto a pressione installato "
        "presso il sito produttivo della ditta {premessa.ragioneSociale}, con sede sociale "
        "in {premessa.sedeLegale}, esercente attività di {premessa.descrizioneAttivita}, "
        "{premessa.ubicazione}.",
    )

    # I due capoversi condizionali restano intatti: quello sulla revisione contiene il
    # segnaposto giallo che il redattore compila in Word, e riscriverlo lo perderebbe.
    atteso(testo(P[25]).startswith("L’attuale revisione"), "P25 non è il capoverso di revisione")
    avvolgi(P[25], "premessa.haRevisione", modello=P[24])
    atteso(testo(P[26]).startswith("Ove previsto"), "P26 non è il capoverso spessimetriche")
    avvolgi(P[26], "premessa.haSpessimetrica", modello=P[24])

    # --- §2.1 Sezioni dell'impianto ---------------------------------------
    atteso(testo(P[30]).startswith("–"), "P30 non è la prima voce dell'elenco sezioni")
    scrivi(P[30], "–\t{voce}")
    avvolgi(P[30], "descrizioneGenerale.sezioni", modello=P[29])
    for i in range(31, 36):
        atteso(testo(P[i]).startswith("–"), "P%d non è una voce dell'elenco sezioni" % i)
        elimina(P[i])

    # --- §2.2 Condizioni di installazione ----------------------------------
    riga_loop(
        T[2], "condizioniInstallazione",
        ["{requisito}", "{esito}", "{note}"],
        ["Ubicazione impianto", None, None],
    )

    # --- §2.3 Schema d'impianto -------------------------------------------
    atteso("<w:drawing" in P[41]._p.xml, "P41 non contiene l'immagine dello schema")
    scrivi(P[41], "{%schemaImpianto}")

    # --- §3 Fluidi ---------------------------------------------------------
    riga_loop(
        T[3], "fluidi.righe",
        ["{circuito}", "{fluido}", "{gruppo}", "{provenienza}", "{qualita}"],
        ["Aria compressa", "Aria ambiente", None, None, None],
    )

    # La frase esiste in due varianti: evidenziata quando l'aria aspirata è dichiarata non
    # pulita, piana altrimenti. Il documento reso ne conserva una sola, l'altra va ricreata.
    atteso(testo(P[45]).startswith("Quest’ultima risulta priva"), "P45 non è la frase sulle sostanze nocive")
    atteso(
        P[45].runs[0].font.highlight_color is not None,
        "P45 dovrebbe essere evidenziata: l'esempio è generato con aria non pulita",
    )
    piana = clona_dopo(P[45], evidenzia=None)
    for r in piana.runs:
        r.font.highlight_color = None
    avvolgi(P[45], "fluidi.evidenziaNocive", modello=P[44])
    avvolgi(piana, "^fluidi.evidenziaNocive".replace("^", ""), modello=P[44])
    # La sezione inversa non si scrive con {#…}: si corregge il tag di apertura.
    apertura_piana = piana._p.getprevious()
    docx.text.paragraph.Paragraph(apertura_piana, piana._parent).runs[0].text = (
        "{^fluidi.evidenziaNocive}"
    )

    # --- §4 Caratterizzazione ---------------------------------------------
    riga_loop(
        T[4], "caratteristiche",
        ["{pos}", "{descrizione}", ["{costruttore}", "{modello}"], "{capacita}",
         "{pressione}", "{temperatura}", "{categoria}", "{anno}", "{nFabbrica}"],
        ["C1", "Compressore", None, "8000", None, None, None, "2025", None],
    )

    # --- §5.2 Esiti --------------------------------------------------------
    riga_loop(
        T[6], "esiti",
        ["{pos}", "{apparecchiatura}", ["{costruttore}", "{modello}"], "{volume}", "{ps}",
         "{psPerV}", "{categoria}", "{adempimento}", "{statoInail}", "{verificaIntegritaMark}"],
        ["C1", "Compressore", None, None, None, None, None, "Escluso", "Nuova richiesta", None],
    )

    # --- §5.3 Protezioni ---------------------------------------------------
    riga_loop(
        T[7], "protezioni.serbatoi",
        ["{pos}", VALVOLE_ANNIDATE, "{scaricoCondensa}",
         "{finituraInterna}", "{ancoraggio}", "{manometro}"],
        ["S1", None, "Automatico", "Zincato", "Sì", None],
    )
    riga_loop(
        T[8], "protezioni.altre",
        ["{pos}", VALVOLE_ANNIDATE, "{manometro}"],
        ["C1.1", None, "a bordo macchina"],
    )

    # --- §5.4 Tubazioni ----------------------------------------------------
    atteso(testo(P[60]).startswith("Tutte le tubazioni"), "P60 non è la nota sulle tubazioni")
    oltre = clona_dopo(
        P[60],
        "Le tubazioni dell’impianto presentano DN massimo pari a {tubazioni.dnMassimo} mm, "
        "superiore alla soglia di 80 mm dell’art. 3 comma bb): rientrano pertanto nel campo "
        "di applicazione del D.M. 329/2004 e sono soggette ai relativi obblighi di denuncia.",
        evidenzia=docx.enum.text.WD_COLOR_INDEX.YELLOW,
    )
    avvolgi(P[60], "tubazioni.escluse", modello=P[59])
    avvolgi(oltre, "tubazioni.escluse", modello=P[59])
    apertura_oltre = oltre._p.getprevious()
    docx.text.paragraph.Paragraph(apertura_oltre, oltre._parent).runs[0].text = (
        "{^tubazioni.escluse}"
    )

    # --- §6 Valvole di sicurezza ------------------------------------------
    connesse = [
        "{#connesse}",
        "Pos. {pos} – {descrizione} · {costruttore} {modello}",
        "{/connesse}",
    ]
    riga_loop(
        T[9], "valvole.portata",
        ["{posValvola}", "{nFabbricaValvola}", connesse, "{portataMaxTesto}",
         "{portataScaricata}", "{adeguatoMark}"],
        ["C1.2", "1001913158", None, "8000", "21500", None],
    )
    riga_loop(
        T[10], "valvole.pressione",
        ["{posValvola}", "{nFabbricaValvola}", connesse, "{psRecipiente}",
         "{pressioneTaratura}", "{adeguatoMark}"],
        ["C1.2", "1001913158", None, "11", "10", None],
    )

    # --- §7.2 Riqualificazione --------------------------------------------
    riga_loop(
        T[12], "riqualificazione",
        ["{pos}", "{apparecchiatura}", "{categoria}", "{verificaFunzionamento}",
         "{verificaIntegrita}"],
        ["C1.1", "Serbatoio disoleatore", "III", None, None],
    )

    # --- §8 Allegati -------------------------------------------------------
    atteso(testo(P[74]).startswith("Attestazioni"), "P74 non è la prima voce degli allegati")
    scrivi(P[74], "{voce}")
    avvolgi(P[74], "allegati", modello=P[68])
    for i in (75, 76):
        elimina(P[i])

    d.save(destinazione)


def rifinisci_pacchetto(percorso):
    """
    Due ritocchi che vivono solo nel pacchetto zip, non nel modello di python-docx:

    - «Pag. 2di 9»: nel piè di pagina manca lo spazio prima di «di». Refuso di battitura,
      si corregge qui perché il template è ormai la sorgente di verità.
    - L'immagine dello schema del documento reso resta orfana una volta sostituita dal tag:
      va tolta dal pacchetto insieme alla sua relazione, altrimenti verrebbe trascinata in
      ogni relazione generata.
    """
    temporaneo = percorso + ".tmp"
    esiti = {"spazio": False, "immagine": False}

    with zipfile.ZipFile(percorso) as src:
        nomi = set(src.namelist())
        media = sorted(n for n in nomi if n.startswith("word/media/"))
        rels = src.read("word/_rels/document.xml.rels").decode("utf-8")
        documento = src.read("word/document.xml").decode("utf-8")
        atteso(
            'r:embed="' not in documento,
            "il template contiene ancora un riferimento a un'immagine",
        )

        with zipfile.ZipFile(temporaneo, "w", zipfile.ZIP_DEFLATED) as dst:
            for info in src.infolist():
                if info.filename in media:
                    esiti["immagine"] = True
                    continue

                dati = src.read(info.filename)
                if info.filename.startswith("word/footer"):
                    xml = dati.decode("utf-8")
                    if '<w:t xml:space="preserve">di </w:t>' in xml:
                        xml = xml.replace(
                            '<w:t xml:space="preserve">di </w:t>',
                            '<w:t xml:space="preserve"> di </w:t>',
                        )
                        dati = xml.encode("utf-8")
                        esiti["spazio"] = True
                elif info.filename == "word/_rels/document.xml.rels":
                    for target in media:
                        breve = target[len("word/"):]
                        dati = re.sub(
                            r'<Relationship[^>]*Target="%s"[^>]*/>' % re.escape(breve),
                            "",
                            rels,
                        ).encode("utf-8")
                        rels = dati.decode("utf-8")

                dst.writestr(info, dati)

    shutil.move(temporaneo, percorso)
    return esiti


if __name__ == "__main__":
    sorgente = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    converti(sorgente, OUT)
    esiti = rifinisci_pacchetto(OUT)
    print("Template scritto in %s (%d byte)" % (OUT, os.path.getsize(OUT)))
    print("  spazio nel pie di pagina: %s" % ("corretto" if esiti["spazio"] else "non trovato"))
    print("  immagine di esempio: %s" % ("rimossa" if esiti["immagine"] else "assente"))
