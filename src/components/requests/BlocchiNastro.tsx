import { Box, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { durataInParole, type RiassuntoBlocchi } from '@/utils/blocchiPratica'

interface BlocchiNastroProps {
  riassunto: RiassuntoBlocchi
  /** Data di creazione della pratica, per l'estremo sinistro della scala. */
  creataIl: string
  /**
   * Quanto del percorso la pratica ha coperto, da 0 a 1: il nastro finisce lì.
   *
   * È la stessa frazione del pallino acceso nello stepper, così le due letture si guardano
   * in colonna — il nastro arriva sotto il passo raggiunto, non oltre.
   */
  avanzamento: number
}

const ALTEZZA = 10

/**
 * La vita della pratica in una barra: in ambra i periodi in cui è rimasta ferma — a righe
 * quello ancora aperto — e in verde il momento in cui è ripartita.
 *
 * Risponde alla domanda che lo stato non racconta: non «dove è arrivata» ma «quante volte si
 * è fermata, per quanto, e perché è ripartita». Sta sotto lo stepper e finisce sotto il passo
 * raggiunto: le due righe si leggono insieme.
 *
 * Su una pratica mai ferma non si disegna: una barra vuota occuperebbe una riga per dire
 * niente, e il posto in cui non c'è niente da dire è meglio lasciarlo vuoto.
 */
export const BlocchiNastro = ({ riassunto, creataIl, avanzamento }: BlocchiNastroProps) => {
  if (riassunto.totale === 0) return null

  const ferma = riassunto.attivo !== null
  const testa = ferma
    ? `Ferma da ${durataInParole(riassunto.giorniFermaOra ?? 0)}`
    : `Ripartita il ${new Date(riassunto.ultimoMovimento!).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`

  // Sotto il 5% la barra non conterrebbe nemmeno un segmento: la pratica appena aperta e già
  // ferma deve poterlo mostrare.
  const larghezzaNastro = `${Math.max(5, Math.min(100, avanzamento * 100))}%`

  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary">
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>{testa}</Box>
        {' · '}
        {riassunto.totale} {riassunto.totale === 1 ? 'blocco' : 'blocchi'}, {durataInParole(riassunto.giorniPersi)}
        {' fermi su '}{durataInParole(riassunto.giorniVita)}{' di lavorazione'}
      </Typography>

      {/* La barra occupa solo la parte di percorso già fatta: il resto della riga resta
          vuoto, così l'occhio la chiude sotto il pallino dello stato corrente. */}
      <Box
        sx={{
          position: 'relative',
          width: larghezzaNastro,
          height: ALTEZZA,
          borderRadius: `${ALTEZZA / 2}px`,
          bgcolor: (t) => alpha(t.palette.text.primary, 0.08),
          overflow: 'hidden',
        }}
      >
        {riassunto.segmenti.map((s, i) => (
          <Tooltip key={i} title={s.descrizione} arrow placement="top">
            <Box
              sx={{
                position: 'absolute', top: 0, bottom: 0,
                left: `${s.inizio}%`, width: `${s.larghezza}%`,
                cursor: 'help',
                ...(s.tipo === 'sblocco'
                  // Il momento in cui è ripartita: un segno verde, non un periodo.
                  ? { bgcolor: 'success.main' }
                  : {
                      bgcolor: 'warning.main',
                      opacity: s.aperto ? 1 : 0.85,
                      // Il fermo aperto è rigato: non ha una fine, e non deve sembrare concluso.
                      backgroundImage: s.aperto
                        ? (t: any) => `repeating-linear-gradient(135deg, ${t.palette.warning.main} 0 6px, ${t.palette.warning.dark} 6px 12px)`
                        : 'none',
                    }),
              }}
            />
          </Tooltip>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: larghezzaNastro }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {new Date(creataIl).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </Typography>
        <Typography variant="caption" color="text.disabled">oggi</Typography>
      </Box>
    </Box>
  )
}
