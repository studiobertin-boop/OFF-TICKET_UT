# Dati cliente e ubicazione impianto nel dettaglio DM329 — Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrare nel dettaglio pratica DM329 due riquadri ordinati — dati cliente e ubicazione impianto — modificabili con una matita che aggiorna `customers` e `requests`.

**Architecture:** Due componenti di sezione autonomi montati da `RequestDetail.tsx` (già oltre le 1000 righe, non va ingrassato). Il cliente si modifica con un dialog nuovo che riusa `CustomerFormFields`; l'ubicazione riusa il `CodicePraticaDialog` esistente, perché indirizzo e denominazione sala sono legati ai campi che compongono il codice pratica. `requests.indirizzo_impianto` diventa sorgente unica, con una funzione di risoluzione che copre i due campi legacy finché non vengono eliminati.

**Tech Stack:** React 18 + TypeScript, Material UI 6, react-hook-form + Zod, TanStack Query, Supabase (PostgREST + Management API), Vitest.

**Spec:** `docs/superpowers/specs/2026-08-01-cliente-ubicazione-dettaglio-dm329-design.md`

## Global Constraints

- Lingua dell'interfaccia e dei commenti: italiano.
- Vitest solo su logica/validazioni: **nessun test UI** (convenzione CLAUDE.md).
- Conventional Commits. Ogni task termina con un commit.
- Non committare i 4 file già in stage (`src/services/relazione/{__tests__/classificazione.test.ts,__tests__/proceduraDM329.test.ts,engine/classificazione.ts,engine/proceduraDM329.ts}`): usare sempre `git commit --only <path>…` elencando i file del task.
- Permesso di modifica per entrambe le matite: `isDM329 && !!customerRecord && (role === 'admin' || role === 'userdm329')`.
- Il DROP delle colonne legacy **non** fa parte di questo piano: commit separato dopo verifica in produzione.

---

### Task 1: Risoluzione dell'indirizzo impianto

**Files:**
- Create: `src/utils/indirizzoImpianto.ts`
- Test: `src/utils/__tests__/indirizzoImpianto.test.ts`

**Interfaces:**
- Consumes: niente.
- Produces: `risolviIndirizzoImpianto(fonti: FontiIndirizzoImpianto): string` e il tipo `FontiIndirizzoImpianto` con i campi opzionali `indirizzoRichiesta`, `indirizzoSchedaLegacy`, `sedeImpiantoLegacy` (tutti `string | null | undefined`). Usato dai Task 3 e 5.

- [ ] **Step 1: Scrivere il test che fallisce**

`src/utils/__tests__/indirizzoImpianto.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { risolviIndirizzoImpianto } from '../indirizzoImpianto'

describe('risolviIndirizzoImpianto', () => {
  it('usa requests.indirizzo_impianto quando valorizzato', () => {
    expect(risolviIndirizzoImpianto({
      indirizzoRichiesta: 'Via Bianchi 7, Mogliano Veneto',
      indirizzoSchedaLegacy: 'VIA VECCHIA 1',
      sedeImpiantoLegacy: 'VIA VECCHISSIMA 2',
    })).toBe('Via Bianchi 7, Mogliano Veneto')
  })

  it('ripiega sulla colonna legacy della scheda quando la richiesta e vuota', () => {
    expect(risolviIndirizzoImpianto({
      indirizzoRichiesta: '   ',
      indirizzoSchedaLegacy: 'VIA E.FERMI 75, 36028 ROSSANO V.TO, (VI)',
      sedeImpiantoLegacy: 'VIA VECCHISSIMA 2',
    })).toBe('VIA E.FERMI 75, 36028 ROSSANO V.TO, (VI)')
  })

  it('ripiega su dati_impianto.sede_impianto quando gli altri due sono vuoti', () => {
    expect(risolviIndirizzoImpianto({
      indirizzoRichiesta: null,
      indirizzoSchedaLegacy: undefined,
      sedeImpiantoLegacy: 'VIA SCHIAVONESCA 89, 31030 CASELLE D\'ALTIVOLE, (TV)',
    })).toBe('VIA SCHIAVONESCA 89, 31030 CASELLE D\'ALTIVOLE, (TV)')
  })

  it('restituisce stringa vuota quando non c\'e nessuna fonte', () => {
    expect(risolviIndirizzoImpianto({})).toBe('')
  })

  it('rimuove gli spazi ai bordi del valore scelto', () => {
    expect(risolviIndirizzoImpianto({ indirizzoRichiesta: '  Via Roma 1  ' })).toBe('Via Roma 1')
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

Run: `npx vitest run src/utils/__tests__/indirizzoImpianto.test.ts`
Expected: FAIL — `Failed to resolve import "../indirizzoImpianto"`.

- [ ] **Step 3: Scrivere l'implementazione minima**

`src/utils/indirizzoImpianto.ts`:

```ts
/**
 * L'indirizzo dell'impianto e' storicamente finito in tre posti diversi. La sorgente
 * unica e' `requests.indirizzo_impianto`; le altre due restano solo come ripiego in
 * lettura per le pratiche non ancora migrate, e spariranno con il DROP delle colonne.
 */
export interface FontiIndirizzoImpianto {
  /** `requests.indirizzo_impianto` — sorgente unica. */
  indirizzoRichiesta?: string | null
  /** `dm329_technical_data.indirizzo_impianto` — legacy. */
  indirizzoSchedaLegacy?: string | null
  /** `equipment_data.dati_impianto.sede_impianto` — legacy. */
  sedeImpiantoLegacy?: string | null
}

export const risolviIndirizzoImpianto = (fonti: FontiIndirizzoImpianto): string =>
  [fonti.indirizzoRichiesta, fonti.indirizzoSchedaLegacy, fonti.sedeImpiantoLegacy]
    .map((v) => (v ?? '').trim())
    .find((v) => v.length > 0) ?? ''
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

Run: `npx vitest run src/utils/__tests__/indirizzoImpianto.test.ts`
Expected: PASS, 5 test.

- [ ] **Step 5: Commit**

```bash
git commit --only src/utils/indirizzoImpianto.ts src/utils/__tests__/indirizzoImpianto.test.ts -m "feat(dm329): risoluzione indirizzo impianto con fallback sui campi legacy"
```

---

### Task 2: Dialog di modifica anagrafica cliente

**Files:**
- Create: `src/components/customers/CustomerEditDialog.tsx`

**Interfaces:**
- Consumes: `CustomerFormFields` (`src/components/customers/CustomerFormFields.tsx`), `updateCustomerSchema` (`src/utils/customerValidation.ts`), `useUpdateCustomer` (`src/hooks/useCustomers.ts`, firma `mutateAsync({ id, updates })`).
- Produces: `<CustomerEditDialog customer={Customer} onClose={() => void} onSaved={() => void} />`. Usato dal Task 3. Va montato solo quando aperto, così il prefill si riapplica a ogni apertura.

- [ ] **Step 1: Creare il componente**

`src/components/customers/CustomerEditDialog.tsx`:

```tsx
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Alert, Box } from '@mui/material'
import { useState } from 'react'
import { CustomerFormFields } from './CustomerFormFields'
import { updateCustomerSchema } from '@/utils/customerValidation'
import { useUpdateCustomer } from '@/hooks/useCustomers'
import type { Customer } from '@/types'

interface Props {
  customer: Customer
  onClose: () => void
  /** Chiamata dopo un salvataggio riuscito: il chiamante rifetcha i dati della pagina. */
  onSaved: () => void
}

/**
 * Modifica dell'anagrafica cliente dal dettaglio pratica. Riusa lo stesso form di
 * Admin > Clienti, quindi stessi campi e stessa validazione. Da montare solo quando
 * aperto: il mount fresco riapplica il prefill a ogni apertura.
 */
export const CustomerEditDialog = ({ customer, onClose, onSaved }: Props) => {
  const [error, setError] = useState<string | null>(null)
  const updateCustomer = useUpdateCustomer()

  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(updateCustomerSchema),
    defaultValues: {
      ragione_sociale: customer.ragione_sociale || '',
      identificativo: customer.identificativo || '',
      telefono: customer.telefono || '',
      pec: customer.pec || '',
      descrizione_attivita: customer.descrizione_attivita || '',
      via: customer.via || '',
      numero_civico: customer.numero_civico || '',
      cap: customer.cap || '',
      comune: customer.comune || '',
      provincia: customer.provincia || '',
    },
  })

  const submit = handleSubmit(async (values) => {
    setError(null)
    try {
      await updateCustomer.mutateAsync({ id: customer.id, updates: values })
      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || 'Errore nel salvataggio dei dati cliente')
    }
  })

  return (
    <Dialog open onClose={updateCustomer.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>Modifica dati cliente</DialogTitle>
      <DialogContent dividers>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Le modifiche valgono per tutte le pratiche di questo cliente.
        </Alert>
        <Box component="form">
          <CustomerFormFields control={control} errors={errors} showAllFields highlightMissing={false} />
        </Box>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit" disabled={updateCustomer.isPending}>
          Annulla
        </Button>
        <Button variant="contained" onClick={submit} disabled={updateCustomer.isPending}>
          {updateCustomer.isPending ? 'Salvataggio…' : 'Salva'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 2: Verificare typecheck e lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i CustomerEditDialog`
Expected: nessun output.

Run: `npx eslint src/components/customers/CustomerEditDialog.tsx`
Expected: 0 errors (i warning `no-explicit-any` sono preesistenti nel progetto e accettati).

- [ ] **Step 3: Commit**

```bash
git commit --only src/components/customers/CustomerEditDialog.tsx -m "feat(clienti): dialog di modifica anagrafica riusabile dal dettaglio pratica"
```

---

### Task 3: I due riquadri di sezione

**Files:**
- Create: `src/components/requests/CustomerInfoSection.tsx`
- Create: `src/components/requests/PlantLocationSection.tsx`
- Modify: `src/components/requests/CodicePraticaDialog.tsx` (aggiunta prop `titolo`)

**Interfaces:**
- Consumes: `CustomerEditDialog` (Task 2), `risolviIndirizzoImpianto` (Task 1), `CodicePraticaDialog`, `customersApi.formatFullAddress`.
- Produces:
  - `<CustomerInfoSection info={InfoCliente} customer={Customer | null} canEdit={boolean} onSaved={() => void} />` dove `InfoCliente = { ragione_sociale: string; identificativo: string | null; telefono: string; pec: string; descrizione_attivita: string; sede_legale: string }` — è esattamente la forma già prodotta da `clientInfo` in `RequestDetail`.
  - `<PlantLocationSection request={Request} customer={Customer | null} indirizzoImpianto={string} canEdit={boolean} onSaved={() => void} />`
  - Entrambi esportano il tipo delle props. Usati dal Task 4.

- [ ] **Step 1: Aggiungere la prop `titolo` a CodicePraticaDialog**

In `src/components/requests/CodicePraticaDialog.tsx`, aggiungere al blocco `interface Props`:

```tsx
  /** Titolo del dialog. Il default riflette l'ingresso da "codice pratica". */
  titolo?: string
```

Aggiungere `titolo` alla destrutturazione dei parametri e sostituire la riga del titolo:

```tsx
        <DialogTitle>{titolo ?? (hasCode ? 'Modifica codice pratica' : 'Assegna codice pratica')}</DialogTitle>
```

- [ ] **Step 2: Creare CustomerInfoSection**

`src/components/requests/CustomerInfoSection.tsx`:

```tsx
import { useState } from 'react'
import { Box, Typography, IconButton, Tooltip, Divider } from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { CustomerEditDialog } from '@/components/customers/CustomerEditDialog'
import type { Customer } from '@/types'

/** Valori da mostrare: già risolti dal chiamante con la sua catena di fallback. */
export interface InfoCliente {
  ragione_sociale: string
  identificativo: string | null
  telefono: string
  pec: string
  descrizione_attivita: string
  sede_legale: string
}

interface Props {
  info: InfoCliente
  /**
   * Record anagrafico vero. È null sulle pratiche importate senza cliente a DB:
   * la vista funziona lo stesso, la matita no perché manca l'id da aggiornare.
   */
  customer: Customer | null
  canEdit: boolean
  onSaved: () => void
}

const Campo = ({ label, value }: { label: string; value: string }) => (
  <Box>
    <Typography variant="subtitle2" color="text.secondary">{label}</Typography>
    <Typography variant="body1" gutterBottom>{value || 'N/A'}</Typography>
  </Box>
)

export const CustomerInfoSection = ({ info, customer, canEdit, onSaved }: Props) => {
  const [editOpen, setEditOpen] = useState(false)
  const modificabile = canEdit && !!customer

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Cliente</Typography>
        {canEdit && (
          <Tooltip title={modificabile ? 'Modifica dati cliente' : 'Pratica senza anagrafica cliente collegata'}>
            <span>
              <IconButton size="small" color="primary" disabled={!modificabile} onClick={() => setEditOpen(true)}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Campo
          label="Ragione sociale"
          value={info.identificativo ? `${info.identificativo} — ${info.ragione_sociale}` : info.ragione_sociale}
        />
        <Campo label="Sede legale" value={info.sede_legale} />
        <Campo label="Telefono" value={info.telefono} />
        <Campo label="PEC" value={info.pec} />
        <Campo label="Descrizione attività" value={info.descrizione_attivita} />
      </Box>

      {editOpen && customer && (
        <CustomerEditDialog customer={customer} onClose={() => setEditOpen(false)} onSaved={onSaved} />
      )}
    </>
  )
}
```

- [ ] **Step 3: Creare PlantLocationSection**

`src/components/requests/PlantLocationSection.tsx`:

```tsx
import { useState } from 'react'
import { Box, Typography, IconButton, Tooltip, Divider } from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { CodicePraticaDialog } from './CodicePraticaDialog'
import { customersApi } from '@/services/api/customers'
import type { Customer, Request } from '@/types'

interface Props {
  request: Request
  customer: Customer | null
  /** Già risolto dal chiamante con risolviIndirizzoImpianto. */
  indirizzoImpianto: string
  canEdit: boolean
  onSaved: () => void
}

/**
 * Ubicazione dell'impianto. La matita riapre CodicePraticaDialog invece di avere un
 * editor proprio: indirizzo e denominazione sala sono legati a sala_lettera,
 * progressivo e anno, che compongono il codice pratica; modificarne solo due
 * lascerebbe il codice disallineato dalla sala.
 */
export const PlantLocationSection = ({ request, customer, indirizzoImpianto, canEdit, onSaved }: Props) => {
  const [editOpen, setEditOpen] = useState(false)
  const modificabile = canEdit && !!customer

  return (
    <>
      <Divider sx={{ my: 3 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6">Ubicazione impianto</Typography>
        {canEdit && (
          <Tooltip title={modificabile ? 'Modifica ubicazione impianto' : 'Pratica senza anagrafica cliente collegata'}>
            <span>
              <IconButton size="small" color="primary" disabled={!modificabile} onClick={() => setEditOpen(true)}>
                <EditIcon />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Indirizzo impianto</Typography>
          <Typography variant="body1" gutterBottom>{indirizzoImpianto || 'N/A'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Denominazione sala</Typography>
          <Typography variant="body1" gutterBottom>{request.denominazione_sala || 'N/A'}</Typography>
        </Box>
      </Box>

      {editOpen && customer && (
        <CodicePraticaDialog
          request={request}
          customer={customer}
          sedeLegale={customersApi.formatFullAddress(customer)}
          hasCode={!!request.sala_lettera}
          titolo="Modifica ubicazione impianto"
          onClose={() => setEditOpen(false)}
          onSaved={onSaved}
        />
      )}
    </>
  )
}
```

- [ ] **Step 4: Verificare typecheck e lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE "CustomerInfoSection|PlantLocationSection|CodicePraticaDialog"`
Expected: nessun output.

Run: `npx eslint src/components/requests/CustomerInfoSection.tsx src/components/requests/PlantLocationSection.tsx src/components/requests/CodicePraticaDialog.tsx`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git commit --only src/components/requests/CustomerInfoSection.tsx src/components/requests/PlantLocationSection.tsx src/components/requests/CodicePraticaDialog.tsx -m "feat(dm329): riquadri Cliente e Ubicazione impianto con modifica"
```

---

### Task 4: Montaggio in RequestDetail

**Files:**
- Modify: `src/pages/RequestDetail.tsx`

**Interfaces:**
- Consumes: `CustomerInfoSection`, `PlantLocationSection` (Task 3), `risolviIndirizzoImpianto` (Task 1).
- Produces: niente per i task successivi.

- [ ] **Step 1: Sostituire lo stato `sedeImpianto` con i dati grezzi della scheda**

L'effetto attuale (righe ~119-131) tiene solo la stringa `sede_impianto`. Serve anche la colonna legacy, quindi conserva le due fonti:

```tsx
  const [fontiLegacyImpianto, setFontiLegacyImpianto] = useState<{
    indirizzoSchedaLegacy?: string | null
    sedeImpiantoLegacy?: string | null
  }>({})

  useEffect(() => {
    if (!isDM329 || !id) return
    technicalDataApi.getByRequestId(id)
      .then((data) => setFontiLegacyImpianto({
        indirizzoSchedaLegacy: data?.indirizzo_impianto ?? null,
        sedeImpiantoLegacy: data?.equipment_data?.dati_impianto?.sede_impianto ?? null,
      }))
      .catch(() => setFontiLegacyImpianto({}))
  }, [id, isDM329])
```

Rimuovere la dichiarazione `const [sedeImpianto, setSedeImpianto] = useState…` e ogni altro riferimento a `sedeImpianto`.

- [ ] **Step 2: Calcolare l'indirizzo risolto**

Subito dopo `canManageCodice` (riga ~438):

```tsx
  const indirizzoImpianto = risolviIndirizzoImpianto({
    indirizzoRichiesta: request.indirizzo_impianto,
    ...fontiLegacyImpianto,
  })
```

Aggiungere l'import: `import { risolviIndirizzoImpianto } from '@/utils/indirizzoImpianto'`.

- [ ] **Step 3: Sostituire il blocco "Informazioni Cliente"**

Rimpiazzare l'intero blocco `{clientInfo && ( … )}` (righe ~703-793, dal `<Divider>` fino alla chiusura, **incluso** il campo "Sede Impianto") con:

```tsx
            {clientInfo && (
              <>
                <CustomerInfoSection
                  info={clientInfo}
                  customer={customerRecord}
                  canEdit={canManageCodice}
                  onSaved={() => refetch()}
                />

                {isDM329 && (
                  <PlantLocationSection
                    request={request}
                    customer={customerRecord}
                    indirizzoImpianto={indirizzoImpianto}
                    canEdit={canManageCodice}
                    onSaved={() => refetch()}
                  />
                )}

                {customerRecord && hasIncompleteCustomerData(customerRecord) && (
                  <Alert
                    severity="info"
                    sx={{ mt: 2 }}
                    action={
                      <Button color="inherit" size="small" onClick={() => setShowCompleteCustomerDialog(true)}>
                        Completa dati
                      </Button>
                    }
                  >
                    Alcuni dati anagrafici del cliente sono incompleti. Puoi integrarli ora.
                  </Alert>
                )}
              </>
            )}
```

Aggiungere gli import dei due componenti da `@/components/requests/…`.

- [ ] **Step 4: Togliere `denominazione_sala` dalla matita di "Dettagli Richiesta"**

Nel form DM329 di modifica dettagli (righe ~810-821) eliminare il `<Grid item xs={12}>` con il `TextField` "Denominazione sala". Eliminare lo stato `denominazioneSalaValue` / `setDenominazioneSalaValue`, la sua inizializzazione in `handleEditDetails` e il campo `denominazione_sala` dal payload di `handleSaveDetails`.

Nel riquadro di sola lettura DM329 (righe ~896-931) eliminare il `<Grid item xs={12} md={6}>` che mostra "Denominazione sala": ora vive in `PlantLocationSection`. Restano No CIVA, Off/Cac, Stato Fattura.

- [ ] **Step 5: Verificare typecheck e lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Expected: `0`.

Run: `npx eslint src/pages/RequestDetail.tsx`
Expected: 0 errors.

- [ ] **Step 6: Verifica manuale nel browser**

Avviare il server con `preview_start` (`.claude/launch.json`, nome `off-ticket-ut`) e aprire la pratica `fed244ee-26e6-4d32-8c01-45abd393879d`.

Controllare: i due riquadri compaiono; "Indirizzo impianto" mostra `Via Bianchi 7, Mogliano Veneto, Treviso, Veneto, 31021, Italia`; "Denominazione sala" mostra `Sala principale`; "Denominazione sala" **non** compare più in Dettagli Richiesta.

Aprire la matita cliente, cambiare la descrizione attività, salvare, poi verificare a DB che il valore sia cambiato davvero:

```bash
set -a; . ./.env.local; set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/customers?select=ragione_sociale,descrizione_attivita&id=eq.d299102e-abea-414e-8586-5309874797c7" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Aprire la matita ubicazione, salvare senza modifiche, e verificare che `sala_lettera`, `progressivo` e `anno` non siano cambiati.

- [ ] **Step 7: Commit**

```bash
git commit --only src/pages/RequestDetail.tsx -m "feat(dm329): riquadri cliente e ubicazione nel dettaglio pratica"
```

---

### Task 5: Indirizzo impianto sulle schede CIVA

**Files:**
- Modify: `src/components/civa/CIVAApparecchioColumn.tsx`
- Modify: `src/pages/CIVASummary.tsx`

**Interfaces:**
- Consumes: `risolviIndirizzoImpianto` (Task 1). `useCIVAData` restituisce già `request` e `equipmentData`.
- Produces: `CIVAApparecchioColumn` non accetta più la prop `impianto`; al suo posto `indirizzoImpianto: string`.

- [ ] **Step 1: Cambiare la prop di CIVAApparecchioColumn**

In `src/components/civa/CIVAApparecchioColumn.tsx`, nell'interfaccia props sostituire `impianto: DatiImpianto` con:

```tsx
  /** Indirizzo impianto già risolto dal chiamante (sorgente: requests.indirizzo_impianto). */
  indirizzoImpianto: string
```

Sostituire `impianto` con `indirizzoImpianto` nella destrutturazione, e la riga 112 con:

```tsx
  const impiantoAddress = parseAddress(indirizzoImpianto)
```

Rimuovere `DatiImpianto` dall'import dei tipi se non più usato.

- [ ] **Step 2: Aggiornare CIVASummary**

Dopo la destrutturazione di `useCIVAData` aggiungere:

```tsx
  const indirizzoImpianto = risolviIndirizzoImpianto({
    indirizzoRichiesta: request?.indirizzo_impianto,
    sedeImpiantoLegacy: equipmentData?.dati_impianto?.sede_impianto,
  })
```

con l'import `import { risolviIndirizzoImpianto } from '@/utils/indirizzoImpianto'`.

Sostituire tutte e quattro le occorrenze di `impianto={equipmentData.dati_impianto}` (righe ~282, ~309, ~344, ~376) con `indirizzoImpianto={indirizzoImpianto}`.

- [ ] **Step 3: Verificare typecheck e lint**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Expected: `0`.

Run: `npx eslint src/components/civa/CIVAApparecchioColumn.tsx src/pages/CIVASummary.tsx`
Expected: 0 errors.

- [ ] **Step 4: Verifica manuale**

Aprire `/requests/fed244ee-26e6-4d32-8c01-45abd393879d/civa-summary` e controllare che i campi Indirizzo / Numero Civico / CAP / Comune / Provincia delle colonne apparecchio siano popolati (prima erano vuoti: la scheda non ha `sede_impianto`).

- [ ] **Step 5: Commit**

```bash
git commit --only src/components/civa/CIVAApparecchioColumn.tsx src/pages/CIVASummary.tsx -m "fix(civa): indirizzo impianto dalla sorgente unica su requests"
```

---

### Task 6: Migration dati degli indirizzi legacy

**Files:**
- Create: `supabase/migrations/20260801000000_migra_indirizzo_impianto_su_requests.sql`

**Interfaces:**
- Consumes: niente.
- Produces: `requests.indirizzo_impianto` completo; il ripiego del Task 1 resta in codice ma smette di servire.

- [ ] **Step 1: Contare le righe prima**

```bash
set -a; . ./.env.local; set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/requests?select=id&indirizzo_impianto=not.is.null" -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Prefer: count=exact" -H "Range: 0-0" -I | grep -i content-range
```

Expected: `Content-Range: 0-40/41`.

- [ ] **Step 2: Scrivere la migration**

`supabase/migrations/20260801000000_migra_indirizzo_impianto_su_requests.sql`:

```sql
-- L'indirizzo impianto e' finito storicamente in tre posti. requests.indirizzo_impianto
-- diventa la sorgente unica: qui si recuperano le pratiche in cui e' vuoto ma il dato
-- esiste sulla scheda tecnica. Verificato il 2026-08-01: 8 righe interessate, nessun
-- conflitto (dove entrambi sono valorizzati le stringhe coincidono).
UPDATE requests r
SET indirizzo_impianto = COALESCE(
      NULLIF(btrim(t.indirizzo_impianto), ''),
      NULLIF(btrim(t.equipment_data -> 'dati_impianto' ->> 'sede_impianto'), '')
    )
FROM dm329_technical_data t
WHERE t.request_id = r.id
  AND COALESCE(btrim(r.indirizzo_impianto), '') = ''
  AND COALESCE(
        NULLIF(btrim(t.indirizzo_impianto), ''),
        NULLIF(btrim(t.equipment_data -> 'dati_impianto' ->> 'sede_impianto'), '')
      ) IS NOT NULL;
```

- [ ] **Step 3: Eseguire la migration via Management API**

Secondo CLAUDE.md, con `SUPABASE_ACCESS_TOKEN` e `curl` (non urllib):

```bash
set -a; . ./.env.local; set +a
PROJECT_REF=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#')
curl -s -X POST "https://api.supabase.com/v1/projects/$PROJECT_REF/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  --data-binary @<(jq -Rs '{query: .}' supabase/migrations/20260801000000_migra_indirizzo_impianto_su_requests.sql)
```

- [ ] **Step 4: Contare le righe dopo**

Ripetere il comando dello Step 1.
Expected: `Content-Range: 0-48/49` — 8 righe in più.

Se il numero è diverso da 49, **fermarsi**: significa che i dati di produzione sono cambiati rispetto alla verifica del 2026-08-01. Riportare il numero effettivo prima di procedere.

- [ ] **Step 5: Commit**

```bash
git commit --only supabase/migrations/20260801000000_migra_indirizzo_impianto_su_requests.sql -m "chore(db): migra gli indirizzi impianto legacy su requests.indirizzo_impianto"
```

---

### Task 7: Rimozione del codice morto sugli indirizzi

**Files:**
- Modify: `src/services/api/technicalData.ts`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: niente.
- Produces: niente. Prepara il DROP delle colonne, che è **fuori da questo piano**.

- [ ] **Step 1: Verificare che siano davvero morti**

```bash
grep -rn "updateAddress\|indirizzo_impianto_formatted" src --include=*.ts --include=*.tsx
```

Expected: solo la definizione in `src/services/api/technicalData.ts` e il campo di tipo in `src/types/index.ts`. Nessun chiamante. Se compare un chiamante, **fermarsi** e segnalarlo.

- [ ] **Step 2: Rimuovere il metodo e il campo di tipo**

Eliminare il metodo `updateAddress` (`src/services/api/technicalData.ts`, righe ~137-146) con il suo blocco di commento, e il campo `indirizzo_impianto_formatted?: AddressComponents` da `src/types/index.ts` (riga ~313). Se `AddressComponents` non è più usato in quel file, rimuovere anche il suo import.

- [ ] **Step 3: Verificare typecheck**

Run: `npx tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"`
Expected: `0`.

- [ ] **Step 4: Eseguire l'intera suite**

Run: `npx vitest run`
Expected: nessun fallimento nuovo rispetto allo stato del branch prima del piano. Annotare i fallimenti preesistenti se ce ne sono.

- [ ] **Step 5: Commit**

```bash
git commit --only src/services/api/technicalData.ts src/types/index.ts -m "chore(dm329): rimuove updateAddress e indirizzo_impianto_formatted inutilizzati"
```

---

## Fuori da questo piano

Il **passo 3 della pulizia** dello spec — `DROP COLUMN dm329_technical_data.indirizzo_impianto` e `indirizzo_impianto_formatted`, rimozione delle chiavi `sede_impianto` e `sede_imp_uguale_legale` dal JSONB e dai tipi, semplificazione di `risolviIndirizzoImpianto` — resta un commit separato, da fare dopo aver visto in produzione che dettaglio pratica e schede CIVA funzionano. È l'unica operazione irreversibile del lotto.
