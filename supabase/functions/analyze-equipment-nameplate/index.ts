import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Edge Function: analyze-equipment-nameplate
 *
 * Analizza foto di targhette apparecchiature usando GPT-4o Vision
 * Estrae dati strutturati e suggerisce match dal catalogo
 */

interface OCRRequest {
  image_base64: string
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
    // Parse request
    const { image_base64, equipment_type, equipment_code }: OCRRequest = await req.json()

    if (!image_base64 || !equipment_type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: image_base64, equipment_type'
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

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }

    // Prepare prompt based on equipment type
    const prompt = generatePromptForEquipmentType(equipment_type)

    // Call GPT-4o Vision API
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${image_base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.1 // Low temperature for accurate extraction
      })
    })

    if (!gptResponse.ok) {
      const error = await gptResponse.text()
      throw new Error(`OpenAI API error: ${error}`)
    }

    const gptData = await gptResponse.json()
    const extractedText = gptData.choices[0]?.message?.content

    if (!extractedText) {
      throw new Error('No response from GPT-4o Vision')
    }

    // Parse JSON response
    let extractedData
    try {
      // GPT-4o should return JSON, parse it
      extractedData = JSON.parse(extractedText)
    } catch (e) {
      // Fallback: try to extract JSON from markdown code block
      const jsonMatch = extractedText.match(/```json\n([\s\S]*?)\n```/)
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1])
      } else {
        throw new Error('Failed to parse GPT-4o response as JSON')
      }
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
 * Genera prompt specifico per tipo apparecchiatura
 */
function generatePromptForEquipmentType(equipmentType: string): string {
  const basePrompt = `Analyze this equipment nameplate image and extract ALL visible information.
Return ONLY a JSON object (no markdown, no explanations) with the following structure:`

  const commonFields = `{
  "marca": "manufacturer brand (string or null)",
  "modello": "model number (string or null)",
  "n_fabbrica": "serial/factory number (string or null)",
  "anno": "manufacturing year (integer or null)",`

  const equipmentSpecificFields: Record<string, string> = {
    serbatoio: `
  "volume": "tank volume in liters (integer or null)",
  "pressione_max": "maximum pressure in bar (number or null)",
  "finitura_interna": "internal finish type (string or null)",
  "valvola_sicurezza": {
    "marca": "safety valve brand (string or null)",
    "modello": "safety valve model (string or null)",
    "n_fabbrica": "safety valve serial (string or null)",
    "diametro_pressione": "diameter and pressure (string or null)"
  },
  "manometro": {
    "fondo_scala": "gauge max scale in bar (number or null)",
    "segno_rosso": "red mark pressure in bar (number or null)"
  }`,
    compressore: `
  "materiale_n": "material number (string or null)",
  "pressione_max": "maximum pressure in bar (number or null)"`,
    disoleatore: `
  "volume": "volume in liters (integer or null)",
  "pressione_max": "maximum pressure in bar (number or null)",
  "valvola_sicurezza": {
    "marca": "safety valve brand (string or null)",
    "modello": "safety valve model (string or null)",
    "n_fabbrica": "safety valve serial (string or null)",
    "diametro_pressione": "diameter and pressure (string or null)"
  }`,
    essiccatore: `
  "pressione_max": "maximum pressure in bar (number or null)"`,
    scambiatore: `
  "pressione_max": "maximum pressure in bar (number or null)",
  "volume": "volume in liters (integer or null)"`,
    filtro: ``,
    separatore: ``
  }

  const specificFields = equipmentSpecificFields[equipmentType] || ''

  const closingInstructions = `
  "raw_text": "all visible text on the nameplate (string)"
}

IMPORTANT RULES:
- Return ONLY valid JSON, no markdown code blocks
- Use null for any field that cannot be clearly read
- Extract numbers without units (e.g., "13" not "13 bar")
- Be precise with brand and model names
- Include raw_text with ALL visible text for debugging
- If text is unclear or ambiguous, use null rather than guessing`

  return `${basePrompt}${commonFields}${specificFields}${closingInstructions}`
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
