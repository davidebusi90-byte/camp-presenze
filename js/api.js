/**
 * API.js - Integrazione diretta con Supabase REST API (PostgREST)
 * Gestisce la memorizzazione di URL e Anon Key.
 */

const STORAGE_KEYS = {
    SUPABASE_URL: 'camp_supabase_url',
    SUPABASE_KEY: 'camp_supabase_key'
};

const DEFAULTS = {
    SUPABASE_URL: 'https://eegkytdawwajpwysjsli.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZ2t5dGRhd3dhanB3eXNqc2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDIyOTAsImV4cCI6MjA5ODkxODI5MH0.lo_eiSTk0KmataFfpuBtW2s2K9nsmOIPo3nZL_qFalQ'
};

const CampAPI = {
    // Configura e ottiene i parametri Supabase
    getSupabaseConfig() {
        return {
            url: DEFAULTS.SUPABASE_URL,
            key: DEFAULTS.SUPABASE_KEY
        };
    },

    setSupabaseConfig(url, key) {
        // Rimosso dall'interfaccia - la configurazione è automatica
    },

    // Rileva se l'app è collegata a Supabase
    isOnlineMode() {
        const config = this.getSupabaseConfig();
        return config.url !== '' && config.key !== '';
    },

    // Genera gli header HTTP per Supabase
    getHeaders(key) {
        const activeKey = key || this.getSupabaseConfig().key;
        return {
            'apikey': activeKey,
            'Authorization': `Bearer ${activeKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    },

    // Testa la connessione a Supabase facendo una query di test sulla tabella allievi
    async testConnection(url, key) {
        if (!url || !key) return { success: false, message: 'URL o Key mancanti.' };
        
        try {
            const cleanUrl = url.trim().replace(/\/$/, "");
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(`${cleanUrl}/rest/v1/allievi?limit=1`, {
                method: 'GET',
                signal: controller.signal,
                headers: this.getHeaders(key)
            });
            
            clearTimeout(id);
            if (response.ok) {
                return { success: true, message: 'Connessione stabilita con successo!' };
            } else {
                const errText = await response.text();
                return { success: false, message: `Errore Supabase (${response.status}): ${errText || 'Verifica lo schema del DB.'}` };
            }
        } catch (e) {
            console.error('Supabase Connection Test Error:', e);
            return { 
                success: false, 
                message: 'Impossibile connettersi a Supabase. Verifica l\'URL o i permessi CORS.' 
            };
        }
    },

    // Recupera la lista degli allievi e ne unisce lo stato presenze della data selezionata
    async fetchStudents(camp, dateStr) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }
        
        const config = this.getSupabaseConfig();
        // 1. Scarica tutti gli allievi di questo Camp
        const urlAllievi = `${config.url}/rest/v1/allievi?camp=eq.${camp}&select=*`;
        const resAllievi = await fetch(urlAllievi, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        if (!resAllievi.ok) {
            const errText = await resAllievi.text();
            throw new Error(`Impossibile scaricare allievi (${resAllievi.status}): ${errText}`);
        }
        const allievi = await resAllievi.json();

        // 2. Scarica i record di presenza per questo camp e data
        const urlPresenze = `${config.url}/rest/v1/presenze?camp=eq.${camp}&data=eq.${dateStr}&select=*`;
        const resPresenze = await fetch(urlPresenze, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        if (!resPresenze.ok) {
            const errText = await resPresenze.text();
            throw new Error(`Impossibile scaricare presenze (${resPresenze.status}): ${errText}`);
        }
        const presenze = await resPresenze.json();

        // 3. Fai il Merge dei dati in memoria
        return allievi.map(allievo => {
            const recordPresenza = presenze.find(p => p.allievo_id === allievo.id);
            return {
                id: allievo.id,
                nome: allievo.nome,
                cognome: allievo.cognome,
                categoria: allievo.categoria,
                intolleranze: allievo.intolleranze || '',
                patologie: allievo.patologie || '',
                // Se c'è un record di presenza, usa i suoi valori, altrimenti imposta i default (null = Neutro)
                presente: recordPresenza ? recordPresenza.presente : null,
                preCamp: recordPresenza ? recordPresenza.pre_camp : false,
                postCamp: recordPresenza ? recordPresenza.post_camp : false,
                entrataAnticipata: recordPresenza ? recordPresenza.entrata_anticipata : '',
                uscitaAnticipata: recordPresenza ? recordPresenza.uscita_anticipata : ''
            };
        });
    },

    // Salva o aggiorna (UPSERT) la presenza di un allievo
    async saveStudentData(camp, dateStr, studentData) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }

        const config = this.getSupabaseConfig();
        // PostgREST supporta l'UPSERT nativo tramite POST + l'header "Prefer: resolution=merge-duplicates"
        const url = `${config.url}/rest/v1/presenze`;
        const headers = this.getHeaders();
        headers['Prefer'] = 'resolution=merge-duplicates'; // Forza l'inserimento/aggiornamento su vincolo unico (allievo_id, data)

        const payload = {
            allievo_id: studentData.id,
            data: dateStr,
            camp: camp,
            presente: studentData.presente === null ? false : studentData.presente,
            pre_camp: studentData.preCamp,
            post_camp: studentData.postCamp,
            entrata_anticipata: studentData.entrataAnticipata || '',
            uscita_anticipata: studentData.uscitaAnticipata || ''
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore salvataggio Supabase (${response.status}): ${errText}`);
        }
        return true;
    },

    // Aggiorna le intolleranze alimentari e patologie di un allievo
    async saveStudentMedicalInfo(camp, studentId, intolleranze, patologie) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/allievi?id=eq.${studentId}`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ 
                intolleranze: intolleranze,
                patologie: patologie
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore Supabase (${response.status}): ${errText}`);
        }
        return true;
    },

    // Ottiene le attività dal calendario Supabase
    async fetchActivities(camp) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/attivita?camp=eq.${camp}&select=*`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore fetch attività da Supabase (${response.status}): ${errText}`);
        }
        return await response.json();
    },

    // Aggiunge un'attività nel calendario Supabase
    async saveActivity(camp, newActivity) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/attivita`;
        const headers = this.getHeaders();
        headers['Prefer'] = 'return=representation'; // Forza PostgREST a restituire la riga inserita (con l'ID autogenerato)

        const payload = {
            camp: camp,
            nome: newActivity.nome,
            giorno: newActivity.giorno,
            inizio: newActivity.inizio,
            fine: newActivity.fine,
            target: newActivity.target
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore invio attività a Supabase (${response.status}): ${errText}`);
        }
        const inserted = await response.json();
        return inserted[0] || newActivity;
    },

    // Rimuove un'attività da Supabase
    async deleteActivity(camp, activityId) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/attivita?id=eq.${activityId}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore cancellazione attività da Supabase (${response.status}): ${errText}`);
        }
        return true;
    }
};

window.CampAPI = CampAPI;
