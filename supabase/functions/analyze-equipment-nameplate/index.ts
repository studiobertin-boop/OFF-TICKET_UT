import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Edge Function: analyze-equipment-nameplate
 *
 * Legge i dati di targhetta di un'apparecchiatura da una foto o da un PDF (certificato,
 * dichiarazione di conformità, manuale) e li restituisce già strutturati.
 *
 * Il formato della risposta è vincolato dallo schema (`output_config.format`), non chiesto a
 * parole: la versione precedente domandava «restituisci solo JSON» in un prompt e faceva il
 * parse del testo libero, e su un documento — dove c'è molto più testo di una targhetta — la
 * risposta non era JSON e la lettura falliva con «Failed to parse Claude response as JSON».
 */

/** Lettura di targhette fisiche: serve un modello preciso su testo minuto e foto imperfette. */
const MODELLO = 'claude-sonnet-5'

/**
 * Un documento porta molto più testo di una targhetta: il tetto dev'essere largo abbastanza
 * da non troncare la risposta a metà, che è ciò che rende illeggibile un JSON altrimenti valido.
 */
const MAX_TOKENS = 8000

interface OCRRequest {
  /** Contenuto del file in base64 — immagine o PDF. */
  file_base64?: string
  /** @deprecated resta per le versioni dell'app che inviano solo immagini. */
  image_base64?: string
  /** MIME del file: se assente si deduce dai primi byte del base64. */
  media_type?: string
  equipment_type: string
  equipment_code?: string
}

interface OCRResponse {
  success: boolean
  data?: any
  error?: string
  confidence_score?: number
  fuzzy_matches?: any[]
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: OCRRequest = await req.json()
    const fileBase64 = body.file_base64 ?? body.image_base64
    const { equipment_type, equipment_code } = body

    if (!fileBase64 || !equipment_type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Campi obbligatori mancanti: file_base64, equipment_type'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get Anthropic API key from environment
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }

    /**
     * La firma del file vince sul tipo dichiarato: l'API rifiuta la richiesta se i due non
     * concordano, e un `.png` salvato con estensione sbagliata — o un browser che dichiara
     * `application/octet-stream` — non deve far fallire una lettura che funzionerebbe.
     */
    const mediaType = rilevaMediaType(fileBase64) ?? body.media_type ?? 'image/jpeg'
    console.log(`Analisi ${equipment_type}${equipment_code ? ` (${equipment_code})` : ''}, formato: ${mediaType}`)

    /**
     * Il PDF si manda com'è, non convertito in immagine: il modello legge il testo del
     * documento invece di rileggerlo da un rendering, e vede tutte le pagine — la targhetta
     * può stare sulla seconda del certificato.
     */
    const contenutoFile = mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mediaType, data: fileBase64 } }

    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODELLO,
        max_tokens: MAX_TOKENS,
        system: promptPerTipo(equipment_type),
        output_config: { format: { type: 'json_schema', schema: schemaPerTipo(equipment_type) } },
        messages: [
          {
            role: 'user',
            content: [
              contenutoFile,
              {
                type: 'text',
                text: mediaType === 'application/pdf'
                  ? 'Estrai i dati dell’apparecchiatura da questo documento, come richiesto.'
                  : 'Analizza questa targhetta ed estrai i dati come richiesto.'
              }
            ]
          }
        ]
      })
    })

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text()
      throw new Error(`Anthropic API error (${claudeResponse.status}): ${error}`)
    }

    const claudeData = await claudeResponse.json()
    console.log(`Risposta ricevuta: stop_reason=${claudeData.stop_reason}`)

    if (claudeData.stop_reason === 'refusal') {
      throw new Error('La lettura del documento è stata rifiutata dal modello')
    }

    if (claudeData.stop_reason === 'max_tokens') {
      throw new Error(
        'Il documento è troppo ricco di testo e la lettura si è interrotta prima della fine. ' +
        'Carica solo le pagine con i dati di targa.'
      )
    }

    const extractedText = claudeData.content?.find((b: { type: string }) => b.type === 'text')?.text

    if (!extractedText) {
      throw new Error('Il modello non ha restituito alcun dato')
    }

    /**
     * Lo schema garantisce la forma della risposta, quindi il parse non dovrebbe fallire. Se
     * fallisce lo stesso, l'errore riporta l'inizio di ciò che è arrivato: senza, resta solo
     * «parse fallito» e non c'è modo di capire cosa il modello abbia risposto davvero.
     */
    let extractedData
    try {
      extractedData = JSON.parse(extractedText)
    } catch (e) {
      throw new Error(
        `Risposta del modello non leggibile come JSON (${(e as Error).message}). ` +
        `Inizio della risposta: ${extractedText.slice(0, 200)}`
      )
    }

    // Calculate confidence score (0-100)
    const confidenceScore = calculateConfidenceScore(extractedData)

    // Search for fuzzy matches in equipment catalog
    const fuzzyMatches = await searchFuzzyMatches(
      supabase,
      extractedData.marca,
      extractedData.modello,
      equipment_type
    )

    // Return response
    const response: OCRResponse = {
      success: true,
      data: extractedData,
      confidence_score: confidenceScore,
      fuzzy_matches: fuzzyMatches
    }

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error in analyze-equipment-nameplate:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

/**
 * MIME riconosciuto dai primi caratteri del base64; null se la firma non dice niente.
 * PNG inizia per iVBOR, JPEG per /9j/, PDF per JVBERi0 («%PDF-»), GIF per R0lG, WebP per UklG.
 */
function rilevaMediaType(base64: string): string | null {
  if (base64.startsWith('JVBERi0')) return 'application/pdf'
  if (base64.startsWith('iVBOR')) return 'image/png'
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('R0lG')) return 'image/gif'
  if (base64.startsWith('UklG')) return 'image/webp'
  return null
}

/** Campo nullable nella forma che lo schema accetta: niente `type: [...]`, si usa `anyOf`. */
const opzionale = (tipo: 'string' | 'integer' | 'number', descrizione: string) => ({
  anyOf: [{ type: tipo }, { type: 'null' }],
  description: descrizione,
})

const VALVOLA_SCHEMA = {
  anyOf: [
    {
      type: 'object',
      properties: {
        marca: opzionale('string', 'marca della valvola di sicurezza'),
        modello: opzionale('string', 'modello della valvola di sicurezza'),
        n_fabbrica: opzionale('string', 'numero di fabbrica della valvola'),
        diametro_pressione: opzionale('string', 'diametro e pressione, es. «1/2" 13 bar»'),
      },
      required: ['marca', 'modello', 'n_fabbrica', 'diametro_pressione'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
  description: 'dati della valvola di sicurezza, se leggibili',
}

const MANOMETRO_SCHEMA = {
  anyOf: [
    {
      type: 'object',
      properties: {
        fondo_scala: opzionale('number', 'fondo scala in bar'),
        segno_rosso: opzionale('number', 'pressione del segno rosso in bar'),
      },
      required: ['fondo_scala', 'segno_rosso'],
      additionalProperties: false,
    },
    { type: 'null' },
  ],
  description: 'dati del manometro, se leggibili',
}

/**
 * Campi propri del tipo di apparecchiatura, che si aggiungono a quelli comuni.
 */
function campiSpecifici(equipmentType: string): Record<string, unknown> {
  switch (equipmentType) {
    case 'serbatoio':
      return {
        volume: opzionale('integer', 'volume in litri'),
        pressione_max: opzionale('number', 'pressione massima PS in bar'),
        finitura_interna: opzionale('string', 'finitura interna'),
        valvola_sicurezza: VALVOLA_SCHEMA,
        manometro: MANOMETRO_SCHEMA,
      }
    case 'compressore':
      return {
        materiale_n: opzionale('string', 'numero di materiale'),
        pressione_max: opzionale('number', 'pressione massima in bar'),
      }
    case 'disoleatore':
      return {
        volume: opzionale('integer', 'volume in litri'),
        pressione_max: opzionale('number', 'pressione massima PS in bar'),
        valvola_sicurezza: VALVOLA_SCHEMA,
      }
    case 'essiccatore':
      return { pressione_max: opzionale('number', 'pressione massima in bar') }
    case 'scambiatore':
      return {
        volume: opzionale('integer', 'volume in litri'),
        pressione_max: opzionale('number', 'pressione massima PS in bar'),
      }
    case 'valvola':
      return {
        diametro_pressione: opzionale('string', 'diametro e pressione di taratura, es. «1/2" 13 bar»'),
      }
    default:
      return {}
  }
}

/**
 * Schema della risposta: è ciò che garantisce che arrivi un JSON e non un discorso.
 *
 * Ogni campo è dichiarato obbligatorio e annullabile insieme — è la forma che gli output
 * strutturati richiedono: `required` copre tutte le proprietà, e ciò che non si legge sulla
 * targhetta vale `null`.
 */
function schemaPerTipo(equipmentType: string) {
  const properties: Record<string, unknown> = {
    marca: opzionale('string', 'marca del costruttore'),
    modello: opzionale('string', 'modello'),
    n_fabbrica: opzionale('string', 'numero di fabbrica o di serie'),
    anno: opzionale('integer', 'anno di costruzione'),
    ...campiSpecifici(equipmentType),
    raw_text: opzionale('string', 'testo della targhetta, per verifica — al massimo 600 caratteri'),
  }

  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

/**
 * Istruzioni di lettura. La forma della risposta non è più affare del prompt — la fissa lo
 * schema — quindi qui resta solo ciò che riguarda *come* leggere: quale apparecchiatura
 * cercare in un documento che ne cita più d'una, e cosa fare di ciò che non si legge.
 */
function promptPerTipo(equipmentType: string): string {
  const nome: Record<string, string> = {
    serbatoio: 'un serbatoio d’aria compressa',
    compressore: 'un compressore',
    disoleatore: 'un serbatoio disoleatore',
    essiccatore: 'un essiccatore',
    scambiatore: 'uno scambiatore di calore',
    filtro: 'un filtro',
    separatore: 'un separatore',
    valvola: 'una valvola di sicurezza',
  }

  return `Leggi i dati di targa di ${nome[equipmentType] ?? 'un’apparecchiatura'} da questa immagine o da questo documento.

REGOLE
- Il file può essere la foto di una targhetta oppure un documento (certificato, dichiarazione di conformità, manuale) di più pagine: cerca i dati di targa ovunque compaiano.
- Se il documento descrive più apparecchiature, riporta quella del tipo richiesto; se ce n'è più d'una dello stesso tipo, riporta la prima.
- Usa null per ogni dato che non riesci a leggere con certezza: meglio un campo vuoto di un valore indovinato.
- Riporta i numeri senza unità di misura ("13", non "13 bar") e usa il punto come separatore decimale.
- Trascrivi marca e modello esattamente come sono scritti.
- In raw_text riporta solo il testo della targa o del riquadro dei dati tecnici, non l'intero documento, e comunque non più di 600 caratteri.`
}

/**
 * Calcola confidence score basato su quanti campi sono stati estratti
 */
function calculateConfidenceScore(data: any): number {
  const fields = ['marca', 'modello', 'n_fabbrica', 'anno', 'pressione_max', 'volume']
  const extractedCount = fields.filter(field => data[field] !== null && data[field] !== undefined).length
  return Math.round((extractedCount / fields.length) * 100)
}

/**
 * Cerca match fuzzy nel catalogo equipaggiamenti
 */
async function searchFuzzyMatches(
  supabase: any,
  marca: string | null,
  modello: string | null,
  equipmentType: string
): Promise<any[]> {
  if (!marca && !modello) {
    return []
  }

  try {
    const searchTerm = `${marca || ''} ${modello || ''}`.trim()

    const { data, error } = await supabase.rpc('search_equipment_fuzzy', {
      search_term: searchTerm,
      equipment_type_filter: equipmentType,
      limit_results: 5
    })

    if (error) {
      console.error('Fuzzy search error:', error)
      return []
    }

    return data || []
  } catch (error) {
    console.error('Error in searchFuzzyMatches:', error)
    return []
  }
}
