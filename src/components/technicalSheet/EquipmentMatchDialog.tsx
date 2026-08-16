import { useState, useEffect } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Radio, RadioGroup, Paper, Typography,
} from '@mui/material'
import type { Candidato, ConfrontoSpec, MotivoAmbiguita } from '@/utils/equipmentMatcher'
import type { OCRExtractedData } from '@/types/ocr'

interface EquipmentMatchDialogProps {
  open: boolean
  /** Che cosa la targhetta dichiara, per l'intestazione. */
  datiOcr: OCRExtractedData
  candidati: Candidato[]
  motivo: MotivoAmbiguita
  /** Da quale file arriva questa targhetta; mostrato nel batch. */
  origine?: string
  /** Posizione nella coda del batch, es. «2 di 5». */
  passo?: { corrente: number; totale: number }
  onScegli: (candidato: Candidato) => void
  onScarta: () => void
}

// `Record<MotivoAmbiguita, string>`: se l'enum cresce di nuovo, il compilatore blocca finché
// non si scrive anche il testo del motivo nuovo — qui non basta "quasi tutti coperti".
const AVVISO: Record<MotivoAmbiguita, string> = {
  ragione_sociale_altra:
    'La targhetta dichiara una ragione sociale, ma questo modello è a catalogo solo sotto un\'altra della stessa azienda. O il catalogo è incompleto, o la lettura è imprecisa.',
  divergenza_specs:
    'I dati letti dalla targhetta non coincidono con quelli a catalogo. Verifica quale dei due è corretto prima di scegliere.',
  piu_candidati:
    'Più voci di catalogo corrispondono a questa targhetta. Le ragioni sociali appartengono alla stessa azienda in epoche diverse: scegli quella riportata sul certificato.',
  marca_assente:
    'La targhetta non riporta una marca leggibile: senza quella, la voce di catalogo va confermata a mano.',
  senza_conferma_tecnica:
    'Il modello coincide con questa voce di catalogo, ma la targhetta non riporta dati tecnici che lo confermino. Su questo tipo di apparecchiatura il solo modello non basta a garantire l\'identità.',
  somiglianza_incerta:
    'Il modello letto somiglia a questa voce di catalogo ma non coincide esattamente.',
}

/** Riga di confronto fra ciò che dice la targhetta e ciò che dice il catalogo. */
const Confronto = ({ c }: { c: ConfrontoSpec }) => {
  if (c.esito === 'non_letto') {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>
        {c.etichetta} {c.valoreCatalogo ?? '—'} <em>(da catalogo)</em>
      </Typography>
    )
  }
  const diverge = c.esito === 'diverge'
  return (
    <Typography
      variant="caption"
      sx={{ mr: 2, color: diverge ? 'error.main' : 'success.main', fontWeight: diverge ? 700 : 400 }}
    >
      {c.etichetta} {c.valoreCatalogo} {diverge ? '✗' : '✓'}
      {diverge && (
        <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
          {' '}targhetta: {c.valoreLetto}
        </Box>
      )}
    </Typography>
  )
}

/**
 * Scelta fra le voci di catalogo che possono corrispondere alla targhetta appena letta.
 *
 * Il confronto è mostrato campo per campo perché la decisione si prende sui numeri: due
 * ragioni sociali della stessa azienda portano spesso lo stesso modello, e l'unica cosa che
 * le distingue sono i dati tecnici — quando li distinguono.
 */
export const EquipmentMatchDialog = ({
  open, datiOcr, candidati, motivo, origine, passo, onScegli, onScarta,
}: EquipmentMatchDialogProps) => {
  const [scelto, setScelto] = useState<string>('')

  // La coda del batch riusa lo stesso dialog per targhette diverse: senza azzerare, la
  // selezione della precedente resterebbe accesa sulla successiva.
  useEffect(() => {
    setScelto(candidati.length === 1 ? candidati[0].riga.id : '')
  }, [candidati])

  const letto = [
    datiOcr.marca, datiOcr.modello,
    datiOcr.volume != null ? `${datiOcr.volume} L` : null,
    datiOcr.pressione_max != null ? `${datiOcr.pressione_max} bar` : null,
    datiOcr.n_fabbrica ? `matr. ${datiOcr.n_fabbrica}` : null,
    datiOcr.anno ? String(datiOcr.anno) : null,
  ].filter(Boolean).join(' · ')

  const candidatoScelto = candidati.find((c) => c.riga.id === scelto)

  return (
    <Dialog open={open} onClose={onScarta} maxWidth="md" fullWidth>
      <DialogTitle>
        Corrispondenza a catalogo
        {passo && (
          <Chip label={`${passo.corrente} di ${passo.totale}`} size="small" sx={{ ml: 1 }} />
        )}
      </DialogTitle>

      <DialogContent>
        <Alert severity={motivo === 'divergenza_specs' ? 'warning' : 'info'} sx={{ mb: 2 }}>
          {AVVISO[motivo]}
        </Alert>

        {origine && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            File: {origine}
          </Typography>
        )}

        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary">Dalla targhetta</Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{letto || '—'}</Typography>
        </Paper>

        <RadioGroup value={scelto} onChange={(e) => setScelto(e.target.value)}>
          {candidati.map((c) => (
            <Paper key={c.riga.id} variant="outlined" sx={{ p: 1, mb: 1 }}>
              <FormControlLabel
                value={c.riga.id}
                control={<Radio size="small" />}
                sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                label={
                  <Box sx={{ pt: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.riga.marca}
                      <Box component="span" sx={{ fontWeight: 400, ml: 1 }}>{c.riga.modello}</Box>
                    </Typography>
                    <Box sx={{ mt: 0.5 }}>
                      {c.confronti.map((x) => <Confronto key={x.campo} c={x} />)}
                    </Box>
                  </Box>
                }
              />
            </Paper>
          ))}
        </RadioGroup>
      </DialogContent>

      <DialogActions>
        <Button onClick={onScarta}>Nessuno di questi</Button>
        <Button
          variant="contained"
          disabled={!candidatoScelto}
          onClick={() => candidatoScelto && onScegli(candidatoScelto)}
        >
          Usa selezionato
        </Button>
      </DialogActions>
    </Dialog>
  )
}
