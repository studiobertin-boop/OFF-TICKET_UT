/**
 * I gesti della taratura di un simbolo: spostare le ancore, aggiungerne e toglierne, decidere
 * cosa ciascuna accetta, e muovere/deformare la sagoma sotto di loro. Isolato dalla tela per lo
 * stesso motivo di useTestiLiberi.ts/useGomiti.ts/useSegniTubo.ts (CLAUDE.md, «no UI test»):
 * tutto quel che va provato sta nelle funzioni pure sotto e nell'hook, non in un componente
 * React — questo modulo non ne monta nessuno, non tocca react-flow. La tela che consuma questo
 * hook arriva nel prossimo task.
 *
 * La regola che tiene insieme il gesto, con le parole del committente: le ANCORE si agganciano
 * SEMPRE alla griglia (passo 10, `PASSO_GRIGLIA`), la SAGOMA si muove LIBERA. Le ancore devono
 * cadere su punti precisi del disegno ma, siccome non possono uscire dalla griglia, è il disegno
 * a doversi muovere sotto di loro: prima si trasla il blocco per avvicinarlo agli ancoraggi, poi
 * lo si deforma per lo stretto indispensabile. `trasla`/`deforma` restano quindi libere apposta:
 * se si agganciassero anche loro, il gesto «avvicina il blocco al pallino» perderebbe la sua
 * unica ragione d'essere (vedi anche il test di mutazione nel rapporto del task).
 */
import { useCallback, useRef } from 'react'
import { PASSO_GRIGLIA, allineaAllaGriglia } from '@/services/schemaImpianto/griglia'
import type { TaraturaSimbolo } from '@/services/schemaImpianto/libreria'
import type { SchemaAncora, SchemaLatoAncora, SchemaTipoAggancio } from '@/services/schemaImpianto/types'
import { useSchemaHistory } from './useSchemaHistory'

/** Sposta l'ancora `id` sul punto di griglia più vicino a `(x, y)`. Le altre non cambiano. */
export function spostaAncora(t: TaraturaSimbolo, id: string, x: number, y: number): TaraturaSimbolo {
  return {
    ...t,
    ancore: t.ancore.map((a) => (a.id === id ? { ...a, x: allineaAllaGriglia(x), y: allineaAllaGriglia(y) } : a)),
  }
}

/**
 * Il lato più vicino al punto `(x, y)`, misurato contro il baricentro delle ancore esistenti —
 * l'unico riferimento geometrico disponibile qui: `TaraturaSimbolo` non porta l'ingombro della
 * sagoma (solo `dx/dy/sx/sy`, un fattore di trasformazione, non una misura), mentre le ancore
 * vivono già in coordinate finali (vedi il commento su `TaraturaSimbolo.ancore`, libreria.ts).
 * Senza ancore preesistenti il baricentro ricade sull'origine: un ripiego arbitrario ma
 * innocuo, che si vede solo la prima volta che una sagoma senza ancore ne riceve una.
 */
function latoPiuVicino(ancore: SchemaAncora[], x: number, y: number): SchemaLatoAncora {
  const n = ancore.length || 1
  const cx = ancore.reduce((s, a) => s + a.x, 0) / n
  const cy = ancore.reduce((s, a) => s + a.y, 0) / n
  const scostoX = x - cx
  const scostoY = y - cy
  if (Math.abs(scostoX) >= Math.abs(scostoY)) return scostoX >= 0 ? 'dx' : 'sx'
  return scostoY >= 0 ? 'basso' : 'alto'
}

/**
 * Primo id `<lato>-N` libero, a partire da 2: il nome nudo del lato (`sx`, `dx`, ...) è quello
 * che il registro usa già per l'ancora di fabbrica (vedi REGISTRO_SIMBOLI), quindi un'ancora
 * aggiunta a mano parte da 2 anche quando il nome nudo sarebbe ancora libero — così non si
 * confonde mai con un'ancora di fabbrica solo perché quella particolare sagoma non la porta.
 */
function idAncoraLibero(lato: SchemaLatoAncora, ancore: SchemaAncora[]): string {
  const usati = new Set(ancore.map((a) => a.id))
  for (let n = 2; ; n++) {
    const id = `${lato}-${n}`
    if (!usati.has(id)) return id
  }
}

/**
 * Ancora nuova, sulla griglia e con un id stabile e parlante (vedi `idAncoraLibero`). Questi id
 * entrano negli archi salvati (`SchemaCapo.ancora`), quindi non possono nascere casuali: un id
 * diverso a ogni sessione invaliderebbe i layout già disegnati con la sessione precedente.
 */
export function aggiungiAncora(
  t: TaraturaSimbolo,
  accetta: SchemaTipoAggancio[],
  x: number,
  y: number
): TaraturaSimbolo {
  const lato = latoPiuVicino(t.ancore, x, y)
  const ancora: SchemaAncora = {
    id: idAncoraLibero(lato, t.ancore),
    x: allineaAllaGriglia(x),
    y: allineaAllaGriglia(y),
    accetta,
  }
  return { ...t, ancore: [...t.ancore, ancora] }
}

/**
 * Toglie l'ancora `id`, lasciando le altre invariate. Arrivare a zero ancore è un esito
 * legittimo qui: una sagoma temporaneamente senza punti di attacco è uno stato che l'editor
 * (Task 12) può attraversare mentre il committente ricompone la taratura — non spetta a un
 * gesto puro impedirlo o segnalarlo.
 */
export function togliAncora(t: TaraturaSimbolo, id: string): TaraturaSimbolo {
  return { ...t, ancore: t.ancore.filter((a) => a.id !== id) }
}

/**
 * Cambia cosa un'ancora accetta, mantenendo il suo id: il quarto gesto che il committente vuole
 * («decidere cosa ciascuno accetta»), accanto a spostare/aggiungere/togliere. Il gesto è
 * legittimo anche quando un tubo è già attaccato a quell'id — ma ha una conseguenza scoperta
 * nel Task 10: la riconciliazione confronta l'ancora trovata per id con lo stile del tubo
 * collegato, e se il fluido non combacia più stacca quel capo (lo tratta come se l'ancora fosse
 * sparita, non diversamente da un id tolto con `togliAncora`). Questa funzione non se ne
 * preoccupa: decidere se un cambio è sicuro spetta a chi la chiama (l'editor), non a un gesto
 * puro che non conosce gli archi esistenti.
 */
export function impostaAccetta(t: TaraturaSimbolo, id: string, accetta: SchemaTipoAggancio[]): TaraturaSimbolo {
  return { ...t, ancore: t.ancore.map((a) => (a.id === id ? { ...a, accetta } : a)) }
}

/**
 * Trasla la sagoma. LIBERA: a differenza delle ancore non si aggancia alla griglia, perché è lei
 * che deve avvicinarsi ai pallini fermi — se si incastrasse anche lei su un passo suo, i due
 * potrebbero non combaciare mai. `dx`/`dy` sono uno spostamento RELATIVO che si somma a quello
 * corrente: due `trasla` in sequenza compongono, come due eventi dello stesso trascinamento.
 */
export function trasla(t: TaraturaSimbolo, dx: number, dy: number): TaraturaSimbolo {
  return { ...t, dx: t.dx + dx, dy: t.dy + dy }
}

/**
 * Deforma la sagoma. LIBERA come `trasla`; le ANCORE non entrano nel calcolo — sono la parte
 * ferma del gesto (vedi il commento di testa al file: è il punto che il test di mutazione del
 * task deve far cadere). `sx`/`sy` sono fattori MOLTIPLICATIVI applicati alla scala corrente,
 * non valori assoluti — stessa natura RELATIVA di `dx`/`dy` in `trasla`, tradotta in scala
 * (dove comporre vuol dire moltiplicare, non sommare): due `deforma` in sequenza compongono,
 * come due eventi dello stesso trascinamento su una maniglia di ridimensionamento.
 */
export function deforma(t: TaraturaSimbolo, sx: number, sy: number): TaraturaSimbolo {
  return { ...t, sx: t.sx * sx, sy: t.sy * sy }
}

/**
 * Da uno spostamento della maniglia (`delta`, in unità del disegno) al fattore MOLTIPLICATIVO
 * che `deforma` si aspetta su quell'asse. Vive qui, accanto a `deforma`, e non nel componente
 * delle maniglie: è la conversione fra i due vocabolari — il puntatore consegna deltas, la
 * taratura compone scale — ed è l'unico punto in cui una sagoma può degenerare.
 *
 * `null` quando il gesto va rifiutato, cioè quando la dimensione risultante scenderebbe sotto un
 * passo di griglia: sotto quella soglia la sagoma diventa un filo, e passato lo zero si
 * capovolge (scala negativa) — due esiti visibili che nessuna taratura reale chiede. `null`
 * anche per una dimensione di partenza nulla o negativa, dove il fattore non esiste affatto:
 * `nuova / 0` darebbe `Infinity` (o `NaN` a delta zero) e lo porterebbe dentro `sx`/`sy`, da cui
 * nessun gesto successivo potrebbe più farlo uscire — moltiplicare `Infinity` per qualsiasi
 * fattore finito resta `Infinity`.
 */
export function fattoreDeforma(dimensione: number, delta: number): number | null {
  if (!(dimensione > 0)) return null
  const nuova = dimensione + delta
  if (nuova < PASSO_GRIGLIA) return null
  return nuova / dimensione
}

export interface UseTaratura {
  taratura: TaraturaSimbolo
  /** `concluso=false` durante il trascinamento, `true` sull'ultimo evento: vedi il commento su `useTaratura`. */
  spostaAncora: (id: string, x: number, y: number, concluso: boolean) => void
  aggiungiAncora: (accetta: SchemaTipoAggancio[], x: number, y: number) => void
  togliAncora: (id: string) => void
  impostaAccetta: (id: string, accetta: SchemaTipoAggancio[]) => void
  trasla: (dx: number, dy: number, concluso: boolean) => void
  deforma: (sx: number, sy: number, concluso: boolean) => void
  annulla: () => void
  puoAnnullare: boolean
  reimposta: (nuovo: TaraturaSimbolo) => void
}

/**
 * Cronologia PROPRIA, separata da quella dell'editor: annullare una taratura non deve disfare
 * uno spostamento di apparecchiatura fatto nel frattempo, e viceversa (richiesta esplicita del
 * task — sono due modi di edizione distinti). È la differenza voluta rispetto a
 * useTestiLiberi/useGomiti/useSegniTubo/useTrascinamentoTratto, che invece RICEVONO `applica`/
 * `aggiornaSenzaCronologia` dal chiamante per condividere l'UNICA cronologia dell'editor — lì è
 * corretto perché spostare un gomito o un'annotazione è parte dello stesso disegno che si sta
 * componendo; tarare un simbolo è un modo a parte, con un proprio tasto "annulla".
 *
 * Si riusa `useSchemaHistory` invece di riscrivere un secondo reducer: è già generico su `T`,
 * ogni chiamata a questo hook ne crea un'istanza indipendente (stato React proprio del
 * componente che monta `useTaratura`), e porta già risolto il bug di composizione fra
 * `dispatch` dello stesso lotto React documentato in testa a useSchemaHistory.ts — un reducer
 * scritto da capo lo riscoprirebbe.
 */
export function useTaratura(iniziale: TaraturaSimbolo): UseTaratura {
  const cronologia = useSchemaHistory<TaraturaSimbolo>(iniziale)
  const { applica, aggiornaSenzaCronologia } = cronologia

  // Un riferimento per gesto continuo, sulla falsariga di
  // useTestiLiberi.ts/useGomiti.ts/useSegniTubo.ts/useTrascinamentoTratto.ts: il PRIMO evento di
  // un trascinamento entra in cronologia, i successivi aggiornano lo stesso passo
  // (`aggiornaSenzaCronologia`) — senza, un trascinamento al secondo riempirebbe la cronologia
  // (profonda solo 10) di stati intermedi inutili e "annulla" diventerebbe inutile. Tre
  // riferimenti distinti perché sono tre gesti indipendenti (si sposta un'ancora, o si trasla il
  // blocco, o lo si deforma): non capitano mai insieme, ma ognuno ha la propria vita.
  const spostaAncoraAvviato = useRef(false)
  const traslaAvviato = useRef(false)
  const deformaAvviato = useRef(false)

  const spostaAncoraGesto = useCallback(
    (id: string, x: number, y: number, concluso: boolean) => {
      const primoEvento = !spostaAncoraAvviato.current
      spostaAncoraAvviato.current = !concluso
      const aggiorna = primoEvento ? applica : aggiornaSenzaCronologia
      aggiorna((t) => spostaAncora(t, id, x, y))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const aggiungiAncoraGesto = useCallback(
    (accetta: SchemaTipoAggancio[], x: number, y: number) => {
      applica((t) => aggiungiAncora(t, accetta, x, y))
    },
    [applica]
  )

  const togliAncoraGesto = useCallback(
    (id: string) => {
      applica((t) => togliAncora(t, id))
    },
    [applica]
  )

  const impostaAccettaGesto = useCallback(
    (id: string, accetta: SchemaTipoAggancio[]) => {
      applica((t) => impostaAccetta(t, id, accetta))
    },
    [applica]
  )

  const traslaGesto = useCallback(
    (dx: number, dy: number, concluso: boolean) => {
      const primoEvento = !traslaAvviato.current
      traslaAvviato.current = !concluso
      const aggiorna = primoEvento ? applica : aggiornaSenzaCronologia
      aggiorna((t) => trasla(t, dx, dy))
    },
    [applica, aggiornaSenzaCronologia]
  )

  const deformaGesto = useCallback(
    (sx: number, sy: number, concluso: boolean) => {
      const primoEvento = !deformaAvviato.current
      deformaAvviato.current = !concluso
      const aggiorna = primoEvento ? applica : aggiornaSenzaCronologia
      aggiorna((t) => deforma(t, sx, sy))
    },
    [applica, aggiornaSenzaCronologia]
  )

  return {
    taratura: cronologia.stato,
    spostaAncora: spostaAncoraGesto,
    aggiungiAncora: aggiungiAncoraGesto,
    togliAncora: togliAncoraGesto,
    impostaAccetta: impostaAccettaGesto,
    trasla: traslaGesto,
    deforma: deformaGesto,
    annulla: cronologia.annulla,
    puoAnnullare: cronologia.puoAnnullare,
    reimposta: cronologia.reimposta,
  }
}
