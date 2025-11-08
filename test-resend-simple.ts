// Test Resend semplice - da eseguire in Deno Deploy Playground
// https://dash.deno.com/playground

const RESEND_API_KEY = 're_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas'

async function testResend() {
  console.log('Testing Resend...')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'Officomp Ticketing <onboarding@resend.dev>',
      to: ['francesco.bertin@officomp.it'],
      subject: 'Test Email - Resend API',
      html: '<h1>Test Email</h1><p>Questa è una email di test da Resend API</p>',
    }),
  })

  console.log('Response status:', response.status)
  const data = await response.json()
  console.log('Response data:', data)

  if (!response.ok) {
    console.error('ERROR:', data)
  } else {
    console.log('SUCCESS! Email ID:', data.id)
  }
}

testResend()
