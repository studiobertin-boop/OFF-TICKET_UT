/**
 * CIVAApparecchioColumn Component
 *
 * Visualizza i dati di un'apparecchiatura CIVA in formato colonna verticale
 */

import { Card, CardContent, Typography, Box, Chip, Divider } from '@mui/material'
import type { CIVAApparecchio } from '@/types/civa'
import type { Customer, Installer, DatiImpianto } from '@/types'

interface CIVAApparecchioColumnProps {
  apparecchio: CIVAApparecchio
  customer: Customer
  installer: Installer
  impianto: DatiImpianto
}

/**
 * Field Display Component - Inline layout with larger value text
 */
const Field = ({ label, value }: { label: string; value: string | number | undefined | null }) => {
  if (value === undefined || value === null || value === '') {
    return null
  }

  return (
    <Box sx={{ mb: 0.5, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
        {label}:
      </Typography>
      <Typography variant="body1" sx={{ fontSize: '0.95rem' }}>
        {value}
      </Typography>
    </Box>
  )
}

/**
 * Section Header Component
 */
const SectionHeader = ({ title }: { title: string }) => (
  <Typography
    variant="subtitle2"
    sx={{
      fontWeight: 700,
      mt: 1.5,
      mb: 0.75,
      borderBottom: '2px solid',
      borderColor: 'primary.main',
      pb: 0.25
    }}
  >
    {title}
  </Typography>
)

/**
 * Parse address from string format
 * Expected format: "Via, 123 - 12345 Città (PR)"
 */
function parseAddress(address: string): {
  via: string
  numero_civico: string
  cap: string
  comune: string
  provincia: string
} {
  // Default empty values
  const result = {
    via: '',
    numero_civico: '',
    cap: '',
    comune: '',
    provincia: ''
  }

  if (!address || address.trim() === '') {
    return result
  }

  // Try to parse structured address
  // Pattern: "Via Name, 123 - 12345 City (PR)"
  const match = address.match(/^(.+?),\s*(.+?)\s*-\s*(\d{5})\s+(.+?)\s*\(([A-Z]{2})\)$/)

  if (match) {
    const [, via, numero_civico, cap, comune, provincia] = match
    return {
      via: via.trim(),
      numero_civico: numero_civico.trim(),
      cap: cap.trim(),
      comune: comune.trim(),
      provincia: provincia.trim()
    }
  }

  // Fallback: just return full address in via field
  return {
    ...result,
    via: address
  }
}

export const CIVAApparecchioColumn = ({
  apparecchio,
  customer,
  installer,
  impianto
}: CIVAApparecchioColumnProps) => {
  const { manufacturer } = apparecchio

  // Parse impianto address
  const impiantoAddress = parseAddress(impianto.sede_impianto || '')

  // Badge color based on tipo pratica
  const badgeColor = apparecchio.tipoPratica === 'DICHIARAZIONE' ? 'info' : 'warning'

  return (
    <Card
      className="civa-column"
      sx={{
        minWidth: 300,
        maxWidth: 320,
        height: 'fit-content',
        border: '1px solid',
        borderColor: 'divider',
        '@media print': {
          minWidth: 180,
          maxWidth: 180,
          pageBreakInside: 'avoid',
          fontSize: '9pt'
        }
      }}
    >
      <CardContent>
        {/* Header: Codice + Badge */}
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            {apparecchio.codice}
          </Typography>
          <Chip
            label={apparecchio.tipoPratica}
            color={badgeColor}
            size="small"
            sx={{ fontWeight: 600 }}
            className={`tipo-pratica-${apparecchio.tipoPratica.toLowerCase()}`}
          />
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        {/* Section: APPARECCHIO */}
        <SectionHeader title="APPARECCHIO" />
        <Field label="Tipo" value={apparecchio.tipo} />
        <Field label="Marca" value={apparecchio.marca} />
        <Field label="Modello" value={apparecchio.modello} />
        <Field label="N. Fabbrica/Serie" value={apparecchio.n_fabbrica} />
        <Field label="Anno" value={apparecchio.anno} />
        <Field label="PS (bar)" value={apparecchio.ps_pressione_max} />
        <Field label="V (litri)" value={apparecchio.volume} />
        <Field label="TS (°C)" value={apparecchio.ts_temperatura} />
        <Field label="Categoria PED" value={apparecchio.categoria_ped} />

        {/* Section: CLIENTE */}
        <SectionHeader title="CLIENTE" />
        <Field label="Ragione Sociale" value={customer.ragione_sociale} />
        <Field label="PEC" value={customer.pec} />
        <Field label="Telefono" value={customer.telefono} />

        {/* Section: COSTRUTTORE */}
        <SectionHeader title="COSTRUTTORE" />
        {manufacturer.is_estero ? (
          <>
            <Field label="Nome" value={manufacturer.nome} />
            <Field label="Paese" value={manufacturer.paese} />
          </>
        ) : (
          <>
            <Field label="Nome" value={manufacturer.nome} />
            <Field label="Partita IVA" value={manufacturer.partita_iva} />
            <Field label="Via" value={manufacturer.via} />
            <Field label="Numero Civico" value={manufacturer.numero_civico} />
            <Field label="CAP" value={manufacturer.cap} />
            <Field label="Comune" value={manufacturer.comune} />
            <Field label="Provincia" value={manufacturer.provincia} />
            <Field label="Telefono" value={manufacturer.telefono} />
          </>
        )}

        {/* Section: INSTALLATORE */}
        <SectionHeader title="INSTALLATORE" />
        <Field label="Ragione Sociale" value={installer.nome} />
        <Field label="Partita IVA" value={installer.partita_iva} />
        <Field label="Via" value={installer.via} />
        <Field label="Numero Civico" value={installer.numero_civico} />
        <Field label="CAP" value={installer.cap} />
        <Field label="Comune" value={installer.comune} />
        <Field label="Provincia" value={installer.provincia} />

        {/* Section: IMPIANTO */}
        <SectionHeader title="IMPIANTO" />
        <Field label="Indirizzo" value={impiantoAddress.via} />
        <Field label="Numero Civico" value={impiantoAddress.numero_civico} />
        <Field label="CAP" value={impiantoAddress.cap} />
        <Field label="Comune" value={impiantoAddress.comune} />
        <Field label="Provincia" value={impiantoAddress.provincia} />
      </CardContent>
    </Card>
  )
}
