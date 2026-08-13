import { Box, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import { durataInParole, type RiassuntoBlocchi } from '@/utils/blocchiPratica'

interface BlocchiNastroProps {
  riassunto: RiassuntoBlocchi
  /** Data di creazione della pratica, per l'estremo sinistro della scala. */
  creataIl: string
}

const ALTEZZA = 10

/**
 * La vita della pratica in una barra: in grigio il tempo in cui è andata avanti, in ambra i
 * periodi in cui è rimasta ferma — a righe quello ancora aperto.
 *
 * Risponde alla domanda che il chip non può rispondere senza un clic: non «è ferma?» ma
 * «quante volte si è fermata, e per quanto». Sta sotto lo stepper perché è la stessa lettura
 * — dove è arrivata, con quali soste — e perché non deve rubare spazio alla barra agganciata.
 *
 * Su una pratica mai ferma non si disegna: una barra vuota occuperebbe una riga per dire
 * niente, e il posto in cui non c'è niente da dire è meglio lasciarlo vuoto.
 */
export const BlocchiNastro = ({ riassunto, creataIl }: BlocchiNastroProps) => {
  if (riassunto.totale === 0) return null

  const ferma = riassunto.attivo !== null
  const testa = ferma
    ? `Ferma da ${durataInParole(riassunto.giorniFermaOra ?? 0)}`
    : `Ripartita il ${new Date(riassunto.ultimoMovimento!).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`

  return (
    <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, maxWidth: 640 }}>
      <Typography variant="caption" color="text.secondary">
        <Box component="strong" sx={{ color: 'text.primary', fontWeight: 600 }}>{testa}</Box>
        {' · '}
        {riassunto.totale} {riassunto.totale === 1 ? 'blocco' : 'blocchi'}, {durataInParole(riassunto.giorniPersi)}
        {' fermi su '}{durataInParole(riassunto.giorniVita)}{' di lavorazione'}
      </Typography>

      <Box
        sx={{
          position: 'relative',
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
                // Il fermo aperto è rigato: non ha una fine, e non deve sembrare concluso.
                bgcolor: 'warning.main',
                opacity: s.aperto ? 1 : 0.85,
                backgroundImage: s.aperto
                  ? (t) => `repeating-linear-gradient(135deg, ${t.palette.warning.main} 0 6px, ${t.palette.warning.dark} 6px 12px)`
                  : 'none',
                cursor: 'help',
              }}
            />
          </Tooltip>
        ))}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {new Date(creataIl).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </Typography>
        <Typography variant="caption" color="text.disabled">oggi</Typography>
      </Box>
    </Box>
  )
}
