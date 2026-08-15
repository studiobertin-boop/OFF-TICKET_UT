/**
 * Scaricamento di un documento già salvato nello Storage.
 *
 * Non passa da un blob in memoria — `download()` più `saveAs()` — ma da un link firmato, e
 * la differenza non è di stile. Un `blob:` è un'origine opaca: il controllo di sicurezza del
 * browser (SmartScreen su Edge, Safe Browsing su Chrome) non ha alcun indirizzo da valutare e
 * ripiega sull'esame del contenuto. Sui PDF passa, sui documenti Office no: il file resta
 * fermo su «Verifica della sicurezza» e non arriva mai a destinazione. Con un link firmato il
 * browser scarica da un indirizzo https vero, e il controllo si risolve come per qualunque
 * altro file preso dal web.
 *
 * Il nome del file lo porta il `Content-Disposition` che lo Storage aggiunge quando il link
 * si chiede con l'opzione `download`: l'attributo `download` qui sotto vale solo per la stessa
 * origine, e lo Storage non lo è.
 */

/**
 * Durata del link firmato, in secondi.
 *
 * Larga: non protegge nulla in più se è stretta — il browser lo usa subito — mentre una rete
 * lenta o un browser che accoda il download possono metterci più di quanto si creda.
 */
export const DURATA_LINK_FIRMATO_S = 300

/** Fa partire lo scaricamento di un indirizzo, senza portare via la pagina. */
export const scaricaDaUrl = (url: string, nome: string) => {
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.rel = 'noopener'
  // In `body` e non staccato: Firefox non fa partire il click su un nodo fuori dal documento.
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Pausa fra due scaricamenti consecutivi, per non farli partire tutti nello stesso istante. */
export const attendi = (ms: number) => new Promise<void>((risolvi) => setTimeout(risolvi, ms))
