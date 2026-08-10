import { useState, type ReactNode } from 'react'
import { Controller, useWatch, type Control } from 'react-hook-form'
import { Box, IconButton, MenuItem, Select, Tooltip } from '@mui/material'
import { Edit as EditIcon, ListAlt as ListAltIcon } from '@mui/icons-material'
import { LARGHEZZA_AZIONE, NumberCell, PAD_CELLA, TextCell, type AllineamentoCella } from './EquipmentCells'
import { useVariantiModello, valoriACatalogo } from '@/hooks/useVariantiModello'
import type { EquipmentCatalogType } from '@/types'

interface CatalogValueCellProps {
  control: Control<any>
  /** Base della riga, es. `compressori.0` oppure `serbatoi.0.valvola_sicurezza`. */
  base: string
  catalogType: EquipmentCatalogType
  /** Campo del form, relativo alla base della riga. */
  campo: string
  /** Chiave canonica del dato a catalogo da cui vengono le voci proposte. */
  specKey: string
  kind: 'number' | 'text'
  disabled?: boolean
  /** Motivo del blocco, mostrato al passaggio del mouse. */
  motivoBlocco?: string
  placeholder?: string
  /**
   * Allineamento del valore. Vale sia per l'elenco a catalogo sia per il campo libero:
   * le due rese si alternano nella stessa colonna e devono cadere sullo stesso asse.
   */
  align?: AllineamentoCella
  min?: number
  max?: number
  step?: number
}

/**
 * Il valore tiene il rientro delle altre celle su entrambi i lati, e il pulsante gli sta
 * accanto a larghezza dichiarata: è quello che permette all'intestazione di arretrare di
 * una misura nota (`PAD_TITOLO_AZIONE`) e cadere sull'asse del valore invece che su
 * quello della colonna.
 */
const selectSx = (align: AllineamentoCella) => ({
  flex: 1, minWidth: 0, fontSize: '0.82rem',
  '& .MuiSelect-select': {
    py: 0.4,
    pl: `${PAD_CELLA}px`,
    pr: `${PAD_CELLA}px !important`,
    textAlign: align,
    fontVariantNumeric: 'tabular-nums',
  },
  '& .MuiSelect-icon': { display: 'none' },
})

const bottoneSx = {
  p: 0, flex: 'none',
  width: LARGHEZZA_AZIONE, height: LARGHEZZA_AZIONE,
  '& svg': { fontSize: '0.95rem' },
} as const

/**
 * Cella di un dato che il catalogo già conosce: si sceglie fra i valori censiti per quel
 * modello, e un pulsante sblocca l'inserimento di un valore diverso.
 *
 * L'elenco viene da tutte le righe del modello, non dalla sola variante scelta nella colonna
 * PS: due varianti dello stesso compressore dichiarano portate diverse, ed è normale accorgersi
 * a metà compilazione di aver scelto la pressione sbagliata. Digitare resta possibile — è il
 * modo per censire un valore nuovo — ma passa da un gesto esplicito, così una battitura
 * distratta non introduce silenziosamente un dato che il catalogo contraddice.
 *
 * Senza modello scelto, o quando il catalogo non dichiara nulla per quel dato, non c'è elenco
 * da proporre e la cella è un campo libero fin da subito.
 */
export const CatalogValueCell = ({
  control, base, catalogType, campo, specKey, kind,
  disabled, motivoBlocco, placeholder, align = 'left', min, max, step,
}: CatalogValueCellProps) => {
  const marca = useWatch({ control, name: `${base}.marca` }) as string | undefined
  const modello = useWatch({ control, name: `${base}.modello` }) as string | undefined
  const { righe } = useVariantiModello(catalogType, marca, modello)
  const [libero, setLibero] = useState(false)

  const name = `${base}.${campo}`
  const valori = valoriACatalogo(catalogType, righe, specKey)

  const campoLibero = (
    kind === 'number'
      ? <NumberCell control={control} name={name} min={min} max={max} step={step} placeholder={placeholder} disabled={disabled} />
      : <TextCell control={control} name={name} placeholder={placeholder} disabled={disabled} align={align} />
  )

  /**
   * Il posto del pulsante resta occupato anche dove il pulsante non c'è — modello senza
   * voci a catalogo, o nessun modello ancora scelto. Senza, quelle righe spingerebbero il
   * valore fin sul bordo della cella e la colonna perderebbe l'asse proprio dove è più
   * facile accorgersene: una riga vuota accanto a una compilata.
   */
  const conAzione = (azione: ReactNode) => (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>{campoLibero}</Box>
      {azione ?? <Box sx={{ width: LARGHEZZA_AZIONE, flex: 'none' }} />}
    </Box>
  )

  if (valori.length === 0) return conAzione(null)

  if (libero) {
    return conAzione(
      <Tooltip title="Torna ai valori a catalogo">
        <IconButton size="small" sx={bottoneSx} onClick={() => setLibero(false)} aria-label="Valori a catalogo">
          <ListAltIcon />
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => {
        // Una scheda già compilata può portare un valore che a catalogo non c'è (più): resta
        // fra le voci, altrimenti aprire la scheda basterebbe a cancellarlo.
        const corrente = field.value == null || field.value === '' ? '' : String(field.value)
        const voci = corrente && !valori.some((v) => String(v) === corrente) ? [corrente, ...valori] : valori

        return (
          <Tooltip title={disabled ? (motivoBlocco ?? '') : ''} placement="top">
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Select
                value={corrente}
                disabled={disabled}
                variant="standard"
                disableUnderline
                displayEmpty
                onChange={(e) => {
                  const v = e.target.value
                  if (v === '') { field.onChange(null); return }
                  field.onChange(kind === 'number' ? Number(v) : v)
                }}
                onBlur={field.onBlur}
                renderValue={(v) =>
                  v ? String(v) : <Box component="span" sx={{ color: 'text.disabled' }}>—</Box>
                }
                sx={selectSx(align)}
              >
                <MenuItem value=""><em>—</em></MenuItem>
                {voci.map((v) => <MenuItem key={String(v)} value={String(v)}>{String(v)}</MenuItem>)}
              </Select>
              <Tooltip title="Inserisci un valore diverso da quelli a catalogo">
                <span>
                  <IconButton size="small" sx={bottoneSx} disabled={disabled} onClick={() => setLibero(true)} aria-label="Modifica il valore">
                    <EditIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Tooltip>
        )
      }}
    />
  )
}
