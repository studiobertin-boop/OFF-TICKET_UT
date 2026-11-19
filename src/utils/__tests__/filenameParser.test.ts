import { describe, expect, it } from 'vitest'
import { formatParsedFilename, getFormPath, parseEquipmentFilename } from '../filenameParser'

describe('parseEquipmentFilename — generatore di azoto e serbatoi interni', () => {
  it('N2.jpg è il secondo generatore', () => {
    const p = parseEquipmentFilename('N2.jpg')
    expect(p.isValid).toBe(true)
    expect(p.equipmentType).toBe('Generatori azoto')
    expect(p.index).toBe(1)
    expect(p.componentType).toBeUndefined()
  })

  it('NS3.jpg è il terzo serbatoio interno', () => {
    const p = parseEquipmentFilename('NS3.jpg')
    expect(p.isValid).toBe(true)
    expect(p.equipmentType).toBe('Serbatoi generatore azoto')
    expect(p.index).toBe(2)
    expect(p.componentType).toBeUndefined()
  })

  it('NS1.1.jpg è la valvola principale di NS1', () => {
    const p = parseEquipmentFilename('NS1.1.jpg')
    expect(p.isValid).toBe(true)
    expect(p.equipmentType).toBe('Serbatoi generatore azoto')
    expect(p.index).toBe(0)
    expect(p.componentType).toBe('valvola_sicurezza')
  })

  it('N1.1.jpg non è valido e rimanda a NS', () => {
    const p = parseEquipmentFilename('N1.1.jpg')
    expect(p.isValid).toBe(false)
    expect(p.error).toContain('NS')
  })

  it('un prefisso sconosciuto elenca N e NS fra quelli validi', () => {
    const p = parseEquipmentFilename('Z1.jpg')
    expect(p.isValid).toBe(false)
    expect(p.error).toMatch(/\bN\b/)
    expect(p.error).toContain('NS')
  })

  it('i prefissi esistenti non cambiano', () => {
    expect(parseEquipmentFilename('S1.jpg').equipmentType).toBe('Serbatoi')
    expect(parseEquipmentFilename('SEP3.jpg').index).toBe(2)
    expect(parseEquipmentFilename('C1.1.jpg').equipmentType).toBe('Disoleatori')
    expect(parseEquipmentFilename('S1.1.jpg').componentType).toBe('valvola_sicurezza')
  })
})

describe('formatParsedFilename e getFormPath — nuovi tipi', () => {
  it('descrive generatore, serbatoio interno e valvola con i loro nomi', () => {
    expect(formatParsedFilename(parseEquipmentFilename('N2.jpg'))).toBe('Generatore di azoto #2')
    expect(formatParsedFilename(parseEquipmentFilename('NS3.jpg'))).toBe('Serbatoio interno #3')
    expect(formatParsedFilename(parseEquipmentFilename('NS1.1.jpg'))).toBe('Valvola di Sicurezza NS1')
    expect(formatParsedFilename(parseEquipmentFilename('S1.1.jpg'))).toBe('Valvola di Sicurezza S1')
  })

  it('il percorso di form usa i nomi degli array della scheda', () => {
    expect(getFormPath('Generatori azoto', 1)).toBe('generatori_azoto[1]')
    expect(getFormPath('Serbatoi generatore azoto', 2)).toBe('serbatoi_generatore[2]')
    expect(getFormPath('Serbatoi', 0)).toBe('serbatoi[0]')
  })
})
