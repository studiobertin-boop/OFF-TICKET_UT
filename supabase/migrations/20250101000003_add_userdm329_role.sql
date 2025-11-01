-- Migration: Aggiunta ruolo userdm329 all'enum user_role
-- Data: 2025-01-01
-- Parte 1: Solo aggiunta enum (deve essere eseguita separatamente)

-- Aggiungere il nuovo valore 'userdm329' all'enum user_role
-- NOTA: Questo deve essere committato prima di poter essere usato nelle policies
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'userdm329';
