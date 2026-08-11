import { describe, test, expect } from 'vitest'
import { eUnImmagine } from '../sorgente'
import type { DocumentoFascicolo } from '../types'

const doc = (nome: string, mime?: string): DocumentoFascicolo =>
  ({ id: 'x', nome, peso: 1, mime, ruoli: [] })

describe('eUnImmagine', () => {
  test('riconosce le immagini dal tipo MIME', () => {
    expect(eUnImmagine(doc('targhetta', 'image/jpeg'))).toBe(true)
    expect(eUnImmagine(doc('certificato', 'application/pdf'))).toBe(false)
  })

  test('senza tipo MIME ripiega sull’estensione, maiuscole comprese', () => {
    expect(eUnImmagine(doc('TARGHETTA.JPG'))).toBe(true)
    expect(eUnImmagine(doc('foto.heic'))).toBe(true)
    expect(eUnImmagine(doc('certificato.pdf'))).toBe(false)
  })

  test('un nome senza estensione non è un’immagine', () => {
    expect(eUnImmagine(doc('scansione'))).toBe(false)
  })
})
