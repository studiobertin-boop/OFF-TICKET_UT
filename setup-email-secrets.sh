#!/bin/bash

# =====================================================
# Setup Email Notification Secrets - Supabase
# =====================================================
# Questo script configura tutti i secrets necessari
# per il sistema di notifiche email
# =====================================================

echo "🔐 Configurazione Secrets Supabase per Email Notifications"
echo "=========================================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Errore: Supabase CLI non installato"
    echo "   Installa con: npm install -g supabase"
    exit 1
fi

echo "✓ Supabase CLI trovato"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Non sei autenticato con Supabase"
    echo "   Esegui: supabase login"
    exit 1
fi

echo "✓ Autenticato con Supabase"
echo ""

# Set secrets
echo "📧 Configurazione secrets..."
echo ""

echo "1/3 Impostazione RESEND_API_KEY..."
if supabase secrets set RESEND_API_KEY=re_gmvhhY1N_3muRNSkMKLKZwfYJ9egpKfas; then
    echo "   ✓ RESEND_API_KEY configurato"
else
    echo "   ❌ Errore configurazione RESEND_API_KEY"
    exit 1
fi

echo "2/3 Impostazione EMAIL_FROM..."
if supabase secrets set EMAIL_FROM=notifiche@officomp.it; then
    echo "   ✓ EMAIL_FROM configurato"
else
    echo "   ❌ Errore configurazione EMAIL_FROM"
    exit 1
fi

echo "3/3 Impostazione APP_URL..."
if supabase secrets set APP_URL=https://off-ticket-ut.vercel.app; then
    echo "   ✓ APP_URL configurato"
else
    echo "   ❌ Errore configurazione APP_URL"
    exit 1
fi

echo ""
echo "=========================================================="
echo "✅ Tutti i secrets sono stati configurati con successo!"
echo ""
echo "📋 Prossimi passi:"
echo "   1. Deploy Edge Functions:"
echo "      supabase functions deploy send-notification-email"
echo "      supabase functions deploy test-notification-email"
echo ""
echo "   2. Applica migration database:"
echo "      supabase db push"
echo "      (oppure copia manualmente da SQL Editor)"
echo ""
echo "   3. Configura database settings (esegui nel SQL Editor):"
echo "      ALTER DATABASE postgres SET app.settings.supabase_url = 'https://YOUR_PROJECT_REF.supabase.co';"
echo "      ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'YOUR_ANON_KEY';"
echo ""
echo "   4. Testa invio email (come admin):"
echo "      curl -X POST 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/test-notification-email' \\"
echo "        -H 'Authorization: Bearer YOUR_JWT_TOKEN'"
echo ""
echo "📖 Documentazione completa: DOCUMENTAZIONE/EMAIL_NOTIFICATIONS_SETUP.md"
echo "=========================================================="
