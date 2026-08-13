/**
 * Annotazioni libere sulla tela (SchemaTestoLibero): crearle, trascinarle, riscriverne il
 * contenuto anche su più righe, toglierle. Isolato dall'editor per lo stesso motivo di
 * useGomiti.ts/useSegniTubo.ts/useTrascinamentoTratto.ts — e perché questo file non monta
 * componenti React nei test (CLAUDE.md, «no UI test»): tutto quel che va provato sta nelle
 * quattro funzioni pure sotto, non nell'hook.
 *
 * A fine di questo task le operazioni esistono ma nessuno le chiama: la tela non disegna
 * ancora i testi né offre pulsanti per crearli/trascinarli (arriva col Task 10). L'hook è
 * pronto per essere cablato lì, sullo stesso modello di useGomiti/useSegniTubo.
 */
import { useCallback, useRef } from 'react'
import type { SchemaTestoLibero } from '@/services/schemaImpianto/types'

interface StatoConTesti {
  testi: SchemaTestoLibero[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

/** Primo id libero, saltando quelli già in uso invece di contare gli elementi: dopo una
 *  cancellazione in mezzo, un contatore sulla lunghezza produrrebbe un id già esistente
 *  (stesso principio di `codiceLibero` in SchemaEditor.tsx). */
function idLibero(testi: SchemaTestoLibero[]): string {
  const usati = new Set(testi.map((t) => t.id))
  for (let i = 1; ; i++) {
    const id = `T${i}`
    if (!usati.has(id)) return id
  }
}

/** Testo nuovo, vuoto, nella posizione data: l'utente lo scrive subito dopo (il dialog si apre
 *  sull'id restituito da `aggiungiTesto`, non da qui — questa è la funzione pura). */
export function testoAggiunto(
  testi: SchemaTestoLibero[],
  posizione: { x: number; y: number },
  contenuto = ''
): SchemaTestoLibero[] {
  return [...testi, { id: idLibero(testi), x: posizione.x, y: posizione.y, contenuto }]
}

export function testiConSpostamento(
  testi: SchemaTestoLibero[],
  id: string,
  posizione: { x: number; y: number }
): SchemaTestoLibero[] {
  return testi.map((t) => (t.id === id ? { ...t, x: posizione.x, y: posizione.y } : t))
}

export function testiConContenuto(testi: SchemaTestoLibero[], id: string, contenuto: string): SchemaTestoLibero[] {
  return testi.map((t) => (t.id === id ? { ...t, contenuto } : t))
}

export function testiSenza(testi: SchemaTestoLibero[], id: string): SchemaTestoLibero[] {
  return testi.filter((t) => t.id !== id)
}

export function useTestiLiberi<T extends StatoConTesti>(
  stato: T,
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  // Un gesto solo (clic sulla tela per piazzare il testo): sempre in cronologia, come creare
  // un gomito o un segno. L'id restituito va letto dallo stato passato all'updater di
  // `applica`, non da `stato.testi` catturato nella chiusura: quest'ultimo può essere
  // l'istantanea di un render precedente a quella su cui il reducer sta per applicare
  // l'aggiunta (stesso rischio di lettura-stantia descritto in useSchemaHistory.ts, a
  // proposito di più `dispatch` nello stesso lotto), e produrrebbe un id diverso da quello
  // realmente inserito.
  const aggiungiTesto = useCallback(
    (posizione: { x: number; y: number }) => {
      let idCreato = ''
      applica((s) => {
        const testi = testoAggiunto(s.testi, posizione)
        idCreato = testi[testi.length - 1].id
        return { ...s, testi }
      })
      return idCreato
    },
    [applica]
  )

  // Stesso principio del trascinamento del gomito e del segno: il PRIMO evento del gesto
  // entra in cronologia, i successivi no (vedi useGomiti.ts/useSegniTubo.ts). Durante un
  // trascinamento arrivano molti eventi al secondo: se ognuno entrasse in cronologia,
  // profonda 10, si riempirebbe di stati intermedi e Ctrl+Z diventerebbe inutile; se
  // entrasse solo l'ultimo, lo stato "precedente" sarebbe già quello finale e Ctrl+Z non
  // riporterebbe da nessuna parte.
  const trascinamentoTestoAvviato = useRef(false)

  const spostaTesto = useCallback(
    (id: string, posizione: { x: number; y: number }, concluso: boolean) => {
      const primoEventoDelGesto = !trascinamentoTestoAvviato.current
      trascinamentoTestoAvviato.current = !concluso
      const aggiorna = primoEventoDelGesto ? applica : aggiornaSenzaCronologia
      aggiorna((s) => ({ ...s, testi: testiConSpostamento(s.testi, id, posizione) }))
    },
    [applica, aggiornaSenzaCronologia]
  )

  // La modifica del contenuto si chiude con un dialog (conferma/annulla), non con eventi al
  // secondo come il trascinamento: un gesto solo, sempre in cronologia.
  const modificaTesto = useCallback(
    (id: string, contenuto: string) => {
      applica((s) => ({ ...s, testi: testiConContenuto(s.testi, id, contenuto) }))
    },
    [applica]
  )

  const rimuoviTesto = useCallback(
    (id: string) => {
      applica((s) => ({ ...s, testi: testiSenza(s.testi, id) }))
    },
    [applica]
  )

  return { aggiungiTesto, spostaTesto, modificaTesto, rimuoviTesto }
}
