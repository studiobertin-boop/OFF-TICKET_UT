import { describe, it, expect } from 'vitest'
import type { Node } from '@xyflow/react'
import { codiceLibero } from '../SchemaEditor'

function nodo(id: string): Node {
  return { id, type: 'x', position: { x: 0, y: 0 }, data: {} } as Node
}

describe('codiceLibero', () => {
  it('non produce mai un codice che la scheda potrebbe assegnare in futuro', () => {
    // La scheda dati numera le sue apparecchiature senza prefisso ("S2", "PB3", ...): se
    // codiceLibero producesse la stessa forma, una S2 comparsa davvero in scheda verrebbe
    // scambiata dalla riconciliazione per il nodo manuale già presente — non entrerebbe mai
    // fra gli `aggiunti`, e resterebbe "Serbatoio" per sempre, senza marca né valvole.
    const codice = codiceLibero('S', [nodo('S1')])
    expect(codice).not.toMatch(/^S\d+$/)
  })

  it('resta comunque libero rispetto ai nodi già presenti nella tela', () => {
    const primo = codiceLibero('PB', [])
    const secondo = codiceLibero('PB', [nodo(primo)])
    expect(secondo).not.toBe(primo)
  })
})
