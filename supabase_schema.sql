-- =========================================================================
-- SCRIPT DI CREAZIONE DATABASE PER "RITMO DANZA - PRESENZE CAMP"
-- Incolla questo script all'interno dello "SQL Editor" del tuo Supabase
-- =========================================================================

-- Abilita l'estensione per la generazione di UUID (identificativi univoci sicuri)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Rimuovi eventuali tabelle esistenti per evitare conflitti in caso di ri-esecuzione
DROP TABLE IF EXISTS presenze;
DROP TABLE IF EXISTS attivita;
DROP TABLE IF EXISTS allievi;

-- 1. TABELLA ALLIEVI (Anagrafica Centrale degli iscritti)
CREATE TABLE allievi (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('baby', 'bambino')),
    camp TEXT NOT NULL CHECK (camp IN ('summer', 'spring', 'winter')),
    intolleranze TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. TABELLA PRESENZE (Registro giornaliero appello, pre/post camp e orari anticipati)
CREATE TABLE presenze (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    allievo_id UUID REFERENCES allievi(id) ON DELETE CASCADE NOT NULL,
    data DATE NOT NULL,
    camp TEXT NOT NULL CHECK (camp IN ('summer', 'spring', 'winter')),
    presente BOOLEAN DEFAULT FALSE NOT NULL,
    pre_camp BOOLEAN DEFAULT FALSE NOT NULL,
    post_camp BOOLEAN DEFAULT FALSE NOT NULL,
    entrata_anticipata TEXT DEFAULT '', -- Memorizzato come stringa 'HH:MM' o stringa vuota
    uscita_anticipata TEXT DEFAULT '',  -- Memorizzato come stringa 'HH:MM' o stringa vuota
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- Impedisce la creazione di duplicati: una sola riga di presenza per allievo in ogni data
    UNIQUE(allievo_id, data)
);

-- 3. TABELLA ATTIVITA (Calendario settimanale pianificato per camp)
CREATE TABLE attivita (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    camp TEXT NOT NULL CHECK (camp IN ('summer', 'spring', 'winter')),
    nome TEXT NOT NULL,
    giorno TEXT NOT NULL CHECK (giorno IN ('1', '2', '3', '4', '5')), -- '1' = Lunedì .. '5' = Venerdì
    inizio TEXT NOT NULL, -- Formato 'HH:MM'
    fine TEXT NOT NULL,   -- Formato 'HH:MM'
    target TEXT NOT NULL CHECK (target IN ('tutti', 'baby', 'bambino')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. INDICI DI PRESTAZIONE (Per ricerche rapide)
CREATE INDEX idx_allievi_camp ON allievi(camp);
CREATE INDEX idx_presenze_data_camp ON presenze(data, camp);
CREATE INDEX idx_attivita_camp_giorno ON attivita(camp, giorno);

-- 5. ABILITAZIONE SICUREZZA (Row Level Security - RLS)
ALTER TABLE allievi ENABLE ROW LEVEL SECURITY;
ALTER TABLE presenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE attivita ENABLE ROW LEVEL SECURITY;

-- 6. POLITICHE DI ACCESSO PUBBLICO CON CHIAVE ANONIMA (Lettura/Scrittura senza restrizioni)
CREATE POLICY "Accesso totale anonimo allievi" ON allievi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale anonimo presenze" ON presenze FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Accesso totale anonimo attivita" ON attivita FOR ALL USING (true) WITH CHECK (true);

-- 7. ALLIEVI DI ESEMPIO INIZIALI (Facoltativo - per testare subito l'applicazione)
INSERT INTO allievi (nome, cognome, categoria, camp) VALUES
('Sofia', 'Rossi', 'baby', 'summer'),
('Giulia', 'Ferrari', 'baby', 'summer'),
('Aurora', 'Esposito', 'baby', 'summer'),
('Alice', 'Ricci', 'baby', 'summer'),
('Emma', 'Marino', 'baby', 'summer'),
('Leonardo', 'Bianchi', 'bambino', 'summer'),
('Francesco', 'Russo', 'bambino', 'summer'),
('Lorenzo', 'Romano', 'bambino', 'summer'),
('Mattia', 'Bruno', 'bambino', 'summer'),
('Davide', 'Gallo', 'bambino', 'summer'),
-- Esempio allievi Spring Camp
('Marco', 'Verdi', 'baby', 'spring'),
('Elena', 'Neri', 'bambino', 'spring'),
-- Esempio allievi Winter Camp
('Matteo', 'Poli', 'baby', 'winter'),
('Chiara', 'Lupi', 'bambino', 'winter');

-- Attività di esempio per il Summer Camp
INSERT INTO attivita (camp, nome, giorno, inizio, fine, target) VALUES
('summer', 'Hip Hop e Ritmo', '1', '09:30', '10:30', 'tutti'),
('summer', 'Piscina e Giochi d''Acqua', '1', '11:00', '12:30', 'bambino'),
('summer', 'Laboratorio di Fiabe', '1', '11:00', '12:00', 'baby'),
('summer', 'Laboratorio Creativo', '2', '10:00', '11:30', 'tutti'),
('summer', 'Danza Moderna', '3', '09:30', '11:00', 'bambino');
