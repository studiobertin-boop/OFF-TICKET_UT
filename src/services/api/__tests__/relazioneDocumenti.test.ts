import { describe, it, expect, vi, beforeEach } from 'vitest'

const fromMock = vi.fn()
const storageFromMock = vi.fn()
const getSessionMock = vi.fn()

vi.mock('../../supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
    storage: { from: (...args: unknown[]) => storageFromMock(...args) },
    auth: { getSession: (...args: unknown[]) => getSessionMock(...args) },
  },
}))

import { relazioneDocumentiApi } from '../relazioneDocumenti'

const rigaEsistente = {
  id: 'doc-vecchio',
  request_id: 'r1',
  file_name: 'Relazione_DM329.docx',
  file_path: 'r1/1000_vecchia.docx',
  file_size: 100,
  mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  created_at: '2026-01-01T00:00:00Z',
}

describe('relazioneDocumentiApi.ultimoFinale', () => {
  it('restituisce null quando non esiste alcuna relazione salvata', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      }),
    })

    const risultato = await relazioneDocumentiApi.ultimoFinale('r1')
    expect(risultato).toBeNull()
  })

  it('mappa la riga più recente nel tipo DocumentoRelazione', async () => {
    fromMock.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({ maybeSingle: async () => ({ data: rigaEsistente, error: null }) }),
          }),
        }),
      }),
    })

    const risultato = await relazioneDocumentiApi.ultimoFinale('r1')
    expect(risultato).toEqual({
      id: 'doc-vecchio',
      nome: 'Relazione_DM329.docx',
      peso: 100,
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      filePath: 'r1/1000_vecchia.docx',
    })
  })
})

describe('relazioneDocumentiApi.salvaFinale', () => {
  const nuovoFile = new File(['contenuto'], 'Relazione_DM329.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })

  beforeEach(() => {
    fromMock.mockReset()
    storageFromMock.mockReset()
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } })
  })

  it('carica i byte, inserisce la riga, poi rimuove la relazione precedente', async () => {
    const upload = vi.fn(async () => ({ error: null }))
    const remove = vi.fn(async () => ({ error: null }))
    storageFromMock.mockReturnValue({ upload, remove })

    let chiamataUltimoFinale = 0
    const insertSingle = vi.fn(async () => ({
      data: { ...rigaEsistente, id: 'doc-nuovo', file_path: 'r1/2000_nuova.docx' },
      error: null,
    }))
    const deleteEq = vi.fn(async () => ({ error: null }))

    fromMock.mockImplementation((tabella: string) => {
      if (tabella === 'relazione_documenti') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => {
                    chiamataUltimoFinale++
                    // La prima volta (dentro salvaFinale, per leggere il precedente) trova la
                    // riga vecchia; non ci sono altre chiamate a select in questo test.
                    return { data: chiamataUltimoFinale === 1 ? rigaEsistente : null, error: null }
                  },
                }),
              }),
            }),
          }),
          insert: () => ({ select: () => ({ single: insertSingle }) }),
          delete: () => ({ eq: deleteEq }),
        }
      }
      if (tabella === 'relazione_scadenze') {
        return { delete: () => ({ eq: async () => ({ error: null }) }) }
      }
      throw new Error(`Tabella non attesa nel test: ${tabella}`)
    })

    const risultato = await relazioneDocumentiApi.salvaFinale('r1', nuovoFile)

    expect(upload).toHaveBeenCalledTimes(1)
    expect(insertSingle).toHaveBeenCalledTimes(1)
    // Rimuove i byte e la riga della relazione precedente, non quella appena creata.
    expect(remove).toHaveBeenCalledWith(['r1/1000_vecchia.docx'])
    expect(deleteEq).toHaveBeenCalledWith('id', 'doc-vecchio')
    expect(risultato.id).toBe('doc-nuovo')
  })
})
