/**
 * Cronologia delle versioni dello schema salvate a mano (fino a 5, vedi
 * `schemaImpiantoVersioniApi`): utile prima di «Rigenera da capo», per recuperare un disegno
 * che altrimenti si perderebbe. Finestra a sé, aperta dalla sezione §2.3, perché non riguarda
 * né il disegno in corso né le preferenze — solo un elenco da consultare, ripristinare o
 * ripulire.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { Delete as DeleteIcon, Restore as RestoreIcon } from '@mui/icons-material'
import toast from 'react-hot-toast'
import { schemaImpiantoVersioniApi, type VersioneSchema } from '@/services/api/schemaImpiantoVersioni'
import type { SchemaImpianto } from '@/services/relazione/types'

export interface CronologiaSchemaDialogProps {
  open: boolean
  onClose: () => void
  requestId: string
  /** Rimette la versione scelta come schema attivo: la decide `SchemaImpiantoSection`, che sa
   *  anche scartare il layout modificabile — di una versione storica resta solo il PNG. */
  onRipristina: (schema: SchemaImpianto) => void
}

const dataItaliana = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function CronologiaSchemaDialog({
  open,
  onClose,
  requestId,
  onRipristina,
}: CronologiaSchemaDialogProps) {
  const queryClient = useQueryClient()
  const chiave = ['schemaImpiantoVersioni', requestId]

  const { data: versioni = [], isLoading } = useQuery({
    queryKey: chiave,
    queryFn: () => schemaImpiantoVersioniApi.elenca(requestId),
    enabled: open && Boolean(requestId),
  })

  const percorsi = versioni.map((v) => v.filePath)
  // Dipendente dall'elenco: i link firmati vanno chiesti dopo, non prima di sapere quali file
  // esistono. Ricalcolata a ogni apertura — durano solo 5 minuti (`DURATA_LINK_FIRMATO_S`), un
  // link tenuto in cache da una sessione precedente sarebbe già scaduto.
  const { data: urlPerPercorso = {} } = useQuery({
    queryKey: ['schemaImpiantoVersioniUrl', ...percorsi],
    queryFn: async () => {
      const voci = await Promise.all(
        versioni.map(
          async (v): Promise<[string, string]> => [v.filePath, await schemaImpiantoVersioniApi.urlFirmato(v.filePath)]
        )
      )
      return Object.fromEntries(voci) as Record<string, string>
    },
    enabled: open && percorsi.length > 0,
  })

  const [azioneInCorso, setAzioneInCorso] = useState<string | null>(null)
  const [ingranditaUrl, setIngranditaUrl] = useState<string | null>(null)

  const elimina = async (versione: VersioneSchema) => {
    setAzioneInCorso(versione.id)
    try {
      await schemaImpiantoVersioniApi.elimina(versione.id, versione.filePath)
      queryClient.invalidateQueries({ queryKey: chiave })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eliminazione non riuscita.')
    } finally {
      setAzioneInCorso(null)
    }
  }

  const ripristina = async (versione: VersioneSchema) => {
    setAzioneInCorso(versione.id)
    try {
      const blob = await schemaImpiantoVersioniApi.scarica(versione.filePath)
      const buffer = await blob.arrayBuffer()
      onRipristina({
        dati: new Uint8Array(buffer),
        larghezzaPx: versione.larghezzaPx,
        altezzaPx: versione.altezzaPx,
        nomeFile: `Versione del ${dataItaliana(versione.creataIl)}`,
      })
      toast.success('Versione ripristinata.')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ripristino non riuscito.')
    } finally {
      setAzioneInCorso(null)
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Cronologia dello schema</DialogTitle>
        <DialogContent dividers>
          {isLoading && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ py: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Caricamento…
              </Typography>
            </Stack>
          )}

          {!isLoading && versioni.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              Nessuna versione salvata. Premi «Salva versione» prima di rigenerare, per poterla
              recuperare in seguito.
            </Typography>
          )}

          <Stack spacing={1.5}>
            {versioni.map((v) => (
              <Box
                key={v.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {urlPerPercorso[v.filePath] ? (
                  <Tooltip title="Ingrandisci">
                    <Box
                      component="img"
                      src={urlPerPercorso[v.filePath]}
                      alt={`Versione del ${dataItaliana(v.creataIl)}`}
                      onClick={() => setIngranditaUrl(urlPerPercorso[v.filePath])}
                      sx={{
                        width: 72,
                        height: 54,
                        objectFit: 'contain',
                        borderRadius: 0.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'common.white',
                        cursor: 'zoom-in',
                        flex: 'none',
                      }}
                    />
                  </Tooltip>
                ) : (
                  <Box sx={{ width: 72, height: 54, flex: 'none', bgcolor: 'action.hover', borderRadius: 0.5 }} />
                )}

                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {dataItaliana(v.creataIl)}
                </Typography>

                <Tooltip title="Rimetti come schema attivo">
                  <span>
                    <IconButton size="small" onClick={() => void ripristina(v)} disabled={azioneInCorso === v.id}>
                      <RestoreIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Elimina questa versione">
                  <span>
                    <IconButton size="small" onClick={() => void elimina(v)} disabled={azioneInCorso === v.id}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Chiudi</Button>
        </DialogActions>
      </Dialog>

      {/* Stessa idea dell'anteprima ingrandita in `SchemaImpiantoSection`: a 72px la miniatura
          non basta a giudicare il disegno. */}
      <Dialog open={Boolean(ingranditaUrl)} onClose={() => setIngranditaUrl(null)} fullWidth maxWidth="xl">
        <DialogTitle>Versione dello schema</DialogTitle>
        <DialogContent dividers sx={{ bgcolor: 'common.white', overflow: 'auto' }}>
          {ingranditaUrl && (
            <Box
              component="img"
              src={ingranditaUrl}
              alt="Versione dello schema a grandezza piena"
              sx={{ width: '100%', display: 'block' }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
