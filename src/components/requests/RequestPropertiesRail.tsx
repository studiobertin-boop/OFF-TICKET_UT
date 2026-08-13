import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material'
import { Close as CloseIcon, Edit as EditIcon, Save as SaveIcon, Add as AddIcon, Remove as RemoveIcon } from '@mui/icons-material'
import { FieldValue, SectionLabel } from '@/components/common'
import { isDM329Family } from '@/utils/workflow'
import {
  STATO_FATTURA_LABELS,
  STATO_FATTURA_OPTIONS,
  type Request,
  type RequestType,
  type StatoFattura,
} from '@/types'

export interface RequestPropertiesRailProps {
  request: Request
  isDM329: boolean

  canChangeType: boolean
  requestTypes: RequestType[]
  changingType: boolean
  onChangeType: (requestTypeId: string) => void

  /** I tre campi fissi DM329 sono modificabili solo da admin e userdm329. */
  canEditDetails: boolean
  isEditingDetails: boolean
  onEditDetails: () => void
  onSaveDetails: () => void
  onCancelDetails: () => void
  saving: boolean
  noCivaValue: boolean
  setNoCivaValue: (v: boolean) => void
  offCacValue: 'off' | 'cac' | ''
  setOffCacValue: (v: 'off' | 'cac' | '') => void
  statoFatturaValue: StatoFattura
  setStatoFatturaValue: (v: StatoFattura) => void

  showIncompleteCustomer: boolean
  onCompleteCustomer: () => void

  /** "X Fattura": visibile e modificabile solo da admin, sia su DM329 sia su richieste generali. */
  isAdmin: boolean
  xFattura: number
  savingXFattura: boolean
  onChangeXFattura: (delta: 1 | -1) => void
}

/**
 * Colonna delle proprietà della pratica: tutto ciò che si legge a colpo d'occhio
 * e si cambia raramente. Prima era sparso fra l'HERO ("Attribuita a"), un blocco
 * isolato in cima alla colonna sinistra (Tipo richiesta) e il riquadro "Dettagli
 * richiesta" a metà pagina.
 *
 * Lo stato non compare qui: lo dicono già chip e stepper nell'intestazione.
 */
export const RequestPropertiesRail = ({
  request,
  isDM329,
  canChangeType,
  requestTypes,
  changingType,
  onChangeType,
  canEditDetails,
  isEditingDetails,
  onEditDetails,
  onSaveDetails,
  onCancelDetails,
  saving,
  noCivaValue,
  setNoCivaValue,
  offCacValue,
  setOffCacValue,
  statoFatturaValue,
  setStatoFatturaValue,
  showIncompleteCustomer,
  onCompleteCustomer,
  isAdmin,
  xFattura,
  savingXFattura,
  onChangeXFattura,
}: RequestPropertiesRailProps) => {
  // Solo i tre campi fissi DM329 si modificano da qui: le richieste ordinarie
  // hanno campi dinamici da fields_schema, troppo larghi per una colonna stretta,
  // e restano nel pannello Dettagli.
  const modificabileQui = isDM329 && canEditDetails

  return (
    <Card>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionLabel>Proprietà</SectionLabel>
          {modificabileQui && !isEditingDetails && (
            <IconButton size="small" color="primary" onClick={onEditDetails} title="Modifica dettagli">
              <EditIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {canChangeType ? (
          <FormControl size="small" fullWidth>
            <InputLabel id="tipo-richiesta-label">Tipo richiesta</InputLabel>
            <Select
              labelId="tipo-richiesta-label"
              label="Tipo richiesta"
              value={request.request_type_id}
              disabled={changingType}
              onChange={(e) => onChangeType(e.target.value)}
            >
              {requestTypes.filter(t => isDM329Family(t.name)).map(t => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <FieldValue label="Tipo richiesta" value={request.request_type?.name} />
        )}

        {isDM329 && (
          <FieldValue label="Attribuita a" value={request.attributed_user?.full_name} />
        )}

        {isDM329 && (isEditingDetails ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="no-civa-label">No CIVA</InputLabel>
              <Select
                labelId="no-civa-label"
                label="No CIVA"
                value={noCivaValue ? 'true' : 'false'}
                onChange={(e) => setNoCivaValue(e.target.value === 'true')}
              >
                <MenuItem value="false">No</MenuItem>
                <MenuItem value="true">Sì</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="off-cac-label">Off / Cac</InputLabel>
              <Select
                labelId="off-cac-label"
                label="Off / Cac"
                value={offCacValue}
                onChange={(e) => setOffCacValue(e.target.value as 'off' | 'cac' | '')}
              >
                <MenuItem value=""><em>Nessuno</em></MenuItem>
                <MenuItem value="off">OFF</MenuItem>
                <MenuItem value="cac">CAC</MenuItem>
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel id="stato-fattura-label">Stato fattura</InputLabel>
              <Select
                labelId="stato-fattura-label"
                label="Stato fattura"
                value={statoFatturaValue}
                onChange={(e) => setStatoFatturaValue(e.target.value as StatoFattura)}
              >
                {STATO_FATTURA_OPTIONS.map((opt) => (
                  <MenuItem key={opt} value={opt}>{STATO_FATTURA_LABELS[opt]}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" variant="contained" startIcon={<SaveIcon />} onClick={onSaveDetails} disabled={saving}>
                Salva
              </Button>
              <Button size="small" variant="outlined" startIcon={<CloseIcon />} onClick={onCancelDetails} disabled={saving}>
                Annulla
              </Button>
            </Box>
          </Box>
        ) : (
          <>
            <FieldValue label="No CIVA" value={request.custom_fields?.no_civa ? 'Sì' : 'No'} />
            <FieldValue
              label="Off / Cac"
              value={request.custom_fields?.off_cac ? String(request.custom_fields.off_cac).toUpperCase() : undefined}
            />
            <FieldValue
              label="Stato fattura"
              value={STATO_FATTURA_LABELS[(request.custom_fields?.stato_fattura as StatoFattura) || 'NO']}
            />
          </>
        ))}

        {isAdmin && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
              X Fattura
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => onChangeXFattura(-1)}
                disabled={savingXFattura || xFattura <= 1}
                title="Diminuisci"
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
              <Typography variant="body2" sx={{ minWidth: '1.5em', textAlign: 'center' }}>
                {xFattura}
              </Typography>
              <IconButton
                size="small"
                onClick={() => onChangeXFattura(1)}
                disabled={savingXFattura || xFattura >= 10}
                title="Aumenta"
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}

        {showIncompleteCustomer && (
          <Alert
            severity="info"
            sx={{ mt: 0.5, py: 0.25, '& .MuiAlert-message': { py: 0.75 } }}
            action={
              <Button color="inherit" size="small" onClick={onCompleteCustomer}>
                Completa
              </Button>
            }
          >
            Anagrafica cliente incompleta
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
