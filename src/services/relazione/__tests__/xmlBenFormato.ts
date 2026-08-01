import { expect } from 'vitest'

/**
 * Verifica che l'XML sia ben formato **e** che ogni prefisso usato sia dichiarato.
 *
 * Nasce da un difetto reale: il modulo immagini inietta `<w:drawing>` con i prefissi
 * `wp:`, `a:` e `pic:` dandoli per dichiarati sulla radice, come lo sono nei documenti
 * prodotti da Word. Il nostro template, scritto a mano, dichiarava solo `w:` e `r:`:
 * il documento risultava «unbound prefix» e Word si rifiutava di aprirlo.
 *
 * I test cercavano stringhe dentro l'XML, quindi passavano tutti su un file illeggibile.
 * Cercare un testo dimostra che una sostituzione è avvenuta, non che il documento sia
 * valido: sono due controlli diversi e servono entrambi.
 */
export function attendiXmlValido(xml: string, contesto = 'word/document.xml'): void {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const errore = doc.getElementsByTagName('parsererror')[0]
  expect(
    errore?.textContent ?? null,
    `${contesto} non è XML valido — Word rifiuterebbe di aprire il documento`
  ).toBeNull()
}
