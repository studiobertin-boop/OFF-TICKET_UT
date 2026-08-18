/**
 * Finestra "SCHEMA IMPIANTO": i collegamenti compressori → serbatoi e l'editor dello schema
 * d'impianto (§2.3 della relazione), separati dalla finestra "Dati per la relazione tecnica"
 * perché servono anche a chi non genera ancora il documento finale.
 */
import { useMemo } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
} from '@mui/material'
import type { SelectChangeEvent } from '@mui/material'
import { GruppoCampi } from '@/components/common'
import type { SchedaDatiCompleta } from '@/types/technicalSheet'
import type { SchemaImpianto, SchemaPreferenze } from '@/services/relazione/types'
import type { Tarature } from '@/services/schemaImpianto/libreria'
import type { LayoutSalvato } from '@/services/schemaImpianto/persistenza'
import type { SchemaLayout } from '@/services/schemaImpianto/types'
import { SchemaImpiantoSection } from './SchemaImpiantoSection'
import PannelloPreferenzeSchema from './PannelloPreferenzeSchema'
import { ETICHETTA_TRONCATA, LARGHEZZA_SELECT } from './selectStyles'

export interface SchemaImpiantoDialogProps {
  open: boolean
  onClose: () => void
  scheda: SchedaDatiCompleta
  /** Collegamenti compressori→serbatoi salvati che non corrispondono più a un codice di scheda. */
  droppedRefs: string[]
  collegamenti: Record<string, string[]>
  onCollegamentiChange: (collegamenti: Record<string, string[]>) => void
  /** Ordine, condense e gruppi by-pass scelti dall'operatore. Li consuma il pannello (Task 4). */
  preferenze: SchemaPreferenze
  onPreferenzeChange: (preferenze: SchemaPreferenze) => void
  schema: SchemaImpianto | null
  onSchemaChange: (schema: SchemaImpianto | null) => void
  layoutSalvato: LayoutSalvato | null | undefined
  onLayoutChange: (layout: SchemaLayout | null) => void
  /** Impronta delle preferenze con cui il disegno e' stato generato: passa di qui e basta, la
   *  decide `SchemaImpiantoSection` e la conserva chi monta questa finestra. */
  onPreferenzeApplicateChange: (impronta: string | undefined) => void
  taraturaPratica: Tarature
  onTaraturaPraticaChange: (taraturaPratica: Tarature) => void
}

/**
 * Sta fuori dalla finestra "Dati relazione" apposta: collegamenti e schema servono al calcolo
 * delle valvole e si rifiniscono anche indipendentemente dalla generazione del .docx.
 *
 * `keepMounted` sul Dialog: `SchemaImpiantoSection` genera lo schema in automatico appena i dati
 * bastano (suo effetto interno, invariato) — deve restare montata anche a finestra chiusa, o il
 * chip "SC" in testata resterebbe grigio dopo un ricaricamento della pagina finché l'utente non
 * apre questa finestra almeno una volta.
 */
export default function SchemaImpiantoDialog({
  open,
  onClose,
  scheda,
  droppedRefs,
  collegamenti,
  onCollegamentiChange,
  preferenze,
  onPreferenzeChange,
  schema,
  onSchemaChange,
  layoutSalvato,
  onLayoutChange,
  onPreferenzeApplicateChange,
  taraturaPratica,
  onTaraturaPraticaChange,
}: SchemaImpiantoDialogProps) {
  const compressoriCodes = useMemo(() => (scheda.compressori ?? []).map((c) => c.codice), [scheda])
  const serbatoiCodes = useMemo(() => (scheda.serbatoi ?? []).map((s) => s.codice), [scheda])

  const setCollegamentoFor = (code: string, values: string[]) =>
    onCollegamentiChange({ ...collegamenti, [code]: values })

  const renderMultiValue = (selected: string[]) => selected.join(', ')

  return (
    <Dialog open={open} onClose={onClose} keepMounted maxWidth="lg" fullWidth>
      <DialogTitle>Schema d’impianto</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {droppedRefs.length > 0 && (
            <Alert severity="warning">
              Alcuni collegamenti salvati non corrispondono più ad apparecchiature presenti nella
              scheda e sono stati rimossi: {droppedRefs.join('; ')}.
            </Alert>
          )}

          <GruppoCampi
            titolo="Collegamenti compressori → serbatoi"
            spiegazione="Serve al calcolo della portata delle valvole dei serbatoi."
          >
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
              {compressoriCodes.map((code) => (
                <FormControl key={code} size="small" sx={{ width: LARGHEZZA_SELECT, ...ETICHETTA_TRONCATA }}>
                  <InputLabel id={`coll-${code}`}>{`${code} collegato a`}</InputLabel>
                  <Select
                    labelId={`coll-${code}`}
                    multiple
                    value={collegamenti[code] ?? []}
                    onChange={(e: SelectChangeEvent<string[]>) =>
                      setCollegamentoFor(
                        code,
                        typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                      )
                    }
                    input={<OutlinedInput label={`${code} collegato a`} />}
                    renderValue={renderMultiValue}
                  >
                    {serbatoiCodes.map((s) => (
                      <MenuItem key={s} value={s}>
                        <Checkbox checked={(collegamenti[code] ?? []).includes(s)} />
                        <ListItemText primary={s} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
          </GruppoCampi>

          <GruppoCampi
            titolo="Ordine e opzioni delle apparecchiature"
            spiegazione="Decide come sarà disegnato lo schema generato. Il disegno già rifinito non cambia da sé: premi «Rigenera da capo» per applicarle."
          >
            <PannelloPreferenzeSchema
              scheda={scheda}
              preferenze={preferenze}
              onChange={onPreferenzeChange}
            />
          </GruppoCampi>

          <SchemaImpiantoSection
            scheda={scheda}
            collegamentiCompressoriSerbatoi={collegamenti}
            schemaPreferenze={preferenze}
            schema={schema}
            onSchemaChange={onSchemaChange}
            layoutSalvato={layoutSalvato}
            onLayoutChange={onLayoutChange}
            onPreferenzeApplicateChange={onPreferenzeApplicateChange}
            taraturaPratica={taraturaPratica}
            onTaraturaPraticaChange={onTaraturaPraticaChange}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Chiudi</Button>
      </DialogActions>
    </Dialog>
  )
}
