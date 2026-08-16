import type { EquipmentCatalogItem } from '@/types'

/**
 * Le marche presenti a catalogo in produzione al 2026-08-16.
 *
 * Serve al test di coerenza della mappa famiglie: una marca rinominata o scritta con un
 * refuso deve emergere come test rosso, non degradare il matching in silenzio.
 */
export const MARCHE_A_CATALOGO = [
  'KAESER KOMPRESSOREN SE', 'CECCATO ARIA COMPRESSA S.R.L.', 'A.ARIA C S.r.l. (ABAC)',
  'AIR COM S.r.l.', 'A.S.T.R.A. REFRIGERANTI S.R.L.', 'SIAP sas', 'SICC TECH s.r.l.',
  'SICC S.p.A.', 'SICC S.r.L.', 'WORTHINGTON-CREYSSENSAC', 'FRIULAIR S.r.l.',
  'ATLAS COPCO AIRPOWER N.V.', 'PARISE COMPRESSORI SRL', 'POWER SYSTEM SRL',
  'FINI - FNA S.p.A.', 'CO.INOX S.r.l.', 'S.E.A. S.p.A.', 'BOTTARINI SPA', 'COMPAIR',
  'BEHALTER-WERK BURGAU GMBH', 'EURE SHANGHAI MACHINERY EQUIPMENT Co. Ltd.',
  'BEKO TECHNOLOGIES S.r.l.', 'CORDIVARI S.r.l.', 'CSC srl', 'ELBI S.p.A.', 'SICC TECH',
  'ZANI s.r.l.', 'AIRTEAMS - AIR.COMP', 'ALUP KOMPRESSOREN', 'FIAC', 'INGERSOLL-RAND CO.LTD',
  'KTC s.r.l.', 'MANNESMANN DEMAG', 'BOMECA srl', 'EFEREST GmbH', 'ZEIDLER & UHL',
  'FIAC AIR COMPRESSORS S.p.A.',
]

const riga = (
  id: string, marca: string, modello: string,
  specs: Record<string, any>, usage_count = 0
): EquipmentCatalogItem => ({
  id, tipo: '', marca, modello, specs, usage_count,
  is_active: true, is_user_defined: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
})

/**
 * Serbatoi SICC realmente a catalogo, famiglia «12783».
 *
 * Due proprietà di questo insieme guidano il matching e vanno conservate copiandolo:
 * `500 - 12783` esiste sotto tre ragioni sociali con specs identiche, e `SICC TECH s.r.l.`
 * ne ha due righe proprie (`500-12783` e `500 - 12783`) che differiscono solo per il
 * separatore.
 */
export const SERBATOI_SICC: EquipmentCatalogItem[] = [
  riga('sicc-tech-500-nospazi', 'SICC TECH s.r.l.', '500-12783',   { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }),
  riga('sicc-tech-500',         'SICC TECH s.r.l.', '500 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }, 3),
  riga('sicc-tech-725',         'SICC TECH s.r.l.', '725 - 12783', { ps: 11, ts: 120,          volume: 725, categoria_ped: 'IV' }, 1),
  riga('sicc-tech-270',         'SICC TECH s.r.l.', '270 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 270, categoria_ped: 'III' }),
  riga('sicc-tech-900',         'SICC TECH s.r.l.', '900 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 900, categoria_ped: 'IV' }),
  riga('sicc-spa-500',          'SICC S.p.A.',      '500 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }),
  riga('sicc-spa-725',          'SICC S.p.A.',      '725 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 725, categoria_ped: 'IV' }),
  riga('sicc-spa-270',          'SICC S.p.A.',      '270 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 270, categoria_ped: 'III' }),
  riga('sicc-srl-500',          'SICC S.r.L.',      '500 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 500, categoria_ped: 'IV' }),
  riga('sicc-srl-725',          'SICC S.r.L.',      '725 - 12783', { ps: 11, ts: '-10 ÷ +120', volume: 725, categoria_ped: 'IV' }),
  riga('sicc-tech-nudo-725',    'SICC TECH',        '725/12783',   { ps: 10.8, ts: '-10 ÷+120', volume: 725, categoria_ped: 'IV' }),
]

/**
 * Compressori CECCATO: lo stesso modello sotto le due ragioni sociali della famiglia, con
 * specs *diverse* — e l'OCR del compressore non estrae il FAD, quindi non può distinguerle.
 */
export const COMPRESSORI_CECCATO: EquipmentCatalogItem[] = [
  riga('abac-fono-270',    'A.ARIA C S.r.l. (ABAC)',        'FONOCOMPACT PRO 270 F6S',   { fad: 660,  pressione_max: 11 }),
  riga('ceccato-fono-270', 'CECCATO ARIA COMPRESSA S.R.L.', 'FONOCOMPACT PRO 270 F6S',   { fad: 1010, pressione_max: 11 }),
  riga('ceccato-fono-f55', 'CECCATO ARIA COMPRESSA S.R.L.', 'FONOCOMPACT PRO 270 F5 5S', { fad: 653,  pressione_max: 11 }),
  riga('ceccato-fono-500', 'CECCATO ARIA COMPRESSA S.R.L.', 'FONOCOMPACT PRO 500 F10XSE',{ fad: 1200, pressione_max: 11 }),
]

/** Un filtro: tipo privo di discriminanti tecnici nell'estrazione OCR. */
export const FILTRI: EquipmentCatalogItem[] = [
  riga('filtro-uno', 'AIR COM S.r.l.', 'AC 0035', { ps: 16, ts: '-10 ÷ +120' }),
]
