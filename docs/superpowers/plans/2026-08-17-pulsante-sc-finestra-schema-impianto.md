# Pulsante "SC" e finestra SCHEMA IMPIANTO — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sposta l'editor dello schema d'impianto e l'associazione compressori→serbatoi fuori dalla
finestra "Dati per la relazione tecnica", in una finestra propria "SCHEMA IMPIANTO" aperta da un
nuovo chip "SC" in testata, a sinistra di "R". "R" diventa verde solo se, oltre al documento già
generato, anche lo schema è pronto.

**Architecture:** Lo stato di `collegamenti`/`schema`/`layout`/`taraturaPratica` sale da
`RelazioneDataDialog` a `TechnicalDetails.tsx` (genitore comune), inizializzato una sola volta dal
database. Un nuovo componente `SchemaImpiantoDialog` (con `Dialog keepMounted`, per generare lo
schema in sottofondo anche a finestra chiusa) ospita ciò che oggi vive dentro
`RelazioneDataDialog`, e salva su `additional_info` alla propria chiusura — indipendentemente dalla
generazione della relazione. `RelazioneDataDialog` riceve questi dati come prop invece di
possederli.

**Tech Stack:** React 18 + TypeScript + Material UI 6, Vitest, ESLint.

**Spec:** `docs/superpowers/specs/2026-08-17-pulsante-sc-finestra-schema-impianto-design.md`

## Global Constraints

- Nessuna modifica a `SchemaImpiantoSection.tsx`, `SchemaEditor.tsx`, o a qualunque file sotto
  `src/services/schemaImpianto/`.
- Nessun nuovo test di interfaccia per `SchemaImpiantoDialog` (convenzione del progetto: niente
  UI test). `TechnicalSheetHeader.test.tsx` è l'eccezione perché esiste già.
- `updateAdditionalInfo` sovrascrive l'intera colonna `additional_info`: ogni scrittura parziale
  deve fare merge esplicito con lo stato corrente, mai un oggetto costruito da zero.
- Comandi di verifica ad ogni task: `npx vitest run`, `npx tsc --noEmit`, `npx eslint <path
  toccati> --max-warnings 0`.

---

### Task 1: Modulo di stile condiviso + nuova finestra `SchemaImpiantoDialog`

**Files:**
- Create: `src/components/relazione/selectStyles.ts`
- Create: `src/components/relazione/SchemaImpiantoDialog.tsx`
- Test: nessuno (vedi Global Constraints)

**Interfaces:**
- Produces: `LARGHEZZA_SELECT: number`, `ETICHETTA_TRONCATA: object` da `selectStyles.ts`.
- Produces: `export default function SchemaImpiantoDialog(props: SchemaImpiantoDialogProps)` con

```ts
export interface SchemaImpiantoDialogProps {
  open: boolean
  onClose: () => void
  scheda: SchedaDatiCompleta
  droppedRefs: string[]
  collegamenti: Record<string, string[]>
  onCollegamentiChange: (collegamenti: Record<string, string[]>) => void
  schema: SchemaImpianto | null
  onSchemaChange: (schema: SchemaImpianto | null) => void
  layoutSalvato: LayoutSalvato | null | undefined
  onLayoutChange: (layout: SchemaLayout | null) => void
  taraturaPratica: Tarature
  onTaraturaPraticaChange: (taraturaPratica: Tarature) => void
}
```

  Task 3 consuma questo componente e questa interfaccia esattamente come sopra.

- [ ] **Step 1: Creare `selectStyles.ts`**

```ts
/**
 * Larghezza delle select che raccolgono una sigla o due — collegamenti e giri.
 *
 * Erano larghe quanto la finestra: novecento pixel per contenere «S1, S2», una per riga.
 * Con una misura propria stanno in fila e vanno a capo solo quando la finestra si stringe
 * davvero, ed è lì che la finestra smette di dover essere scorsa per intero.
 */
export const LARGHEZZA_SELECT = 232

/**
 * Etichetta che si tronca invece di sfondare il campo.
 *
 * «C1 · KAESER SK 19» ci sta, «C1 · ATLAS COPCO GA 30 VSD+ FF» no: MUI non accorcia da sé
 * l'etichetta di un campo contornato, e quella in eccesso uscirebbe dal bordo.
 */
export const ETICHETTA_TRONCATA = {
  '& .MuiInputLabel-root': {
    maxWidth: 'calc(100% - 28px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
} as const
```

- [ ] **Step 2: Creare `SchemaImpiantoDialog.tsx`**

```tsx
/**
 * Finestra "SCHEMA IMPIANTO": i collegamenti compressori → serbatoi e l'editor dello schema
 * d'impianto (§2.3 della relazione), separati dalla finestra "Dati per la relazione tecnica"
 * perché servono anche a chi non genera ancora il documento finale.
 */
import { useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import { GruppoCampi } from '@/components/common'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { SchemaImpianto } from '@/services/relazione/types'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { SchemaImpiantoSection } from './SchemaImpiantoSection'
import { ETICHETTA_TRONCATA, LARGHEZZA_SELECT } from './selectStyles'

export interface SchemaImpiantoDialogProps {
  open: boolean
  onClose: () => void
  scheda: SchedaDatiCompleta
  /** Collegamenti compressori→serbatoi salvati che non corrispondono più a un codice di scheda. */
  droppedRefs: string[]
  collegamenti: Record<string, string[]>
  onCollegamentiChange: (collegamenti: Record<string, string[]>) => void
  schema: SchemaImpianto | null
  onSchemaChange: (schema: SchemaImpianto | null) => void
  layoutSalvato: LayoutSalvato | null | undefined
  onLayoutChange: (layout: SchemaLayout | null) => void
  taraturaPratica: Tarature
  onTaraturaPraticaChange: (taraturaPratica: Tarature) => void
}

/**
 * Sta fuori dalla finestra "Dati relazione" apposta: collegamenti e schema servono al calcolo
 * delle valvole e si rifiniscono anche indipendentemente dalla generazione del .docx.
 *
 * `keepMounted` sul Dialog: `SchemaImpiantoSection` genera lo schema in automatico appena i dati
 * bastano (suo effetto interno, invariato) — deve restare montata anche a finestra chiusa, o il
 * chip "SC" in testata resterebbe grigio dopo un ricaricamento della pagina finché l'utente non
 * apre questa finestra almeno una volta.
 */
export default function SchemaImpiantoDialog({
  open,
  onClose,
  scheda,
  droppedRefs,
  collegamenti,
  onCollegamentiChange,
  schema,
  onSchemaChange,
  layoutSalvato,
  onLayoutChange,
  taraturaPratica,
  onTaraturaPraticaChange,
}: SchemaImpiantoDialogProps) {
  const compressoriCodes = useMemo(() => (scheda.compressori ?? []).map((c) => c.codice), [scheda])
  const serbatoiCodes = useMemo(() => (scheda.serbatoi ?? []).map((s) => s.codice), [scheda])

  const setCollegamentoFor = (code: string, values: string[]) =>
    onCollegamentiChange({ ...collegamenti, [code]: values })

  const renderMultiValue = (selected: string[]) => selected.join(', ')

  return (
    <Dialog open={open} onClose={onClose} keepMounted maxWidth="md" fullWidth>
      <DialogTitle>Schema d’impianto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {droppedRefs.length > 0 && (
            <Alert severity="warning">
              Alcuni collegamenti salvati non corrispondono più ad apparecchiature presenti nella
              scheda e sono stati rimossi: {droppedRefs.join('; ')}.
            </Alert>
          )}

          <GruppoCampi
            titolo="Collegamenti compressori → serbatoi"
            spiegazione="Serve al calcolo della portata delle valvole dei serbatoi."
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              {compressoriCodes.map((code) => (
                <FormControl key={code} size="small" sx={{ width: LARGHEZZA_SELECT, ...ETICHETTA_TRONCATA }}>
                  <InputLabel id={`coll-${code}`}>{`${code} collegato a`}</InputLabel>
                  <Select
                    labelId={`coll-${code}`}
                    multiple
                    value={collegamenti[code] ?? []}
                    onChange={(e: SelectChangeEvent<string[]>) =>
                      setCollegamentoFor(
                        code,
                        typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                      )
                    }
                    input={<OutlinedInput label={`${code} collegato a`} />}
                    renderValue={renderMultiValue}
                  >
                    {serbatoiCodes.map((s) => (
                      <MenuItem key={s} value={s}>
                        <Checkbox checked={(collegamenti[code] ?? []).includes(s)} />
                        <ListItemText primary={s} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
          </GruppoCampi>

          <SchemaImpiantoSection
            scheda={scheda}
            collegamentiCompressoriSerbatoi={collegamenti}
            schema={schema}
            onSchemaChange={onSchemaChange}
            layoutSalvato={layoutSalvato}
            onLayoutChange={onLayoutChange}
            taraturaPratica={taraturaPratica}
            onTaraturaPraticaChange={onTaraturaPraticaChange}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 3: Verificare**

Run: `npx tsc --noEmit`
Expected: nessun errore nei due file nuovi (il componente non è ancora importato da nessuno: è
normale che non compaia in nessun altro output).

Run: `npx eslint src/components/relazione/selectStyles.ts src/components/relazione/SchemaImpiantoDialog.tsx --max-warnings 0`
Expected: nessun warning.

- [ ] **Step 4: Commit**

```bash
git add src/components/relazione/selectStyles.ts src/components/relazione/SchemaImpiantoDialog.tsx
git commit -m "feat(schema): nuova finestra SchemaImpiantoDialog, non ancora collegata"
```

---

### Task 2: Chip "SC" in `TechnicalSheetHeader`

**Files:**
- Modify: `src/components/technicalSheet/TechnicalSheetHeader.tsx`
- Test: `src/components/technicalSheet/__tests__/TechnicalSheetHeader.test.tsx`

**Interfaces:**
- Consumes: `ChipAzione` da `@/components/common` (già importato nel file), stessa firma di oggi.
- Produces: due prop nuove su `TechnicalSheetHeaderProps` — `schemaGenerato: boolean`,
  `onSchemaImpianto: () => void` — che Task 3 passa da `TechnicalDetails.tsx`.

- [ ] **Step 1: Aggiungere le due prop all'interfaccia e alla firma**

In `TechnicalSheetHeader.tsx`, nell'interfaccia `TechnicalSheetHeaderProps` (righe 31-54),
subito sopra `onRelazione`:

```ts
  onSchemaImpianto: () => void
```

e subito sopra `relazionePronta`:

```ts
  /** Presente quando lo schema d'impianto è già pronto in questa sessione. */
  schemaGenerato: boolean
```

Nella destrutturazione della funzione (righe 77-97), aggiungere `onSchemaImpianto` accanto a
`onRelazione` e `schemaGenerato` accanto a `relazionePronta`.

- [ ] **Step 2: Aggiungere il chip "SC", a sinistra di "R"**

Subito prima del blocco `<ChipAzione sigla="R" .../>` (riga 233 del file originale):

```tsx
              <ChipAzione
                sigla="SC"
                testo={schemaGenerato ? 'Schema d’impianto pronto' : 'Genera schema d’impianto'}
                fatto={schemaGenerato}
                onClick={onSchemaImpianto}
              />

```

- [ ] **Step 3: Aggiornare il test esistente**

In `TechnicalSheetHeader.test.tsx`, ogni montaggio diretto di `<TechnicalSheetHeader>` guadagna
`onSchemaImpianto={() => {}}` e `schemaGenerato={false}` (o il valore che il test richiede). Tre
punti:

1. Nell'helper `monta` (righe 79-98): aggiungere sotto `onRelazione={() => {}}`:

```tsx
              onSchemaImpianto={() => {}}
              schemaGenerato={false}
```

2. Nel secondo test, "apre la finestra dell'apparecchiatura al clic sul chip del fascicolo"
   (righe 113-142): stessa aggiunta, sotto `relazionePronta={false}`.

3. Nell'ultimo test, "accende la documentazione completa quando c'è tutto" (righe 193-222):
   stessa aggiunta, sotto `relazionePronta`.

- [ ] **Step 4: Aggiungere un test per il chip "SC"**

Prima di tutto, estendere il tipo che l'helper `monta` accetta (righe 70-78), aggiungendo
`schemaGenerato?: boolean` e `onSchemaImpianto?: () => void`:

```ts
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
```

Nel corpo di `monta`, il JSX aggiunto allo Step 3 (`onSchemaImpianto={() => {}}` /
`schemaGenerato={false}`) resta prima dello spread `{...extra}`, così i test esistenti — che non
passano questi due campi — continuano a montare con i default, e i test nuovi possono
sovrascriverli passandoli espliciti:

```tsx
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
```

Poi, dopo il test `'su relazione e dichiarazioni non ancora generate porta alla generazione'` (che
finisce alla riga 156):

```tsx
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
```

- [ ] **Step 5: Eseguire i test e verificare**

Run: `npx vitest run src/components/technicalSheet/__tests__/TechnicalSheetHeader.test.tsx`
Expected: PASS, tutti i test incluso i due nuovi.

Run: `npx tsc --noEmit`
Expected: nessun errore.

Run: `npx eslint src/components/technicalSheet/TechnicalSheetHeader.tsx src/components/technicalSheet/__tests__/TechnicalSheetHeader.test.tsx --max-warnings 0`
Expected: nessun warning.

- [ ] **Step 6: Commit**

```bash
git add src/components/technicalSheet/TechnicalSheetHeader.tsx src/components/technicalSheet/__tests__/TechnicalSheetHeader.test.tsx
git commit -m "feat(schema): chip SC in testata, R verde solo con schema pronto"
```

---

### Task 3: Stato di pagina, `RelazioneDataDialog` a prop, collegamento in `TechnicalDetails.tsx`

**Files:**
- Modify: `src/components/relazione/RelazioneDataDialog.tsx`
- Modify: `src/pages/TechnicalDetails.tsx`

**Interfaces:**
- Consumes: `SchemaImpiantoDialog`/`SchemaImpiantoDialogProps` (Task 1), `TechnicalSheetHeader`
  con `schemaGenerato`/`onSchemaImpianto` (Task 2).
- Consumes: `layoutDaPersistere(layoutCorrente, layoutRicalcolato, layoutSalvato, simboli):
  LayoutSalvato | undefined` da `@/services/schemaImpianto/persistenza` (esistente, invariata).
- Consumes: `pruneAdditionalInfo(info, codes): {info, dropped}`, `collectCodes(scheda): Set<string>`
  da `@/utils/equipmentCodes` (esistenti, invariate).
- Produces: `RelazioneDataDialogProps` guadagna `collegamentiCompressoriSerbatoi: Record<string,
  string[]>`, `schemaImpianto: SchemaImpianto | null`, `schemaLayoutDaPersistere: LayoutSalvato |
  undefined`.

- [ ] **Step 1: `RelazioneDataDialog.tsx` — import**

Sostituire il blocco di import righe 42-45:

```ts
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import { layoutDaPersistere } from '@/services/schemaImpianto/persistenza'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { SchemaImpiantoSection } from './SchemaImpiantoSection'
```

con:

```ts
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
```

(`SchemaImpianto` resta importato dalla riga esistente `import type { AdditionalInfo, PraticaInfo,
SchemaImpianto, TipoGiri } from '@/services/relazione/types'`, riga 41 — non toccarla.)

- [ ] **Step 2: `RelazioneDataDialog.tsx` — costanti di stile**

Sostituire il blocco righe 71-91 (`LARGHEZZA_SELECT` e `ETICHETTA_TRONCATA` dichiarati lì) con
l'import:

```ts
import { ETICHETTA_TRONCATA, LARGHEZZA_SELECT } from './selectStyles'
```

(da mettere fra gli altri import, non in mezzo al file — vicino a dove stavano le costanti
rimosse, sotto l'ultimo import esistente.)

- [ ] **Step 3: `RelazioneDataDialog.tsx` — nuove prop**

Nell'interfaccia `RelazioneDataDialogProps` (righe 50-68), sotto `pratica`:

```ts
  /** Collegamenti compressori → serbatoi: di proprietà della finestra SCHEMA IMPIANTO. */
  collegamentiCompressoriSerbatoi: Record<string, string[]>
  /** Il PNG dello schema d'impianto già pronto, o `null` se non generato/caricato. */
  schemaImpianto: SchemaImpianto | null
  /** Layout da scrivere in `additional_info.schemaLayout`, già calcolato dal chiamante. */
  schemaLayoutDaPersistere: LayoutSalvato | undefined
```

Nella firma della funzione (righe 93-103), aggiungere i tre parametri nella destrutturazione.

- [ ] **Step 4: `RelazioneDataDialog.tsx` — rimuovere `compressoriCodes` e lo stato spostato**

Rimuovere il blocco righe 104-107 (`compressoriCodes`, non più usato da questo file).

Rimuovere dalle dichiarazioni di stato (righe 146, 152-153, 161, 166): `schema`/`setSchema`,
`layoutSalvato`/`setLayoutSalvato`, `layout`/`setLayout`, `taraturaPratica`/`setTaraturaPratica`,
`layoutRicalcolato`/`setLayoutRicalcolato`, e la dichiarazione `collegamenti`/`setCollegamenti`
(riga 145).

- [ ] **Step 5: `RelazioneDataDialog.tsx` — effetto di sincronizzazione**

Nell'effetto righe 179-223, rimuovere queste righe dal corpo (quelle che scrivevano nello stato
appena tolto):

```ts
    setCollegamenti(info.collegamentiCompressoriSerbatoi ?? {})
```

```ts
    setSchema(null)
    setLayout(null)
    setLayoutRicalcolato(false)
    setLayoutSalvato(info.schemaLayout ?? null)
    setTaraturaPratica(info.schemaLayout?.simboli ?? {})
```

Il resto dell'effetto (descrizioneAttivita, dataEmissione, giri, spessimetrica, droppedRefs,
`setSchema`/`setLayout`/eccetera erano l'unico punto che li leggeva: dopo la rimozione l'effetto
calcola comunque `info`/`dropped` con `pruneAdditionalInfo`, li usa per gli altri campi, e ignora
la parte di `info` relativa a collegamenti/schemaLayout — nessun'altra modifica necessaria qui).

- [ ] **Step 6: `RelazioneDataDialog.tsx` — rimuovere `setCollegamentoFor`**

Rimuovere le righe 228-229 (la funzione, non più usata in questo file).

- [ ] **Step 7: `RelazioneDataDialog.tsx` — `additionalInfo`**

Sostituire il blocco righe 231-251:

```ts
  const additionalInfo: AdditionalInfo = useMemo(
    () => ({
      descrizioneAttivita: descrizioneAttivita.trim(),
      dataEmissione,
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi: collegamenti,
      schemaLayout: layoutDaPersistere(layout, layoutRicalcolato, layoutSalvato, taraturaPratica),
    }),
    [
      descrizioneAttivita,
      dataEmissione,
      giri,
      spessimetrica,
      collegamenti,
      layout,
      layoutRicalcolato,
      layoutSalvato,
      taraturaPratica,
    ]
  )
```

con:

```ts
  const additionalInfo: AdditionalInfo = useMemo(
    () => ({
      descrizioneAttivita: descrizioneAttivita.trim(),
      dataEmissione,
      compressoriGiri: giri,
      spessimetrica,
      collegamentiCompressoriSerbatoi,
      schemaLayout: schemaLayoutDaPersistere,
    }),
    [descrizioneAttivita, dataEmissione, giri, spessimetrica, collegamentiCompressoriSerbatoi, schemaLayoutDaPersistere]
  )
```

- [ ] **Step 8: `RelazioneDataDialog.tsx` — `segnalazioni` e `handleGenera`**

Nel blocco `segnalazioni` (righe 257-276), sostituire `schemaImpianto: schema ?? undefined` con
`schemaImpianto: schemaImpianto ?? undefined`, e nell'array di dipendenze sostituire `schema` con
`schemaImpianto`.

In `handleGenera` (dentro la chiamata a `generateAndDownloadRelazione`, riga 319), sostituire
`schemaImpianto: schema ?? undefined` con `schemaImpianto: schemaImpianto ?? undefined`.

- [ ] **Step 9: `RelazioneDataDialog.tsx` — JSX**

Rimuovere l'intera `GruppoCampi` "Collegamenti compressori → serbatoi" (righe 448-479 del file
originale, tra la `GruppoCampi` "Giri dei compressori" e quella "Apparecchiature con verifica
spessimetrica").

Rimuovere il blocco (righe 506-520 del file originale):

```tsx
          <Divider />
          <SchemaImpiantoSection
            scheda={scheda}
            collegamentiCompressoriSerbatoi={collegamenti}
            schema={schema}
            onSchemaChange={setSchema}
            layoutSalvato={layoutSalvato}
            onLayoutChange={(nuovo) => {
              setLayout(nuovo)
              setLayoutRicalcolato(true)
            }}
            taraturaPratica={taraturaPratica}
            onTaraturaPraticaChange={setTaraturaPratica}
            disabled={saving}
          />
```

lasciando **un solo** `<Divider />` fra la `GruppoCampi` "Apparecchiature con verifica
spessimetrica" e `<Typography variant="subtitle2">Controllo di completezza</Typography>` (quello
che oggi sta alla riga 522, dopo il blocco rimosso).

- [ ] **Step 10: `TechnicalDetails.tsx` — import**

Estendere l'import esistente (riga 34):

```ts
import { normalizeSchedaCodes } from '@/utils/equipmentCodes'
```

in:

```ts
import { collectCodes, normalizeSchedaCodes, pruneAdditionalInfo } from '@/utils/equipmentCodes'
```

Estendere l'import esistente (riga 30):

```ts
import type { AdditionalInfo } from '@/services/relazione/types'
```

in:

```ts
import type { AdditionalInfo, SchemaImpianto } from '@/services/relazione/types'
```

Aggiungere, vicino agli altri import di componenti:

```ts
import toast from 'react-hot-toast'
import SchemaImpiantoDialog from '@/components/relazione/SchemaImpiantoDialog'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import { layoutDaPersistere } from '@/services/schemaImpianto/persistenza'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
```

- [ ] **Step 11: `TechnicalDetails.tsx` — nuovo stato**

Subito dopo `const [dichiarazioniDialogOpen, setDichiarazioniDialogOpen] = useState(false)` (riga
67):

```ts
  const [schemaDialogOpen, setSchemaDialogOpen] = useState(false)
  const [collegamenti, setCollegamenti] = useState<Record<string, string[]>>({})
  const [schema, setSchema] = useState<SchemaImpianto | null>(null)
  const [schemaLayoutSalvato, setSchemaLayoutSalvato] = useState<LayoutSalvato | null | undefined>(undefined)
  const [schemaLayout, setSchemaLayout] = useState<SchemaLayout | null>(null)
  const [schemaLayoutRicalcolato, setSchemaLayoutRicalcolato] = useState(false)
  const [taraturaPratica, setTaraturaPratica] = useState<Tarature>({})
  const [schemaDroppedRefs, setSchemaDroppedRefs] = useState<string[]>([])
  const schemaSincronizzatoRef = useRef(false)
```

- [ ] **Step 12: `TechnicalDetails.tsx` — effetto di inizializzazione una tantum**

Subito dopo l'effetto `loadTechnicalData` (dopo la riga 140 `}, [id, request?.assigned_user,
request?.custom_fields])`):

```ts
  // Collegamenti e schema d'impianto vivono qui (non nei due dialog che li mostrano — "SC" e
  // "R" — perché li condividono entrambi): la finestra SCHEMA IMPIANTO li rifinisce e li salva,
  // la finestra Relazione li legge per calcolare le valvole e per incorporare l'immagine nel
  // .docx. Si inizializzano una volta sola, appena la pratica è caricata: un nuovo giro a ogni
  // apertura di una delle due finestre butterebbe via il lavoro fatto nell'altra nel frattempo.
  useEffect(() => {
    if (!technicalData || schemaSincronizzatoRef.current) return
    schemaSincronizzatoRef.current = true
    const scheda = (formData ?? technicalData.equipment_data) as SchedaDatiCompleta
    const codes = collectCodes(scheda)
    const { info, dropped } = pruneAdditionalInfo(technicalData.additional_info as AdditionalInfo | undefined, codes)
    setCollegamenti(info.collegamentiCompressoriSerbatoi ?? {})
    setSchemaLayoutSalvato(info.schemaLayout ?? null)
    setTaraturaPratica(info.schemaLayout?.simboli ?? {})
    setSchemaDroppedRefs(dropped.filter((d) => d.startsWith('collegament')))
  }, [technicalData, formData])
```

- [ ] **Step 13: `TechnicalDetails.tsx` — layout da persistere e salvataggio alla chiusura**

Vicino a `riaggiornaAdditionalInfo` (dopo la riga 175):

```ts
  const schemaLayoutDaPersistere = useMemo(
    () => layoutDaPersistere(schemaLayout, schemaLayoutRicalcolato, schemaLayoutSalvato, taraturaPratica),
    [schemaLayout, schemaLayoutRicalcolato, schemaLayoutSalvato, taraturaPratica]
  )

  /**
   * "Chiudi" sulla finestra SCHEMA IMPIANTO salva subito collegamenti e schema: a differenza
   * della finestra Relazione, che scrive tutto solo generando il .docx, qui non c'è un "genera"
   * a valle che lo faccia per conto suo. Si passano avanti gli altri campi di `additional_info`
   * così come sono e si ripassano tutti da `pruneAdditionalInfo`: questa finestra non conosce
   * `descrizioneAttivita` o `dataEmissione` e non deve svuotarli — `updateAdditionalInfo`
   * sovrascrive l'intera colonna, non fa merge lui (stesso motivo di
   * `DichiarazioniSection.genera`).
   */
  const handleCloseSchemaDialog = useCallback(async () => {
    setSchemaDialogOpen(false)
    if (!id || !technicalData) return
    try {
      const scheda = (formData ?? technicalData.equipment_data) as SchedaDatiCompleta
      const codes = collectCodes(scheda)
      const { info: daSalvare } = pruneAdditionalInfo(
        {
          ...(technicalData.additional_info as AdditionalInfo | undefined),
          collegamentiCompressoriSerbatoi: collegamenti,
          schemaLayout: schemaLayoutDaPersistere,
        },
        codes
      )
      const aggiornato = await technicalDataApi.updateAdditionalInfo(id, daSalvare)
      setTechnicalData((prev) => (prev ? { ...prev, additional_info: aggiornato.additional_info } : prev))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Salvataggio dello schema non riuscito')
    }
  }, [id, technicalData, formData, collegamenti, schemaLayoutDaPersistere])
```

- [ ] **Step 14: `TechnicalDetails.tsx` — collegare `TechnicalSheetHeader`**

Nel blocco `<TechnicalSheetHeader ...>` (righe 546-566), sostituire:

```tsx
                relazionePronta={!!relazioneSalvata}
```

con:

```tsx
                onSchemaImpianto={() => setSchemaDialogOpen(true)}
                schemaGenerato={!!schema}
                relazionePronta={!!relazioneSalvata && !!schema}
```

- [ ] **Step 15: `TechnicalDetails.tsx` — collegare `RelazioneDataDialog`**

Nel blocco `<RelazioneDataDialog ...>` (righe 594-620), aggiungere, sotto
`initialAdditionalInfo={technicalData.additional_info as AdditionalInfo | undefined}`:

```tsx
            collegamentiCompressoriSerbatoi={collegamenti}
            schemaImpianto={schema}
            schemaLayoutDaPersistere={schemaLayoutDaPersistere}
```

- [ ] **Step 16: `TechnicalDetails.tsx` — montare `SchemaImpiantoDialog`**

Subito dopo il blocco `<RelazioneDataDialog ... />` (dopo la riga 621 `)}`), prima del commento
`{/* Dialog "Dichiarazioni" ... */}`:

```tsx
        {/* Finestra "SCHEMA IMPIANTO": collegamenti compressori-serbatoi e l'editor dello schema.
            Indipendente da "R": salva da sé alla chiusura (vedi handleCloseSchemaDialog). */}
        {technicalData && (
          <SchemaImpiantoDialog
            open={schemaDialogOpen}
            onClose={handleCloseSchemaDialog}
            scheda={(formData ?? technicalData.equipment_data) as SchedaDatiCompleta}
            droppedRefs={schemaDroppedRefs}
            collegamenti={collegamenti}
            onCollegamentiChange={setCollegamenti}
            schema={schema}
            onSchemaChange={setSchema}
            layoutSalvato={schemaLayoutSalvato}
            onLayoutChange={(nuovo) => {
              setSchemaLayout(nuovo)
              setSchemaLayoutRicalcolato(true)
            }}
            taraturaPratica={taraturaPratica}
            onTaraturaPraticaChange={setTaraturaPratica}
          />
        )}

```

- [ ] **Step 17: Verificare**

Run: `npx vitest run`
Expected: PASS, nessuna regressione.

Run: `npx tsc --noEmit`
Expected: nessun errore in tutto il progetto (questo è il punto in cui un prop dimenticato in uno
dei tre file toccati si vedrebbe).

Run: `npx eslint src/components/relazione src/pages/TechnicalDetails.tsx --max-warnings 0`
Expected: nessun warning.

- [ ] **Step 18: Commit**

```bash
git add src/components/relazione/RelazioneDataDialog.tsx src/pages/TechnicalDetails.tsx
git commit -m "feat(schema): finestra SCHEMA IMPIANTO indipendente, R legge lo schema da prop"
```

---

### Task 4: Verifica in pagina

Nessun file da modificare: solo dev server e browser, per tutto ciò che la convenzione del
progetto ("no UI test") lascia fuori dai comandi automatici.

- [ ] **Step 1: Avviare il dev server**

Run: `npm run dev`

- [ ] **Step 2: Aprire una pratica DM329 con dati sufficienti a generare lo schema**

Verificare, nell'ordine, gli otto punti della sezione "In pagina" della specifica
(`docs/superpowers/specs/2026-08-17-pulsante-sc-finestra-schema-impianto-design.md`):

1. Il chip "SC" compare a sinistra di "R", grigio su una pratica senza schema salvato.
2. Il clic su "SC" apre "Schema d'impianto": collegamenti + editor, nient'altro della relazione.
3. Con dati sufficienti lo schema si genera da solo appena la finestra si apre.
4. Chiudendo "SC" il chip diventa verde; "R" resta grigio finché il `.docx` non è mai stato
   generato, poi verde solo se anche "SC" lo è.
5. "Rimuovi" nell'editor + richiusura di "SC": il chip torna grigio.
6. Ricaricando la pagina dopo il passo 4, il chip "SC" torna verde **senza** riaprire la finestra.
7. Il `.docx` generato da "R" incorpora l'immagine di "SC" e la portata delle valvole tiene conto
   dei collegamenti impostati lì.
8. Eliminando un serbatoio referenziato in un collegamento salvato e riaprendo "SC": l'avviso sui
   riferimenti scartati compare e il collegamento sparisce dalla `Select`.

- [ ] **Step 3: Ripulire i dati di prova**

Se la verifica è avvenuta su una pratica reale (non locale/di test): ripulire ogni collegamento o
schema scritto per la prova, e riverificarne l'assenza con una query diretta (Data API, come da
`CLAUDE.md`).

- [ ] **Step 4: Riportare l'esito**

Nessun commit: questo task è verifica, non codice. Se un punto della lista fallisce, tornare al
task che lo riguarda, correggere, e ripetere Task 4 da capo.
