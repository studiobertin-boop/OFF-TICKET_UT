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

I punti d'aggancio si cercano per **testo**, non per posizione. Ancorarli al numero di
paragrafo aveva chiuso il giro: recependo una revisione, l'indirizzo di copertina è passato
da due paragrafi a uno con l'a capo dentro, e da lì in poi ogni conteggio slittava di uno.
Cercando per testo, il documento può guadagnare o perdere paragrafi senza che lo script se
ne accorga, e sono ammesse entrambe le forme dell'indirizzo.

Uso
---
    python scripts/tag-relazione-template.py [sorgente.docx]

Il flusso di lavoro previsto:

  1. npx tsx scripts/generate-relazione-sample.ts esempio.docx schema.png
  2. si riformatta `esempio.docx` in Word
  3. python scripts/tag-relazione-template.py esempio.docx
  4. si rigenera l'esempio e si confronta

Lo schema d'impianto al punto 1 non è facoltativo: senza immagine il paragrafo di §2.3
sparisce del tutto dal documento reso, e non ci sarebbe nulla da sostituire con il tag.

Se un giorno si preferisse curare direttamente il template, basta smettere di eseguire lo
script: da quel momento la sorgente di verità è il `.docx` in `public/templates/`.
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


# ---------------------------------------------------------------------------
# Ricerca degli agganci per testo
#
# Si tengono riferimenti ai paragrafi, non i loro indici: cancellarne uno non invalida
# gli altri, mentre gli indici slitterebbero tutti.
# ---------------------------------------------------------------------------

def paragrafo(P, inizio, cosa):
    """Il primo paragrafo il cui testo inizia con `inizio`. Fallisce se non c'è o è doppio."""
    trovati = [p for p in P if testo(p).startswith(inizio)]
    atteso(trovati, "%s: nessun paragrafo inizia con %r" % (cosa, inizio))
    atteso(
        len(trovati) == 1,
        "%s: %d paragrafi iniziano con %r, l'aggancio è ambiguo"
        % (cosa, len(trovati), inizio),
    )
    return trovati[0]


def precedente(P, p, cosa):
    """
    Il paragrafo che precede `p`, usato come modello di formattazione per i paragrafi di
    tag che verranno inseriti: prende font e stile del corpo del testo, non di un titolo.
    """
    i = P.index(p)
    atteso(i > 0, "%s: non c'è un paragrafo precedente da cui prendere la formattazione" % cosa)
    return P[i - 1]


def seguenti_che_iniziano(P, p, inizio):
    """I paragrafi consecutivi dopo `p` che iniziano con `inizio`, per cancellarli in blocco."""
    fuori = []
    for q in P[P.index(p) + 1:]:
        if not testo(q).startswith(inizio):
            break
        fuori.append(q)
    return fuori


def seguenti_con_stile(P, p):
    """
    I paragrafi consecutivi dopo `p` che ne condividono lo stile.

    Serve per gli elenchi le cui voci non hanno un prefisso comune su cui agganciarsi:
    delimitarli con «tutto ciò che segue» cancellerebbe anche un capoverso aggiunto in coda.
    """
    fuori = []
    for q in P[P.index(p) + 1:]:
        if q.style.name != p.style.name:
            break
        fuori.append(q)
    return fuori


def tabella(T, intestazione, cosa):
    """
    La tabella la cui riga di intestazione inizia con le celle indicate.

    L'indice non basta a distinguerle: §4 e §5.2 aprono entrambe con
    «Pos. · Descrizione · Costruttore e modello», e si separano solo dalla quarta colonna.
    """
    def combacia(t):
        celle = [c.text.strip() for c in t.rows[0].cells]
        if len(celle) < len(intestazione):
            return False
        return all(
            attesa is None or celle[j].startswith(attesa)
            for j, attesa in enumerate(intestazione)
        )

    trovate = [t for t in T if t.rows and combacia(t)]
    atteso(trovate, "%s: nessuna tabella con intestazione %r" % (cosa, intestazione))
    atteso(
        len(trovate) == 1,
        "%s: %d tabelle con intestazione %r, l'aggancio è ambiguo"
        % (cosa, len(trovate), intestazione),
    )
    return trovate[0]


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

def indirizzo_copertina(P, dopo, tag, cosa):
    """
    Sostituisce l'indirizzo di copertina col suo tag, accettando entrambe le forme.

    Nel documento formattato a mano nel 2026 via e località stavano su due paragrafi; da
    quando il motore le unisce in `sedeLegaleCopertina`, un documento reso ne ha uno solo
    con l'a capo dentro (docxtemplater, con `linebreaks: true`, lo rende come <w:br/>).
    Il template vuole in ogni caso un paragrafo solo: se ne trova due, il secondo si toglie.
    """
    i = P.index(dopo)
    atteso(i + 1 < len(P), "%s: manca il paragrafo dell'indirizzo" % cosa)
    riga = P[i + 1]
    atteso(
        testo(riga).startswith("Via Esempio"),
        "%s: atteso l'indirizzo di esempio, trovato %r" % (cosa, testo(riga)[:40]),
    )
    scrivi(riga, tag)
    # Forma a due paragrafi: la località segue e va assorbita nel tag.
    if i + 2 < len(P) and testo(P[i + 2]).startswith("31013"):
        elimina(P[i + 2])


def converti(sorgente, destinazione):
    d = docx.Document(sorgente)
    P = d.paragraphs
    T = d.tables

    # Tutti gli agganci si risolvono prima di modificare alcunché: dopo le cancellazioni
    # `d.paragraphs` non corrisponderebbe più a `P`, mentre i riferimenti restano validi.
    ragione_sociale = paragrafo(P, "ESEMPIO S.P.A.", "copertina")
    sito_produttivo = paragrafo(P, "Sito produttivo in", "copertina")
    premessa = paragrafo(P, "La presente relazione tecnica", "§1 premessa")
    revisione = paragrafo(P, "L’attuale revisione", "§1 capoverso di revisione")
    spessimetriche = paragrafo(P, "Ove previsto", "§1 capoverso spessimetriche")
    intro_sezioni = paragrafo(P, "L’impianto in oggetto è finalizzato", "§2.1 elenco sezioni")
    intro_schema = paragrafo(P, "Lo schema seguente rappresenta", "§2.3 schema d'impianto")
    nocive = paragrafo(P, "Quest’ultima risulta priva", "§3 frase sulle sostanze nocive")
    tubazioni = paragrafo(P, "Tutte le tubazioni", "§5.4 nota sulle tubazioni")
    intro_riqualificazione = paragrafo(
        P, "Le attrezzature rientranti nel campo", "§7 introduzione"
    )
    primo_allegato = paragrafo(P, "Attestazioni", "§8 elenco allegati")

    # --- Copertina ---------------------------------------------------------
    scrivi(ragione_sociale, "{premessa.ragioneSociale}")
    indirizzo_copertina(
        P, ragione_sociale, "{premessa.sedeLegaleCopertina}", "copertina · sede legale"
    )
    indirizzo_copertina(
        P, sito_produttivo, "{premessa.sitoProduttivoCopertina}", "copertina · sito produttivo"
    )

    # --- §1 Premessa -------------------------------------------------------
    scrivi(
        premessa,
        "La presente relazione tecnica si riferisce all’impianto a pressione installato "
        "presso il sito produttivo della ditta {premessa.ragioneSociale}, con sede sociale "
        "in {premessa.sedeLegale}, esercente attività di {premessa.descrizioneAttivita}, "
        "{premessa.ubicazione}.",
    )

    # I due capoversi condizionali restano intatti: quello sulla revisione contiene il
    # segnaposto giallo che il redattore compila in Word, e riscriverlo lo perderebbe.
    modello_premessa = precedente(P, revisione, "§1 capoverso di revisione")
    avvolgi(revisione, "premessa.haRevisione", modello=modello_premessa)
    avvolgi(spessimetriche, "premessa.haSpessimetrica", modello=modello_premessa)

    # --- §2.1 Sezioni dell'impianto ---------------------------------------
    voci_sezioni = seguenti_che_iniziano(P, intro_sezioni, "–")
    atteso(voci_sezioni, "§2.1: nessuna voce di elenco dopo l'introduzione")
    scrivi(voci_sezioni[0], "–\t{voce}")
    avvolgi(voci_sezioni[0], "descrizioneGenerale.sezioni", modello=intro_sezioni)
    for voce in voci_sezioni[1:]:
        elimina(voce)

    # --- §2.2 Condizioni di installazione ----------------------------------
    riga_loop(
        tabella(T, ["Requisito", "Esito", "Note"], "§2.2 condizioni di installazione"),
        "condizioniInstallazione",
        ["{requisito}", "{esito}", "{note}"],
        ["Ubicazione impianto", None, None],
    )

    # --- §2.3 Schema d'impianto -------------------------------------------
    i_schema = P.index(intro_schema)
    atteso(
        i_schema + 1 < len(P) and "<w:drawing" in P[i_schema + 1]._p.xml,
        "§2.3: il paragrafo dopo l'introduzione non contiene l'immagine dello schema. "
        "Genera l'esempio passando un file immagine come secondo argomento: senza schema "
        "quel paragrafo non compare affatto nel documento reso",
    )
    scrivi(P[i_schema + 1], "{%schemaImpianto}")

    # --- §3 Fluidi ---------------------------------------------------------
    riga_loop(
        tabella(
            T, ["Circuito", "Fluido", "Gruppo", "Provenienza", "Qualit"], "§3 fluidi di processo"
        ),
        "fluidi.righe",
        ["{circuito}", "{fluido}", "{gruppo}", "{provenienza}", "{qualita}"],
        ["Aria compressa", "Aria ambiente", None, None, None],
    )

    # La frase esiste in due varianti: evidenziata quando l'aria aspirata è dichiarata non
    # pulita, piana altrimenti. Il documento reso ne conserva una sola, l'altra va ricreata.
    atteso(
        nocive.runs and nocive.runs[0].font.highlight_color is not None,
        "§3: la frase sulle sostanze nocive dovrebbe essere evidenziata, l'esempio è "
        "generato con aria non pulita",
    )
    modello_fluidi = precedente(P, nocive, "§3 frase sulle sostanze nocive")
    piana = clona_dopo(nocive, evidenzia=None)
    for r in piana.runs:
        r.font.highlight_color = None
    avvolgi(nocive, "fluidi.evidenziaNocive", modello=modello_fluidi)
    avvolgi(piana, "fluidi.evidenziaNocive", modello=modello_fluidi)
    # La sezione inversa non si scrive con {#…}: si corregge il tag di apertura.
    apertura_piana = piana._p.getprevious()
    docx.text.paragraph.Paragraph(apertura_piana, piana._parent).runs[0].text = (
        "{^fluidi.evidenziaNocive}"
    )

    # --- §4 Caratterizzazione ---------------------------------------------
    riga_loop(
        tabella(
            T,
            ["Pos.", "Descrizione", "Costruttore e modello", "Capacit"],
            "§4 caratterizzazione",
        ),
        "caratteristiche",
        ["{pos}", "{descrizione}", ["{costruttore}", "{modello}"], "{capacita}",
         "{pressione}", "{temperatura}", "{categoria}", "{anno}", "{nFabbrica}"],
        ["C1", "Compressore", None, "8000", None, None, None, "2025", None],
    )

    # --- §5.2 Esiti --------------------------------------------------------
    riga_loop(
        tabella(T, ["Pos.", "Descrizione", "Costruttore e modello", "V"], "§5.2 esiti"),
        "esiti",
        ["{pos}", "{apparecchiatura}", ["{costruttore}", "{modello}"], "{volume}", "{ps}",
         "{psPerV}", "{categoria}", "{adempimento}", "{statoInail}", "{verificaIntegritaMark}"],
        ["C1", "Compressore", None, None, None, None, None, "Escluso", "Nuova richiesta", None],
    )

    # --- §5.3 Protezioni ---------------------------------------------------
    riga_loop(
        tabella(
            T,
            ["Pos.", "Valvole di sicurezza", "Scarico condensa"],
            "§5.3 protezioni dei serbatoi",
        ),
        "protezioni.serbatoi",
        ["{pos}", VALVOLE_ANNIDATE, "{scaricoCondensa}",
         "{finituraInterna}", "{ancoraggio}", "{manometro}"],
        ["S1", None, "Automatico", "Zincato", "Sì", None],
    )
    riga_loop(
        tabella(
            T,
            ["Pos.", "Valvole di sicurezza", "Manometro"],
            "§5.3 protezioni delle altre apparecchiature",
        ),
        "protezioni.altre",
        ["{pos}", VALVOLE_ANNIDATE, "{manometro}"],
        ["C1.1", None, "a bordo macchina"],
    )

    # --- §5.4 Tubazioni ----------------------------------------------------
    modello_tubazioni = precedente(P, tubazioni, "§5.4 nota sulle tubazioni")
    oltre = clona_dopo(
        tubazioni,
        "Le tubazioni dell’impianto presentano DN massimo pari a {tubazioni.dnMassimo} mm, "
        "superiore alla soglia di 80 mm dell’art. 3 comma bb): rientrano pertanto nel campo "
        "di applicazione del D.M. 329/2004 e sono soggette ai relativi obblighi di denuncia.",
        evidenzia=docx.enum.text.WD_COLOR_INDEX.YELLOW,
    )
    avvolgi(tubazioni, "tubazioni.escluse", modello=modello_tubazioni)
    avvolgi(oltre, "tubazioni.escluse", modello=modello_tubazioni)
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
        tabella(
            T,
            ["Pos. valvola", "N. fabbrica", None, "Portata massima"],
            "§6.1 portata delle valvole",
        ),
        "valvole.portata",
        ["{posValvola}", "{nFabbricaValvola}", connesse, "{portataMaxTesto}",
         "{portataScaricata}", "{adeguatoMark}"],
        ["C1.2", "1001913158", None, "8000", "21500", None],
    )
    riga_loop(
        tabella(
            T,
            ["Pos. valvola", "N. fabbrica", None, "PS recipiente"],
            "§6.2 pressione di taratura",
        ),
        "valvole.pressione",
        ["{posValvola}", "{nFabbricaValvola}", connesse, "{psRecipiente}",
         "{pressioneTaratura}", "{adeguatoMark}"],
        ["C1.2", "1001913158", None, "11", "10", None],
    )

    # --- §7.2 Riqualificazione --------------------------------------------
    riga_loop(
        # Non «Attrezzature contenenti…»: quella è la tabella delle frequenze di §7.1,
        # che ha intestazioni quasi identiche ma nessuna riga da generare.
        tabella(
            T,
            ["Pos.", "Apparecchiatura", "Cat.", "Verifica di funzionamento"],
            "§7.2 scadenze di riqualificazione",
        ),
        "riqualificazione",
        ["{pos}", "{apparecchiatura}", "{categoria}", "{verificaFunzionamento}",
         "{verificaIntegrita}"],
        ["C1.1", "Serbatoio disoleatore", "III", None, None],
    )

    # --- §8 Allegati -------------------------------------------------------
    # Le altre voci si cancellano una a una: sono capoversi di elenco, senza un prefisso
    # comune su cui agganciarsi, e stanno fra la prima voce e la fine del documento.
    altre_voci = seguenti_con_stile(P, primo_allegato)
    # Modello dal corpo del testo e non dalla voce di elenco: i tag erediterebbero il
    # rientro e il punto elenco.
    scrivi(primo_allegato, "{voce}")
    avvolgi(primo_allegato, "allegati", modello=intro_riqualificazione)
    for voce in altre_voci:
        elimina(voce)

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
