-- =========================================================================
-- SCRIPT PER STORICO GIORNALIERO (SNAPSHOT)
-- =========================================================================

-- Creazione tabella per il salvataggio dei dati giornalieri
CREATE TABLE IF NOT EXISTS storico_giornaliero (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_riferimento DATE NOT NULL,
    allievo_id UUID REFERENCES allievi(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    categoria TEXT NOT NULL,
    camp TEXT NOT NULL,
    colore TEXT DEFAULT '',
    intolleranze TEXT DEFAULT '',
    patologie TEXT DEFAULT '',
    presente BOOLEAN DEFAULT FALSE NOT NULL,
    pre_camp BOOLEAN DEFAULT FALSE NOT NULL,
    post_camp BOOLEAN DEFAULT FALSE NOT NULL,
    entrata_anticipata TEXT DEFAULT '',
    uscita_anticipata TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    
    -- Evita duplicati dello stesso allievo nello stesso giorno
    UNIQUE(allievo_id, data_riferimento)
);

-- Indici per ricerche veloci
CREATE INDEX IF NOT EXISTS idx_storico_data ON storico_giornaliero(data_riferimento);
CREATE INDEX IF NOT EXISTS idx_storico_camp_data ON storico_giornaliero(camp, data_riferimento);

-- Abilitazione sicurezza
ALTER TABLE storico_giornaliero ENABLE ROW LEVEL SECURITY;

-- Policy di accesso pubblico
CREATE POLICY "Accesso totale anonimo storico" ON storico_giornaliero FOR ALL USING (true) WITH CHECK (true);
