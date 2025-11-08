import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'notifiche@officomp.it'
const APP_URL = Deno.env.get('APP_URL') || 'https://off-ticket-ut.vercel.app'

interface EmailPayload {
  to: string
  user_name: string
  event_type: string
  message: string
  request_id?: string
  metadata?: {
    request_title?: string
    request_type_name?: string
    customer_name?: string
    is_dm329?: boolean
    assigned_to_name?: string
    current_status?: string
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateEmailHTML(payload: EmailPayload): string {
  const { user_name, message, request_id, metadata } = payload
  const requestUrl = request_id ? `${APP_URL}/requests/${request_id}` : null

  return `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notifica Richiesta</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f5f5f5; padding: 20px 0;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                Sistema Ticketing Ufficio Tecnico
              </h1>
              <p style="color: #cbd5e1; margin: 8px 0 0 0; font-size: 14px;">Officomp</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="color: #475569; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                Ciao <strong>${user_name}</strong>,
              </p>

              <!-- Notification Message -->
              <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 16px 20px; margin-bottom: 24px; border-radius: 4px;">
                <p style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0;">
                  ${message}
                </p>
              </div>

              ${metadata ? `
              <!-- Request Details -->
              <div style="background-color: #f8fafc; padding: 20px; border-radius: 6px; margin-bottom: 24px;">
                <h3 style="color: #1e293b; font-size: 16px; font-weight: 600; margin: 0 0 16px 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">
                  Dettagli Richiesta
                </h3>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  ${metadata.request_title ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 40%;">Titolo:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${metadata.request_title}</td>
                  </tr>
                  ` : ''}
                  ${metadata.customer_name ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Cliente:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${metadata.customer_name}</td>
                  </tr>
                  ` : ''}
                  ${metadata.request_type_name ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tipo:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${metadata.request_type_name}</td>
                  </tr>
                  ` : ''}
                  ${metadata.current_status ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Stato Attuale:</td>
                    <td style="padding: 8px 0;">
                      <span style="background-color: #3b82f6; color: #ffffff; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                        ${metadata.current_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                  ` : ''}
                  ${metadata.assigned_to_name ? `
                  <tr>
                    <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Tecnico Assegnato:</td>
                    <td style="padding: 8px 0; color: #1e293b; font-size: 14px; font-weight: 500;">${metadata.assigned_to_name}</td>
                  </tr>
                  ` : ''}
                </table>
              </div>
              ` : ''}

              ${requestUrl ? `
              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${requestUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
                  Visualizza Richiesta
                </a>
              </div>
              ` : ''}

              <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                Questa è una notifica automatica del sistema di ticketing.<br>
                Puoi gestire le tue preferenze di notifica accedendo all'applicazione.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 30px; border-radius: 0 0 8px 8px; border-top: 1px solid #e2e8f0;">
              <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin: 0; text-align: center;">
                <strong>Officomp - Ufficio Tecnico</strong><br>
                Sistema di gestione richieste e ticketing<br>
                <a href="${APP_URL}" style="color: #3b82f6; text-decoration: none;">Accedi all'applicazione</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

function generateSubject(payload: EmailPayload): string {
  const { event_type, metadata } = payload

  // Generate dynamic subject based on event type and metadata
  let subject = 'Notifica Richiesta'

  if (metadata?.customer_name && metadata?.request_type_name) {
    const prefix = `${metadata.customer_name} - ${metadata.request_type_name}`

    switch (event_type) {
      case 'request_created':
        subject = `${prefix} - Nuova richiesta creata`
        break
      case 'request_suspended':
        subject = `${prefix} - Richiesta sospesa`
        break
      case 'request_unsuspended':
        subject = `${prefix} - Richiesta riattivata`
        break
      case 'status_change':
        subject = `${prefix} - Cambio stato`
        break
      default:
        subject = `${prefix} - Aggiornamento`
    }
  } else if (metadata?.request_type_name) {
    subject = `${metadata.request_type_name} - Aggiornamento richiesta`
  }

  return subject
}

async function sendEmail(payload: EmailPayload): Promise<void> {
  const htmlContent = generateEmailHTML(payload)
  const subject = generateSubject(payload)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: `Officomp Ticketing <${EMAIL_FROM}>`,
      to: [payload.to],
      subject: subject,
      html: htmlContent,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Resend API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  console.log('Email sent successfully:', data)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== SEND NOTIFICATION EMAIL START ===')
    console.log('RESEND_API_KEY present:', !!RESEND_API_KEY)
    console.log('EMAIL_FROM:', EMAIL_FROM)
    console.log('APP_URL:', APP_URL)

    const payload: EmailPayload = await req.json()

    console.log('Received email notification request:', {
      to: payload.to,
      event_type: payload.event_type,
      request_id: payload.request_id,
      user_name: payload.user_name,
    })

    // Validate required fields
    if (!payload.to || !payload.message) {
      throw new Error('Missing required fields: to, message')
    }

    // Send email via Resend
    await sendEmail(payload)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Error sending email notification:', error)

    // Return success to avoid blocking the notification system
    // Log the error but don't fail the request
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Email notification failed but logged'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Return 200 to avoid retry loops
      }
    )
  }
})
