/**
 * Render — inietta il RelazioneModel in un template Word "muto" via docxtemplater.
 *
 * Il template contiene SOLO placeholder semplici ({campo}), loop di tabella
 * ({#lista}...{/lista}) e toggle di presenza. Nessuna logica: tutte le decisioni
 * sono già risolte nel RelazioneModel (principio anti-Carbone).
 */
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import type { RelazioneModel } from './types'

const CHECK = '✓'

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
  return {
    ...model,
    procedura: model.procedura.map((r) => ({
      ...r,
      dichiarazioneMark: r.dichiarazione ? CHECK : '',
      verificaMark: r.verifica ? CHECK : '',
    })),
    valvole: {
      portata: model.valvole.portata.map((r) => ({ ...r, adeguatoMark: r.adeguato ? CHECK : '' })),
      pressione: model.valvole.pressione.map((r) => ({
        ...r,
        adeguatoMark: r.adeguato ? CHECK : '',
      })),
    },
    // liste di stringhe → oggetti, così il template può fare {#lista}{voce}{/lista}
    allegati: model.allegati.map((voce) => ({ voce })),
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
  })
  doc.render(buildTemplateData(model))
  return doc.getZip().generate({ type: 'uint8array' })
}
