# Modifica massiva delle proprietà costruttive a catalogo

Data: 2026-08-03
Stato: approvato, da implementare

## Obiettivo

Nella pagina Apparecchiature, selezionare più righe di compressore e valorizzare
in un colpo solo la regolazione dei giri o la tipologia costruttiva, invece di
aprire e salvare una riga per volta.

## Perché serve

Quando il catalogo è stato importato, `specs.giri` fu valorizzato solo dove
c'era prova positiva: il suffisso commerciale delle macchine a velocità
variabile — KAESER SFC, Ceccato IVR, Atlas Copco VSD, FINI VS — su 141 righe di
61 modelli, ispezionate a una a una. Le restanti **non** furono marcate «fissi»,
e la migration lo dice per esteso: l'assenza del suffisso non è prova di giri
fissi, e il valore finisce in una frase asseverata di una relazione firmata. Un
«fissi» sbagliato è silenzioso e si propaga.

Quella scelta non è cambiata. Cambia chi decide: non più un'euristica sul nome,
ma il tecnico che riconosce un gruppo di macchine e lo marca. Lo strumento non
deve quindi proteggere dall'automatismo, ma da una cosa sola — la distanza fra
ciò che si seleziona e ciò che si crede di aver selezionato.

Stato di produzione (2026-08-03), 633 righe attive di compressori:

| `giri` | `tipo_compressore` | righe | modelli |
|---|---|---|---|
| *(vuoto)* | *(vuoto)* | 485 | 283 |
| variabili | *(vuoto)* | 141 | 61 |
| fissi | *(vuoto)* | 6 | 2 |
| *(vuoto)* | PISTONI | 1 | 1 |

485 righe da compilare; 147 con un valore già stabilito, che è ciò su cui la
conferma deve richiamare l'attenzione. La tipologia costruttiva è di fatto
vergine.

## Ambito

Solo le due proprietà **costruttive** dei compressori: `giri` e
`tipo_compressore`. Appartengono al modello, non alla singola variante, quindi
applicarle a un gruppo di righe è sensato. Gli altri dati tecnici — FAD, PS, TS,
volume, categoria — no: sono esattamente ciò che distingue le varianti fra loro,
e scriverne uno uguale su righe diverse sarebbe quasi sempre un errore.

## Design

### 1. Selezione

Una colonna di caselle come prima colonna della tabella, prima di «Tipo».

- La casella in intestazione seleziona e deseleziona **le righe della pagina**.
- Quando il filtro corrente ha più righe di quelle mostrate, sotto la barra
  compare una riga di testo: `50 righe selezionate.` seguita dall'azione
  `Seleziona tutte le 392 righe del filtro.` — un gesto in più, che dichiara il
  numero.
- La selezione **si azzera** al cambio di pagina, di filtro, di ricerca e degli
  interruttori «Solo incomplete» e «Mostra disattivate». Deliberato: alla
  conferma non si devono trascinare righe scelte sotto un filtro diverso.
- Le righe disattivate sono selezionabili solo quando «Mostra disattivate» è
  acceso, cioè solo quando si vedono.

La selezione ha due forme, e vanno tenute distinte perché si comportano
diversamente al momento della conferma:

```ts
type Selezione =
  | { modo: 'righe'; ids: string[] }
  | { modo: 'filtro'; filtri: CatalogFilters; totale: number }
```

### 2. Barra delle azioni

Compare sopra la tabella quando c'è almeno una riga selezionata:

> **12 righe selezionate** — [Regolazione giri ▾] [Tipo costruttivo ▾] · *Annulla selezione*

I valori dei due menu vengono da `CANONICAL_SPECS.Compressori` — `options` e
`optionLabels` delle definizioni `giri` e `tipo_compressore` — non da costanti
riscritte nel componente: restano una cosa sola con i campi del form di modifica.

I comandi sono attivi solo se **tutte** le righe selezionate sono compressori.
Con una selezione mista la barra lo dice invece di offrire un'azione che
scriverebbe un campo inesistente su un serbatoio:

> 12 righe selezionate, di cui 3 non sono compressori: le proprietà costruttive
> si applicano ai soli compressori.

Nel modo `filtro` la verifica si fa sul filtro: se `tipo` non è `Compressori`,
i comandi restano spenti con lo stesso messaggio.

### 3. Conferma

Scelto il valore, prima di scrivere la selezione si risolve in righe concrete e
si mostra la ripartizione. Nel modo `filtro` le righe si caricano in una query
sola, chiedendo i soli campi che servono a ripartire e a nominare i modelli —
`id, marca, modello, specs` — e non `*`: sono fino a qualche centinaio di righe
e il resto delle colonne non serve a nessuno.

> **Regolazione giri → a giri fissi**
>
> - **26 righe** hanno il campo vuoto e verranno compilate
> - **12 righe** hanno già «a giri variabili (inverter)» e **verranno
>   sostituite**: KAESER ASD 32 SFC, ASD 40 SFC, ASD 50 SFC…
> - 4 righe hanno già questo valore e restano come sono
>
> [Annulla] [Applica a 38 righe]

I modelli da sostituire si elencano per nome, non solo per numero: sono quelli
che il backfill aveva verificato uno a uno, e vanno riconosciuti prima di
cancellarli. Oltre i dieci nomi l'elenco tronca con `… e altri N`.

Il pulsante dichiara quante righe tocca: la somma dei primi due gruppi, non il
totale selezionato. Le righe che hanno già il valore non si riscrivono — non
cambierebbero nulla e sporcherebbero `updated_at`.

Quando i gruppi da toccare sono vuoti, il pulsante è spento e il testo dice che
non c'è niente da fare.

### 4. Scrittura

Una funzione RPC, sul modello di `apply_equipment_fixes`, che già oggi applica in
blocco le correzioni del motore di verifica per la stessa ragione: un'unica
transazione, invece di centinaia di scritture separate che un'interruzione a
metà lascerebbe a metà.

```sql
set_equipment_property(p_ids uuid[], p_chiave text, p_valore text) returns jsonb
```

- valida `p_chiave` contro `('giri', 'tipo_compressore')` e `p_valore` contro i
  valori ammessi per quella chiave, sollevando altrimenti;
- opera solo su righe con `tipo_apparecchiatura = 'Compressori'`;
- `jsonb_set` sulla chiave, `updated_at = now()`;
- restituisce `{"applied": n}`.

La funzione segue il pattern di `apply_equipment_fixes` anche nei permessi:
`SECURITY DEFINER` con `SET search_path = public`, e il controllo del ruolo
**dentro** la funzione — `admin` o `userdm329`, altrimenti eccezione con
`ERRCODE = '42501'`. Poi `REVOKE ALL … FROM public`, `GRANT EXECUTE … TO
authenticated` e `NOTIFY pgrst, 'reload schema'`. Il client traduce il `42501`
nello stesso messaggio già in uso in `applyFixes` — «Non hai i permessi per…».

Il metodo client sta in `equipmentCatalogAdminApi`, accanto ad `applyFixes`.

### 5. Cosa non fa

- Non svuota un campo: azzerare un valore resta operazione da riga singola.
- Non tocca altri dati tecnici, né altri tipi di apparecchiatura.
- Non offre un annullamento dopo l'applicazione: per tornare indietro si
  riseleziona e si riapplica il valore giusto. È il motivo per cui la
  sovrascrittura è ammessa invece che vietata — un errore fatto in massa deve
  potersi correggere in massa.

## Cosa non cambia

Il contratto canonico, l'indice unico, il motore della relazione, la scheda
dati. Nessuna migrazione di dati: la sola DDL è la creazione della funzione.

## Test

Vitest sulla logica, non sulla UI, secondo la convenzione del progetto.

Una funzione pura che ripartisce le righe selezionate rispetto al valore da
applicare:

```ts
ripartisciPerValore(righe, chiave, valore):
  { daCompilare: [], daSostituire: [], giaUguali: [] }
```

Casi da coprire:

- righe con la chiave assente finiscono in `daCompilare`;
- righe con un valore diverso finiscono in `daSostituire`;
- righe con lo stesso valore finiscono in `giaUguali` e non si riscrivono;
- la ripartizione con i numeri veri di produzione: su una selezione che contiene
  sia righe vuote sia righe «variabili», applicando «fissi», i tre gruppi
  tornano;
- la composizione del testo di conferma: singolare e plurale, troncamento
  dell'elenco dei modelli oltre i dieci, e il caso «niente da fare»;
- il rifiuto di una selezione che non è tutta di compressori.
