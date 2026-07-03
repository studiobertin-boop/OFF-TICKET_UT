-- Notifiche: modello unico broadcast a iscritti
-- Spec: docs/superpowers/specs/2026-07-03-notifiche-eventi-pratica-design.md
BEGIN;

-- 1) Nuove colonne toggle (opt-in, default false)
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS notify_request_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_request_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_block_resolved  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_request_urgent  boolean NOT NULL DEFAULT false;

-- 2) Reset preferenze esistenti a "eventi tutti spenti" (canali in_app/email invariati)
UPDATE user_notification_preferences
SET status_transitions = '{}'::jsonb,
    notify_request_created = false,
    notify_request_blocked = false,
    notify_block_resolved  = false,
    notify_request_urgent  = false;

COMMIT;
