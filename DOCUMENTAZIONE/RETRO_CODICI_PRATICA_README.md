# Retro-coding codici pratica DM329 — Istruzioni

Assegnazione dei codici pratica alle pratiche DM329 create prima della funzione codice pratica.

## Flusso

1. **Genera la proposta**
   `npm run retro-codici:export`
   Crea `DOCUMENTAZIONE/RETRO_CODICI_PRATICA_DM329.xlsx` con una proposta automatica
   (una lettera per indirizzo distinto del cliente, progressivo per data, anno da data).

2. **Rivedi a mano l'Excel** (foglio `Pratiche`). Correggi queste colonne:
   - `sala_lettera`: una lettera **A–Z** per ogni sala fisica distinta del cliente.
   - `denominazione_sala`: nome descrittivo della sala (facoltativo ma consigliato).
   - `progressivo`: **00** = pratica iniziale, **01/02…** = aggiornamenti della stessa sala.
   - `anno`: 2000–2100.
   - `pratica_padre` (solo righe `tipo = DM329-Integrazioni`): il `request_id` della
     pratica **primaria** dello stesso cliente a cui agganciare l'integrazione.
   Non modificare `request_id`, `tipo`, `customer_id` (se presente).

   **Regole da rispettare** (altrimenti l'import segnala errore):
   - Per lo stesso cliente, la coppia (sala_lettera, progressivo) deve essere unica.
   - Un'integrazione deve puntare a una primaria **dello stesso cliente**.

3. **Verifica senza scrivere (dry-run)**
   `npm run retro-codici:import`
   Elenca righe valide ed eventuali errori. Correggi l'Excel finché "0 errori".

4. **Applica in produzione**
   `npm run retro-codici:import:apply`
   Scrive i codici su `requests`.

## Fuori scope (non presenti nell'Excel)
- Pratiche in stato `7-CHIUSA` o `ARCHIVIATA NON FINITA`.
- Pratiche senza cliente o con cliente privo di codice cliente.
Questi casi si gestiranno più avanti dal pannello in-app (Fase 2).
