/**
 * Annotazioni libere sulla tela (SchemaTestoLibero): crearle, trascinarle, riscriverne il
 * contenuto anche su più righe, toglierle. Isolato dall'editor per lo stesso motivo di
 * useGomiti.ts/useSegniTubo.ts/useTrascinamentoTratto.ts — e perché questo file non monta
 * componenti React nei test (CLAUDE.md, «no UI test»): tutto quel che va provato sta nelle
 * quattro funzioni pure sotto, non nell'hook.
 *
 * Il cablaggio è fatto: `SchemaEditor` chiama queste operazioni dal pulsante «Testo» della
 * palette e dal dialog di scrittura, e `TestiLiberi.tsx` rende le annotazioni sulla tela.
 */
import { useCallback, useRef } from 'react'
import { allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
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

/** Testo nuovo nella posizione data. Il contenuto arriva già scritto: l'editor apre il dialog
 *  PRIMA di creare l'annotazione, così un'annotazione vuota — invisibile sulla tela, e quindi
 *  né afferrabile né eliminabile — non esiste mai, nemmeno per il tempo di una rinuncia. Il
 *  valore di ripiego resta per chi volesse il comportamento inverso (creare e scrivere dopo). */
export function testoAggiunto(
  testi: SchemaTestoLibero[],
  posizione: { x: number; y: number },
  contenuto = ''
): SchemaTestoLibero[] {
  return [...testi, { id: idLibero(testi), x: posizione.x, y: posizione.y, contenuto }]
}

/**
 * L'annotazione si posa sui punti della griglia. Si allinea qui e non nel componente perché
 * qui i test la raggiungono, e si allinea la posizione ASSOLUTA e non lo spostamento: il
 * puntatore che `TestiLiberi.tsx` legge da `screenToFlowPosition` arriva già quantizzato,
 * perché la tela monta `snapToGrid`/`snapGrid={[10, 10]}` (`SchemaEditor.tsx`), quindi la
 * posizione che il componente calcola è un'origine (`testo.x`/`testo.y`) più uno spostamento
 * che è quantizzato. Oggi l'origine nasce già allineata — l'unica creatrice di annotazioni è
 * `aggiungiTesto` qui sotto, e chi le chiama (`SchemaEditor.tsx`) le fa nascere sulla griglia
 * (Task 4, blocco D2) — ma l'allineamento resta comunque qui: è il punto dove la proprietà si
 * mantiene a ogni trascinamento, indipendentemente da chi crea l'annotazione, non un rimedio
 * legato a un'origine fuori griglia che oggi non esiste più. Prima che le annotazioni nascessero
 * allineate, un'origine fuori griglia sopravviveva a ogni trascinamento senza questo allineamento:
 * misurato in pagina, un'annotazione a y=573,75 spostata di 60 finiva a y=513,75 invece di
 * posarsi sul punto di griglia più vicino, y=510.
 *
 * A differenza del trascinamento del tratto (useTrascinamentoTratto.ts), qui non serve
 * congelare lo stato d'inizio gesto: lo scostamento di presa è congelato al `pointerdown`
 * (`TestiLiberi.tsx`, `scostamentoRef`) e durante il gesto non viene mai ricalcolato dalla
 * posizione allineata scritta qui (si ricalcola solo al `pointerdown` successivo, da
 * `testo.x`/`testo.y` — ma quello è l'inizio di un gesto nuovo), quindi durante un trascinamento
 * non c'è un valore già agganciato su cui il passo successivo si incastrerebbe. E siccome lo
 * spostamento fra un evento e l'altro è sempre un multiplo esatto del passo, l'allineamento vi
 * commuta — allinea(origine + 10k) = allinea(origine) + 10k per ogni k intero — quindi ogni
 * evento del gesto allinea in modo indipendente e coerente con gli altri, senza bisogno di
 * partire dal valore già scritto in stato.
 *
 * Nessuna quota preferita, a differenza del tratto (`agganciaQuota`, griglia.ts):
 * un'annotazione non deve restare allineata a nulla, va dove il committente la mette.
 */
export function testiConSpostamento(
  testi: SchemaTestoLibero[],
  id: string,
  posizione: { x: number; y: number }
): SchemaTestoLibero[] {
  return testi.map((t) =>
    t.id === id ? { ...t, x: allineaAllaGriglia(posizione.x), y: allineaAllaGriglia(posizione.y) } : t
  )
}

export function testiConContenuto(testi: SchemaTestoLibero[], id: string, contenuto: string): SchemaTestoLibero[] {
  return testi.map((t) => (t.id === id ? { ...t, contenuto } : t))
}

export function testiSenza(testi: SchemaTestoLibero[], id: string): SchemaTestoLibero[] {
  return testi.filter((t) => t.id !== id)
}

/**
 * Nessun `stato` fra i parametri, a differenza di useGomiti/useSegniTubo/useTrascinamentoTratto:
 * quelli devono derivare dagli archi correnti gli `edges` arricchiti che passano a react-flow,
 * qui non c'è nulla da derivare — l'editor rende `stato.testi` per conto suo (TestiLiberi.tsx) e
 * queste quattro operazioni leggono sempre lo stato che il reducer passa all'updater, mai
 * un'istantanea catturata nella chiusura. Un parametro tenuto «per uniformità» sarebbe solo
 * peso morto, e per giunta un invito a leggerlo proprio dove non si deve.
 */
export function useTestiLiberi<T extends StatoConTesti>(
  applica: Aggiorna<T>,
  aggiornaSenzaCronologia: Aggiorna<T>
) {
  // Un gesto solo (il pulsante «Testo» della palette, confermato nel dialog): sempre in
  // cronologia, come creare un gomito o un segno — e una voce sola, non due, perché il
  // contenuto arriva insieme alla posizione. L'id nasce dentro l'updater di `applica`, da
  // `s.testi`: `idLibero` su un elenco catturato nella chiusura potrebbe leggere l'istantanea
  // di un render precedente a quello su cui il reducer sta per applicare l'aggiunta (stesso
  // rischio di lettura-stantia descritto in useSchemaHistory.ts, a proposito di più `dispatch`
  // nello stesso lotto) e riusare un id già assegnato.
  //
  // La posizione si accetta anche come funzione dello stato, sulla falsariga di `applica`
  // stessa: chi la calcola dal disegno corrente (l'editor la mette sotto tutto ciò che è già
  // disegnato) deve leggere i nodi e i testi che il reducer sta per aggiornare, non quelli
  // catturati nella chiusura del render — è la stessa lettura stantia da cui l'id qui sotto si
  // difende.
  const aggiungiTesto = useCallback(
    (posizione: { x: number; y: number } | ((corrente: T) => { x: number; y: number }), contenuto = '') => {
      applica((s) => ({
        ...s,
        testi: testoAggiunto(s.testi, typeof posizione === 'function' ? posizione(s) : posizione, contenuto),
      }))
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
