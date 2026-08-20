/**
 * CIVAApparecchioColumn Component
 *
 * Visualizza i dati di un'apparecchiatura CIVA in una tabella stretta a due colonne
 * (etichetta/valore), nell'ordine esatto del modulo dati CIVA del portale INAIL.
 * Ogni riga è copiabile con un clic, per il copia/incolla verso il portale.
 */

import { useState } from 'react'
import { Card, CardContent, Typography, Box, Chip, IconButton } from '@mui/material'
import {
  ContentCopy as ContentCopyIcon,
  Check as CheckIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon
} from '@mui/icons-material'
import type { CIVAApparecchio } from '@/types/civa'
import type { Customer, Installer } from '@/types'
import { parseIndirizzo } from '@/utils/parseIndirizzo'

interface CIVAApparecchioColumnProps {
  apparecchio: CIVAApparecchio
  customer: Customer
  installer: Installer
  /** Indirizzo impianto già risolto dal chiamante (sorgente: requests.indirizzo_impianto). */
  indirizzoImpianto: string
  /** True se l'apparecchio è fra quelli sottoposti a verifica spessimetrica (requests.additional_info.spessimetrica). */
  verificaIntegrita: boolean
  /** Larghezza fissa della card (px). Di default quella che contiene esattamente le due colonne di dati. */
  width?: number
  /** Frecce per sfogliare l'apparecchiatura precedente/successiva, integrate nell'intestazione. Omesse (es. in stampa) se non passate. */
  nav?: { onPrev: () => void; onNext: () => void; enabled: boolean }
}

interface RowData {
  label: string
  value: string | number | undefined | null
}

interface SectionData {
  title: string
  rows: RowData[]
}

const DASH = '—'

/**
 * Riga etichetta/valore. Il clic copia il valore negli appunti: la pagina va usata
 * affiancata al form CIVA, quindi la copia rapida vale più della sola leggibilità.
 */
const Row = ({ label, value, rowKey, copiedKey, onCopy }: {
  label: string
  value: string | number | undefined | null
  rowKey: string
  copiedKey: string | null
  onCopy: (key: string, value: string) => void
}) => {
  const hasValue = value !== undefined && value !== null && value !== ''
  const display = hasValue ? String(value) : DASH
  const copied = copiedKey === rowKey

  return (
    <Box
      onClick={hasValue ? () => onCopy(rowKey, display) : undefined}
      sx={{
        display: 'grid',
        gridTemplateColumns: '113px 187px 18px',
        alignItems: 'baseline',
        gap: 0.75,
        py: 0.5,
        px: 0.5,
        borderBottom: '1px solid',
        borderColor: 'divider',
        cursor: hasValue ? 'pointer' : 'default',
        '&:hover': hasValue ? { bgcolor: 'action.hover' } : undefined,
        '&:hover .civa-copy-icon': { opacity: hasValue ? 1 : 0 }
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ fontWeight: 600, overflowX: 'auto', whiteSpace: 'nowrap', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontFamily: 'monospace',
          fontSize: '0.8rem',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          color: hasValue ? 'text.primary' : 'text.disabled',
          fontStyle: hasValue ? 'normal' : 'italic'
        }}
      >
        {display}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {copied ? (
          <CheckIcon sx={{ fontSize: 14, color: 'success.main' }} />
        ) : (
          <ContentCopyIcon className="civa-copy-icon" sx={{ fontSize: 13, color: 'text.disabled', opacity: 0 }} />
        )}
      </Box>
    </Box>
  )
}

const Section = ({ section, copiedKey, onCopy }: {
  section: SectionData
  copiedKey: string | null
  onCopy: (key: string, value: string) => void
}) => (
  <Box sx={{ mt: 1.75 }}>
    <Typography
      variant="overline"
      sx={{
        display: 'block',
        color: 'primary.main',
        borderBottom: '1.5px solid',
        borderColor: 'primary.main',
        pb: 0.5,
        mb: 0.25
      }}
    >
      {section.title}
    </Typography>
    {section.rows.map(row => (
      <Row
        key={row.label}
        label={row.label}
        value={row.value}
        rowKey={`${section.title}::${row.label}`}
        copiedKey={copiedKey}
        onCopy={onCopy}
      />
    ))}
  </Box>
)

export const CIVAApparecchioColumn = ({
  apparecchio,
  customer,
  installer,
  indirizzoImpianto,
  verificaIntegrita,
  width = 362,
  nav
}: CIVAApparecchioColumnProps) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const { manufacturer } = apparecchio

  const impiantoAddress = parseIndirizzo(indirizzoImpianto)
  const badgeColor = apparecchio.tipoPratica === 'DICHIARAZIONE' ? 'info' : 'warning'

  const identificazione = [
    apparecchio.tipo,
    [apparecchio.marca, apparecchio.modello].filter(Boolean).join(' '),
    apparecchio.n_fabbrica ? `N. fabbrica ${apparecchio.n_fabbrica}` : ''
  ]
    .filter(Boolean)
    .join(' · ')

  const costruttoreRows: RowData[] = manufacturer.is_estero
    ? [
        { label: 'Ragione sociale', value: manufacturer.nome },
        { label: 'Paese', value: manufacturer.paese }
      ]
    : [
        { label: 'P.IVA', value: manufacturer.partita_iva },
        { label: 'Ragione sociale', value: manufacturer.nome },
        { label: 'Indirizzo', value: manufacturer.via },
        { label: 'Civico', value: manufacturer.numero_civico },
        { label: 'Provincia', value: manufacturer.provincia },
        { label: 'Comune', value: manufacturer.comune },
        { label: 'CAP', value: manufacturer.cap },
        { label: 'Telefono', value: manufacturer.telefono }
      ]

  const sections: SectionData[] = [
    {
      title: 'Proprietario / Cliente',
      rows: [
        { label: 'PEC', value: customer.pec },
        { label: 'E-mail secondaria', value: undefined },
        { label: 'Tel. contatto', value: customer.telefono }
      ]
    },
    {
      title: 'Costruttore',
      rows: costruttoreRows
    },
    {
      title: 'Installatore',
      rows: [
        { label: 'P.IVA', value: installer.partita_iva },
        { label: 'Ragione sociale', value: installer.nome },
        { label: 'Indirizzo', value: installer.via },
        { label: 'Civico', value: installer.numero_civico },
        { label: 'Provincia', value: installer.provincia },
        { label: 'Comune', value: installer.comune },
        { label: 'CAP', value: installer.cap },
        { label: 'Telefono', value: installer.telefono }
      ]
    },
    {
      title: 'Ubicazione apparecchio',
      rows: [
        { label: 'Indirizzo', value: impiantoAddress.via },
        { label: 'Civico', value: impiantoAddress.numero_civico },
        { label: 'Provincia', value: impiantoAddress.provincia },
        { label: 'Comune', value: impiantoAddress.comune },
        { label: 'CAP', value: impiantoAddress.cap }
      ]
    },
    {
      title: 'Dati tecnici',
      rows: [
        { label: 'Verifica integrità', value: verificaIntegrita ? 'SI' : 'NO' },
        { label: 'N. fabbrica', value: apparecchio.n_fabbrica },
        { label: 'PS (bar)', value: apparecchio.ps_pressione_max },
        { label: 'TS (°C)', value: apparecchio.ts_temperatura },
        { label: 'Vol (L)', value: apparecchio.volume },
        { label: 'Categoria', value: apparecchio.categoria_ped }
      ]
    }
  ]

  const handleCopy = (key: string, value: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {})
    }
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey(current => (current === key ? null : current)), 1100)
  }

  return (
    <Card
      className="civa-column"
      sx={{
        width,
        height: 'fit-content',
        border: '1px solid',
        borderColor: 'divider',
        '@media print': {
          width: 180,
          minWidth: 180,
          maxWidth: 180,
          pageBreakInside: 'avoid',
          fontSize: '9pt'
        }
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header: Codice + Badge + navigazione + identificazione */}
        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.75rem', lineHeight: 1.1 }}>
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
            {nav && (
              <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
                <IconButton size="small" onClick={nav.onPrev} disabled={!nav.enabled} aria-label="Apparecchio precedente">
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={nav.onNext} disabled={!nav.enabled} aria-label="Apparecchio successivo">
                  <ChevronRightIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
          </Box>
          {identificazione && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {identificazione}
            </Typography>
          )}
        </Box>

        {sections.map(section => (
          <Section key={section.title} section={section} copiedKey={copiedKey} onCopy={handleCopy} />
        ))}
      </CardContent>
    </Card>
  )
}
