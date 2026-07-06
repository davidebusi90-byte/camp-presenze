/**
 * API.js - Modulo per l'integrazione con le API backend
 * Include fallback automatico su localStorage con dati mock per test offline.
 */

const STORAGE_KEYS = {
    API_URL: 'camp_api_url',
    STUDENTS: 'camp_students_data', // Struttura: { [camp]: { [date]: [students] } }
    ACTIVITIES: 'camp_activities_data' // Struttura: { [camp]: [activities] }
};

// Dati mock iniziali se non ci sono dati in localStorage
const MOCK_STUDENTS = [
    { id: '1', nome: 'Sofia', cognome: 'Rossi', categoria: 'baby', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: false },
    { id: '2', nome: 'Leonardo', cognome: 'Bianchi', categoria: 'bambino', preCamp: true, postCamp: false, entrataAnticipata: '08:00', uscitaAnticipata: '', presente: true },
    { id: '3', nome: 'Giulia', cognome: 'Ferrari', categoria: 'baby', preCamp: false, postCamp: true, entrataAnticipata: '', uscitaAnticipata: '12:30', presente: true },
    { id: '4', nome: 'Francesco', cognome: 'Russo', categoria: 'bambino', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: false },
    { id: '5', nome: 'Aurora', cognome: 'Esposito', categoria: 'baby', preCamp: true, postCamp: true, entrataAnticipata: '07:45', uscitaAnticipata: '13:00', presente: true },
    { id: '6', nome: 'Lorenzo', cognome: 'Romano', categoria: 'bambino', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: false },
    { id: '7', nome: 'Alice', cognome: 'Ricci', categoria: 'baby', preCamp: true, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: false },
    { id: '8', nome: 'Mattia', cognome: 'Bruno', categoria: 'bambino', preCamp: false, postCamp: true, entrataAnticipata: '', uscitaAnticipata: '', presente: true },
    { id: '9', nome: 'Emma', cognome: 'Marino', categoria: 'baby', preCamp: false, postCamp: false, entrataAnticipata: '', uscitaAnticipata: '', presente: false },
    { id: '10', nome: 'Davide', cognome: 'Gallo', categoria: 'bambino', preCamp: true, postCamp: true, entrataAnticipata: '08:15', uscitaAnticipata: '', presente: true }
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
    // Configura e ottiene l'URL Base dell'API
    getApiUrl() {
        return localStorage.getItem(STORAGE_KEYS.API_URL) || '';
    },

    setApiUrl(url) {
        if (url) {
            localStorage.setItem(STORAGE_KEYS.API_URL, url);
        } else {
            localStorage.removeItem(STORAGE_KEYS.API_URL);
        }
    },

    // Verifica se l'app è collegata ad un'API reale
    isOnlineMode() {
        return this.getApiUrl().trim() !== '';
    },

    // Testa la connessione all'URL API fornito
    async testConnection(url) {
        if (!url) return { success: false, message: 'URL non inserito' };
        
        try {
            // Effettua una chiamata di test (health check o get standard) con timeout breve
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 4000);
            
            const response = await fetch(`${url}/health`, { 
                method: 'GET',
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            }).catch(async (err) => {
                // Se /health fallisce, proviamo una chiamata GET allievi semplice
                return await fetch(`${url}/students?camp=summer&date=2026-07-06`, {
                    method: 'GET',
                    signal: controller.signal
                });
            });
            
            clearTimeout(id);
            if (response.ok) {
                return { success: true, message: 'Connessione stabilita con successo!' };
            } else {
                return { success: false, message: `Errore Server: Risposta con stato ${response.status}` };
            }
        } catch (e) {
            console.error('API Test Error:', e);
            return { 
                success: false, 
                message: 'Impossibile connettersi al server. Verifica CORS o URL. (Dettagli in console)' 
            };
        }
    },

    // Inizializza i dati mock in localStorage se necessario
    initLocalStore() {
        if (!localStorage.getItem(STORAGE_KEYS.STUDENTS)) {
            // Struttura iniziale vuota per le presenze
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify({}));
        }
        if (!localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) {
            // Inseriamo attività mock iniziali
            localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(MOCK_ACTIVITIES));
        }
    },

    // Forza il ripristino dei dati finti per test
    resetMockData() {
        localStorage.removeItem(STORAGE_KEYS.STUDENTS);
        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify({}));
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(MOCK_ACTIVITIES));
        return MOCK_STUDENTS.length;
    },

    // Recupera l'elenco degli allievi con il loro stato per una determinata data e tipo di camp
    async fetchStudents(camp, dateStr) {
        this.initLocalStore();
        
        if (this.isOnlineMode()) {
            const baseUrl = this.getApiUrl();
            try {
                const response = await fetch(`${baseUrl}/students?camp=${camp}&date=${dateStr}`);
                if (response.ok) {
                    return await response.json();
                }
                throw new Error('API centrali non raggiungibili');
            } catch (err) {
                console.warn('Errore fetch API centrale, uso local fallback:', err);
            }
        }

        // --- FALLBACK OFFLINE / LOCALSTORAGE ---
        const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS));
        
        // Verifica se abbiamo già presenze salvate per questo camp in questa data
        if (localData[camp] && localData[camp][dateStr]) {
            return localData[camp][dateStr];
        } else {
            // Se non ci sono record per questo giorno, creiamo una nuova giornata 
            // partendo dall'anagrafica allievi fissa (tutti assenti di default e orari vuoti)
            const freshDayData = MOCK_STUDENTS.map(s => ({
                ...s,
                presente: false, // Inizia la giornata come assente
                entrataAnticipata: s.preCamp ? '08:00' : '', // se preCamp, suggerisci orario
                uscitaAnticipata: ''
            }));
            
            // Salviamo questa giornata appena creata
            if (!localData[camp]) localData[camp] = {};
            localData[camp][dateStr] = freshDayData;
            localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(localData));
            
            return freshDayData;
        }
    },

    // Salva l'appello o lo stato del singolo allievo per una data e camp specifico
    async saveStudentData(camp, dateStr, studentData) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const baseUrl = this.getApiUrl();
            try {
                const response = await fetch(`${baseUrl}/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        camp,
                        date: dateStr,
                        student: studentData
                    })
                });
                if (response.ok) {
                    return true;
                }
                throw new Error('Salvataggio API fallito');
            } catch (err) {
                console.warn('Errore salvataggio API centrale, salvo localmente:', err);
            }
        }

        // --- FALLBACK OFFLINE / LOCALSTORAGE ---
        const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS));
        if (!localData[camp]) localData[camp] = {};
        if (!localData[camp][dateStr]) localData[camp][dateStr] = [];

        // Aggiorna l'allievo specifico nella lista locale
        const index = localData[camp][dateStr].findIndex(s => s.id === studentData.id);
        if (index !== -1) {
            localData[camp][dateStr][index] = studentData;
        } else {
            localData[camp][dateStr].push(studentData);
        }

        localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(localData));
        return true;
    },

    // Ottiene il calendario delle attività per il camp corrente
    async fetchActivities(camp) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const baseUrl = this.getApiUrl();
            try {
                const response = await fetch(`${baseUrl}/activities?camp=${camp}`);
                if (response.ok) {
                    return await response.json();
                }
            } catch (err) {
                console.warn('Errore fetch attività da API:', err);
            }
        }

        // --- FALLBACK OFFLINE ---
        const activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || {};
        return activities[camp] || [];
    },

    // Aggiunge un'attività al calendario
    async saveActivity(camp, newActivity) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const baseUrl = this.getApiUrl();
            try {
                const response = await fetch(`${baseUrl}/activities`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ camp, activity: newActivity })
                });
                if (response.ok) {
                    return await response.json();
                }
            } catch (err) {
                console.warn('Errore invio attività ad API:', err);
            }
        }

        // --- FALLBACK OFFLINE ---
        const activities = JSON.parse(localStorage.getItem(STORAGE_KEYS.ACTIVITIES)) || {};
        if (!activities[camp]) activities[camp] = [];
        
        // Genera ID
        newActivity.id = 'act-' + Date.now();
        activities[camp].push(newActivity);
        
        localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activities));
        return newActivity;
    },

    // Cancella un'attività
    async deleteActivity(camp, activityId) {
        this.initLocalStore();

        if (this.isOnlineMode()) {
            const baseUrl = this.getApiUrl();
            try {
                const response = await fetch(`${baseUrl}/activities/${activityId}?camp=${camp}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    return true;
                }
            } catch (err) {
                console.warn('Errore cancellazione attività da API:', err);
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

// Rendiamo disponibile l'oggetto a livello globale
window.CampAPI = CampAPI;
