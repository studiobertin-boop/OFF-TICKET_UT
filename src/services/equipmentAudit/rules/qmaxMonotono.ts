import type { Rule } from '../types'
import { checkMonotoniaPressione } from './monotoniaPressione'
import { catalogOfType } from './shared'

/**
 * Valvole di sicurezza: a parità di modello, una taratura più alta non può
 * corrispondere a una portata di scarico minore.
 *
 * Qui non si propongono correzioni automatiche: la portata di scarico dipende
 * dalla sezione di efflusso e dalla taratura insieme, e un errore di scala non
 * è l'ipotesi più probabile come per i compressori. La verifica resta manuale.
 */
export const qmaxMonotono: Rule = input =>
  checkMonotoniaPressione(catalogOfType(input.catalog, 'Valvole di sicurezza'), {
    rule: 'QMAX_NON_MONOTONO',
    direction: 'nonDecrescente',
    nomePressione: 'pressione di taratura',
    nomeCapacita: "l'aria scaricata",
    unitaPressione: 'bar',
    unitaCapacita: 'l/min',
  })
