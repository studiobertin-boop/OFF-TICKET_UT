# Retro-coding DM329 — Fase E (pannello in-app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rendere il codice pratica DM329 assegnabile **dopo la creazione** tramite un pannello "Assegna codice pratica" sul dettaglio, per le pratiche prive di codice, riusando la logica del form di creazione.

**Architecture:** Le pratiche da codificare sono SENZA codice, quindi si riusano `DM329PraticaSection`/`DM329IntegrazioneSection` nella loro modalità di assegnazione fresca (nessun prefill). Un nuovo componente `AssegnaCodicePraticaPanel` ospita un `useForm`, renderizza la sezione giusta in base al tipo, e salva via `useUpdateRequest` (UPDATE su `requests`). Nessuna nuova policy RLS: l'UPDATE è row-level e admin/userdm329 già aggiornano la riga.

**Tech Stack:** React 18 + TS + MUI 6 + react-hook-form + TanStack Query.

## Global Constraints

- Ruoli abilitati: **admin** (qualsiasi pratica DM329) e **userdm329** (pratiche DM329). Nessun altro ruolo vede il pannello.
- Il pannello appare SOLO quando la pratica è DM329/DM329-Integrazioni ed è **priva di codice**: primaria senza `sala_lettera`; integrazione senza `pratica_padre_id`.
- Riuso senza modifiche di `DM329PraticaSection` (props: `customer`, `sedeLegale`, `control`, `setValue`, `onChange`) e `DM329IntegrazioneSection` (props: `customer`, `onChange`).
- Valori sollevati dalle sezioni:
  - `Dm329PraticaValue = { impianto_uguale_sede_legale, indirizzo_impianto, sala_lettera, denominazione_sala, progressivo, anno }`
  - `Dm329IntegrazioneValue = { pratica_padre_id, sala_lettera, progressivo, anno }`
- Salvataggio via `useUpdateRequest().mutateAsync({ id, updates })`; i campi codice pratica passano attraverso `requestsApi.update` (spread diretto).
- Convenzione progetto: **niente UI test**; verifica con `npm run build:check` (tsc + build) + controllo manuale nell'app.

## File Structure

- Modify: `src/services/api/requests.ts` — estendi `UpdateRequestInput` con i campi codice pratica.
- Modify: `src/hooks/useRequests.ts` — `useUpdateRequest` invalida anche `['client-dm329-overview']`.
- Create: `src/components/requests/AssegnaCodicePraticaPanel.tsx` — il pannello.
- Modify: `src/pages/RequestDetail.tsx` — gating (ruolo + assenza codice) e render del pannello.

---

### Task E1: Estendi UpdateRequestInput e invalidazione overview

**Files:**
- Modify: `src/services/api/requests.ts` (interface `UpdateRequestInput`, ~righe 31-39)
- Modify: `src/hooks/useRequests.ts` (`useUpdateRequest`, ~righe 82-92)

**Interfaces:**
- Produces: `UpdateRequestInput` con i campi codice pratica opzionali, riusati da Task E2.

- [ ] **Step 1: Estendi `UpdateRequestInput`**

In `src/services/api/requests.ts`, aggiungi i campi all'interface `UpdateRequestInput` (accanto agli esistenti `title?`, `status?`, ecc.):

```ts
export interface UpdateRequestInput {
  title?: string
  status?: RequestStatus | DM329Status
  assigned_to?: string | null
  custom_fields?: Record<string, any>
  customer_id?: string | null
  is_urgent?: boolean
  request_type_id?: string
  // Codice pratica DM329 (assegnazione post-creazione)
  sala_lettera?: string | null
  progressivo?: number | null
  anno?: number | null
  denominazione_sala?: string | null
  indirizzo_impianto?: string | null
  impianto_uguale_sede_legale?: boolean
  pratica_padre_id?: string | null
}
```

(Non rimuovere i campi esistenti — l'elenco sopra li include tutti; verifica contro il file reale prima di sostituire.)

- [ ] **Step 2: Invalida l'overview in `useUpdateRequest`**

In `src/hooks/useRequests.ts`, nel `onSuccess` di `useUpdateRequest`, aggiungi l'invalidazione dell'overview (usata dal chip codice e dai selettori sala/padre):

```ts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY })
      queryClient.invalidateQueries({ queryKey: ['client-dm329-overview'] })
    },
```

- [ ] **Step 3: Typecheck**

Run: `npm run build:check`
Expected: build/tsc completa senza errori.

- [ ] **Step 4: Commit**

```bash
git add src/services/api/requests.ts src/hooks/useRequests.ts
git commit -m "feat(dm329): campi codice pratica in UpdateRequestInput + invalida overview su update"
```

---

### Task E2: Componente AssegnaCodicePraticaPanel

**Files:**
- Create: `src/components/requests/AssegnaCodicePraticaPanel.tsx`

**Interfaces:**
- Consumes: `UpdateRequestInput` (Task E1), `DM329PraticaSection`/`Dm329PraticaValue`, `DM329IntegrazioneSection`/`Dm329IntegrazioneValue`, `useUpdateRequest`, `customersApi`.
- Produces: `AssegnaCodicePraticaPanel` con props `{ request: Request; customer: Customer; sedeLegale: string; onSaved: () => void }`.

- [ ] **Step 1: Scrivere il componente**

```tsx
// src/components/requests/AssegnaCodicePraticaPanel.tsx
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Card, CardContent, Typography, Button, Box, Alert } from '@mui/material'
import { Request, Customer } from '@/types'
import { useUpdateRequest } from '@/hooks/useRequests'
import { DM329PraticaSection, Dm329PraticaValue } from './DM329PraticaSection'
import { DM329IntegrazioneSection, Dm329IntegrazioneValue } from './DM329IntegrazioneSection'

interface Props {
  request: Request
  customer: Customer
  sedeLegale: string
  onSaved: () => void
}

/**
 * Pannello sul dettaglio pratica DM329 priva di codice: assegna il codice pratica
 * dopo la creazione, riusando la stessa logica del form di creazione. Solo admin/userdm329.
 */
export const AssegnaCodicePraticaPanel = ({ request, customer, sedeLegale, onSaved }: Props) => {
  const isIntegrazione = request.request_type?.name === 'DM329-Integrazioni'
  const { control, setValue } = useForm<{ indirizzo_impianto: string }>({
    defaultValues: { indirizzo_impianto: '' },
  })
  const updateRequest = useUpdateRequest()

  const [praticaVal, setPraticaVal] = useState<{ value: Dm329PraticaValue | null; valid: boolean }>({ value: null, valid: false })
  const [integrVal, setIntegrVal] = useState<{ value: Dm329IntegrazioneValue | null; valid: boolean }>({ value: null, valid: false })
  const [error, setError] = useState<string | null>(null)

  const valid = isIntegrazione ? integrVal.valid : praticaVal.valid

  const handleSave = async () => {
    setError(null)
    try {
      if (isIntegrazione && integrVal.value) {
        await updateRequest.mutateAsync({
          id: request.id,
          updates: {
            pratica_padre_id: integrVal.value.pratica_padre_id,
            sala_lettera: integrVal.value.sala_lettera,
            progressivo: integrVal.value.progressivo,
            anno: integrVal.value.anno,
          },
        })
      } else if (!isIntegrazione && praticaVal.value) {
        await updateRequest.mutateAsync({
          id: request.id,
          updates: {
            sala_lettera: praticaVal.value.sala_lettera,
            progressivo: praticaVal.value.progressivo,
            anno: praticaVal.value.anno,
            denominazione_sala: praticaVal.value.denominazione_sala,
            indirizzo_impianto: praticaVal.value.indirizzo_impianto,
            impianto_uguale_sede_legale: praticaVal.value.impianto_uguale_sede_legale,
          },
        })
      }
      onSaved()
    } catch (e: any) {
      setError(e?.message || 'Errore nel salvataggio del codice pratica')
    }
  }

  return (
    <Card sx={{ mt: 2, borderLeft: '4px solid', borderColor: 'warning.main' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Assegna codice pratica
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Questa pratica è stata creata prima della funzione codice pratica. Assegnalo qui.
        </Typography>

        {isIntegrazione ? (
          <DM329IntegrazioneSection
            customer={customer}
            onChange={(value, v) => setIntegrVal({ value, valid: v })}
          />
        ) : (
          <DM329PraticaSection
            customer={customer}
            sedeLegale={sedeLegale}
            control={control}
            setValue={setValue}
            onChange={(value, v) => setPraticaVal({ value, valid: v })}
          />
        )}

        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!valid || updateRequest.isPending}
          >
            {updateRequest.isPending ? 'Salvataggio…' : 'Salva codice pratica'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build:check`
Expected: nessun errore (verifica in particolare i nomi dei tipi importati e la firma `mutateAsync({ id, updates })`).

- [ ] **Step 3: Commit**

```bash
git add src/components/requests/AssegnaCodicePraticaPanel.tsx
git commit -m "feat(dm329): pannello Assegna codice pratica (riusa sezioni del form)"
```

---

### Task E3: Wiring in RequestDetail + gating per ruolo/assenza codice

**Files:**
- Modify: `src/pages/RequestDetail.tsx`

**Interfaces:**
- Consumes: `AssegnaCodicePraticaPanel` (Task E2), `customerRecord` e `customersApi.formatFullAddress` già presenti, `user` da `useAuth`, `isDM329Family`.

- [ ] **Step 1: Importa il pannello**

In cima a `src/pages/RequestDetail.tsx`, aggiungi:

```tsx
import { AssegnaCodicePraticaPanel } from '@/components/requests/AssegnaCodicePraticaPanel'
```

- [ ] **Step 2: Calcola gating e render**

Nel corpo del componente (dove sono già disponibili `request`, `user`, `customerRecord`, `refetch`, `isDM329` / `isDM329Family`), aggiungi il calcolo:

```tsx
  const isDM329Fam = isDM329Family(request?.request_type?.name)
  const isIntegrazione = request?.request_type?.name === 'DM329-Integrazioni'
  const hasCodicePratica = isIntegrazione ? !!request?.pratica_padre_id : !!request?.sala_lettera
  const canAssignCodice =
    isDM329Fam &&
    !hasCodicePratica &&
    !!customerRecord &&
    (user?.role === 'admin' || user?.role === 'userdm329')
```

(Se una variabile equivalente — es. `isDM329` — esiste già, riusala invece di ridefinirla; non duplicare.)

Poi, nel JSX, subito dopo il blocco che mostra il chip del codice pratica (vicino al titolo/intestazione), renderizza il pannello:

```tsx
  {canAssignCodice && customerRecord && (
    <AssegnaCodicePraticaPanel
      request={request}
      customer={customerRecord}
      sedeLegale={customersApi.formatFullAddress(customerRecord)}
      onSaved={() => refetch()}
    />
  )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run build:check`
Expected: nessun errore.

- [ ] **Step 4: Verifica manuale (nell'app)**

Avvia `npm run dev`. Come admin, apri una pratica DM329 **priva di codice** (es. una delle 6 integrazioni attive, o una primaria chiusa). Attesa:
- Il pannello "Assegna codice pratica" appare.
- Per una primaria: scegli sala/nuova sala, progressivo, anno, indirizzo → l'anteprima mostra il codice; "Salva" scrive e il chip codice compare, il pannello sparisce.
- Per un'integrazione: se il cliente ha una primaria codificata, la selezioni come padre e salvi; il codice ereditato appare.
- Aprendo una pratica **già codificata** o come ruolo non abilitato: il pannello NON appare.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RequestDetail.tsx
git commit -m "feat(dm329): mostra pannello Assegna codice pratica sul dettaglio (admin/userdm329, pratiche senza codice)"
```

---

## Note di esecuzione

- Nessun UI test (convenzione progetto). La verifica è `npm run build:check` + controllo manuale nell'app (Task E3 Step 4).
- Le sezioni riusate mostrano già i propri avvisi (es. integrazione: "Crea prima la pratica iniziale" se il cliente non ha primarie codificate). Per le 6 integrazioni orfane, l'utente potrebbe dover prima codificare la primaria-padre (anche se chiusa) affinché compaia nel selettore.
- RLS: nessuna modifica prevista. Se un `--apply` reale fallisse con 42501 (permessi), significa che manca una policy UPDATE per il ruolo su quelle colonne → in tal caso segnalare (non previsto: admin/userdm329 già aggiornano la riga).

## Self-Review

- Copertura spec (Fase E): estensione tipi/api → E1; pannello riuso sezioni → E2; gating ruolo+assenza codice + wiring → E3.
- Placeholder: nessuno; codice completo in ogni step.
- Coerenza tipi: `Dm329PraticaValue`/`Dm329IntegrazioneValue` (dalle sezioni) usati in E2; `UpdateRequestInput` esteso in E1 usato in E2; `mutateAsync({ id, updates })` coerente con `useUpdateRequest`.
