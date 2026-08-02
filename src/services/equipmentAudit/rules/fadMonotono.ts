import type { Rule } from '../types'
import { checkMonotoniaPressione } from './monotoniaPressione'
import { catalogOfType } from './shared'

/**
 * Compressori: a parità di modello, chi lavora a pressione più alta non può
 * produrre più aria.
 *
 * Gli errori tipici sono di ordine di grandezza — uno zero perso in fase di
 * inserimento — quindi la correzione automatica è ammessa quando riscalare una
 * sola riga di un fattore dieci rimette in ordine tutta la serie.
 */
export const fadMonotono: Rule = input =>
  checkMonotoniaPressione(catalogOfType(input.catalog, 'Compressori'), {
    rule: 'FAD_NON_MONOTONO',
    direction: 'nonCrescente',
    nomePressione: 'pressione di esercizio',
    nomeCapacita: "l'aria prodotta",
    unitaPressione: 'bar',
    unitaCapacita: 'l/min',
  })
