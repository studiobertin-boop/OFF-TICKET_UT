import { Controller, useWatch, type Control } from 'react-hook-form'
import type { ReactNode } from 'react'
import { ComputedCell, NumberCell, SelectCell, TextCell } from './EquipmentCells'
import { CatalogValueCell } from './CatalogValueCell'
import { PressioneCatalogCell } from './PressioneCatalogCell'
import { EquipmentAutocomplete } from '../EquipmentAutocomplete'
import { capacityKey, variantSpecKey } from '@/services/equipmentAudit'
import type { EquipmentCatalogItem, CategoriaPED } from '@/types'
import type { AdvKey, EquipmentTypeDef } from './equipmentConfig'

export const PED_OPTIONS: CategoriaPED[] = ['I', 'II', 'III', 'IV']

/**
 * Le colonne condivise di una riga di apparecchiatura, montate una volta sola.
 *
 * La riga di tabella e la finestra dei dettagli mostrano gli stessi campi con due
 * densità diverse: definirli qui è quello che impedisce alle due rese di divergere —
 * un blocco che vale in tabella ma non nella finestra è un dato che entra in scheda da
 * una porta di servizio.
 */
interface CellePrincipaliArgs {
  control: Control<any>
  def: EquipmentTypeDef
  /** Base della riga nel form, es. `compressori.0` o `serbatoi.0.valvola_sicurezza`. */
  base: string
  /** Colonne avanzate visibili: a `tecnicoDM329` alcune non si mostrano. */
  adv: boolean
  /** Applica al form i dati tecnici della voce scelta a catalogo. */
  onSelected: (specs: Record<string, any>, item?: EquipmentCatalogItem) => void
  /** Dove disegnare il pulsante «aggiungi al catalogo»; solo la tabella ne ha una colonna. */
  contenitoreAggiunta?: HTMLElement | null
}

export interface CellePrincipali {
  /** Vero quando il tipo non prevede quella colonna, o il ruolo non la vede. */
  nascosta: (k: AdvKey) => boolean
  /** Marca e modello: un solo componente, perché il modello dipende dalla marca. */
  marcaModello: (dense: boolean) => ReactNode
  /** Sola marca, per i tipi a cui il ruolo non mostra il modello. */
  soloMarca: ReactNode
  ps: ReactNode | null
  capacita: ReactNode | null
  ts: ReactNode | null
  cat: ReactNode | null
  anno: ReactNode
  nf: ReactNode
}

export const useCellePrincipali = ({
  control, def, base, adv, onSelected, contenitoreAggiunta,
}: CellePrincipaliArgs): CellePrincipali => {
  /**
   * Il catalogo distingue le righe di questo tipo per pressione: la colonna PS diventa un
   * selettore sui valori esistenti, ed è la scelta della pressione — non quella del
   * modello — ad autocompilare capacità, TS e categoria.
   */
  const perVariante = variantSpecKey(def.catalogType) !== null

  const nascosta = (k: AdvKey) => (def.adv?.includes(k) ?? false) && !adv

  /**
   * Valore che identifica la variante di questa riga: è la pressione della colonna PS/Ptar.
   * Serve al pulsante «aggiungi al catalogo» per distinguere «modello mancante» da
   * «modello presente ma non a questa pressione».
   */
  const variantePs = useWatch({
    control,
    name: def.pressioneField ? `${base}.${def.pressioneField}` : `${base}.__noPs`,
  })
  const valoriRiga = useWatch({ control, name: base })

  /**
   * La capacità si compila dopo la PS, perché è la PS a dire di quale variante del modello
   * si tratta: lo stesso compressore rende portate diverse a pressioni diverse.
   *
   * Il blocco vale solo se la colonna PS è davvero visibile: a `tecnicoDM329` è nascosta su
   * serbatoi, disoleatori, essiccatori e scambiatori, e senza questa condizione la capacità
   * gli resterebbe disabilitata per sempre.
   */
  const capacitaBloccata = !!def.pressioneField && !nascosta('pressione') && variantePs == null

  const marcaModello = (dense: boolean) => (
    <Controller name={`${base}.marca`} control={control} render={({ field: m }) => (
      <Controller name={`${base}.modello`} control={control} render={({ field: mo }) => (
        <EquipmentAutocomplete
          equipmentType={def.catalogType}
          dense={dense}
          marcaValue={m.value || ''}
          modelloValue={mo.value || ''}
          onMarcaChange={m.onChange}
          onModelloChange={mo.onChange}
          onEquipmentSelected={perVariante ? undefined : onSelected}
          variantValue={typeof variantePs === 'number' ? variantePs : null}
          rowValues={valoriRiga}
          contenitoreAggiunta={contenitoreAggiunta}
          size="small"
          fullWidth
        />
      )} />
    )} />
  )

  const ps = def.pressioneField && !nascosta('pressione')
    ? (perVariante
        ? <PressioneCatalogCell control={control} base={base} catalogType={def.catalogType}
            pressioneField={def.pressioneField} onSelected={onSelected} min={0} max={100} step={0.1} />
        : <NumberCell control={control} name={`${base}.${def.pressioneField}`} min={0} max={100} step={0.1} />)
    : null

  const capacita = def.capacitaField && !nascosta('capacita')
    ? <CatalogValueCell control={control} base={base} catalogType={def.catalogType}
        campo={def.capacitaField} specKey={capacityKey(def.catalogType)} kind="number" align="right"
        disabled={capacitaBloccata} motivoBlocco="Compila prima la PS"
        min={0} max={100000} step={1} />
    : null

  const ts = def.ts && !nascosta('ts')
    ? <CatalogValueCell control={control} base={base} catalogType={def.catalogType}
        campo="ts" specKey="ts" kind="text" align="center" placeholder="°C / ÷" />
    : null

  const cat = nascosta('cat') || def.cat === false
    ? null
    : def.cat === 'IV'
      ? <ComputedCell value="IV" />
      : <SelectCell control={control} name={`${base}.categoria_ped`} options={PED_OPTIONS} />

  return {
    nascosta,
    marcaModello,
    soloMarca: <TextCell control={control} name={`${base}.marca`} placeholder="Marca" />,
    ps,
    capacita,
    ts,
    cat,
    anno: <NumberCell control={control} name={`${base}.anno`} min={1980} max={2100} />,
    nf: <TextCell control={control} name={`${base}.n_fabbrica`} placeholder="N° fabbrica" />,
  }
}
