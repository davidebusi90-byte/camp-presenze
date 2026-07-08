-- =========================================================================
-- SCRIPT DI CONFIGURAZIONE RLS (Row Level Security) & SICUREZZA
-- Incolla questo script all'interno dello "SQL Editor" del tuo Supabase
-- =========================================================================

-- 1. ABILITAZIONE DELLA SICUREZZA (RLS)
-- Abilita RLS su tutte le tabelle se non è già stato fatto
ALTER TABLE allievi ENABLE ROW LEVEL SECURITY;
ALTER TABLE presenze ENABLE ROW LEVEL SECURITY;
ALTER TABLE attivita ENABLE ROW LEVEL SECURITY;

-- 2. PULIZIA DELLE VECCHIE POLITICHE APERTE
-- Rimuove le vecchie politiche anonime aperte per evitare conflitti di sicurezza
DROP POLICY IF EXISTS "Accesso totale anonimo allievi" ON allievi;
DROP POLICY IF EXISTS "Accesso totale anonimo presenze" ON presenze;
DROP POLICY IF EXISTS "Accesso totale anonimo attivita" ON attivita;

-- 3. NUOVE POLITICHE DI SICUREZZA PER "ALLIEVI"
-- Solo gli utenti autenticati (lo staff loggato) possono leggere o scrivere gli allievi
CREATE POLICY "Lettura allievi riservata allo staff autenticato" ON allievi
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Inserimento allievi riservato allo staff autenticato" ON allievi
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Modifica allievi riservata allo staff autenticato" ON allievi
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Eliminazione allievi riservata allo staff autenticato" ON allievi
    FOR DELETE TO authenticated USING (true);

-- 4. NUOVE POLITICHE DI SICUREZZA PER "PRESENZE"
-- Solo gli utenti autenticati (lo staff loggato) possono gestire le presenze
CREATE POLICY "Lettura presenze riservata allo staff autenticato" ON presenze
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Salvataggio presenze riservato allo staff autenticato" ON presenze
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Modifica presenze riservata allo staff autenticato" ON presenze
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Eliminazione presenze riservata allo staff autenticato" ON presenze
    FOR DELETE TO authenticated USING (true);

-- 5. NUOVE POLITICHE DI SICUREZZA PER "ATTIVITA"
-- Le attività del calendario possono essere lette da chiunque (anche anonimo, utile se si visualizzano all'esterno)
-- Ma possono essere create/modificate/eliminate solo dallo staff autenticato
CREATE POLICY "Lettura attivita pubblica" ON attivita
    FOR SELECT TO public USING (true);

CREATE POLICY "Inserimento attivita riservato allo staff autenticato" ON attivita
    FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Eliminazione attivita riservata allo staff autenticato" ON attivita
    FOR DELETE TO authenticated USING (true);


-- =========================================================================
-- CREAZIONE UTENTE ADMIN IN SUPABASE (OPZIONALE VIA SQL)
-- =========================================================================
-- NOTA: Il modo più semplice e sicuro per creare l'account admin dello staff
-- è andare nel pannello di controllo di Supabase sotto la voce:
-- "Auth" -> "Users" -> "Add User" -> "Create User"
-- In alternativa, puoi sbloccare e avviare il comando SQL qui sotto:

/*
CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, 
    email_confirmed_at, recovery_sent_at, last_sign_in_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    uuid_generate_v4(),
    'authenticated',
    'authenticated',
    'admin@camp.it', -- Inserisci qui l'email dell'admin
    crypt('PasswordSicura123!', gen_salt('bf')), -- Sostituisci con una password sicura
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    now(),
    now(),
    '',
    '',
    '',
    ''
) ON CONFLICT (email) DO NOTHING;

-- Per garantire la corretta registrazione su Supabase Auth, creiamo l'identità associata
INSERT INTO auth.identities (
    id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT 
    id, id, 
    json_build_object('sub', id, 'email', email), 
    'email', now(), now(), now()
FROM auth.users 
WHERE email = 'admin@camp.it'
ON CONFLICT (provider, identity_data) DO NOTHING;
*/
