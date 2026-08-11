import { describe, test, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * `scadenza.ts` e `codiciScheda.ts` sono importati per percorso relativo anche dalla Edge
 * Function `pulisci-fascicoli-scaduti`, che gira su Deno: lì l'alias `@/` non esiste e le
 * dipendenze npm del progetto nemmeno. Un `import` in uno dei due file — anche il più
 * innocuo — non li fa fallire qui né in build: fa fallire il *deploy* della funzione, che è
 * l'unico momento in cui qualcuno se ne accorgerebbe. Oggi lo garantisce solo un commento in
 * testa a entrambi i file; questo test lo rende un vincolo verificato.
 */
const MODULI_SENZA_IMPORT = ['../scadenza.ts', '../codiciScheda.ts']

describe('moduli condivisi con la Edge Function restano senza import', () => {
  test.each(MODULI_SENZA_IMPORT)('%s non contiene istruzioni import', (percorsoRelativo) => {
    const percorso = fileURLToPath(new URL(percorsoRelativo, import.meta.url))
    const testo = readFileSync(percorso, 'utf-8')

    expect(
      /^\s*import\b/m.test(testo),
      `${percorsoRelativo} contiene un 'import': la Edge Function pulisci-fascicoli-scaduti lo ` +
        `carica per percorso relativo su Deno, dove l'alias '@/' e le dipendenze npm del ` +
        `progetto non esistono. Un import qui rompe il deploy della funzione, non i test.`
    ).toBe(false)
  })
})
