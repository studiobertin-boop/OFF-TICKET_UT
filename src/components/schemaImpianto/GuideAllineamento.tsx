/**
 * Resa delle guide di allineamento calcolate da useGuideAllineamento.ts: linee sottili
 * tratteggiate, in coordinate del flow, che segnalano quando il nodo trascinato torna in
 * riga con un altro. Componente a parte per non mescolare hook e JSX nello stesso modulo.
 */
import type { Guida } from '@/services/schemaImpianto/allineamento'

/** Oltre `translateExtent` della tela ([-500,-500]-[4000,4000]): la riga deve attraversare
 * tutto lo spazio raggiungibile, qualunque sia la posizione dei due nodi che la generano. */
const OLTRE_IL_DISEGNO = { da: -1000, a: 5000 }

/**
 * Le linee vanno dentro `<ViewportPortal>` di react-flow, che rende in coordinate del
 * flow: `quota` (in `Guida`) è già in quello stesso sistema, senza conversioni.
 */
export function GuideAllineamento({ guide }: { guide: Guida[] }) {
  return (
    <>
      {guide.map((g, i) =>
        g.orientamento === 'verticale' ? (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: g.quota,
              top: OLTRE_IL_DISEGNO.da,
              width: 0,
              height: OLTRE_IL_DISEGNO.a - OLTRE_IL_DISEGNO.da,
              borderLeft: '1px dashed #ff4081',
              pointerEvents: 'none',
            }}
          />
        ) : (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: g.quota,
              left: OLTRE_IL_DISEGNO.da,
              height: 0,
              width: OLTRE_IL_DISEGNO.a - OLTRE_IL_DISEGNO.da,
              borderTop: '1px dashed #ff4081',
              pointerEvents: 'none',
            }}
          />
        )
      )}
    </>
  )
}
