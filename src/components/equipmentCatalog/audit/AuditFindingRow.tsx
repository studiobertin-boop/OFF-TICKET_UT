import { Alert, Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material'
import { alpha } from '@mui/material/styles'
import type { DismissalRecord, Finding } from '@/services/equipmentAudit'
import { SEVERITY_COLOR } from './severita'

interface AuditFindingRowProps {
  finding: Finding
  /** La segnalazione era archiviata ma i valori sono cambiati: va rivalutata. */
  riemersa?: boolean
  /** Presente solo nell'elenco delle archiviate. */
  archiviazione?: DismissalRecord
  onCorreggi?: (finding: Finding) => void
  onArchivia?: (finding: Finding) => void
  onRipristina?: (finding: Finding) => void
  disabilitato?: boolean
}

export const AuditFindingRow = ({
  finding,
  riemersa = false,
  archiviazione,
  onCorreggi,
  onArchivia,
  onRipristina,
  disabilitato = false,
}: AuditFindingRowProps) => {
  const manuale = finding.fix.kind === 'manual'

  return (
    <Box
      sx={theme => ({
        p: 1.5,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: riemersa ? alpha(theme.palette.warning.main, 0.06) : 'transparent',
      })}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Chip
          label={finding.severity}
          size="small"
          color={SEVERITY_COLOR[finding.severity]}
          sx={{ minWidth: 72 }}
        />

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600}>
            {finding.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {finding.detail}
          </Typography>

          {finding.fix.kind === 'manual' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {finding.fix.hint}
            </Typography>
          )}

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {finding.entities.map(e => (
              <Chip key={e.id} label={e.label} size="small" variant="outlined" />
            ))}
          </Box>

          {riemersa && archiviazione && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Era stata archiviata con la motivazione «{archiviazione.motivazione}», ma i valori
              sono cambiati: va rivalutata.
            </Alert>
          )}

          {archiviazione && !riemersa && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Archiviata: {archiviazione.motivazione}
            </Typography>
          )}
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
          {onCorreggi && (
            <Tooltip
              title={
                manuale
                  ? 'Nessuna correzione sicura da applicare: va decisa a mano'
                  : 'Applica la correzione proposta'
              }
            >
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={manuale || disabilitato}
                  onClick={() => onCorreggi(finding)}
                >
                  Correggi
                </Button>
              </span>
            </Tooltip>
          )}

          {onArchivia && (
            <Button size="small" disabled={disabilitato} onClick={() => onArchivia(finding)}>
              Archivia
            </Button>
          )}

          {onRipristina && (
            <Button size="small" disabled={disabilitato} onClick={() => onRipristina(finding)}>
              Ripristina
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  )
}
