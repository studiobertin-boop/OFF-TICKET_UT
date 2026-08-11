# Prompt di proseguimento — persistenza e scadenza del fascicolo

Da incollare in una sessione nuova, aperta **nel worktree**
`.claude/worktrees/fascicolo-apparecchiatura` (branch `worktree-fascicolo-apparecchiatura`).

---

Proseguiamo la funzione «composizione fascicolo apparecchiatura», già scritta e funzionante su
questo branch. Ci ho ripensato su una decisione presa in fase di progetto.

## Cosa cambia

Nella versione attuale i file caricati vivono **solo in memoria**: si trascinano, si genera il
PDF, si scarica, e ricaricando la pagina si ricomincia. Voglio invece che **i file di partenza e
il fascicolo generato restino salvati e collegati alla singola apparecchiatura**, così chi
riapre la pratica li ritrova.

Per non far crescere il database senza limite, i file vanno cancellati:

- **30 giorni** dopo che la pratica è passata in stato **chiusa** o **archiviata non finita**;
- **e comunque dopo 180 giorni** in cui la pratica non cambia stato.

## Cosa c'è già (non rifarlo)

Tutto in `src/services/fascicolo/` più `src/components/technicalSheet/fascicolo/FascicoloSection.tsx`:

| Pezzo | Stato |
|---|---|
| `ordina.ts` — regola dei 7 posti del fascicolo | fatto, 10 test |
| `componiPdf.ts` — A4, rotazione, compressione a scalare sotto 4,95 MB | fatto, 10 test + prova nel browser |
| `raster.ts`, `estrazione.ts` — ricompressione e ritaglio delle prime pagine | fatto |
| `euristica.ts` — classificazione dal nome file, ripiego senza AI | fatto, 10 test |
| `classifica.ts` + Edge Function `classifica-documenti-fascicolo` | **deployata e provata in produzione** |
| `FascicoloSection.tsx` — trascinamento, elenco, ruoli correggibili, genera | fatto |
| `nomeFileFascicolo` in `practiceCode.ts` | fatto, con test |

Verificato end-to-end l'11-08-2026: la classificazione distingue il certificato del recipiente da
quello della sua valvola leggendo i dati di targa, riconosce i file misti certificato+istruzioni,
e su una bolla di trasporto si rifiuta di indovinare. Costo misurato: **~1 centesimo di dollaro
ogni 3 documenti** (Haiku 4.5). 556 test passano.

Il design originale è in `docs/superpowers/specs/2026-08-10-fascicolo-apparecchiatura-design.md`:
la riga «Persistenza: nessuna» è quella che stiamo rovesciando.

## Fatti verificati sul database di produzione (11-08-2026)

Verificati interrogando il DB vero, non le migrations del repo — che divergono.

1. **`requests.status` è `text`, non un enum**, e convivono due vocabolari. Stati realmente
   presenti, con i conteggi:
   `7-CHIUSA` (222) · `3-MAIL_CLIENTE_INVIATA` (56) · `COMPLETATA` (39) ·
   `1-INCARICO_RICEVUTO` (37) · `4-DOCUMENTI_PRONTI` (26) · `ARCHIVIATA NON FINITA` (9) ·
   `5-ATTESA_FIRMA` (8) · `2-SCHEDA_DATI_PRONTA` (3) · `APERTA` (1).
   Attenzione alla stringa esatta: **`ARCHIVIATA NON FINITA` ha spazi**, non trattini bassi.

2. **Le apparecchiature non hanno identità nel database.** Vivono dentro
   `dm329_technical_data.equipment_data` (JSONB) e si identificano col solo **codice** (`C1`,
   `C1.1`, `S1`…). Peggio: i codici **si rinumerano** quando si elimina una riga — c'è già
   `pruneSchedaRefs` in `src/utils/equipmentCodes.ts` che lo fa. Quindi un legame file →
   apparecchiatura basato sul codice si rompe da solo, ed è il problema di progetto principale
   di questo lavoro.

3. **`attachments` esiste ma non serve così com'è**: ha `request_id`, `file_name`, `file_path`,
   `file_size`, `uploaded_by`, `created_at`. Nessun legame con l'apparecchiatura, nessun tipo di
   documento, nessun ruolo. Bucket `attachments` privato, oggi 9 oggetti per 2,6 MB.

4. **`pg_cron` NON è installato** (disponibile, versione 1.6.4). C'è `pg_net` 0.19.5. Come far
   girare la pulizia periodica è quindi una decisione aperta, non un dato acquisito.

5. **`request_history` è alimentata da trigger** (`after_request_insert_create_history`), 2182
   righe su 401 pratiche, con `created_at`: la data dell'ultimo cambio di stato è ricavabile da
   lì. `requests.updated_at` invece cambia a **ogni** modifica, non solo di stato.

6. **Volumi attuali**: 182 pratiche chiuse o archiviate da oltre 30 giorni; 15 pratiche ferme da
   oltre 180 giorni.

## Domande a cui rispondere prima di scrivere codice

Non decidere da solo: sono scelte mie. Chiedimele una alla volta.

1. **`COMPLETATA`** (39 pratiche, vocabolario vecchio) rientra nella regola dei 30 giorni insieme
   a `7-CHIUSA` e `ARCHIVIATA NON FINITA`, o si considera solo il vocabolario DM329?
2. **I 180 giorni si contano da cosa**: dall'ultimo cambio di stato (`request_history`) o
   dall'ultima modifica (`updated_at`)? Non è la stessa cosa: una scheda che ritocco ogni mese
   senza mai cambiare stato non scadrebbe mai col primo criterio.
3. **Si cancella tutto o solo i sorgenti?** Tenere il fascicolo generato e buttare i file di
   partenza costa poco e conserva il prodotto; tenere i sorgenti permette di ricomporlo.
4. **Cosa resta dopo la cancellazione**: la riga con un «file scaduto» visibile, o sparisce tutto
   senza traccia?
5. **Riapertura**: se una pratica chiusa torna in lavorazione dopo che i file sono spariti, cosa
   deve vedere il tecnico?
6. **Chi può scaricare**: stesse regole degli allegati di pratica (admin tutto, tecnico e utente
   le proprie) o diverse?
7. **Preavviso** prima della cancellazione, o silenziosa?
8. **Tetto di peso** per apparecchiatura o per pratica?
9. **Il legame col codice apparecchiatura** (punto 2 dei fatti): si accetta che rinumerando i
   codici i file seguano la posizione, oppure serve dare un'identità stabile alle righe della
   scheda? È la decisione più pesante delle nove.

## Come lavorare

- Parti da **brainstorming**: è una modifica di progetto, non un'aggiunta meccanica.
- Il design nuovo va a rettificare la spec esistente, non a sostituirla: aggiungi una sezione
  «Persistenza e ciclo di vita» e correggi la riga della tabella delle decisioni.
- Le migrations si applicano direttamente in produzione via Management API (vedi `CLAUDE.md`);
  `.env.local` **è già presente nel worktree** e le credenziali funzionano.
- Test con Vitest per la logica di scadenza (quali pratiche scadono e quando): è calcolo puro e
  merita copertura, come l'ordinamento del fascicolo.
- La rifinitura estetica in fondo, in blocco.

## Comandi utili

```bash
npx vitest run                                    # 556 test
npm run build
node -e "..."                                     # interrogare il DB: vedi CLAUDE.md
npx supabase functions deploy <nome> --project-ref uphftgpwisdiubuhohnc
```
