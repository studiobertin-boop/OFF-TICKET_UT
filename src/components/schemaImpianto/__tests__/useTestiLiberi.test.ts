import { describe, it, expect } from 'vitest'
import { testoAggiunto, testiConContenuto, testiConSpostamento, testiSenza } from '../useTestiLiberi'

const due = [
  { id: 'T1', x: 10, y: 20, contenuto: 'primo' },
  { id: 'T2', x: 30, y: 40, contenuto: 'secondo\nsu due righe' },
]

describe('testoAggiunto', () => {
  it('mette il testo nella posizione data, in coda', () => {
    const risultato = testoAggiunto(due, { x: 100, y: 200 })
    expect(risultato).toHaveLength(3)
    expect(risultato[2]).toMatchObject({ x: 100, y: 200, contenuto: '' })
  })

  it('non riusa un id già presente, nemmeno dopo una cancellazione in mezzo', () => {
    // Un contatore ingenuo sulla lunghezza darebbe 'T3' anche qui, cioè un id già in uso.
    const conBuco = [{ id: 'T1', x: 0, y: 0, contenuto: 'a' }, { id: 'T3', x: 0, y: 0, contenuto: 'c' }]
    const risultato = testoAggiunto(conBuco, { x: 1, y: 1 })
    expect(conBuco.map((t) => t.id)).not.toContain(risultato[2].id)
  })

  it('parte anche da una tela senza testi', () => {
    expect(testoAggiunto([], { x: 5, y: 5 })).toHaveLength(1)
  })
})

describe('testiConSpostamento', () => {
  it('cambia le coordinate del testo indicato e lascia intatti contenuto e vicini', () => {
    const risultato = testiConSpostamento(due, 'T2', { x: 300, y: 400 })
    expect(risultato[1]).toEqual({ id: 'T2', x: 300, y: 400, contenuto: 'secondo\nsu due righe' })
    expect(risultato[0]).toEqual(due[0])
  })

  it('un id sconosciuto non cambia nulla', () => {
    expect(testiConSpostamento(due, 'T9', { x: 0, y: 0 })).toEqual(due)
  })
})

describe('testiConContenuto', () => {
  it('cambia il contenuto senza spostare il testo', () => {
    const risultato = testiConContenuto(due, 'T1', 'nuovo\ntesto')
    expect(risultato[0]).toEqual({ id: 'T1', x: 10, y: 20, contenuto: 'nuovo\ntesto' })
  })
})

describe('testiSenza', () => {
  it('toglie solo il testo indicato, non quello di posizione 0', () => {
    // 'T2' non è il primo elemento: un'implementazione che togliesse per indice (0) invece
    // che per id toglierebbe 'T1' e lascerebbe questo test verde per il motivo sbagliato.
    expect(testiSenza(due, 'T2')).toEqual([due[0]])
  })
})

describe('purezza', () => {
  it('nessuna delle quattro funzioni muta l’elenco o i testi ricevuti in ingresso', () => {
    const originale = due.map((t) => ({ ...t }))
    testoAggiunto(due, { x: 1, y: 1 })
    testiConSpostamento(due, 'T1', { x: 9, y: 9 })
    testiConContenuto(due, 'T1', 'modificato')
    testiSenza(due, 'T1')
    expect(due).toEqual(originale)
  })
})
