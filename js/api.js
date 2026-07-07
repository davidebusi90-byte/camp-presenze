/**
 * API.js - Integrazione diretta con Supabase REST API (PostgREST)
 * Gestisce la memorizzazione di URL e Anon Key e implementa il fallback su localStorage.
 */

const STORAGE_KEYS = {
    SUPABASE_URL: 'camp_supabase_url',
    SUPABASE_KEY: 'camp_supabase_key',
    STUDENTS: 'camp_students_data',     // Fallback offline presenze
    ACTIVITIES: 'camp_activities_data'   // Fallback offline attività
};

const DEFAULTS = {
    SUPABASE_URL: 'https://eegkytdawwajpwysjsli.supabase.co',
    SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZ2t5dGRhd3dhanB3eXNqc2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDIyOTAsImV4cCI6MjA5ODkxODI5MH0.lo_eiSTk0KmataFfpuBtW2s2K9nsmOIPo3nZL_qFalQ'
};

// Dati mock iniziali (fallback offline)
const MOCK_STUDENTS = [
    { id: '1', nome: 'Sofia', cognome: 'Rossi', categoria: 'baby', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: null, intolleranze: 'Allergia al lattosio', patologie: 'Asma (porta inalatore)' },
    { id: '2', nome: 'Leonardo', cognome: 'Bianchi', categoria: 'bambino', preCamp: true, postCamp: false, entrataAnticipata: '07:45', uscitaAnticipata: '', presente: true, intolleranze: 'Celiachia', patologie: '' },
    { id: '3', nome: 'Giulia', cognome: 'Ferrari', categoria: 'baby', preCamp: false, postCamp: true, entrataAnticipata: '', uscitaAnticipata: '17:30', presente: true, intolleranze: '', patologie: '' },
    { id: '4', nome: 'Francesco', cognome: 'Russo', categoria: 'bambino', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: null, intolleranze: '', patologie: '' },
    { id: '5', nome: 'Aurora', cognome: 'Esposito', categoria: 'baby', preCamp: true, postCamp: true, entrataAnticipata: '07:45', uscitaAnticipata: '17:30', presente: true, intolleranze: 'Allergia alle arachidi', patologie: 'Favismo' },
    { id: '6', nome: 'Lorenzo', cognome: 'Romano', categoria: 'bambino', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: null, intolleranze: '', patologie: '' },
    { id: '7', nome: 'Alice', cognome: 'Ricci', categoria: 'baby', preCamp: true, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: null, intolleranze: '', patologie: '' },
    { id: '8', nome: 'Mattia', cognome: 'Bruno', categoria: 'bambino', preCamp: false, postCamp: true, entrataAnticipata: '', uscitaAnticipata: '', presente: true, intolleranze: '', patologie: '' },
    { id: '9', nome: 'Emma', cognome: 'Marino', categoria: 'baby', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: null, intolleranze: '', patologie: '' },
    { id: '10', nome: 'Davide', cognome: 'Gallo', categoria: 'bambino', preCamp: true, postCamp: true, entrataAnticipata: '07:45', uscitaAnticipata: '17:30', presente: true, intolleranze: '', patologie: '' }
];

const MOCK_ACTIVITIES = {
    summer: [
        { id: 'act-1', nome: 'Hip Hop e Ritmo', giorno: '1', inizio: '09:30', fine: '10:30', target: 'tutti' },
        { id: 'act-2', nome: 'Piscina e Giochi d\'Acqua', giorno: '1', inizio: '11:00', fine: '12:30', target: 'bambino' },
        { id: 'act-3', nome: 'Laboratorio di Fiabe e Movimento', giorno: '1', inizio: '11:00', fine: '12:00', target: 'baby' },
        { id: 'act-4', nome: 'Laboratorio Manuale Creativo', giorno: '2', inizio: '10:00', fine: '11:30', target: 'tutti' },
        { id: 'act-5', nome: 'Danza Moderna', giorno: '3', inizio: '09:30', fine: '11:00', target: 'bambino' }
    ],
    spring: [
        { id: 'act-1', nome: 'Danza Creativa in Giardino', giorno: '1', inizio: '10:00', fine: '11:30', target: 'tutti' },
        { id: 'act-2', nome: 'Caccia alle Uova di Primavera', giorno: '2', inizio: '10:30', fine: '12:00', target: 'baby' }
    ],
    winter: [
        { id: 'act-1', nome: 'Danza sui Pattini e Ritmo Natalizio', giorno: '1', inizio: '10:00', fine: '11:30', target: 'tutti' },
        { id: 'act-2', nome: 'Teatro e Canto delle Feste', giorno: '3', inizio: '10:30', fine: '12:00', target: 'bambino' }
    ]
};

const CampAPI = {
    // Configura e ottiene i parametri Supabase
    getSupabaseConfig() {
        return {
            url: localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULTS.SUPABASE_URL,
            key: localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || DEFAULTS.SUPABASE_KEY
        };
    },

    setSupabaseConfig(url, key) {
        if (url && key) {
            localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url.trim().replace(/\/$/, "")); // Rimuove eventuale slash finale
            localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key.trim());
        } else {
            localStorage.removeItem(STORAGE_KEYS.SUPABASE_URL);
            localStorage.removeItem(STORAGE_KEYS.SUPABASE_KEY);
        }
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

    // Inizializza localStorage
    initLocalStore() {
        if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify({}));
        }
        if (!localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) {
            localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(MOCK_ACTIVITIES));
        }
    },

    // Ripristina mock data offline
    resetMockData() {
        localStorage.removeItem(STORAGE_KEYS.STUDENTS);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify({}));
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(MOCK_ACTIVITIES));
        return MOCK_STUDENTS.length;
    },

    // Recupera la lista degli allievi e ne unisce lo stato presenze della data selezionata
    async fetchStudents(camp, dateStr) {
        this.initLocalStore();
        
        if (this.isOnlineMode()) {
            const config = this.getSupabaseConfig();
            try {
                // 1. Scarica tutti gli allievi di questo Camp
                const urlAllievi = `${config.url}/rest/v1/allievi?camp=eq.${camp}&select=*`;
                const resAllievi = await fetch(urlAllievi, {
                    method: 'GET',
                    headers: this.getHeaders()
                });
                
                if (!resAllievi.ok) throw new Error('Impossibile scaricare allievi');
                const allievi = await resAllievi.json();

                // 2. Scarica i record di presenza per questo camp e data
                const urlPresenze = `${config.url}/rest/v1/presenze?camp=eq.${camp}&data=eq.${dateStr}&select=*`;
                const resPresenze = await fetch(urlPresenze, {
                    method: 'GET',
                    headers: this.getHeaders()
                });
                
                if (!resPresenze.ok) throw new Error('Impossibile scaricare presenze');
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
            } catch (err) {
                console.warn('Errore Supabase Cloud, uso local fallback:', err);
            }
        }

        // --- FALLBACK OFFLINE / LOCALSTORAGE ---
        const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS));
        if (localData[camp] && localData[camp][dateStr]) {
            return localData[camp][dateStr];
        } else {
            const registry = JSON.parse(localStorage.getItem('camp_students_registry')) || MOCK_STUDENTS;
            const freshDayData = registry.map(s => ({
                ...s,
                presente: null, // Neutro di default
                preCamp: false,
                postCamp: false,
                entrataAnticipata: '',
                uscitaAnticipata: ''
            }));
            
            if (!localData[camp]) localData[camp] = {};
            localData[camp][dateStr] = freshDayData;
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(localData));
            
            return freshDayData;
        }
    },

    // Salva o aggiorna (UPSERT) la presenza di un allievo
    async saveStudentData(camp, dateStr, studentData) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const config = this.getSupabaseConfig();
            try {
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
                    console.warn(`Errore salvataggio Supabase (${response.status}): ${errText}`);
                }
            } catch (err) {
                console.warn('Errore connessione o salvataggio Supabase, uso local fallback:', err);
            }
        }

        // --- FALLBACK OFFLINE / LOCALSTORAGE ---
        const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS));
        if (!localData[camp]) localData[camp] = {};
        if (!localData[camp][dateStr]) localData[camp][dateStr] = [];

        const index = localData[camp][dateStr].findIndex(s => s.id === studentData.id);
        if (index !== -1) {
            localData[camp][dateStr][index] = studentData;
        } else {
            localData[camp][dateStr].push(studentData);
        }

        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(localData));
        return true;
    },

    // Aggiorna le intolleranze alimentari e patologie di un allievo
    async saveStudentMedicalInfo(camp, studentId, intolleranze, patologie) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const config = this.getSupabaseConfig();
            try {
                const url = `${config.url}/rest/v1/allievi?id=eq.${studentId}`;
                const response = await fetch(url, {
                    method: 'PATCH',
                    headers: this.getHeaders(),
                    body: JSON.stringify({ 
                        intolleranze: intolleranze,
                        patologie: patologie
                    })
                });

                if (response.ok) return true;
                const errText = await response.text();
                throw new Error(`Errore Supabase (${response.status}): ${errText}`);
            } catch (err) {
                console.error('Errore salvataggio intolleranze/patologie Supabase:', err);
                throw err; // Rilancia l'errore al chiamante
            }
        }

        // --- FALLBACK OFFLINE / LOCALSTORAGE ---
        // 1. Aggiorna nel registro anagrafico degli studenti
        const registry = JSON.parse(localStorage.getItem('camp_students_registry')) || MOCK_STUDENTS;
        const studentInRegistry = registry.find(s => s.id === studentId);
        if (studentInRegistry) {
            studentInRegistry.intolleranze = intolleranze;
            studentInRegistry.patologie = patologie;
            localStorage.setItem('camp_students_registry', JSON.stringify(registry));
        }

        // 2. Aggiorna in tutte le date esistenti del camp corrente
        const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS)) || {};
        if (localData[camp]) {
            Object.keys(localData[camp]).forEach(dateStr => {
                const list = localData[camp][dateStr];
                const student = list.find(s => s.id === studentId);
                if (student) {
                    student.intolleranze = intolleranze;
                    student.patologie = patologie;
                }
            });
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(localData));
        }
        return true;
    },

    // Ottiene le attività dal calendario Supabase
    async fetchActivities(camp) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const config = this.getSupabaseConfig();
            try {
                const url = `${config.url}/rest/v1/attivita?camp=eq.${camp}&select=*`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: this.getHeaders()
                });
                if (response.ok) {
                    return await response.json();
                }
            } catch (err) {
                console.warn('Errore fetch attività da Supabase:', err);
            }
        }

        // --- FALLBACK OFFLINE ---
        const activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || {};
        return activities[camp] || [];
    },

    // Aggiunge un'attività nel calendario Supabase
    async saveActivity(camp, newActivity) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const config = this.getSupabaseConfig();
            try {
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

                if (response.ok) {
                    const inserted = await response.json();
                    return inserted[0] || newActivity;
                }
            } catch (err) {
                console.warn('Errore invio attività a Supabase:', err);
            }
        }

        // --- FALLBACK OFFLINE ---
        const activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || {};
        if (!activities[camp]) activities[camp] = [];
        
        newActivity.id = 'act-' + Date.now();
        activities[camp].push(newActivity);
        
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
        return newActivity;
    },

    // Rimuove un'attività da Supabase
    async deleteActivity(camp, activityId) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const config = this.getSupabaseConfig();
            try {
                const url = `${config.url}/rest/v1/attivita?id=eq.${activityId}`;
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: this.getHeaders()
                });
                if (response.ok) return true;
            } catch (err) {
                console.warn('Errore cancellazione attività da Supabase:', err);
            }
        }

        // --- FALLBACK OFFLINE ---
        const activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || {};
        if (activities[camp]) {
            activities[camp] = activities[camp].filter(act => act.id !== activityId);
            localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
        }
        return true;
    }
};

window.CampAPI = CampAPI;
