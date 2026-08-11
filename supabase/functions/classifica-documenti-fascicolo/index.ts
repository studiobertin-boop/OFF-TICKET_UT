import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

/**
 * Edge Function: classifica-documenti-fascicolo
 *
 * Riconosce, dal contenuto, quale ruolo ricopre ciascun documento caricato per il fascicolo di
 * un'apparecchiatura: certificato CE, istruzioni, foto della targhetta, e di quale delle
 * apparecchiature in gioco (quella del fascicolo, la sua valvola di sicurezza, l'apparecchiatura
 * principale che la contiene).
 *
 * Si appoggia all'API Anthropic e non a quella usata dall'OCR delle targhette: Claude accetta i
 * PDF come allegato, quindi i certificati si mandano come sono invece di convertirli in immagini.
 * I documenti viaggiano tutti in una richiesta sola perché il riconoscimento è comparativo: fra
 * due «dichiarazioni di conformità» si distingue confrontando i dati di targa dell'una e
 * dell'altra con quelli che la scheda già conosce.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Per una classificazione a sette categorie non serve di più. */
const MODELLO = 'claude-haiku-4-5'

const RUOLI = [
  'CERT_APPARECCHIATURA',
  'ISTR_APPARECCHIATURA',
  'CERT_VALVOLA',
  'ISTR_VALVOLA',
  'FOTO_TARGHETTA',
  'CERT_PRINCIPALE',
  'FOTO_TARGHETTA_PRINCIPALE',
] as const

interface Apparecchiatura {
  codice: string
  tipo: string
  marca?: string | null
  modello?: string | null
  anno?: number | string | null
  n_fabbrica?: string | null
  pressione?: number | string | null
}

interface BloccoProva {
  kind: 'pdf' | 'immagine'
  base64: string
  mediaType?: string
}

interface DocumentoDaClassificare {
  id: string
  nome: string
  pagine: number | null
  blocchi: BloccoProva[]
}

/** Documento già salvato e già classificato: dice al modello che quel posto è occupato. */
interface RuoloGiaCoperto {
  nome: string
  ruoli: string[]
  valvola: string | null
}

interface RichiestaClassificazione {
  contesto: {
    apparecchiatura: Apparecchiatura
    valvole: Apparecchiatura[]
    principale: Apparecchiatura | null
  }
  documenti: DocumentoDaClassificare[]
  /** Assente o vuoto quando non ci sono ancora documenti salvati. */
  giaCoperti?: RuoloGiaCoperto[]
}

/** Schema dell'esito. `additionalProperties: false` e `required` completi: li pretende l'API. */
const SCHEMA = {
  type: 'object',
  properties: {
    risultati: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ruoli: {
            type: 'array',
            items: { type: 'string', enum: [...RUOLI] },
          },
          // `anyOf` e non `type: ['string', 'null']`: l'unione va scritta così perché lo schema
          // possa essere compilato.
          valvola: {
            anyOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Codice della valvola a cui il documento si riferisce, se pertinente.',
          },
          confidenza: { type: 'number' },
          motivazione: { type: 'string' },
        },
        required: ['id', 'ruoli', 'valvola', 'confidenza', 'motivazione'],
        additionalProperties: false,
      },
    },
  },
  required: ['risultati'],
  additionalProperties: false,
}

const descriviApparecchiatura = (a: Apparecchiatura) =>
  [
    `codice ${a.codice}`,
    `tipo ${a.tipo}`,
    a.marca ? `marca ${a.marca}` : null,
    a.modello ? `modello ${a.modello}` : null,
    a.anno ? `anno ${a.anno}` : null,
    a.n_fabbrica ? `n. fabbrica ${a.n_fabbrica}` : null,
    a.pressione ? `pressione ${a.pressione} bar` : null,
  ].filter(Boolean).join(', ')

/**
 * Paragrafo che elenca i posti del fascicolo già occupati da documenti caricati in precedenza,
 * da aggiungere al prompt quando si classificano solo i file appena arrivati: senza, il modello
 * non saprebbe che certificato e istruzioni dell'apparecchiatura sono già stati riconosciuti, e
 * potrebbe riattribuirli anche se non sono fra i documenti in esame.
 */
const giaCopertiTesto = (giaCoperti: RuoloGiaCoperto[]) =>
  giaCoperti.length === 0
    ? ''
    : `\n\nQuesti posti del fascicolo sono già occupati da documenti caricati in precedenza, che NON devi riclassificare:\n` +
      giaCoperti.map((d) => `- «${d.nome}» → ${d.ruoli.join(' + ')}${d.valvola ? ` (valvola ${d.valvola})` : ''}`).join('\n') +
      `\nTienine conto: se un posto è già occupato, è meno probabile che un documento nuovo lo ricopra di nuovo — ma non è impossibile, perché un caricamento può correggere un errore precedente.`

const istruzioni = (contesto: RichiestaClassificazione['contesto'], giaCoperti: RuoloGiaCoperto[]) => `
Riconosci il ruolo di ciascun documento nel fascicolo tecnico di un'apparecchiatura in pressione.

L'apparecchiatura del fascicolo è: ${descriviApparecchiatura(contesto.apparecchiatura)}.
${contesto.valvole.length
    ? `È protetta da queste valvole di sicurezza:\n${contesto.valvole.map((v) => `- ${descriviApparecchiatura(v)}`).join('\n')}`
    : 'Non ha valvole di sicurezza censite.'}
${contesto.principale
    ? `È contenuta in questa apparecchiatura principale: ${descriviApparecchiatura(contesto.principale)}.`
    : 'Non è contenuta in nessun\'altra apparecchiatura.'}

I ruoli possibili sono:
- CERT_APPARECCHIATURA: dichiarazione/certificato CE dell'apparecchiatura del fascicolo
- ISTR_APPARECCHIATURA: istruzioni d'uso e manutenzione della stessa
- CERT_VALVOLA: certificato CE di una valvola di sicurezza
- ISTR_VALVOLA: istruzioni d'uso e manutenzione di una valvola di sicurezza
- FOTO_TARGHETTA: fotografia della targhetta dell'apparecchiatura del fascicolo
- CERT_PRINCIPALE: certificato CE dell'apparecchiatura principale
- FOTO_TARGHETTA_PRINCIPALE: fotografia della targhetta dell'apparecchiatura principale

Come decidere:
- I dati di targa sono la prova decisiva. Marca, modello, numero di fabbrica e pressione dichiarati
  nel documento dicono a quale delle apparecchiature elencate sopra appartiene, anche quando due
  documenti si intitolano allo stesso modo.
- Un documento può coprire due ruoli: è normale che certificato e istruzioni della stessa
  apparecchiatura stiano nello stesso file, con le istruzioni nelle pagine successive. In quel caso
  elenca entrambi i ruoli.
- Le vedi solo le prime pagine di ogni documento: il numero di pagine totali te lo do a parte, ed è
  un indizio: un documento di una o due pagine è un certificato, uno di molte pagine è un manuale.
- Se un documento riguarda una valvola e le valvole sono più d'una, indica in "valvola" il codice
  di quella giusta; altrimenti lascia null.
- Se non riesci a stabilire il ruolo, restituisci un elenco di ruoli vuoto e confidenza 0. È
  preferibile a un'attribuzione sbagliata: l'utente rivede e corregge prima di generare.
- "confidenza" va da 0 a 1. "motivazione" è una riga in italiano sul perché, citando il dato che
  ha deciso l'attribuzione.${giaCopertiTesto(giaCoperti)}

Restituisci un risultato per ogni documento, con l'id che ti è stato dato.
`.trim()

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const rispondi = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    const { contesto, documenti, giaCoperti }: RichiestaClassificazione = await req.json()

    if (!contesto?.apparecchiatura || !Array.isArray(documenti)) {
      return rispondi({ success: false, error: 'Servono `contesto.apparecchiatura` e `documenti`' }, 400)
    }
    if (documenti.length === 0) {
      return rispondi({ success: true, risultati: [] })
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return rispondi({ success: false, error: 'ANTHROPIC_API_KEY non configurata' }, 500)
    }

    // Un blocco di testo che apre ogni documento, così il modello sa a quale id si riferisce
    // ciò che segue: senza, con più documenti in una richiesta sola, i ruoli si mescolano.
    const contenuto = documenti.flatMap((d) => [
      {
        type: 'text',
        text: `Documento id=${d.id} — nome del file: "${d.nome}"${d.pagine ? `, ${d.pagine} pagine in tutto` : ''}.`,
      },
      ...d.blocchi.map((b) =>
        b.kind === 'pdf'
          ? {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: b.base64 },
          }
          : {
            type: 'image',
            source: { type: 'base64', media_type: b.mediaType ?? 'image/jpeg', data: b.base64 },
          }
      ),
    ])

    const risposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELLO,
        max_tokens: 4000,
        system: istruzioni(contesto, giaCoperti ?? []),
        messages: [{ role: 'user', content: contenuto }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    })

    if (!risposta.ok) {
      const dettaglio = await risposta.text()
      console.error('Anthropic API error:', risposta.status, dettaglio)
      return rispondi(
        { success: false, error: `Errore dall'API Anthropic (${risposta.status})`, dettaglio },
        502
      )
    }

    const messaggio = await risposta.json()

    if (messaggio.stop_reason === 'refusal') {
      return rispondi({ success: false, error: 'La classificazione è stata rifiutata dal modello' }, 502)
    }

    const testo = (messaggio.content ?? []).find((b: { type: string }) => b.type === 'text')?.text
    if (!testo) {
      return rispondi({ success: false, error: 'Risposta del modello senza contenuto' }, 502)
    }

    const { risultati } = JSON.parse(testo)
    return rispondi({ success: true, risultati, usage: messaggio.usage })
  } catch (errore) {
    console.error('classifica-documenti-fascicolo:', errore)
    return rispondi(
      { success: false, error: errore instanceof Error ? errore.message : 'Errore sconosciuto' },
      500
    )
  }
})
