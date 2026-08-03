import { useState } from 'react'
import { Alert, Button, Menu, MenuItem, Paper, Stack, Typography } from '@mui/material'
import type { EquipmentCatalogItem } from '@/types'
import { CANONICAL_SPECS } from '@/services/equipmentAudit'
import { conta, etichettaValore, soloCompressori, type ChiaveMassiva } from '@/utils/modificaMassiva'

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
  // Il menu aperto individua un'unica definizione: la si legge una volta sola, invece di
  // interrogare due volte il contratto canonico — una per le opzioni, una per le etichette.
  const menuDef = menu ? (CANONICAL_SPECS.Compressori ?? []).find(d => d.key === menu.chiave) : undefined

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
            ? `${conta(nonCompressori, 'riga non è un compressore', 'righe non sono compressori')} nella selezione: le proprietà costruttive si applicano ai soli compressori. Filtra per tipo «Compressori» o toglile dalla selezione.`
            : 'Le proprietà costruttive si applicano ai soli compressori.'}
        </Alert>
      )}

      <Menu
        open={menu !== null}
        anchorEl={menu?.anchor}
        onClose={() => setMenu(null)}
      >
        {menuDef?.options?.map(o => (
          <MenuItem
            key={o}
            onClick={() => {
              onScegli(menu!.chiave, o)
              setMenu(null)
            }}
          >
            {etichettaValore(menu!.chiave, o)}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  )
}
