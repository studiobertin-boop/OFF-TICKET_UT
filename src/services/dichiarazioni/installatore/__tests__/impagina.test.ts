import { describe, test, expect } from 'vitest'
import type { RigaTabella } from '../raggruppa'
import { impagina } from '../impagina'

const gruppo = (codice: string): RigaTabella => ({
  principale: { tipo: 'Compressore', marca: 'X' },
  dipendente: { tipo: 'Serbatoio disoleatore', n_fabbrica: codice },
  codiceOrdinamento: codice,
})

const standalone = (codice: string): RigaTabella => ({
  principale: null,
  dipendente: { tipo: 'Serbatoio aria verticale', n_fabbrica: codice },
  codiceOrdinamento: codice,
})

describe('impagina', () => {
  test('poche righe stanno tutte nella prima pagina', () => {
    const pagine = impagina([gruppo('A'), standalone('B')], { righePerPaginaPrima: 6, righePerPaginaSuccessive: 10 })

    expect(pagine).toHaveLength(1)
    expect(pagine[0].continuazione).toBe(false)
    expect(pagine[0].righe).toEqual([gruppo('A'), standalone('B')])
  })

  test('una lista di una sola riga produce una sola pagina', () => {
    const pagine = impagina([standalone('A')], { righePerPaginaPrima: 6, righePerPaginaSuccessive: 10 })
    expect(pagine).toHaveLength(1)
  })

  test('un gruppo che non entra nello spazio rimasto va intero in pagina successiva', () => {
    // Capacità prima pagina = 3 "unità": una riga standalone (peso 1) ne consuma 1, ne restano 2 —
    // non basta per un gruppo (peso 2 in teoria ci starebbe, quindi forziamo capacità=2 e
    // un secondo standalone che porta il totale usato a 2, lasciandone 0 per il gruppo).
    const righe = [standalone('A'), standalone('B'), gruppo('C')]
    const pagine = impagina(righe, { righePerPaginaPrima: 2, righePerPaginaSuccessive: 10 })

    expect(pagine).toHaveLength(2)
    expect(pagine[0].righe).toEqual([standalone('A'), standalone('B')])
    expect(pagine[0].continuazione).toBe(false)
    expect(pagine[1].righe).toEqual([gruppo('C')])
    expect(pagine[1].continuazione).toBe(true)
  })

  test('un gruppo da solo su una pagina vuota non viene mai spezzato, anche se eccede la capacità', () => {
    const pagine = impagina([gruppo('A')], { righePerPaginaPrima: 1, righePerPaginaSuccessive: 1 })
    expect(pagine).toHaveLength(1)
    expect(pagine[0].righe).toEqual([gruppo('A')])
  })

  test('molte righe si spalmano su più pagine, con capacità diversa dalla seconda in poi', () => {
    const righe = Array.from({ length: 7 }, (_, i) => standalone(String(i)))
    const pagine = impagina(righe, { righePerPaginaPrima: 2, righePerPaginaSuccessive: 3 })

    // 2 sulla prima, poi 3 + 2 sulle successive: 3 pagine totali
    expect(pagine).toHaveLength(3)
    expect(pagine[0].righe).toHaveLength(2)
    expect(pagine[1].righe).toHaveLength(3)
    expect(pagine[2].righe).toHaveLength(2)
    expect(pagine[0].continuazione).toBe(false)
    expect(pagine[1].continuazione).toBe(true)
    expect(pagine[2].continuazione).toBe(true)
  })

  test('lista vuota produce nessuna pagina', () => {
    expect(impagina([], { righePerPaginaPrima: 6, righePerPaginaSuccessive: 10 })).toEqual([])
  })
})
