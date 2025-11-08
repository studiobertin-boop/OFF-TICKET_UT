// Test Resend API da Node.js
// Esegui con: node test-resend-node.js

const RESEND_API_KEY = 're_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas';
const EMAIL_TO = 'francesco.bertin@officomp.it';

async function testResend() {
  console.log('=== Test Resend API ===');
  console.log('API Key:', RESEND_API_KEY.substring(0, 10) + '...');
  console.log('To:', EMAIL_TO);

  const payload = {
    from: 'Officomp Ticketing <onboarding@resend.dev>',
    to: [EMAIL_TO],
    subject: 'Test Email - Resend API da Node.js',
    html: '<h1>Test Email</h1><p>Questa è una email di test da Node.js</p>',
  };

  console.log('\nPayload:', JSON.stringify(payload, null, 2));

  try {
    console.log('\n=== Calling Resend API ===');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    console.log('\n=== Response ===');
    console.log('Status:', response.status);
    console.log('Status Text:', response.statusText);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));

    const data = await response.json();
    console.log('\nResponse Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('\n❌ ERROR:', data);
      process.exit(1);
    } else {
      console.log('\n✅ SUCCESS! Email ID:', data.id);
      console.log('Controlla la dashboard Resend: https://resend.com/emails');
    }
  } catch (error) {
    console.error('\n❌ EXCEPTION:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testResend();
