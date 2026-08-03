import { useState } from 'react'
import { Alert, Button, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material'
import type { EquipmentCatalogItem } from '@/types'
import { CANONICAL_SPECS } from '@/services/equipmentAudit'
import { soloCompressori, type ChiaveMassiva } from '@/utils/modificaMassiva'

interface ModificaMassivaBarProps {
  /** Righe selezionate, già risolte: la barra non interroga il database. */
  righe: EquipmentCatalogItem[]
  /** Righe selezionate in tutto, che nel modo «tutte quelle del filtro» sono più di `righe`. */
  totaleSelezionate: number
  /** Numero di righe del filtro corrente, per proporre la selezione estesa. */
  totaleFiltro: number
  onSelezionaTuttoIlFiltro: () => void
  onScegli: (chiave: ChiaveMassiva, valore: string) => void
  onAnnulla: () => void
}

const CHIAVI: ChiaveMassiva[] = ['giri', 'tipo_compressore']

/**
 * Barra della modifica massiva, sopra la tabella.
 *
 * I valori dei due menu vengono dal contratto canonico e non da costanti riscritte qui: se
 * domani si aggiunge una tipologia costruttiva, comparirà sia nel form di modifica sia qui
 * senza che nessuno debba ricordarsi di questo file.
 */
export const ModificaMassivaBar = ({
  righe,
  totaleSelezionate,
  totaleFiltro,
  onSelezionaTuttoIlFiltro,
  onScegli,
  onAnnulla,
}: ModificaMassivaBarProps) => {
  const [menu, setMenu] = useState<{ chiave: ChiaveMassiva; anchor: HTMLElement } | null>(null)

  if (totaleSelezionate === 0) return null

  const omogenea = soloCompressori(righe)
  const nonCompressori = righe.filter(r => r.tipo_apparecchiatura !== 'Compressori').length

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="body2" fontWeight={700}>
          {totaleSelezionate} {totaleSelezionate === 1 ? 'riga selezionata' : 'righe selezionate'}
        </Typography>

        {CHIAVI.map(chiave => {
          const def = (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === chiave)
          if (!def) return null
          return (
            <Button
              key={chiave}
              size="small"
              disabled={!omogenea}
              onClick={e => setMenu({ chiave, anchor: e.currentTarget })}
            >
              {def.label}
            </Button>
          )
        })}

        <Button size="small" color="inherit" onClick={onAnnulla}>
          Annulla selezione
        </Button>
      </Stack>

      {totaleFiltro > totaleSelezionate && (
        <Typography variant="caption" component="div" sx={{ mt: 1 }}>
          <Button size="small" onClick={onSelezionaTuttoIlFiltro}>
            Seleziona tutte le {totaleFiltro} righe del filtro
          </Button>
        </Typography>
      )}

      {!omogenea && (
        <Alert severity="info" sx={{ mt: 1, py: 0 }}>
          {nonCompressori > 0
            ? `Nella selezione ci sono ${nonCompressori} righe che non sono compressori: le proprietà costruttive si applicano ai soli compressori.`
            : 'Le proprietà costruttive si applicano ai soli compressori.'}
        </Alert>
      )}

      <Menu
        open={menu !== null}
        anchorEl={menu?.anchor}
        onClose={() => setMenu(null)}
      >
        {(CANONICAL_SPECS.Compressori ?? [])
          .find(d => d.key === menu?.chiave)
          ?.options?.map(o => (
            <MenuItem
              key={o}
              onClick={() => {
                onScegli(menu!.chiave, o)
                setMenu(null)
              }}
            >
              {(CANONICAL_SPECS.Compressori ?? []).find(d => d.key === menu?.chiave)?.optionLabels?.[o] ?? o}
            </MenuItem>
          ))}
      </Menu>
    </Paper>
  )
}
