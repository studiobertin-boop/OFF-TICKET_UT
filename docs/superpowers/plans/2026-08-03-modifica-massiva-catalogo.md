# Modifica massiva delle proprietà costruttive a catalogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nella pagina Apparecchiature, selezionare più righe di compressore e valorizzare in un colpo solo la regolazione dei giri o la tipologia costruttiva.

**Architecture:** La ripartizione della selezione — quali righe compilare, quali sostituire, quali lasciare stare — è logica pura in `src/utils/modificaMassiva.ts`, testabile senza React né Supabase; è lì che vive anche la composizione del testo di conferma. La scrittura passa da una funzione RPC a database, sul modello di `apply_equipment_fixes`, così centinaia di righe si aggiornano in una transazione sola invece che con altrettante chiamate. La selezione nella tabella segue il pattern già in uso in `Requests.tsx`: uno `Set<string>` nello stato della pagina.

**Tech Stack:** TypeScript, React 18, Material UI 6, TanStack Query, Vitest, Supabase (PostgreSQL + PostgREST).

## Global Constraints

- Specifica di riferimento: `docs/superpowers/specs/2026-08-03-modifica-massiva-catalogo-design.md`. In caso di divergenza vince la specifica.
- **Solo `giri` e `tipo_compressore`, solo sui compressori.** Nessun altro dato tecnico, nessun altro tipo di apparecchiatura.
- **I valori dei menu vengono da `CANONICAL_SPECS.Compressori`** (`options` e `optionLabels` delle definizioni `giri` e `tipo_compressore`), non da costanti riscritte nel componente.
- **Le righe che hanno già il valore che si sta applicando non si riscrivono:** non cambierebbero nulla e sporcherebbero `updated_at`, che è il dato con cui si capisce quando una voce è stata toccata l'ultima volta.
- **La selezione si azzera** al cambio di pagina, ricerca, tipo, «Solo incomplete» e «Mostra disattivate».
- **Nessuna migrazione di dati.** L'unica DDL è la creazione della funzione RPC. Il contratto canonico, l'indice unico, il motore della relazione e la scheda dati non si toccano.
- La funzione RPC segue `apply_equipment_fixes`: `SECURITY DEFINER`, `SET search_path = public`, controllo del ruolo (`admin` o `userdm329`) dentro la funzione con `ERRCODE = '42501'`, poi `REVOKE ALL … FROM public`, `GRANT EXECUTE … TO authenticated`, `NOTIFY pgrst, 'reload schema'`.
- Test con Vitest sulla logica, non sulla UI (convenzione del progetto, `CLAUDE.md`). Comando: `npx vitest run <percorso>`.
- Commenti e copy in **italiano**, nello stile discorsivo dei file toccati: spiegano il perché, non il cosa.
- `strict: false` nel tsconfig: nessun affidamento sul narrowing automatico dei nullable.
- Conventional Commits, messaggi in italiano. `git add` con percorsi espliciti, mai `git add -A`.

---

## File Structure

| File | Responsabilità | Task |
|---|---|---|
| `src/utils/modificaMassiva.ts` (nuovo) | Ripartizione della selezione e testo di conferma — logica pura | 1 |
| `src/utils/__tests__/modificaMassiva.test.ts` (nuovo) | Test del modulo sopra | 1 |
| `supabase/migrations/20260808000000_set_equipment_property.sql` (nuovo) | La funzione RPC di scrittura in blocco | 2 |
| `src/services/api/equipmentCatalogAdmin.ts` | Il metodo client che la chiama | 2 |
| `src/hooks/useEquipmentCatalogAdmin.ts` | La mutation e l'invalidazione della cache | 2 |
| `src/components/equipmentCatalog/EquipmentCatalogTable.tsx` | La colonna delle caselle di selezione | 3 |
| `src/components/equipmentCatalog/ModificaMassivaBar.tsx` (nuovo) | Barra delle azioni sopra la tabella | 4 |
| `src/components/equipmentCatalog/ModificaMassivaDialog.tsx` (nuovo) | Conferma con la ripartizione | 4 |
| `src/pages/EquipmentCatalogManagement.tsx` | Stato della selezione, orchestrazione | 3, 4 |

---

## Task 1: La ripartizione e il testo, come logica pura

Il cuore della funzionalità senza una riga di React: date le righe selezionate, una chiave e un valore, dire cosa succederebbe. È ciò che va verificato sui numeri veri, ed è ciò che il dialog si limita a mostrare.

**Files:**
- Create: `src/utils/modificaMassiva.ts`
- Test: `src/utils/__tests__/modificaMassiva.test.ts`

**Interfaces:**
- Consumes: da `@/types` il tipo `EquipmentCatalogItem` (campi usati: `id`, `marca`, `modello`, `specs`, `tipo_apparecchiatura`). Da `@/services/equipmentAudit`: `CANONICAL_SPECS`.
- Produces:
  - `type ChiaveMassiva = 'giri' | 'tipo_compressore'`
  - `interface RipartizioneMassiva { daCompilare: EquipmentCatalogItem[]; daSostituire: EquipmentCatalogItem[]; giaUguali: EquipmentCatalogItem[] }`
  - `ripartisciPerValore(righe: EquipmentCatalogItem[], chiave: ChiaveMassiva, valore: string): RipartizioneMassiva`
  - `etichettaValore(chiave: ChiaveMassiva, valore: string): string`
  - `modelliDa(righe: EquipmentCatalogItem[], max?: number): string`
  - `interface TestoConferma { titolo: string; righe: string[]; azione: string; applicabile: boolean }`
  - `testoConferma(rip: RipartizioneMassiva, chiave: ChiaveMassiva, valore: string): TestoConferma`
  - `soloCompressori(righe: EquipmentCatalogItem[]): boolean`

- [ ] **Step 1: Scrivere i test che falliscono**

Creare `src/utils/__tests__/modificaMassiva.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { EquipmentCatalogItem } from '@/types'
import {
  etichettaValore,
  modelliDa,
  ripartisciPerValore,
  soloCompressori,
  testoConferma,
} from '@/utils/modificaMassiva'

/**
 * I numeri sono quelli di produzione al 2026-08-03: 485 righe di compressore hanno
 * `giri` vuoto, 141 valgono «variabili» (backfill verificato modello per modello) e 6
 * valgono «fissi». È la sovrapposizione fra questi tre gruppi che la ripartizione deve
 * saper raccontare prima di scrivere.
 */
let seq = 0
const riga = (
  specs: Record<string, unknown>,
  modello = 'SK 22',
  tipo: string = 'Compressori'
): EquipmentCatalogItem =>
  ({
    id: `r${++seq}`,
    tipo,
    tipo_apparecchiatura: tipo,
    marca: 'KAESER KOMPRESSOREN SE',
    modello,
    specs,
    is_active: true,
    is_user_defined: false,
    usage_count: 0,
    created_at: '',
    updated_at: '',
  }) as EquipmentCatalogItem

describe('ripartisciPerValore', () => {
  it('separa i vuoti, i diversi e i già uguali', () => {
    const r = ripartisciPerValore(
      [
        riga({ fad: 2000 }, 'SK 22'),
        riga({ fad: 1680, giri: 'variabili' }, 'ASD 32 SFC'),
        riga({ fad: 1320, giri: 'fissi' }, 'SK 25'),
      ],
      'giri',
      'fissi'
    )
    expect(r.daCompilare.map(x => x.modello)).toEqual(['SK 22'])
    expect(r.daSostituire.map(x => x.modello)).toEqual(['ASD 32 SFC'])
    expect(r.giaUguali.map(x => x.modello)).toEqual(['SK 25'])
  })

  it('tratta la stringa vuota come campo da compilare', () => {
    const r = ripartisciPerValore([riga({ giri: '' })], 'giri', 'fissi')
    expect(r.daCompilare).toHaveLength(1)
    expect(r.daSostituire).toHaveLength(0)
  })

  it('funziona anche sulla tipologia costruttiva', () => {
    const r = ripartisciPerValore(
      [riga({}), riga({ tipo_compressore: 'PISTONI' })],
      'tipo_compressore',
      'VITE'
    )
    expect(r.daCompilare).toHaveLength(1)
    expect(r.daSostituire).toHaveLength(1)
  })

  it('regge una selezione vuota', () => {
    const r = ripartisciPerValore([], 'giri', 'fissi')
    expect(r).toEqual({ daCompilare: [], daSostituire: [], giaUguali: [] })
  })
})

describe('etichettaValore', () => {
  it('usa le etichette del contratto canonico, non il valore memorizzato', () => {
    expect(etichettaValore('giri', 'fissi')).toBe('a giri fissi')
    expect(etichettaValore('giri', 'variabili')).toBe('a giri variabili (inverter)')
    expect(etichettaValore('tipo_compressore', 'VITE')).toBe('Rotativo a vite')
  })

  it('ripiega sul valore quando l etichetta non c è', () => {
    expect(etichettaValore('giri', 'ignoto')).toBe('ignoto')
  })
})

describe('modelliDa', () => {
  it('elenca i modelli senza ripeterli', () => {
    expect(modelliDa([riga({}, 'SK 22'), riga({}, 'SK 22'), riga({}, 'SK 25')])).toBe('SK 22, SK 25')
  })

  it('tronca oltre il massimo e dice quanti restano', () => {
    const righe = ['A', 'B', 'C', 'D', 'E'].map(m => riga({}, m))
    expect(modelliDa(righe, 3)).toBe('A, B, C e altri 2')
  })
})

describe('testoConferma', () => {
  it('racconta i tre gruppi e conta solo le righe che tocca', () => {
    const rip = ripartisciPerValore(
      [riga({}), riga({}), riga({ giri: 'variabili' }, 'ASD 32 SFC'), riga({ giri: 'fissi' })],
      'giri',
      'fissi'
    )
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.titolo).toBe('Regolazione giri → a giri fissi')
    expect(t.righe[0]).toBe('2 righe hanno il campo vuoto e verranno compilate')
    expect(t.righe[1]).toBe(
      '1 riga ha già «a giri variabili (inverter)» e verrà sostituita: ASD 32 SFC'
    )
    expect(t.righe[2]).toBe('1 riga ha già questo valore e resta com è')
    expect(t.azione).toBe('Applica a 3 righe')
    expect(t.applicabile).toBe(true)
  })

  it('tace sui gruppi vuoti', () => {
    const rip = ripartisciPerValore([riga({}), riga({})], 'giri', 'fissi')
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.righe).toHaveLength(1)
    expect(t.azione).toBe('Applica a 2 righe')
  })

  it('non è applicabile quando non c è niente da fare', () => {
    const rip = ripartisciPerValore([riga({ giri: 'fissi' })], 'giri', 'fissi')
    const t = testoConferma(rip, 'giri', 'fissi')
    expect(t.applicabile).toBe(false)
    expect(t.azione).toBe('Niente da applicare')
  })
})

describe('soloCompressori', () => {
  it('riconosce una selezione omogenea', () => {
    expect(soloCompressori([riga({}), riga({})])).toBe(true)
  })

  it('rifiuta una selezione mista', () => {
    expect(soloCompressori([riga({}), riga({}, 'ABC', 'Serbatoi')])).toBe(false)
  })

  it('una selezione vuota non è una selezione di compressori', () => {
    expect(soloCompressori([])).toBe(false)
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

```bash
npx vitest run src/utils/__tests__/modificaMassiva.test.ts
```

Atteso: FAIL — `Failed to resolve import "@/utils/modificaMassiva"`.

- [ ] **Step 3: Scrivere il modulo**

Creare `src/utils/modificaMassiva.ts`:

```ts
import type { EquipmentCatalogItem } from '@/types'
import { CANONICAL_SPECS } from '@/services/equipmentAudit'

/**
 * Modifica massiva delle proprietà costruttive dei compressori: che cosa succederebbe.
 *
 * Logica pura, senza React né Supabase. Sta qui e non nel dialog perché è la parte che va
 * verificata sui casi reali, e perché la conferma mostrata all'utente e la lista di righe
 * effettivamente scritte devono venire dallo stesso calcolo: se divergessero, il numero
 * annunciato non sarebbe quello applicato.
 */

/** Le sole due proprietà che appartengono al modello e non alla singola variante. */
export type ChiaveMassiva = 'giri' | 'tipo_compressore'

export interface RipartizioneMassiva {
  /** Il campo è vuoto: si compila. */
  daCompilare: EquipmentCatalogItem[]
  /** Il campo ha un altro valore: si sostituisce, ed è ciò su cui va richiamata l'attenzione. */
  daSostituire: EquipmentCatalogItem[]
  /** Il campo ha già questo valore: non si riscrive, per non sporcare `updated_at`. */
  giaUguali: EquipmentCatalogItem[]
}

/**
 * Divide le righe selezionate rispetto al valore che si sta per applicare.
 *
 * I tre gruppi non sono una comodità di presentazione: `daSostituire` sono le righe il cui
 * valore qualcuno ha già stabilito — sui giri, le 141 che il backfill aveva verificato una
 * a una — e cancellarne uno per sbaglio è silenzioso, perché il dato finisce in una frase
 * asseverata di una relazione firmata.
 */
export function ripartisciPerValore(
  righe: EquipmentCatalogItem[],
  chiave: ChiaveMassiva,
  valore: string
): RipartizioneMassiva {
  const out: RipartizioneMassiva = { daCompilare: [], daSostituire: [], giaUguali: [] }

  for (const riga of righe) {
    const attuale = riga.specs?.[chiave]
    const vuoto = attuale === null || attuale === undefined || String(attuale).trim() === ''

    if (vuoto) out.daCompilare.push(riga)
    else if (String(attuale) === valore) out.giaUguali.push(riga)
    else out.daSostituire.push(riga)
  }

  return out
}

/** Come il valore si dice all'utente: l'etichetta del contratto, non la sigla memorizzata. */
export function etichettaValore(chiave: ChiaveMassiva, valore: string): string {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  return def?.optionLabels?.[valore] ?? valore
}

/**
 * Elenco dei modelli, senza ripetizioni e troncato.
 *
 * I modelli si nominano, non si contano soltanto: chi sta per sostituire un valore deve
 * poter riconoscere le macchine su cui lo fa. Oltre `max` l'elenco diventa illeggibile e si
 * tronca dicendo quanti ne restano.
 */
export function modelliDa(righe: EquipmentCatalogItem[], max = 10): string {
  const unici = [...new Set(righe.map(r => r.modello))]
  if (unici.length <= max) return unici.join(', ')
  return `${unici.slice(0, max).join(', ')} e altri ${unici.length - max}`
}

export interface TestoConferma {
  titolo: string
  /** Una riga per gruppo non vuoto, nell'ordine: da compilare, da sostituire, già uguali. */
  righe: string[]
  /** Etichetta del pulsante, che dichiara quante righe verranno davvero scritte. */
  azione: string
  applicabile: boolean
}

export function testoConferma(
  rip: RipartizioneMassiva,
  chiave: ChiaveMassiva,
  valore: string
): TestoConferma {
  const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
  const righe: string[] = []

  if (rip.daCompilare.length > 0) {
    const n = rip.daCompilare.length
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} il campo vuoto e ${scegli(n, 'verrà compilata', 'verranno compilate')}`
    )
  }

  if (rip.daSostituire.length > 0) {
    const n = rip.daSostituire.length
    // Il valore attuale si nomina solo quando è uno solo: dire «hanno già X» quando le righe
    // da sostituire portano valori diversi sarebbe falso.
    const attuali = [...new Set(rip.daSostituire.map(r => String(r.specs?.[chiave])))]
    const quali = attuali.length === 1 ? ` «${etichettaValore(chiave, attuali[0])}»` : ' un altro valore'
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} già${quali} e ${scegli(n, 'verrà sostituita', 'verranno sostituite')}: ${modelliDa(rip.daSostituire)}`
    )
  }

  if (rip.giaUguali.length > 0) {
    const n = rip.giaUguali.length
    righe.push(
      `${conta(n, 'riga ha', 'righe hanno')} già questo valore e ${scegli(n, 'resta com è', 'restano come sono')}`
    )
  }

  const daScrivere = rip.daCompilare.length + rip.daSostituire.length

  return {
    titolo: `${def?.label ?? chiave} → ${etichettaValore(chiave, valore)}`,
    righe,
    azione: daScrivere > 0 ? `Applica a ${daScrivere} ${daScrivere === 1 ? 'riga' : 'righe'}` : 'Niente da applicare',
    applicabile: daScrivere > 0,
  }
}

/** Le proprietà costruttive esistono solo sui compressori: su un serbatoio non vogliono dire nulla. */
export function soloCompressori(righe: EquipmentCatalogItem[]): boolean {
  return righe.length > 0 && righe.every(r => r.tipo_apparecchiatura === 'Compressori')
}

/** «2 righe hanno» — il numero davanti, una volta sola nella frase. */
function conta(n: number, uno: string, molti: string): string {
  return `${n} ${n === 1 ? uno : molti}`
}

/** «verranno compilate» — la sola concordanza, senza ripetere il numero a metà frase. */
function scegli(n: number, uno: string, molti: string): string {
  return n === 1 ? uno : molti
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

```bash
npx vitest run src/utils/__tests__/modificaMassiva.test.ts
```

Atteso: PASS su tutti i casi.

- [ ] **Step 5: Verificare che non si sia rotto nulla**

```bash
npx vitest run && npx tsc --noEmit
```

Atteso: suite verde, nessun errore di tipo.

- [ ] **Step 6: Commit**

```bash
git add src/utils/modificaMassiva.ts src/utils/__tests__/modificaMassiva.test.ts
git commit -m "feat(catalogo): la modifica massiva dice cosa sta per fare, prima di farlo

La ripartizione della selezione nei tre gruppi — da compilare, da sostituire,
già uguali — è logica pura, verificabile sui numeri di produzione senza React.

Il gruppo che conta e' il secondo: sono le righe il cui valore qualcuno ha gia'
stabilito, e sui giri sono le 141 che il backfill aveva verificato una a una.
Cancellarne uno per sbaglio e' silenzioso, perche' il dato finisce in una frase
asseverata di una relazione firmata: per questo i modelli si nominano invece di
contarli soltanto.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: La scrittura in blocco

**Files:**
- Create: `supabase/migrations/20260808000000_set_equipment_property.sql`
- Modify: `src/services/api/equipmentCatalogAdmin.ts` (aggiunge un metodo accanto ad `applyFixes`)
- Modify: `src/hooks/useEquipmentCatalogAdmin.ts` (aggiunge la mutation)

**Interfaces:**
- Consumes: da Task 1, `ChiaveMassiva`.
- Produces:
  - RPC `set_equipment_property(p_ids uuid[], p_chiave text, p_valore text) returns jsonb` → `{"applied": n}`
  - `equipmentCatalogAdminApi.setProperty(ids: string[], chiave: ChiaveMassiva, valore: string): Promise<number>`
  - `useSetEquipmentProperty()` — mutation TanStack Query che invalida `equipmentCatalogKeys.all`, cioè `['equipment-catalog-admin']`

- [ ] **Step 1: Scrivere la migration**

Creare `supabase/migrations/20260808000000_set_equipment_property.sql`:

```sql
-- Modifica massiva delle proprieta' costruttive dei compressori.
--
-- Serve a valorizzare `giri` e `tipo_compressore` su gruppi di righe scelti a mano dal
-- tecnico. Quando il catalogo fu importato, `giri` venne compilato solo dove c'era prova
-- positiva — il suffisso commerciale delle macchine a velocita' variabile — e 485 righe
-- restarono vuote apposta: l'assenza del suffisso non e' prova di giri fissi, e il valore
-- finisce in una frase asseverata di una relazione firmata. Qui non decide un'euristica,
-- decide chi seleziona.
--
-- Una transazione sola invece di centinaia di scritture separate, come gia' fa
-- `apply_equipment_fixes` per le correzioni del motore di verifica: un'interruzione a meta'
-- lascerebbe il catalogo in uno stato misto.
--
-- Le chiavi ammesse sono due e sole. Non e' pignoleria: applicare lo stesso FAD o la stessa
-- PS a righe diverse cancellerebbe proprio cio' che distingue le varianti fra loro.

CREATE OR REPLACE FUNCTION set_equipment_property(
  p_ids     uuid[],
  p_chiave  text,
  p_valore  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    user_role;
  v_applied int := 0;
BEGIN
  SELECT role INTO v_role FROM users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin', 'userdm329') THEN
    RAISE EXCEPTION 'Permesso negato: solo admin e userdm329 possono modificare il catalogo'
      USING ERRCODE = '42501';
  END IF;

  IF p_chiave NOT IN ('giri', 'tipo_compressore') THEN
    RAISE EXCEPTION 'Chiave non ammessa alla modifica massiva: %', p_chiave;
  END IF;

  IF p_chiave = 'giri' AND p_valore NOT IN ('fissi', 'variabili') THEN
    RAISE EXCEPTION 'Valore non ammesso per la regolazione giri: %', p_valore;
  END IF;

  IF p_chiave = 'tipo_compressore'
     AND p_valore NOT IN ('VITE', 'PISTONI', 'SCROLL', 'CENTRIFUGO') THEN
    RAISE EXCEPTION 'Valore non ammesso per la tipologia costruttiva: %', p_valore;
  END IF;

  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('applied', 0);
  END IF;

  -- Il filtro sul tipo non e' ridondante rispetto al client: e' la garanzia che una chiamata
  -- costruita altrove non scriva una proprieta' di compressore su un serbatoio.
  UPDATE equipment_catalog
  SET specs      = jsonb_set(COALESCE(specs, '{}'::jsonb), ARRAY[p_chiave], to_jsonb(p_valore), true),
      updated_at = now()
  WHERE id = ANY (p_ids)
    AND tipo_apparecchiatura = 'Compressori';

  GET DIAGNOSTICS v_applied = ROW_COUNT;

  RETURN jsonb_build_object('applied', v_applied);
END;
$$;

COMMENT ON FUNCTION set_equipment_property(uuid[], text, text) IS
  'Valorizza in un''unica transazione una proprieta'' costruttiva (giri, tipo_compressore) '
  'su piu'' righe di compressore. Verifica da se'' il ruolo del chiamante (admin o userdm329).';

REVOKE ALL ON FUNCTION set_equipment_property(uuid[], text, text) FROM public;
GRANT EXECUTE ON FUNCTION set_equipment_property(uuid[], text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verifica:
--   SELECT set_equipment_property('{}'::uuid[], 'giri', 'fissi');   -- atteso {"applied": 0}
--   SELECT set_equipment_property('{}'::uuid[], 'fad', '1');        -- attesa eccezione
```

- [ ] **Step 2: Applicare la migration a produzione**

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && python - <<'PY' > /tmp/mig.json
import json, pathlib
sql = pathlib.Path("supabase/migrations/20260808000000_set_equipment_property.sql").read_text(encoding="utf-8")
print(json.dumps({"query": sql}))
PY
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/mig.json
```

- [ ] **Step 3: Verificare la funzione a database**

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && cat > /tmp/v.json <<'EOF'
{"query":"SELECT proname, prosecdef, pg_get_function_identity_arguments(oid) AS args FROM pg_proc WHERE proname = 'set_equipment_property'"}
EOF
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/v.json
```

Atteso: una riga, `prosecdef` a `true`, argomenti `p_ids uuid[], p_chiave text, p_valore text`.

Nota: la chiamata `SELECT set_equipment_property(...)` dal token di servizio fallisce il controllo del ruolo, perché `auth.uid()` è nullo fuori da una sessione autenticata. È il comportamento corretto — la verifica funzionale si fa a schermo al Task 5.

- [ ] **Step 4: Aggiungere il metodo client**

In `src/services/api/equipmentCatalogAdmin.ts`, subito dopo `applyFixes`, dentro l'oggetto `equipmentCatalogAdminApi`:

```ts
  /**
   * Valorizza una proprietà costruttiva su più righe di compressore, in una transazione sola.
   *
   * Come `applyFixes`: la funzione a database verifica da sé il ruolo e le chiavi ammesse, così
   * il vincolo non dipende dal fatto che il client si comporti bene.
   */
  async setProperty(ids: string[], chiave: ChiaveMassiva, valore: string): Promise<number> {
    if (ids.length === 0) return 0

    const { data, error } = await supabase.rpc('set_equipment_property', {
      p_ids: ids,
      p_chiave: chiave,
      p_valore: valore,
    })

    if (error) {
      if (error.code === '42501') {
        throw new Error('Non hai i permessi per modificare il catalogo apparecchiature')
      }
      throw describeError(error, 'Errore nella modifica massiva')
    }

    return (data as { applied?: number } | null)?.applied ?? 0
  },
```

Aggiungere l'import del tipo in testa al file:

```ts
import type { ChiaveMassiva } from '@/utils/modificaMassiva'
```

- [ ] **Step 5: Aggiungere la mutation**

In `src/hooks/useEquipmentCatalogAdmin.ts`, seguendo la forma delle mutation già presenti nel file (`useUpdateEquipment`, `useSetEquipmentActive`):

```ts
/**
 * Modifica massiva di una proprietà costruttiva.
 *
 * Invalida l'intera lista e non una riga sola: la modifica tocca righe che possono stare su
 * pagine diverse da quella visibile, e i conteggi dei filtri cambiano con loro.
 */
export function useSetEquipmentProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ ids, chiave, valore }: { ids: string[]; chiave: ChiaveMassiva; valore: string }) =>
      equipmentCatalogAdminApi.setProperty(ids, chiave, valore),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentCatalogKeys.all })
    },
  })
}
```

`equipmentCatalogKeys` è già definito in testa al file (`all: ['equipment-catalog-admin']`): si usa quello, non una chiave nuova. Aggiungere `import type { ChiaveMassiva } from '@/utils/modificaMassiva'`.

- [ ] **Step 6: Verificare tipi e suite**

```bash
npx tsc --noEmit && npx vitest run
```

Atteso: nessun errore, suite verde.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260808000000_set_equipment_property.sql src/services/api/equipmentCatalogAdmin.ts src/hooks/useEquipmentCatalogAdmin.ts
git commit -m "feat(db): una transazione sola per la modifica massiva delle proprieta' costruttive

Centinaia di righe si aggiornano in un viaggio invece che in altrettanti, come
gia' fa apply_equipment_fixes per le correzioni del motore di verifica.

La funzione verifica da se' il ruolo del chiamante e le chiavi ammesse — giri e
tipo_compressore, nient'altro — e filtra sul tipo apparecchiatura: cosi' il
vincolo non dipende dal fatto che il client si comporti bene. Applicare lo
stesso FAD o la stessa PS a righe diverse cancellerebbe proprio cio' che
distingue le varianti fra loro.

Migration gia' applicata al database di produzione.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: La selezione nella tabella

**Files:**
- Modify: `src/components/equipmentCatalog/EquipmentCatalogTable.tsx:26-36` (props), `:64-76` (intestazione), `:88-143` (righe), `:79-87` (riga vuota)
- Modify: `src/pages/EquipmentCatalogManagement.tsx:93-104` (stato), `:171-173` (azzeramento), il punto dove si rende `<EquipmentCatalogTable …>`

**Interfaces:**
- Consumes: niente dai task precedenti.
- Produces: `EquipmentCatalogTable` accetta tre props nuove:
  - `selezionate: Set<string>`
  - `onToggleRiga: (id: string) => void`
  - `onTogglePagina: (seleziona: boolean) => void`

- [ ] **Step 1: Aggiungere le props e la colonna**

In `src/components/equipmentCatalog/EquipmentCatalogTable.tsx`, aggiungere all'interfaccia `EquipmentCatalogTableProps`:

```ts
  /** Id delle righe selezionate, condivise con la pagina che le raccoglie. */
  selezionate: Set<string>
  onToggleRiga: (id: string) => void
  /** Seleziona o deseleziona tutte le righe della pagina corrente. */
  onTogglePagina: (seleziona: boolean) => void
```

Aggiungerle alla destrutturazione dei parametri, e importare `Checkbox` da `@mui/material`.

Nell'intestazione, prima di `<TableCell>Tipo</TableCell>`:

```tsx
          <TableCell padding="checkbox">
            <Checkbox
              size="small"
              checked={righe.length > 0 && righe.every(r => selezionate.has(r.id))}
              indeterminate={righe.some(r => selezionate.has(r.id)) && !righe.every(r => selezionate.has(r.id))}
              onChange={e => onTogglePagina(e.target.checked)}
              inputProps={{ 'aria-label': 'Seleziona tutte le righe della pagina' }}
            />
          </TableCell>
```

In ogni riga, prima della cella del tipo:

```tsx
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    checked={selezionate.has(item.id)}
                    onChange={() => onToggleRiga(item.id)}
                    inputProps={{ 'aria-label': `Seleziona ${item.marca} ${item.modello}` }}
                  />
                </TableCell>
```

Portare il `colSpan` della riga «Nessuna apparecchiatura corrisponde ai filtri» da `6` a `7`.

- [ ] **Step 2: Tenere la selezione nella pagina**

In `src/pages/EquipmentCatalogManagement.tsx`, accanto agli altri `useState`:

```ts
  /**
   * Righe selezionate per la modifica massiva.
   *
   * Si azzera a ogni cambio di filtro, di ricerca e di pagina: alla conferma non si devono
   * trascinare righe scelte sotto un filtro diverso, che chi conferma non ha più sotto gli occhi.
   */
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set())
```

Le due funzioni di selezione, accanto ad `apriModifica`:

```ts
  const toggleRiga = (id: string) => {
    setSelezionate(prec => {
      const prossime = new Set(prec)
      if (prossime.has(id)) prossime.delete(id)
      else prossime.add(id)
      return prossime
    })
  }

  const togglePagina = (seleziona: boolean) => {
    setSelezionate(seleziona ? new Set((data?.data ?? []).map(r => r.id)) : new Set())
  }
```

`useEquipmentCatalogList` restituisce una `CatalogListResponse`: le righe stanno in `data.data` e il totale del filtro in `data.count`. Le righe disattivate non richiedono una guardia in più — quando «Mostra disattivate» è spento non compaiono nella lista, quindi non sono selezionabili per costruzione.

Estendere l'effetto di azzeramento esistente (~riga 171) perché copra anche la pagina e la selezione:

```ts
  useEffect(() => {
    setPage(0)
    setSelezionate(new Set())
  }, [searchDebounced, tipo, mostraDisattivate, soloIncompleti])

  // La pagina cambia anche senza che cambino i filtri: la selezione non la segue.
  useEffect(() => {
    setSelezionate(new Set())
  }, [page, rowsPerPage])
```

Passare le tre props nuove a `<EquipmentCatalogTable …>`.

- [ ] **Step 3: Verificare tipi e suite**

```bash
npx tsc --noEmit && npx vitest run
```

Atteso: nessun errore, suite verde (456 test più quelli del Task 1).

- [ ] **Step 4: Commit**

```bash
git add src/components/equipmentCatalog/EquipmentCatalogTable.tsx src/pages/EquipmentCatalogManagement.tsx
git commit -m "feat(catalogo): si possono selezionare piu' righe in tabella

La selezione si azzera a ogni cambio di filtro, ricerca o pagina. E'
deliberato: alla conferma di una modifica massiva non si devono trascinare
righe scelte sotto un filtro diverso, che chi conferma non ha piu' sotto gli
occhi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: La barra, la conferma e l'applicazione

**Files:**
- Create: `src/components/equipmentCatalog/ModificaMassivaBar.tsx`
- Create: `src/components/equipmentCatalog/ModificaMassivaDialog.tsx`
- Modify: `src/pages/EquipmentCatalogManagement.tsx` (rende la barra e il dialog, tiene lo stato dell'azione scelta)

**Interfaces:**
- Consumes: da Task 1 `ChiaveMassiva`, `ripartisciPerValore`, `testoConferma`, `soloCompressori`; da Task 2 `useSetEquipmentProperty`; da Task 3 lo stato `selezionate`.
- Produces: nessuna API riusabile fuori dalla pagina.

- [ ] **Step 1: La barra delle azioni**

Creare `src/components/equipmentCatalog/ModificaMassivaBar.tsx`:

```tsx
import { useState } from 'react'
import { Alert, Button, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material'
import type { EquipmentCatalogItem } from '@/types'
import { CANONICAL_SPECS } from '@/services/equipmentAudit'
import { soloCompressori, type ChiaveMassiva } from '@/utils/modificaMassiva'

interface ModificaMassivaBarProps {
  /** Righe selezionate, già risolte: la barra non interroga il database. */
  righe: EquipmentCatalogItem[]
  /** Righe selezionate in tutto, che nel modo «tutte quelle del filtro» sono più di `righe`. */
  totaleSelezionate: number
  /** Numero di righe del filtro corrente, per proporre la selezione estesa. */
  totaleFiltro: number
  onSelezionaTuttoIlFiltro: () => void
  onScegli: (chiave: ChiaveMassiva, valore: string) => void
  onAnnulla: () => void
}

const CHIAVI: ChiaveMassiva[] = ['giri', 'tipo_compressore']

/**
 * Barra della modifica massiva, sopra la tabella.
 *
 * I valori dei due menu vengono dal contratto canonico e non da costanti riscritte qui: se
 * domani si aggiunge una tipologia costruttiva, comparirà sia nel form di modifica sia qui
 * senza che nessuno debba ricordarsi di questo file.
 */
export const ModificaMassivaBar = ({
  righe,
  totaleSelezionate,
  totaleFiltro,
  onSelezionaTuttoIlFiltro,
  onScegli,
  onAnnulla,
}: ModificaMassivaBarProps) => {
  const [menu, setMenu] = useState<{ chiave: ChiaveMassiva; anchor: HTMLElement } | null>(null)

  if (totaleSelezionate === 0) return null

  const omogenea = soloCompressori(righe)
  const nonCompressori = righe.filter(r => r.tipo_apparecchiatura !== 'Compressori').length

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="body2" fontWeight={700}>
          {totaleSelezionate} {totaleSelezionate === 1 ? 'riga selezionata' : 'righe selezionate'}
        </Typography>

        {CHIAVI.map(chiave => {
          const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
          if (!def) return null
          return (
            <Button
              key={chiave}
              size="small"
              disabled={!omogenea}
              onClick={e => setMenu({ chiave, anchor: e.currentTarget })}
            >
              {def.label}
            </Button>
          )
        })}

        <Button size="small" color="inherit" onClick={onAnnulla}>
          Annulla selezione
        </Button>
      </Stack>

      {totaleFiltro > totaleSelezionate && (
        <Typography variant="caption" component="div" sx={{ mt: 1 }}>
          <Button size="small" onClick={onSelezionaTuttoIlFiltro}>
            Seleziona tutte le {totaleFiltro} righe del filtro
          </Button>
        </Typography>
      )}

      {!omogenea && (
        <Alert severity="info" sx={{ mt: 1, py: 0 }}>
          {nonCompressori > 0
            ? `Nella selezione ci sono ${nonCompressori} righe che non sono compressori: le proprietà costruttive si applicano ai soli compressori.`
            : 'Le proprietà costruttive si applicano ai soli compressori.'}
        </Alert>
      )}

      <Menu
        open={menu !== null}
        anchorEl={menu?.anchor}
        onClose={() => setMenu(null)}
      >
        {(CANONICAL_SPECS.Compressori ?? [])
          .find(d => d.key === menu?.chiave)
          ?.options?.map(o => (
            <MenuItem
              key={o}
              onClick={() => {
                onScegli(menu!.chiave, o)
                setMenu(null)
              }}
            >
              {(CANONICAL_SPECS.Compressori ?? []).find(d => d.key === menu?.chiave)?.optionLabels?.[o] ?? o}
            </MenuItem>
          ))}
      </Menu>
    </Paper>
  )
}
```

- [ ] **Step 2: Il dialog di conferma**

Creare `src/components/equipmentCatalog/ModificaMassivaDialog.tsx`:

```tsx
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import type { EquipmentCatalogItem } from '@/types'
import { ripartisciPerValore, testoConferma, type ChiaveMassiva } from '@/utils/modificaMassiva'

interface ModificaMassivaDialogProps {
  open: boolean
  /** Righe già risolte: nel modo «tutte quelle del filtro» le carica la pagina, non il dialog. */
  righe: EquipmentCatalogItem[]
  chiave: ChiaveMassiva | null
  valore: string | null
  inCorso: boolean
  errore: string | null
  onAnnulla: () => void
  /** Riceve i soli id da scrivere: le righe che hanno già il valore non si toccano. */
  onConferma: (ids: string[]) => void
}

/**
 * Conferma della modifica massiva: dice cosa sta per succedere, prima che succeda.
 *
 * I modelli il cui valore verrà sostituito si elencano per nome. È l'unica cosa che
 * distingue un'operazione voluta da una fatta con un filtro troppo largo.
 */
export const ModificaMassivaDialog = ({
  open,
  righe,
  chiave,
  valore,
  inCorso,
  errore,
  onAnnulla,
  onConferma,
}: ModificaMassivaDialogProps) => {
  if (!chiave || !valore) return null

  const rip = ripartisciPerValore(righe, chiave, valore)
  const testo = testoConferma(rip, chiave, valore)
  const daScrivere = [...rip.daCompilare, ...rip.daSostituire].map(r => r.id)

  return (
    <Dialog open={open} onClose={inCorso ? undefined : onAnnulla} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '1rem' }}>{testo.titolo}</DialogTitle>
      <DialogContent>
        <List dense disablePadding>
          {testo.righe.map(r => (
            <ListItem key={r} sx={{ display: 'list-item', listStyleType: 'disc', ml: 3, py: 0.25 }} disablePadding>
              <ListItemText primaryTypographyProps={{ fontSize: '0.875rem' }} primary={r} />
            </ListItem>
          ))}
        </List>
        {errore && <Alert severity="error" sx={{ mt: 2 }}>{errore}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onAnnulla} disabled={inCorso}>Annulla</Button>
        <Button
          variant="contained"
          disabled={!testo.applicabile || inCorso}
          onClick={() => onConferma(daScrivere)}
        >
          {testo.azione}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 3: Collegare tutto nella pagina**

In `src/pages/EquipmentCatalogManagement.tsx`, aggiungere lo stato dell'azione scelta e delle righe risolte:

```ts
  const [azione, setAzione] = useState<{ chiave: ChiaveMassiva; valore: string } | null>(null)
  /**
   * Righe della selezione, risolte.
   *
   * Nel modo «solo la pagina» sono quelle che si vedono; con «tutte quelle del filtro» si
   * caricano, perché la conferma deve ripartire le righe vere e non stimarle.
   */
  const [righeSelezionate, setRigheSelezionate] = useState<EquipmentCatalogItem[]>([])
  const setProperty = useSetEquipmentProperty()
```

La selezione estesa a tutto il filtro carica gli id in una query sola, chiedendo i soli campi che servono:

```ts
  /**
   * «Seleziona tutte le N righe del filtro»: si caricano gli id, non si finge di averli.
   * Il `pageSize` alto è deliberato — il filtro più largo del catalogo sono poche centinaia
   * di righe, e una seconda pagina qui vorrebbe dire una selezione parziale spacciata per
   * totale.
   */
  const selezionaTuttoIlFiltro = async () => {
    const tutte = await equipmentCatalogAdminApi.list({ ...filters, page: 0, pageSize: 1000 })
    setSelezionate(new Set(tutte.data.map(r => r.id)))
    setRigheSelezionate(tutte.data)
  }
```

`1000` è il `PAGE_LIMIT` già dichiarato in `equipmentCatalogAdmin.ts`: PostgREST non restituisce di più in una chiamata. Se il filtro corrente conta più righe di così, **non selezionarle in silenzio**: mostrare che l'azione copre le prime 1000 e invitare a restringere il filtro. Con i compressori — 633 righe in tutto — il caso non si presenta, ma una selezione parziale spacciata per totale è esattamente il difetto che questa funzionalità deve evitare.

Quando la selezione cambia dalla tabella, le righe risolte sono quelle della pagina:

```ts
  useEffect(() => {
    const dellaPagina = (data?.data ?? []).filter(r => selezionate.has(r.id))
    // Con la selezione estesa `righeSelezionate` contiene già più righe di quelle visibili:
    // non la si sovrascrive con il solo sottoinsieme della pagina.
    if (dellaPagina.length === selezionate.size) setRigheSelezionate(dellaPagina)
  }, [selezionate, data])
```

Rendere la barra sopra la tabella e il dialog accanto agli altri:

```tsx
      <ModificaMassivaBar
        righe={righeSelezionate}
        totaleSelezionate={selezionate.size}
        totaleFiltro={data?.count ?? 0}
        onSelezionaTuttoIlFiltro={selezionaTuttoIlFiltro}
        onScegli={(chiave, valore) => setAzione({ chiave, valore })}
        onAnnulla={() => setSelezionate(new Set())}
      />
```

```tsx
      <ModificaMassivaDialog
        open={azione !== null}
        righe={righeSelezionate}
        chiave={azione?.chiave ?? null}
        valore={azione?.valore ?? null}
        inCorso={setProperty.isPending}
        errore={setProperty.error instanceof Error ? setProperty.error.message : null}
        onAnnulla={() => { setAzione(null); setProperty.reset() }}
        onConferma={async ids => {
          const n = await setProperty.mutateAsync({ ids, chiave: azione!.chiave, valore: azione!.valore })
          setAzione(null)
          setSelezionate(new Set())
          toast.success(`${n} ${n === 1 ? 'riga aggiornata' : 'righe aggiornate'}.`)
        }}
      />
```

Verificare come la pagina segnala già gli esiti — se non usa `toast`, seguire il meccanismo che usa (`erroreSalvataggio` e simili) invece di introdurne uno nuovo.

- [ ] **Step 4: Verificare tipi e suite**

```bash
npx tsc --noEmit && npx vitest run && npx eslint src/components/equipmentCatalog src/pages/EquipmentCatalogManagement.tsx --ext .ts,.tsx
```

Atteso: nessun errore di tipo, suite verde, zero errori di lint (i warning `no-explicit-any` preesistenti non contano).

- [ ] **Step 5: Commit**

```bash
git add src/components/equipmentCatalog/ModificaMassivaBar.tsx src/components/equipmentCatalog/ModificaMassivaDialog.tsx src/pages/EquipmentCatalogManagement.tsx
git commit -m "feat(catalogo): modifica massiva delle proprieta' costruttive

Selezionate le righe, i due menu della barra propongono i valori del contratto
canonico e la conferma dice cosa sta per succedere: quante righe si compilano,
quante si sostituiscono e su quali modelli, quante restano come sono.

I modelli da sostituire si nominano invece di contarli soltanto: sono quelli il
cui valore qualcuno aveva gia' stabilito, ed e' l'unica cosa che distingue
un'operazione voluta da una fatta con un filtro troppo largo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Verifica a schermo

Non produce codice: accerta che la funzionalità faccia davvero ciò che dice, su dati veri. La logica è coperta dai test del Task 1; qui si verifica il cablaggio, che la convenzione del progetto non testa.

**Files:** nessuno.

- [ ] **Step 1: Fotografare lo stato di partenza**

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && cat > /tmp/prima.json <<'EOF'
{"query":"SELECT coalesce(specs->>'giri','(vuoto)') AS giri, count(*) FROM equipment_catalog WHERE tipo_apparecchiatura='Compressori' AND is_active GROUP BY 1 ORDER BY 2 DESC"}
EOF
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/prima.json
```

Attesi al 2026-08-03: `(vuoto)` 486, `variabili` 141, `fissi` 6. Annotare i numeri effettivi.

- [ ] **Step 2: Provare su un gruppo piccolo e riconoscibile**

Avviare l'anteprima, aprire Apparecchiature, filtrare per tipo `Compressori` e cercare `SK 22`. Selezionare le righe con la casella in intestazione, aprire «Regolazione giri» e scegliere «a giri fissi».

La conferma deve dire quante righe si compilano e, se fra quelle selezionate ce n'è una già valorizzata, nominarne il modello. Applicare.

Verificare a database che siano cambiate quelle e solo quelle:

```bash
cd "$(git rev-parse --show-toplevel)" && set -a && . ./.env.local && set +a && PID=$(echo "$VITE_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && cat > /tmp/dopo.json <<'EOF'
{"query":"SELECT modello, specs->>'giri' AS giri, updated_at FROM equipment_catalog WHERE tipo_apparecchiatura='Compressori' AND is_active AND modello LIKE 'SK 22%' ORDER BY modello"}
EOF
curl -s -X POST "https://api.supabase.com/v1/projects/$PID/database/query" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" -d @/tmp/dopo.json
```

- [ ] **Step 3: Verificare che le righe già uguali non siano state toccate**

Riapplicare lo stesso valore alla stessa selezione. La conferma deve dire «Niente da applicare» con il pulsante spento, e nessun `updated_at` deve cambiare.

- [ ] **Step 4: Verificare l'azzeramento della selezione**

Selezionare due righe, cambiare il filtro tipo, tornare indietro: la selezione dev'essere vuota e la barra sparita. Stessa cosa cambiando pagina.

- [ ] **Step 5: Verificare la selezione mista**

Togliere il filtro tipo, selezionare righe di tipi diversi: i due pulsanti devono essere spenti e comparire l'avviso che le proprietà costruttive si applicano ai soli compressori.

- [ ] **Step 6: Rimettere a posto i dati di prova**

Se i valori applicati alle SK 22 durante la prova non sono quelli veri, riportarli come stavano — annotare prima i valori originali al Passo 1 e ripristinarli con una `UPDATE` mirata, oppure riapplicare dall'interfaccia il valore corretto.

---

## Verifica finale

- [ ] **Suite, tipi e lint**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src --ext .ts,.tsx
```

Attesi: suite verde, `tsc` pulito, e sui file toccati zero errori di lint (i 29 errori preesistenti del progetto stanno in file che questo lavoro non apre).

- [ ] **Nessuna regressione sul resto della pagina**

Aprire, modificare e salvare una singola apparecchiatura dalla matita, come prima: la colonna nuova non deve aver spostato le azioni di riga né rotto il form. Verificare anche che il pannello «Verifica coerenza» si apra ancora.
