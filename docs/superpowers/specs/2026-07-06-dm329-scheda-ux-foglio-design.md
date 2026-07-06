# Scheda dati DM329 — redesign UX compatto (Variante A "Foglio")

**Data:** 2026-07-06
**Branch:** `feat/dm329-scheda-ux-foglio`
**Mockup di riferimento:** Artifact "Scheda DM329 — mockup varianti", Variante A
**Stato:** approvata direzione, in attesa review spec

## 1. Contesto e problema

La scheda dati DM329 ([TechnicalSheetForm.tsx](../../../src/components/technicalSheet/TechnicalSheetForm.tsx) + [AllEquipmentSections.tsx](../../../src/components/technicalSheet/AllEquipmentSections.tsx)) raccoglie le apparecchiature di una sala compressori (serbatoi, compressori+disoleatori, essiccatori+scambiatori, filtri+recipienti, separatori, altri).

Oggi ogni apparecchio è una `Card` outlined a tutta larghezza, dentro accordion per tipo, con una `Grid` di `TextField` full-size. Conseguenza: enorme spazio verticale per apparecchio, nessun colpo d'occhio sull'insieme, scroll continuo. L'inserimento dati funziona ma è dispersivo.

## 2. Direzione scelta

**Variante A — "Foglio di calcolo".** Ogni tipo di apparecchiatura diventa una **tabella densa**: una riga per apparecchio, una colonna per campo. Obiettivi (priorità dell'utente):

1. **Colpo d'occhio** su tutte le apparecchiature di un tipo in poche righe.
2. **Densità alta con tutti i campi visibili** (niente campi nascosti a scomparsa; le colonne avanzate scorrono orizzontalmente).
3. **Incolla per campo fluido**: celle adiacenti navigabili con `Tab`/frecce, così incollare valori singoli in sequenza è rapido.

Ambito approvato: **tutta la scheda** (header pratica compatto + Dati Generali/Impianto compatti + tabelle apparecchiature).
Rollout approvato: **slice verticale** — prima i **Serbatoi** (sezione più complessa), poi replica alle altre.

## 3. Principi di design

- **Coerenza stilistica** col resto dell'app: tema MUI dark, palette da [palette.ts](../../../src/theme/palette.ts), tipografia da [typography.ts](../../../src/theme/typography.ts), tokens da [tokens.ts](../../../src/theme/tokens.ts). Niente palette nuove.
- **Nessuna modifica alla struttura dati** (`SchedaDatiCompleta` in [technicalSheet.ts](../../../src/types/technicalSheet.ts) resta identica) né al salvataggio (`equipment_data` JSONB). È un intervento di sola presentazione/interazione.
- **Zero regressioni sulle logiche** (vedi §4).
- **Un componente tabella riutilizzabile** guida tutte le sezioni; le differenze per tipo sono dichiarate via configurazione colonne, non duplicando markup.

## 4. Logiche da preservare (inventario — invariante di accettazione)

Ogni voce deve continuare a funzionare identica dopo il refactor:

| Logica | Dove vive oggi | Nota per il foglio |
|---|---|---|
| Codifiche automatiche (S1, C1, C1.1, E1.1, F1.1, SEP1) | `generateEquipmentCode`, `EQUIPMENT_LIMITS` | Cella "Cod." read-only, generata come oggi |
| Precompilazione da catalogo marca/modello | `EquipmentAutocomplete` | Autocomplete **inline in cella** (marca e modello) |
| Precompilazione 3-step con pressione | `EquipmentAutocompleteWithPressure` | Compressori (marca+modello+pressione→FAD), Valvole (marca+modello+Ptar→TS/Qmax/diametro) |
| Auto-fill specs da catalogo (volume, FAD, Q, PS, TS, Ptar, Qmax, diametro, categoria_ped) | `handleEquipmentSelected` in `CommonEquipmentFields`/sezioni | Invariato: gli handler `onEquipmentSelected` restano, scrivono nelle stesse celle |
| Auto-calcolo Categoria PED (PS × Volume) | `CategoriaPEDFieldWithAutoCalc`, effetto in `SerbatoioItem` | Cella "computed" con badge `auto`; select modificabile dove già lo è |
| Relazione padre→figlio via checkbox | `ha_disoleatore`/`ha_scambiatore`/`ha_recipiente` handlers | Checkbox in cella; crea/rimuove la **sub-riga** associata |
| OCR singolo per apparecchio | `SingleOCRButton` + handler `onOCRComplete` per tipo | Pulsante icona nella colonna azioni della riga |
| OCR batch "Riconosci automaticamente" | `BatchOCRDialog` + `handleBatchOCRComplete` | Invariato: resta il bottone in testata sezione apparecchiature |
| Visibilità `tecnicoDM329` | `useTecnicoDM329Visibility` | Le colonne avanzate hanno flag `adv`; nascoste quando `!showAdvancedFields` |
| Recipiente filtro intera sezione nascosta | `showRecipienteFiltro` | Sub-riga recipiente non renderizzata a tecnicoDM329 |
| Aggiornamento catalogo al salvataggio | `useEquipmentCatalogUpdate` + `UpdateCatalogDialog` | Invariato (a monte del render) |
| Autosave 120s + salva bozza + completa | `TechnicalSheetForm` / `TechnicalDetails` | Invariato: stesso `FormProvider`, stessi `useFieldArray` |
| Validazioni range (anno, volume, pressione…) | `rules` sui Controller | Riproposte sugli input cella; errore = bordo/celle rosse + tooltip |

**Campi nascosti a `tecnicoDM329`** (da `useTecnicoDM329Visibility`), che diventano colonne `adv`:
- Serbatoi: `modello`, `ps_pressione_max`, `ts_temperatura`, `categoria_ped`
- Compressori: `volume_aria_prodotto` (FAD)
- Disoleatori: `ps_pressione_max`, `ts_temperatura`, `categoria_ped`
- Valvole: `ts_temperatura`, `volume_aria_scaricato`, `categoria_ped`
- Essiccatori: `ps_pressione_max`, `volume_aria_trattata`
- Scambiatori: `ps_pressione_max`, `ts_temperatura`, `volume`
- Recipienti filtro: intera sub-riga

## 5. Architettura componenti

**Nuovi:**
- `EquipmentTable` — tabella generica: riceve `columns` (config), `fields` (da `useFieldArray`), `renderers`, gestisce header sticky, prima colonna (codice) sticky, scroll orizzontale, riga "+ aggiungi", limiti min/max, colonna azioni (OCR + elimina).
- `EquipmentTableCell` (o set di celle tipizzate): `TextCell`, `NumberCell`, `SelectCell`, `CheckCell`, `AutocompleteCell`, `AutocompletePressureCell`, `ComputedCell`. Ogni cella è un wrapper attorno ai `Controller` esistenti, con stile "cella" (input borderless, focus ring, `tabular-nums` sui numerici).
- `SectionNav` — barra chip per saltare/scorrere alle sezioni con conteggi.
- `PraticaHeaderCompact` — intestazione pratica compatta (codice pratica editabile, cliente, sopralluogo, tecnico, sala, stato+autosave).

**Modificati:**
- `TechnicalSheetForm` — orchestrazione: header compatto + SectionNav + tabelle; mantiene `FormProvider`, autosave, batch OCR, catalog update.
- Le sezioni `SerbatoiSection`/`CompressoriSection`/… diventano configuratori di colonne + `useFieldArray` che montano `EquipmentTable`. La logica handler (checkbox padre-figlio, OCR, PED) resta nelle sezioni.
- `DatiGeneraliSection` / `DatiImpiantoSection` — resi più compatti (griglia densa, `size="small"` uniforme), senza cambiarne i campi.

**Definizione colonne — Serbatoi (slice 1):**
Riga principale `S{n}`: `Cod.` · Marca (autocomplete) · Modello *(adv)* · N° fabbrica · Anno · Volume L · PS bar *(adv)* · TS °C *(adv)* · Cat. PED *(adv, computed)* · Finitura (select) · Scarico (select) · Ancorato (check) · Manometro fondo scala · Manometro segno rosso · azioni.
Sub-riga obbligatoria valvola `S{n}.1`: Marca+Modello+Ptar (autocomplete 3-step) · N° fabbrica · Anno · Diametro · TS *(adv)* · Qmax *(adv)* · Cat. PED *(adv, fisso IV)*.

> **Decisione:** valvola di sicurezza e (per compressori) disoleatore/scambiatore/recipiente sono **sub-righe agganciate** alla riga padre (indentate, tinta della sezione), non colonne aggiuntive sulla riga padre. Motivo: valvola ha ~9 campi propri con autocomplete 3-step; come colonne renderebbe la riga padre ingestibile. Le sub-righe riusano lo stesso pattern padre-figlio già esistente per i disoleatori. Il manometro (2 soli campi) resta come 2 colonne sulla riga padre.

## 6. Copia-incolla / navigazione

Nessuna mappatura automatica multi-cella (scelta utente: "incolla singolo campo più fluido"). Requisiti:
- Ordine di tabulazione **naturale sinistra→destra, poi riga successiva**; ogni cella è un unico target focus.
- Le celle non editabili (Cod., computed) sono saltate dal `Tab`.
- Focus con anello visibile e sfondo cella evidenziato.
- Incollare un valore in una cella non deve triggerare side-effect indesiderati (solo `onChange` del campo).

## 7. Add / Remove / limiti

Invariati nella sostanza: riga "+ Aggiungi" in fondo alla tabella (disabilitata al `max`), icona elimina in colonna azioni (bloccata al `min`, con `window.confirm` come oggi), messaggi limiti. Le sub-righe si creano/rimuovono via checkbox padre.

## 8. Coerenza stilistica

- Tabelle dentro `Card`/`Paper` con `borderRadius: radii.card`.
- Testata sezione con badge lettera colorato (tinte già usate negli accordion attuali) + conteggio `n/max` + batch OCR.
- Celle: `body2`/0.82rem, `tabular-nums` sui numeri, sfondo riga alternato tenue, hover riga con tinta sezione a bassa opacità.
- Badge `cat` (precompilato) e `auto` (calcolato) come nel mockup.

## 9. Rollout

1. **Slice 1 — Serbatoi**: `EquipmentTable` + celle + `SerbatoiSection` a tabella, dentro il form reale, con valvola sub-riga e manometro. Header pratica compatto + SectionNav minima. → verifica utente nell'app.
2. **Slice 2** — Compressori (+disoleatore), Essiccatori (+scambiatore), Filtri (+recipiente), Separatori, Altri apparecchi.
3. **Slice 3** — Dati Generali / Dati Impianto compatti + rifinitura header e navigazione.

Ogni slice: build + typecheck + verifica manuale nell'app prima della successiva.

## 10. Fuori scope

- Modifiche a schema DB, tipi, API, OCR backend, calcolo PED (solo riuso).
- Nuovi campi o rimozione di campi.
- Cambiamenti al workflow stati o ai permessi.

## 11. Rischi e mitigazioni

- **Autocomplete in cella**: `EquipmentAutocomplete*` sono nati per layout full-width. Rischio ingombro dropdown/portal in cella stretta. Mitigazione: wrapper cella dedicato che imposta `size="small"`, larghezza minima e dropdown in portal; verificare tab-order.
- **Sticky header + prima colonna** con scroll orizzontale su dark theme: attenzione a z-index e sfondi opachi.
- **Densità vs accessibilità**: mantenere target click ≥ ~28px e focus visibile.
- **react-hook-form performance** con molte celle watch: usare `Controller` per cella come oggi (nessun `watch()` globale aggiuntivo oltre a quelli esistenti).

## 12. Verifica

- Typecheck/ESLint puliti.
- Nel browser (pratica DM329 reale): inserimento, autocomplete precompila, PED auto, checkbox crea sub-riga, OCR singolo popola la riga, batch OCR invariato, toggle ruolo tecnicoDM329 nasconde le colonne `adv`, autosave e salva bozza funzionanti, valori persistono al reload.
