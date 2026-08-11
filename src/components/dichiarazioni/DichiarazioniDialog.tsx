/**
 * ⚠️ Da verificare nell'app in esecuzione (UI non coperta dai test unitari).
 */
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { MovimentoPratica } from '@/services/dichiarazioni/scadenza'
import type { AdditionalInfo } from '@/services/relazione/types'
import { DichiarazioniSection } from './DichiarazioniSection'

export interface DichiarazioniDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  scheda: SchedaDatiCompleta
  customerName: string
  sitoProduttivo: string
  nomeFile: string
  movimenti?: MovimentoPratica
  /** Stessa fonte del form "Genera relazione": la data di emissione è condivisa fra i due. */
  initialAdditionalInfo?: AdditionalInfo
}

export default function DichiarazioniDialog({
  open,
  onClose,
  requestId,
  scheda,
  customerName,
  sitoProduttivo,
  nomeFile,
  movimenti,
  initialAdditionalInfo,
}: DichiarazioniDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Dichiarazioni</DialogTitle>
      <DialogContent dividers>
        <DichiarazioniSection
          requestId={requestId}
          scheda={scheda}
          customerName={customerName}
          sitoProduttivo={sitoProduttivo}
          nomeFile={nomeFile}
          movimenti={movimenti}
          initialAdditionalInfo={initialAdditionalInfo}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  )
}
