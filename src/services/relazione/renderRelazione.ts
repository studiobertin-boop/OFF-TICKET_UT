/**
 * Render — inietta il RelazioneModel in un template Word "muto" via docxtemplater.
 *
 * Il template contiene SOLO placeholder semplici ({campo}), loop di tabella
 * ({#lista}...{/lista}) e toggle di presenza. Nessuna logica: tutte le decisioni
 * sono già risolte nel RelazioneModel (principio anti-Carbone).
 */
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import ImageModule from 'docxtemplater-image-module-free'
import type { RelazioneModel, SchemaImpianto } from './types'
import { applicaFusioneColonne } from './fusioneCelle'
import { dimensioniGruppi } from './engine/esiti'
import { comportaAdempimento } from '@/utils/dm329Classification'

const CHECK = '✓'
const NON_APPLICABILE = 'n.a.'
const NON_DETERMINABILE = 'n.d.'
/** Verifica dovuta e non eseguita. */
const NEGATIVO = 'NO'
/** Dato che non si applica a quella apparecchiatura: non è una dimenticanza. */
const NON_PERTINENTE = '–'

/**
 * Larghezza fissa dello schema d'impianto, in pixel a 96 dpi: pari alla larghezza utile
 * della pagina del template (9638 twip = 6,69 pollici). È fissa per scelta — due schemi
 * catturati a risoluzioni diverse devono impaginarsi identici.
 */
const SCHEMA_LARGHEZZA_PX = 640

/**
 * Altezza massima tollerata, poco sotto l'altezza utile della pagina (14570 twip).
 * Serve solo agli schemi in formato ritratto: senza il limite l'immagine sborderebbe,
 * e un documento rotto è peggio di una larghezza non rispettata al pixel.
 */
const SCHEMA_ALTEZZA_MAX_PX = 900

/** Proporzioni di ripiego quando le dimensioni native non sono note (4:3). */
const SCHEMA_RAPPORTO_DEFAULT = 0.75

/**
 * Valore del tag `{%schemaImpianto}`. Il modulo immagini vuole un primitivo e lo passa
 * a `getImage`: i byte veri arrivano dalla chiusura su `SchemaImpianto`, non da qui.
 */
const SCHEMA_TAG = 'schemaImpianto'

/** Dimensioni di stampa dello schema: larghezza fissa, altezza in proporzione. */
export function dimensioniSchema(schema: SchemaImpianto): [number, number] {
  const { larghezzaPx, altezzaPx } = schema
  const rapporto =
    larghezzaPx > 0 && altezzaPx > 0 ? altezzaPx / larghezzaPx : SCHEMA_RAPPORTO_DEFAULT

  const altezza = Math.round(SCHEMA_LARGHEZZA_PX * rapporto)
  if (altezza <= SCHEMA_ALTEZZA_MAX_PX) return [SCHEMA_LARGHEZZA_PX, altezza]

  return [Math.round(SCHEMA_ALTEZZA_MAX_PX / rapporto), SCHEMA_ALTEZZA_MAX_PX]
}

/**
 * Parser che risolve i path con punto ({premessa.ragioneSociale}) contro lo scope
 * corrente. Restituendo undefined per i segmenti mancanti, lascia che sia lo
 * scope-walking di docxtemplater a risalire agli scope esterni (utile nei loop).
 */
function nestedParser(tag: string) {
  return {
    get(scope: Record<string, unknown> | null | undefined): unknown {
      if (tag === '.') return scope
      return tag
        .split('.')
        .reduce<unknown>(
          (acc, key) =>
            acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined,
          scope
        )
    },
  }
}

/**
 * Trasforma il RelazioneModel nella forma attesa dai tag del template:
 * aggiunge i "mark" (✓/'') per le colonne booleane e incapsula le liste di stringhe.
 */
export function buildTemplateData(model: RelazioneModel): Record<string, unknown> {
  // L'obbligo è del gruppo, non della riga: il capogruppo è spesso un compressore o un
  // essiccatore, esclusi in quanto tali, mentre il recipiente che portano è soggetto. La
  // cella è fusa sul gruppo, quindi mostrerebbe il verdetto del capogruppo — sbagliato.
  const gruppiSoggetti = new Set(
    model.esiti.filter((r) => comportaAdempimento(r.esito)).map((r) => r.gruppo)
  )

  return {
    ...model,
    esiti: model.esiti.map((r) => {
      const soggetta = gruppiSoggetti.has(r.gruppo)
      return {
        ...r,
        // Nessuna cella vuota in questa tabella: il vuoto si legge come dimenticanza.
        // «–» dice «non pertinente», e va anche sulle righe delle apparecchiature escluse.
        volume: r.volume || NON_PERTINENTE,
        ps: r.ps || NON_PERTINENTE,
        psPerV: r.psPerV || NON_PERTINENTE,
        categoria: r.categoria || NON_PERTINENTE,
        statoInail: r.statoInail || NON_PERTINENTE,
        // Tre esiti: verifica eseguita, dovuta e non eseguita, non dovuta perché
        // l'apparecchiatura è fuori dal campo di applicazione.
        verificaIntegritaMark: r.verificaIntegrita
          ? CHECK
          : soggetta
            ? NEGATIVO
            : NON_PERTINENTE,
      }
    }),
    valvole: {
      portata: model.valvole.portata.map((r) => ({
        ...r,
        // Tre esiti distinti, non due: "n.a." = confronto non definito (nessun
        // compressore collegato), "n.d." = dati mancanti, cella vuota = confronto
        // eseguito e non superato. Una spunta afferma; il vuoto non deve coprire
        // due significati opposti.
        adeguatoMark: !r.applicabile
          ? NON_APPLICABILE
          : !r.datiCompleti
            ? NON_DETERMINABILE
            : r.adeguato
              ? CHECK
              : '',
      })),
      pressione: model.valvole.pressione.map((r) => ({
        ...r,
        adeguatoMark: !r.datiCompleti ? NON_DETERMINABILE : r.adeguato ? CHECK : '',
      })),
    },
    // liste di stringhe → oggetti, così il template può fare {#lista}{voce}{/lista}
    allegati: model.allegati.map((voce) => ({ voce })),
    // Sentinella per il modulo immagini; stringa vuota = nessuno schema = paragrafo vuoto.
    schemaImpianto: model.schemaImpianto ? SCHEMA_TAG : '',
    descrizioneGenerale: {
      ...model.descrizioneGenerale,
      sezioni: model.descrizioneGenerale.sezioni.map((voce) => ({ voce })),
    },
  }
}

/**
 * Renderizza il documento Word e restituisce i byte del .docx.
 * Il chiamante li incapsula in un Blob per il download.
 */
export function renderRelazioneDocx(
  templateContent: ArrayBuffer | Uint8Array | string,
  model: RelazioneModel
): Uint8Array {
  const zip = new PizZip(templateContent as ArrayBuffer)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    parser: nestedParser,
    nullGetter: () => '',
    // Il modulo è sempre attaccato: senza schema il tag vale '' e rende un paragrafo
    // vuoto, quindi non serve costruire il documento in due modi diversi.
    modules: [
      new ImageModule({
        centered: true,
        fileType: 'docx',
        getImage: () => model.schemaImpianto?.dati ?? new Uint8Array(),
        getSize: () =>
          model.schemaImpianto
            ? dimensioniSchema(model.schemaImpianto)
            : [SCHEMA_LARGHEZZA_PX, Math.round(SCHEMA_LARGHEZZA_PX * SCHEMA_RAPPORTO_DEFAULT)],
      }),
    ],
  })
  doc.render(buildTemplateData(model))

  // Stato INAIL e verifica di integrità valgono per l'intero gruppo di apparecchiature:
  // le celle si fondono verticalmente. Va fatto dopo il render perché `vMerge` sta nelle
  // proprietà della cella, che il loop di docxtemplater duplica identiche.
  const out = doc.getZip()
  const documento = out.file('word/document.xml')
  if (documento) {
    out.file(
      'word/document.xml',
      applicaFusioneColonne(documento.asText(), {
        ancoraTabella: 'Adempimento DM 329/2004',
        intestazioniColonne: ['Stato INAIL', 'Verifica Integrità'],
        dimensioniGruppi: dimensioniGruppi(model.esiti),
      })
    )
  }

  return out.generate({ type: 'uint8array' })
}
