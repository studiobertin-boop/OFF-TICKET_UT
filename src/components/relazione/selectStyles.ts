/**
 * Larghezza delle select che raccolgono una sigla o due — collegamenti e giri.
 *
 * Erano larghe quanto la finestra: novecento pixel per contenere «S1, S2», una per riga.
 * Con una misura propria stanno in fila e vanno a capo solo quando la finestra si stringe
 * davvero, ed è lì che la finestra smette di dover essere scorsa per intero.
 */
export const LARGHEZZA_SELECT = 232

/**
 * Etichetta che si tronca invece di sfondare il campo.
 *
 * «C1 · KAESER SK 19» ci sta, «C1 · ATLAS COPCO GA 30 VSD+ FF» no: MUI non accorcia da sé
 * l'etichetta di un campo contornato, e quella in eccesso uscirebbe dal bordo.
 */
export const ETICHETTA_TRONCATA = {
  '& .MuiInputLabel-root': {
    maxWidth: 'calc(100% - 28px)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
} as const
