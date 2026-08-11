/**
 * Impaginazione pura della tabella della dichiarazione installatore: nessuna dipendenza da
 * pdf-lib, solo calcolo. Ogni riga con un principale (compressore/essiccatore/filtro + il suo
 * dipendente) pesa 2 "unità" fisiche di tabella, una riga standalone pesa 1 — e un gruppo non
 * si spezza mai fra due pagine: se non ci sta intero nello spazio rimasto, va tutto in quella
 * successiva.
 *
 * La prima pagina ha una capacità minore delle successive perché porta anche il testo
 * boilerplate della dichiarazione sopra la tabella.
 */
import type { RigaTabella } from './raggruppa'

export interface Pagina {
  righe: RigaTabella[]
  /** Vero per le pagine dopo la prima: solo intestazione tabella, niente boilerplate. */
  continuazione: boolean
}

export interface ImpaginaConfig {
  righePerPaginaPrima: number
  righePerPaginaSuccessive: number
}

const peso = (riga: RigaTabella): number => (riga.principale ? 2 : 1)

export function impagina(righe: RigaTabella[], config: ImpaginaConfig): Pagina[] {
  if (righe.length === 0) return []

  const pagine: Pagina[] = []
  let correnti: RigaTabella[] = []
  let capacita = config.righePerPaginaPrima
  let usata = 0

  const chiudiPagina = () => {
    pagine.push({ righe: correnti, continuazione: pagine.length > 0 })
    correnti = []
    capacita = config.righePerPaginaSuccessive
    usata = 0
  }

  for (const riga of righe) {
    const p = peso(riga)
    if (correnti.length > 0 && usata + p > capacita) {
      chiudiPagina()
    }
    correnti.push(riga)
    usata += p
  }
  chiudiPagina()

  return pagine
}
