/**
 * Gesti propri delle aree tratteggiate: crearle, ridimensionarle dagli angoli, spostarne la sola
 * scritta, riscriverla. Lo spostamento dell'area intera NON sta qui: è uno spostamento di gruppo
 * (`spostaGruppoDa`, useSelezioneMultipla.ts), perché un'area selezionata insieme ad altro si
 * trascina insieme ad altro. Stesso schema di useTestiLiberi.ts/useMuro.ts.
 */
import { useCallback, useRef } from 'react'
import { areaAggiunta, areaRidimensionata, areeConScarto, areeConScritta, type AngoloArea } from '@/services/schemaImpianto/aree'
import type { Punto } from '@/services/schemaImpianto/tratti'
import type { SchemaArea } from '@/services/schemaImpianto/types'

interface StatoConAree {
  aree: SchemaArea[]
}

type Aggiorna<T> = (prossimo: T | ((corrente: T) => T)) => void

export function useAree<T extends StatoConAree>(applica: Aggiorna<T>, aggiornaSenzaCronologia: Aggiorna<T>) {
  // La posizione come funzione dello stato, per la stessa ragione di `aggiungiTesto`: va calcolata
  // sul disegno che il reducer sta per aggiornare, non su quello catturato nel render.
  const aggiungiArea = useCallback(
    (id: string, posizione: (corrente: T) => Punto) => {
      applica((s) => ({ ...s, aree: areaAggiunta(s.aree, id, posizione(s)) }))
    },
    [applica]
  )

  // Un solo riferimento per i due gesti: non possono essere in corso insieme, e il riarmo a fine
  // gesto (`concluso`) vale per entrambi. Primo evento in cronologia, gli altri no. Porta anche
  // `tipo`/`id` dell'area, come `gestoLibero` in useSelezioneMultipla.ts: se l'area viene
  // cancellata a metà di un ridimensionamento o di uno spostamento della scritta, l'evento
  // `concluso` non arriva mai e il ref resterebbe pieno — il prossimo gesto, anche su un'area
  // diversa o dell'altro tipo, deve comunque essere riconosciuto come primo invece di restare
  // silenziosamente fuori dalla cronologia.
  const gestoArea = useRef<{ tipo: 'ridimensiona' | 'scritta'; id: string } | null>(null)
  const aggiornaPerGesto = useCallback(
    (tipo: 'ridimensiona' | 'scritta', id: string, concluso: boolean) => {
      const g = gestoArea.current
      const primo = !g || g.tipo !== tipo || g.id !== id
      gestoArea.current = concluso ? null : { tipo, id }
      return primo ? applica : aggiornaSenzaCronologia
    },
    [applica, aggiornaSenzaCronologia]
  )

  const ridimensionaArea = useCallback(
    (id: string, angolo: AngoloArea, punto: Punto, concluso: boolean) => {
      aggiornaPerGesto('ridimensiona', id, concluso)((s) => ({
        ...s,
        aree: s.aree.map((a) => (a.id === id ? areaRidimensionata(a, angolo, punto) : a)),
      }))
    },
    [aggiornaPerGesto]
  )

  const spostaScrittaArea = useCallback(
    (id: string, posizione: Punto, concluso: boolean) => {
      aggiornaPerGesto('scritta', id, concluso)((s) => ({ ...s, aree: areeConScarto(s.aree, id, posizione) }))
    },
    [aggiornaPerGesto]
  )

  const riscriviArea = useCallback(
    (id: string, scritta: string) => {
      applica((s) => ({ ...s, aree: areeConScritta(s.aree, id, scritta) }))
    },
    [applica]
  )

  return { aggiungiArea, ridimensionaArea, spostaScrittaArea, riscriviArea }
}
