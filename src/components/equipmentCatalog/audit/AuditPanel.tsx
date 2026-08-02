import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import {
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon,
  PlayArrow as EseguiIcon,
} from '@mui/icons-material'
import {
  RULE_LABELS,
  SEVERITY_ORDER,
  type AuditOptions,
  type Finding,
  type RuleId,
  type Severity,
} from '@/services/equipmentAudit'
import {
  useDismissFinding,
  useEquipmentAudit,
  useRestoreFinding,
} from '@/hooks/useEquipmentAudit'
import { useApplyFixes } from '@/hooks/useEquipmentCatalogAdmin'
import { AuditFindingRow } from './AuditFindingRow'
import { SEVERITY_COLOR } from './severita'
import { BulkFixDialog } from './BulkFixDialog'
import { DismissFindingDialog } from './DismissFindingDialog'

interface AuditPanelProps {
  open: boolean
  onClose: () => void
}

const SEVERITA: Severity[] = ['critica', 'alta', 'media', 'bassa']

/**
 * Verifica di coerenza del catalogo.
 *
 * I controlli euristici nascono spenti: sulle serie di modelli producono falsi
 * positivi certi — due taglie vicine possono appartenere a generazioni diverse —
 * e mescolarli ai controlli deterministici toglierebbe credito a entrambi.
 */
export const AuditPanel = ({ open, onClose }: AuditPanelProps) => {
  const [options, setOptions] = useState<AuditOptions>({
    includeSheets: false,
    includeHeuristics: false,
  })
  const [tab, setTab] = useState(0)
  const [daArchiviare, setDaArchiviare] = useState<Finding | null>(null)
  const [bulk, setBulk] = useState<{ titolo: string; findings: Finding[] } | null>(null)

  const { report, run, isRunning, hasRun, error } = useEquipmentAudit(options)
  const applyFixes = useApplyFixes()
  const dismiss = useDismissFinding()
  const restore = useRestoreFinding()

  const perRegola = useMemo(() => {
    const gruppi = new Map<RuleId, Finding[]>()
    for (const f of report?.findings ?? []) {
      const bucket = gruppi.get(f.rule)
      if (bucket) bucket.push(f)
      else gruppi.set(f.rule, [f])
    }
    return [...gruppi.entries()].sort(
      (a, b) => SEVERITY_ORDER[a[1][0].severity] - SEVERITY_ORDER[b[1][0].severity]
    )
  }, [report])

  const riemerse = useMemo(() => new Set(report?.resurfacedKeys ?? []), [report])
  const archiviatePerChiave = useMemo(
    () => new Map((report?.dismissed ?? []).map(d => [d.key, d.dismissal])),
    [report]
  )

  const applica = async (findings: Finding[]) => {
    await applyFixes.mutateAsync(findings.map(f => f.fix))
    setBulk(null)
    run()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <span>Verifica di coerenza</span>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={isRunning ? <CircularProgress size={16} /> : <EseguiIcon />}
            disabled={isRunning}
            onClick={() => run()}
          >
            {isRunning ? 'Verifica in corso…' : hasRun ? 'Riesegui' : 'Esegui verifica'}
          </Button>

          <FormControlLabel
            control={
              <Switch
                checked={options.includeSheets}
                onChange={e => setOptions(o => ({ ...o, includeSheets: e.target.checked }))}
              />
            }
            label="Includi le schede dati"
          />

          <FormControlLabel
            control={
              <Switch
                checked={options.includeHeuristics}
                onChange={e => setOptions(o => ({ ...o, includeHeuristics: e.target.checked }))}
              />
            }
            label="Includi i controlli incerti"
          />
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error.message}
          </Alert>
        )}

        {!hasRun && !isRunning && (
          <Typography variant="body2" color="text.secondary">
            La verifica confronta ogni voce di catalogo con le altre dello stesso modello e con il
            formato atteso dei dati tecnici. Non parte da sola: premi «Esegui verifica».
          </Typography>
        )}

        {report && (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              {SEVERITA.map(s => (
                <Chip
                  key={s}
                  label={`${report.counts[s]} ${s}`}
                  size="small"
                  color={SEVERITY_COLOR[s]}
                  variant={report.counts[s] > 0 ? 'filled' : 'outlined'}
                />
              ))}
              <Divider orientation="vertical" flexItem />
              <Typography variant="caption" color="text.secondary">
                {report.stats.catalogRows} voci di catalogo
                {options.includeSheets &&
                  `, ${report.stats.sheetRows} apparecchiature in ${report.stats.sheetsScanned} schede`}
              </Typography>
            </Stack>

            {report.resurfacedKeys.length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {report.resurfacedKeys.length}{' '}
                {report.resurfacedKeys.length === 1
                  ? 'segnalazione archiviata è riemersa'
                  : 'segnalazioni archiviate sono riemerse'}
                : i valori coinvolti sono cambiati rispetto a quando le hai valutate.
              </Alert>
            )}

            <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 2 }}>
              <Tab label={`Attive (${report.findings.length})`} />
              <Tab label={`Archiviate (${report.dismissed.length})`} />
            </Tabs>

            {tab === 0 && (
              <>
                {report.findings.length === 0 && (
                  <Alert severity="success">
                    Nessuna incoerenza rilevata con i controlli attivi.
                  </Alert>
                )}

                {perRegola.map(([rule, findings]) => {
                  const applicabili = findings.filter(f => f.fix.kind !== 'manual')

                  return (
                    <Accordion key={rule} disableGutters>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack
                          direction="row"
                          spacing={1.5}
                          alignItems="center"
                          sx={{ width: '100%', pr: 2 }}
                        >
                          <Chip
                            label={findings.length}
                            size="small"
                            color={SEVERITY_COLOR[findings[0].severity]}
                          />
                          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {RULE_LABELS[rule].title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {RULE_LABELS[rule].description}
                            </Typography>
                          </Box>
                          {findings[0].heuristic && (
                            <Chip label="da verificare" size="small" variant="outlined" />
                          )}
                        </Stack>
                      </AccordionSummary>

                      <AccordionDetails>
                        {applicabili.length > 1 && (
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ mb: 1.5 }}
                            onClick={() =>
                              setBulk({ titolo: RULE_LABELS[rule].title, findings })
                            }
                          >
                            Correggi tutte ({applicabili.length})
                          </Button>
                        )}

                        <Stack spacing={1}>
                          {findings.map(f => (
                            <AuditFindingRow
                              key={f.key}
                              finding={f}
                              riemersa={riemerse.has(f.key)}
                              archiviazione={archiviatePerChiave.get(f.key)}
                              disabilitato={applyFixes.isPending || dismiss.isPending}
                              onCorreggi={() => applica([f])}
                              onArchivia={setDaArchiviare}
                            />
                          ))}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  )
                })}
              </>
            )}

            {tab === 1 && (
              <Stack spacing={1}>
                {report.dismissed.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nessuna segnalazione archiviata.
                  </Typography>
                )}
                {report.dismissed.map(f => (
                  <AuditFindingRow
                    key={f.key}
                    finding={f}
                    archiviazione={f.dismissal}
                    disabilitato={restore.isPending}
                    onRipristina={() => restore.mutate(f.key)}
                  />
                ))}
              </Stack>
            )}
          </>
        )}
      </DialogContent>

      <DismissFindingDialog
        open={daArchiviare !== null}
        finding={daArchiviare}
        isSaving={dismiss.isPending}
        onClose={() => setDaArchiviare(null)}
        onConfirm={async motivazione => {
          if (!daArchiviare) return
          await dismiss.mutateAsync({ finding: daArchiviare, motivazione })
          setDaArchiviare(null)
          run()
        }}
      />

      <BulkFixDialog
        open={bulk !== null}
        titolo={bulk?.titolo ?? ''}
        findings={bulk?.findings ?? []}
        isApplying={applyFixes.isPending}
        onClose={() => setBulk(null)}
        onConfirm={() => bulk && applica(bulk.findings)}
      />
    </Dialog>
  )
}
