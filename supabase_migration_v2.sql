-- =========================================================================
-- SCRIPT DI MIGRAZIONE V2: Ritmo Danza - Presenze Camp
-- Incolla ed esegui questo script nello "SQL Editor" di Supabase
-- =========================================================================

-- 1. Aggiornamento della tabella allievi
-- Rimuove il vecchio vincolo sulla categoria per consentire "special" (Special Camp)
ALTER TABLE allievi DROP CONSTRAINT IF EXISTS allievi_categoria_check;
ALTER TABLE allievi ADD CONSTRAINT allievi_categoria_check CHECK (categoria IN ('baby', 'bambino', 'special'));

-- Aggiunta nuove colonne per la gestione turni, armadietti persistenti e override manuale
ALTER TABLE allievi ADD COLUMN IF NOT EXISTS turni TEXT DEFAULT '1';
ALTER TABLE allievi ADD COLUMN IF NOT EXISTS armadietto TEXT DEFAULT '';
ALTER TABLE allievi ADD COLUMN IF NOT EXISTS override_manual BOOLEAN DEFAULT FALSE;

-- 2. Creazione tabella importazioni (storico file importati)
CREATE TABLE IF NOT EXISTS importazioni (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_file TEXT NOT NULL,
    camp TEXT NOT NULL,
    payload JSONB NOT NULL,
    creato_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Creazione tabella archivio_presenze (storico snapshot a mezzanotte)
CREATE TABLE IF NOT EXISTS archivio_presenze (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_archivio DATE DEFAULT CURRENT_DATE NOT NULL,
    camp TEXT NOT NULL,
    allievi_data JSONB NOT NULL,
    presenze_data JSONB NOT NULL,
    creato_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(data_archivio, camp)
);

-- 4. Abilitazione della Row Level Security (RLS) sulle nuove tabelle
ALTER TABLE importazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE archivio_presenze ENABLE ROW LEVEL SECURITY;

-- 5. Politiche di sicurezza per utenti autenticati (lo staff)
DROP POLICY IF EXISTS "Accesso totale staff importazioni" ON importazioni;
CREATE POLICY "Accesso totale staff importazioni" ON importazioni
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Accesso totale staff archivio_presenze" ON archivio_presenze;
CREATE POLICY "Accesso totale staff archivio_presenze" ON archivio_presenze
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Indici di performance per ricerche rapide
CREATE INDEX IF NOT EXISTS idx_importazioni_camp ON importazioni(camp);
CREATE INDEX IF NOT EXISTS idx_archivio_presenze_data ON archivio_presenze(data_archivio);
