-- =========================================================================
-- SCRIPT DI MIGRAZIONE: Aggiunta colonna external_id alla tabella allievi
-- =========================================================================
-- Esegui questo script nel SQL Editor di Supabase SE hai già un database
-- configurato con lo schema precedente e vuoi abilitare l'importazione
-- da API esterna senza perdere i dati esistenti.
-- =========================================================================

-- 1. Aggiunge la colonna external_id (vuota di default per i record esistenti)
ALTER TABLE allievi
    ADD COLUMN IF NOT EXISTS external_id TEXT DEFAULT '';

-- 2. Aggiunge la colonna colore (valore grezzo dall'API esterna)
ALTER TABLE allievi
    ADD COLUMN IF NOT EXISTS colore TEXT DEFAULT '';

-- 3. Aggiunge un indice per velocizzare il lookup durante l'importazione
CREATE INDEX IF NOT EXISTS idx_allievi_external_id ON allievi(external_id);

-- Verifica che la colonna sia stata aggiunta correttamente
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'allievi' AND column_name = 'external_id';
