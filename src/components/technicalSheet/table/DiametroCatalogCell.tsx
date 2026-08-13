import { Controller, useWatch, type Control } from 'react-hook-form'
import { Autocomplete, Box, TextField } from '@mui/material'
import { DIAMETRO_VALVOLA_OPTIONS, readSpec } from '@/services/equipmentAudit'
import { useVariantiModello } from '@/hooks/useVariantiModello'
import { useNoAutofillToken } from '@/utils/noAutofill'
import type { EquipmentCatalogItem } from '@/types'

/**
 * Cella del diametro della valvola di sicurezza: sceglie la variante, come fa la colonna Ptar.
 *
 * A catalogo lo stesso modello di valvola esiste in più diametri, e a parità di taratura è
 * l'attacco a dire quale — con la portata scaricata che ne dipende. Il campo era testo libero, e
 * a testo libero il diametro non poteva distinguere niente: le stesse righe di produzione
 * portavano «3/8» e «3/8''» sullo stesso attacco.
 *
 * L'elenco è la scala commerciale intera, non i soli diametri censiti: chi compila deve poter
 * dichiarare l'attacco che ha davanti anche quando il catalogo non lo conosce ancora — è il
 * modo per censire una variante nuova, come per la Ptar. Le voci che il catalogo conosce
 * portano accanto la portata, che è ciò che si guadagna a sceglierle: quella scelta autocompila
 * i dati della variante.
 */
interface DiametroCatalogCellProps {
  control: Control<any>
  /** Base della riga, es. `serbatoi.0.valvola_sicurezza`. */
  base: string
  /** Applica gli specs della variante scelta ai campi della riga. */
  onSelected?: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void
}

const CATALOG_TYPE = 'Valvole di sicurezza' as const

interface VoceDiametro {
  diametro: string
  /** La riga di catalogo che dichiara questo diametro; assente se solo scala commerciale. */
  item?: EquipmentCatalogItem
  etichetta: string
}

export const DiametroCatalogCell = ({ control, base, onSelected }: DiametroCatalogCellProps) => {
  const marca = useWatch({ control, name: `${base}.marca` }) as string | undefined
  const modello = useWatch({ control, name: `${base}.modello` }) as string | undefined
  const ptar = useWatch({ control, name: `${base}.pressione_taratura` }) as number | undefined
  const { varianti } = useVariantiModello(CATALOG_TYPE, marca, modello)
  const ac = useNoAutofillToken()

  /**
   * Le varianti che valgono per la taratura corrente. Senza taratura scelta valgono tutte:
   * il tecnico può compilare i due campi nell'ordine che preferisce, e un elenco vuoto
   * finché non compila l'altro campo si legge come «il catalogo non sa niente».
   */
  const perDiametro = new Map<string, EquipmentCatalogItem>()
  for (const v of varianti) {
    if (ptar != null && v.value !== ptar) continue
    const d = readSpec(CATALOG_TYPE, v.item.specs, 'diametro')
    if (d === null || d === '') continue
    if (!perDiametro.has(String(d))) perDiametro.set(String(d), v.item)
  }

  const qmaxDi = (item: EquipmentCatalogItem) => readSpec(CATALOG_TYPE, item.specs, 'qmax')

  const voci: VoceDiametro[] = DIAMETRO_VALVOLA_OPTIONS.map((d) => {
    const item = perDiametro.get(d)
    const qmax = item ? qmaxDi(item) : null
    return { diametro: d, item, etichetta: qmax === null ? d : `${d} · ${qmax} l/min` }
  })

  // I diametri già scritti con una grafia che la scala non prevede restano scegliibili: sono
  // righe di catalogo vere, e toglierle dall'elenco le renderebbe irraggiungibili.
  for (const [d, item] of perDiametro) {
    if (voci.some((v) => v.diametro === d)) continue
    const qmax = qmaxDi(item)
    voci.push({ diametro: d, item, etichetta: qmax === null ? d : `${d} · ${qmax} l/min` })
  }

  return (
    <Controller
      name={`${base}.diametro`}
      control={control}
      render={({ field }) => (
        <Autocomplete
          freeSolo
          fullWidth
          openOnFocus
          disableClearable
          forcePopupIcon={false}
          size="small"
          value={field.value == null ? '' : String(field.value)}
          options={voci}
          getOptionLabel={(o) =>
            o === null || o === undefined || o === '' ? '' : typeof o === 'object' ? o.diametro : String(o)
          }
          // Con `freeSolo` il valore corrente resta la stringa del form, non una voce: il
          // confronto con l'opzione passa dal diametro, che è ciò che il campo memorizza.
          isOptionEqualToValue={(o, v) => o.diametro === (v as unknown as string)}
          onChange={(_e, v) => {
            if (v === null || (v as any) === '') { field.onChange(null); return }
            if (typeof v === 'object') {
              field.onChange(v.diametro)
              if (v.item?.specs) onSelected?.(v.item.specs as Record<string, any>, v.item)
              return
            }
            field.onChange(v)
            const scelta = voci.find((o) => o.diametro === v)
            if (scelta?.item?.specs) onSelected?.(scelta.item.specs as Record<string, any>, scelta.item)
          }}
          /* Il campo svuotato vale `null` e non `undefined`: per react-hook-form quest'ultimo è
             un campo mai valorizzato, e alla lettura ne ripescherebbe il default — il diametro
             che c'era prima. Stessa ragione documentata in `NumberCell`. */
          onInputChange={(_e, v, reason) => {
            if (reason !== 'input') return
            field.onChange(v === '' ? null : v)
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="standard"
              placeholder={marca && modello ? 'Diametro' : 'Prima il modello'}
              InputProps={{ ...params.InputProps, disableUnderline: true }}
              inputProps={{ ...params.inputProps, autoComplete: ac }}
            />
          )}
          renderOption={(props, option) => {
            // La chiave che MUI deriva dall'etichetta può ripetersi fra scala commerciale e
            // righe di catalogo con grafia diversa: si usa il diametro, che è unico.
            const rest = { ...props }
            delete (rest as any).key
            return (
              <Box component="li" key={option.diametro} {...rest}>
                {option.etichetta}
              </Box>
            )
          }}
        />
      )}
    />
  )
}
