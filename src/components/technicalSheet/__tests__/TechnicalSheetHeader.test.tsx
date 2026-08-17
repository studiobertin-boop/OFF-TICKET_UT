import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useForm, FormProvider } from 'react-hook-form'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TechnicalSheetHeader } from '../TechnicalSheetHeader'
import { AperturaApparecchiaturaProvider, useAperturaApparecchiatura } from '../AperturaApparecchiatura'
import type { Completezza } from '@/utils/schedaCompleteness'

/**
 * I traguardi della pratica stanno in barra titolo, a destra del chip di compilazione.
 *
 * Quel che questi casi tengono fermo è il contratto che si legge a colpo d'occhio: c'è un
 * chip per ogni apparecchiatura che vuole un fascicolo, uno per la relazione e uno per le
 * dichiarazioni, e l'ultimo — la documentazione completa — resta inerte finché anche un solo
 * pezzo manca, dicendo quale. Il verde non è decorazione: distingue «da fare», che apre la
 * generazione, da «fatto», che apre invece la scelta fra riscaricare e rigenerare.
 */

vi.mock('@/services/supabase', () => ({
  supabase: {},
  SUPABASE_URL: '',
  ensureValidSession: async () => true,
}))

const CODICI_CON_FASCICOLO = new Set<string>(['S1'])

vi.mock('@/services/api/fascicoloDocumenti', () => ({
  fascicoloDocumentiApi: {
    codiciConFascicolo: async () => CODICI_CON_FASCICOLO,
  },
  TETTO_BYTE_APPARECCHIATURA: 0,
}))

beforeAll(() => {
  // La barra si rimisura da sé per pubblicare la propria altezza: in jsdom non esiste.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
})

const COMPLETEZZA: Completezza = { previsti: 10, compilati: 8, valorizzati: 8, mancanti: ['a', 'b'] }

/** Due recipienti oltre soglia: S1 e S2 comportano adempimento, quindi vogliono il fascicolo. */
const SCHEDA = {
  serbatoi: [
    { codice: 'S1', volume: 500, ps_pressione_max: 11 },
    { codice: 'S2', volume: 500, ps_pressione_max: 11 },
  ],
  disoleatori: [],
  scambiatori: [],
  recipienti_filtro: [],
}

const props = {
  customerName: 'GAMMA SRL',
  codicePratica: '00-2026',
  completezza: COMPLETEZZA,
  autoSaving: false,
  lastSaved: null,
  canManageSharing: true,
  canGenerateDocs: true,
  onBack: () => {},
  onShare: () => {},
  onCivaSummary: () => {},
  requestId: 'r-1',
}

const monta = (extra: {
  relazionePronta: boolean
  dichiarazioniPronte: boolean
  schemaGenerato?: boolean
  onSchemaImpianto?: () => void
  onRelazione?: () => void
  onDichiarazioni?: () => void
  onScaricaRelazione?: () => void
  onScaricaDichiarazioni?: () => void
  onScaricaCompleta?: () => void
}) => {
  const Barra = () => {
    const form = useForm({ defaultValues: SCHEDA as any })
    return (
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <FormProvider {...form}>
          <AperturaApparecchiaturaProvider>
            <TechnicalSheetHeader
              {...props}
              onRelazione={() => {}}
              onDichiarazioni={() => {}}
              onScaricaRelazione={() => {}}
              onScaricaDichiarazioni={() => {}}
              onScaricaCompleta={() => {}}
              onSchemaImpianto={() => {}}
              schemaGenerato={false}
              {...extra}
            />
          </AperturaApparecchiaturaProvider>
        </FormProvider>
      </QueryClientProvider>
    )
  }
  return render(<Barra />)
}

describe('TechnicalSheetHeader — i traguardi in barra titolo', () => {
  it('mostra un chip per fascicolo, e lo dà per fatto solo dove il fascicolo esiste', async () => {
    monta({ relazionePronta: false, dichiarazioniPronte: false })

    // S1 ha già il suo fascicolo, S2 no: il nome accessibile lo dice, e con lui il tooltip.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Fascicolo di S1 — pronto' })).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Fascicolo di S2' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fascicolo di S1 — pronto' }).className).toContain('filledSuccess')
    expect(screen.getByRole('button', { name: 'Fascicolo di S2' }).className).not.toContain('filledSuccess')
  })

  it('apre la finestra dell’apparecchiatura al clic sul chip del fascicolo', async () => {
    const aperti: string[] = []
    const Barra = () => {
      const form = useForm({ defaultValues: SCHEDA as any })
      return (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FormProvider {...form}>
            <AperturaApparecchiaturaProvider>
              <Registrante onApri={(c) => aperti.push(c)} />
              <TechnicalSheetHeader
                {...props}
                relazionePronta={false}
                dichiarazioniPronte={false}
                onRelazione={() => {}}
                onDichiarazioni={() => {}}
                onScaricaRelazione={() => {}}
                onScaricaDichiarazioni={() => {}}
                onScaricaCompleta={() => {}}
                onSchemaImpianto={() => {}}
                schemaGenerato={false}
              />
            </AperturaApparecchiaturaProvider>
          </FormProvider>
        </QueryClientProvider>
      )
    }
    render(<Barra />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Fascicolo di S2' })).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Fascicolo di S2' }))
    expect(aperti).toEqual(['S2'])
  })

  it('su relazione e dichiarazioni non ancora generate porta alla generazione', () => {
    const chiamate: string[] = []
    monta({
      relazionePronta: false,
      dichiarazioniPronte: false,
      onRelazione: () => chiamate.push('relazione'),
      onDichiarazioni: () => chiamate.push('dichiarazioni'),
    })

    fireEvent.click(screen.getByRole('button', { name: 'Genera relazione' }))
    fireEvent.click(screen.getByRole('button', { name: 'Genera dichiarazioni' }))
    expect(chiamate).toEqual(['relazione', 'dichiarazioni'])
  })

  it('mostra il chip "SC" a sinistra di "R", e lo dà per fatto solo con lo schema pronto', () => {
    const chiamate: string[] = []
    monta({
      relazionePronta: false,
      dichiarazioniPronte: false,
      schemaGenerato: false,
      onSchemaImpianto: () => chiamate.push('schema'),
    })

    const chip = screen.getByRole('button', { name: 'Genera schema d’impianto' })
    expect(chip.className).not.toContain('filledSuccess')
    fireEvent.click(chip)
    expect(chiamate).toEqual(['schema'])
  })

  it('il chip "SC" diventa verde con lo schema pronto', () => {
    monta({
      relazionePronta: false,
      dichiarazioniPronte: false,
      schemaGenerato: true,
    })

    expect(screen.getByRole('button', { name: 'Schema d’impianto pronto' }).className).toContain(
      'filledSuccess'
    )
  })

  it('a dichiarazioni generate diventa verde e offre scarica o rigenera, come la relazione', () => {
    const chiamate: string[] = []
    monta({
      relazionePronta: true,
      dichiarazioniPronte: true,
      onDichiarazioni: () => chiamate.push('rigenera'),
      onScaricaDichiarazioni: () => chiamate.push('scarica'),
    })

    const chip = screen.getByRole('button', { name: 'Dichiarazioni pronte' })
    expect(chip.className).toContain('filledSuccess')

    fireEvent.click(chip)
    fireEvent.click(screen.getByText('Scarica dichiarazioni'))
    expect(chiamate).toEqual(['scarica'])

    fireEvent.click(screen.getByRole('button', { name: 'Dichiarazioni pronte' }))
    fireEvent.click(screen.getByText('Rigenera dichiarazioni'))
    expect(chiamate).toEqual(['scarica', 'rigenera'])
  })

  it('tiene spenta la documentazione completa finché manca un pezzo, e dice quale', async () => {
    const chiamate: string[] = []
    monta({
      relazionePronta: false,
      dichiarazioniPronte: true,
      onScaricaCompleta: () => chiamate.push('completa'),
    })

    // S1 ce l'ha, S2 no: mancano la relazione e il fascicolo di S2.
    const spento = await screen.findByRole('button', { name: 'Mancano: relazione, fascicolo di S2' })
    fireEvent.click(spento)
    expect(chiamate).toEqual([])
  })

  it('accende la documentazione completa quando c’è tutto', async () => {
    const chiamate: string[] = []
    const SCHEDA_UN_SOLO_CODICE = { ...SCHEDA, serbatoi: [SCHEDA.serbatoi[0]] }
    const Barra = () => {
      const form = useForm({ defaultValues: SCHEDA_UN_SOLO_CODICE as any })
      return (
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <FormProvider {...form}>
            <AperturaApparecchiaturaProvider>
              <TechnicalSheetHeader
                {...props}
                relazionePronta
                dichiarazioniPronte
                onRelazione={() => {}}
                onDichiarazioni={() => {}}
                onScaricaRelazione={() => {}}
                onScaricaDichiarazioni={() => {}}
                onScaricaCompleta={() => chiamate.push('completa')}
                onSchemaImpianto={() => {}}
                schemaGenerato={false}
              />
            </AperturaApparecchiaturaProvider>
          </FormProvider>
        </QueryClientProvider>
      )
    }
    render(<Barra />)

    const pronto = await screen.findByRole('button', { name: 'Scarica documentazione completa' })
    fireEvent.click(pronto)
    expect(chiamate).toEqual(['completa'])
  })

  it('lascia a destra solo assegnazione e dati CIVA', () => {
    monta({ relazionePronta: true, dichiarazioniPronte: true })

    expect(screen.getByRole('button', { name: 'Assegna scheda' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Visualizza dati CIVA' })).toBeTruthy()
  })
})

/** Sta al posto della tabella: registra l'apertura, che nel test è solo una nota. */
function Registrante({ onApri }: { onApri: (codice: string) => void }) {
  const apertura = useAperturaApparecchiatura()
  apertura?.registra(onApri)
  return null
}
