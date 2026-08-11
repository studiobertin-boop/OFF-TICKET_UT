/**
 * La regola di scadenza è identica a quella del fascicolo apparecchiatura (30gg dopo la
 * chiusura della pratica, tetto di 180gg senza movimenti): vive in `fascicolo/scadenza.ts`,
 * condivisa anche con Deno. Questo file resta come punto d'importazione lato client — la
 * eventuale Edge Function di pulizia delle dichiarazioni importa l'originale per percorso
 * relativo, non questo re-export.
 */
export * from '@/services/fascicolo/scadenza'
