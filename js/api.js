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
            url: localStorage.getItem(STORAGE_KEYS.SUPABASE_URL) || DEFAULTS.SUPABASE_URL,
            key: localStorage.getItem(STORAGE_KEYS.SUPABASE_KEY) || DEFAULTS.SUPABASE_KEY
        };
    },

    setSupabaseConfig(url, key) {
        localStorage.setItem(STORAGE_KEYS.SUPABASE_URL, url);
        localStorage.setItem(STORAGE_KEYS.SUPABASE_KEY, key);
    },

    // Rileva se l'app è collegata a Supabase
    isOnlineMode() {
        const config = this.getSupabaseConfig();
        return config.url !== '' && config.key !== '';
    },

    // Genera gli header HTTP per Supabase
    getHeaders(key) {
        const config = this.getSupabaseConfig();
        const activeKey = key || config.key;
        const userToken = localStorage.getItem('camp_user_token');
        return {
            'apikey': activeKey,
            'Authorization': `Bearer ${userToken || activeKey}`,
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
        // Utilizziamo il Resource Embedding di PostgREST per scaricare allievi e presenze filtrate per data in un'unica chiamata HTTP
        const url = `${config.url}/rest/v1/allievi?camp=eq.${camp}&select=*,presenze(*)&presenze.data=eq.${dateStr}`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders()
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Impossibile scaricare allievi e presenze (${response.status}): ${errText}`);
        }
        const allievi = await response.json();

        // Mappa i dati uniti direttamente dal database
        return allievi.map(allievo => {
            // Poiché presenze.data=eq.dateStr filtra le presenze nidificate per la data selezionata,
            // l'array allievo.presenze conterrà al massimo 1 elemento (vincolo UNIQUE su allievo_id e data)
            const recordPresenza = allievo.presenze && allievo.presenze.length > 0 ? allievo.presenze[0] : null;
            return {
                id: allievo.id,
                nome: allievo.nome,
                cognome: allievo.cognome,
                categoria: allievo.categoria,
                intolleranze: allievo.intolleranze || '',
                patologie: allievo.patologie || '',
                turni: allievo.turni || '1',
                armadietto: allievo.armadietto || '',
                overrideManual: allievo.override_manual || false,
                colore: allievo.colore || '',
                externalId: allievo.external_id || '',
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

        // Se l'allievo è in stato Neutro (presente === null) e non ha altri servizi attivi,
        // rimuoviamo il record dal database in modo che al caricamento successivo rimanga Neutro (grigio)
        if (studentData.presente === null && !studentData.preCamp && !studentData.postCamp && !studentData.entrataAnticipata && !studentData.uscitaAnticipata) {
            const deleteUrl = `${config.url}/rest/v1/presenze?allievo_id=eq.${studentData.id}&data=eq.${dateStr}`;
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Errore cancellazione presenza Supabase (${response.status}): ${errText}`);
            }
            return true;
        }

        // PostgREST supporta l'UPSERT nativo tramite POST + l'header "Prefer: resolution=merge-duplicates"
        const url = `${config.url}/rest/v1/presenze?on_conflict=allievo_id,data`;
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

    // Aggiunge un nuovo allievo su Supabase
    async addStudent(camp, studentData) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato.');
        }

        const config = this.getSupabaseConfig();
        const headers = this.getHeaders();

        // Genera ID manuale consecutivo (0X1, 0X2, ...)
        let nextManualId = '0X1';
        try {
            const selectUrl = `${config.url}/rest/v1/allievi?external_id=like.0X%25&select=external_id`;
            const selectRes = await fetch(selectUrl, { method: 'GET', headers });
            if (selectRes.ok) {
                const manualStudents = await selectRes.json();
                let maxNum = 0;
                if (manualStudents && manualStudents.length > 0) {
                    manualStudents.forEach(s => {
                        const num = parseInt(s.external_id.replace('0X', ''), 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    });
                }
                nextManualId = `0X${maxNum + 1}`;
            }
        } catch (e) {
            console.error('Errore nel calcolo del prefisso 0X consecutivo:', e);
        }

        const url = `${config.url}/rest/v1/allievi`;
        headers['Prefer'] = 'return=representation';

        const payload = {
            camp: camp,
            nome: studentData.nome,
            cognome: studentData.cognome,
            categoria: studentData.categoria,
            intolleranze: studentData.intolleranze || '',
            patologie: studentData.patologie || '',
            external_id: nextManualId,
            turni: studentData.turni || '1',
            armadietto: studentData.armadietto || '',
            override_manual: true // È stato creato manualmente
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore inserimento allievo Supabase (${response.status}): ${errText}`);
        }
        const inserted = await response.json();
        return inserted[0];
    },

    // Aggiorna le informazioni anagrafiche di un allievo
    async updateStudentInfo(studentId, studentData) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/allievi?id=eq.${studentId}`;
        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.getHeaders(),
            body: JSON.stringify({ 
                nome: studentData.nome,
                cognome: studentData.cognome,
                categoria: studentData.categoria,
                intolleranze: studentData.intolleranze || '',
                patologie: studentData.patologie || '',
                turni: studentData.turni || '1',
                armadietto: studentData.armadietto || '',
                override_manual: true // Imposta a TRUE quando l'operatore modifica i dati
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore aggiornamento allievo Supabase (${response.status}): ${errText}`);
        }
        return true;
    },

    // Rimuove un allievo da Supabase
    async deleteStudent(studentId) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/allievi?id=eq.${studentId}`;
        const response = await fetch(url, {
            method: 'DELETE',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore cancellazione allievo Supabase (${response.status}): ${errText}`);
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
    },

    // Effettua il login su Supabase Auth
    async login(email, password) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato. Inserisci URL e Anon Key nelle Impostazioni.');
        }
        const config = this.getSupabaseConfig();
        const url = `${config.url}/auth/v1/token?grant_type=password`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': config.key,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: email.trim(), password: password })
        });
        
        if (!response.ok) {
            const errJson = await response.json().catch(() => ({}));
            const errMsg = errJson.error_description || errJson.error || 'Credenziali non valide.';
            throw new Error(errMsg);
        }
        
        const data = await response.json();
        if (data.access_token) {
            localStorage.setItem('camp_user_token', data.access_token);
            localStorage.setItem('camp_user_email', data.user.email);
            return data;
        } else {
            throw new Error('Errore durante la ricezione del token di sessione.');
        }
    },

    // Effettua il logout localmente
    logout() {
        localStorage.removeItem('camp_user_token');
        localStorage.removeItem('camp_user_email');
    },

    // ==========================================================================
    // IMPORTAZIONE DA API ESTERNA (formato tecnico fornitore)
    // ==========================================================================

    /**
     * Estrae l'anno di nascita a 4 cifre da diversi formati (YYYY-MM-DD o DD/MM/YYYY)
     */
    _getBirthYear(dateStr) {
        if (!dateStr) return null;
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts[0].length === 4) return parseInt(parts[0], 10);
            if (parts[2].length === 4) return parseInt(parts[2], 10);
        }
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[2].length === 4) return parseInt(parts[2], 10);
            if (parts[0].length === 4) return parseInt(parts[0], 10);
        }
        const match = dateStr.match(/\b\d{4}\b/);
        return match ? parseInt(match[0], 10) : null;
    },

    /**
     * Determina la categoria (baby/bambino) dall'allievo esterno.
     * Baby: 3-5 anni. Bambini: 6-18 anni.
     */
    _determinaCategoria(allievoEsterno) {
        if (allievoEsterno.data_nascita) {
            const annoCamp = parseInt(allievoEsterno.annualita || new Date().getFullYear(), 10);
            const annoNascita = this._getBirthYear(allievoEsterno.data_nascita);
            if (annoNascita) {
                const eta = annoCamp - annoNascita;
                return (eta >= 3 && eta <= 5) ? 'baby' : 'bambino';
            }
        }
        return 'bambino';
    },

    /**
     * Determina il camp (summer/spring/winter) dal campo rd_camp dell'allievo esterno.
     */
    _determinaCamp(allievoEsterno, campTarget) {
        const rdCamp = (allievoEsterno.rd_camp || '').toLowerCase();
        if (rdCamp.includes('summer') || rdCamp.includes('estiv')) return 'summer';
        if (rdCamp.includes('spring') || rdCamp.includes('primaver')) return 'spring';
        if (rdCamp.includes('winter') || rdCamp.includes('inver')) return 'winter';
        return campTarget; // Usa il camp selezionato dall'utente nell'interfaccia
    },

    /**
     * Importa un array di allievi dal formato API esterna al database Supabase.
     */
    async importFromExternalAPI(allievi, campTarget, onProgress) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato.');
        }

        const config = this.getSupabaseConfig();
        const headers = this.getHeaders();

        // 1. Salva l'importazione come file storico nel database (7 file a settimana)
        try {
            const importFileName = `import_${campTarget}_${new Date().toISOString().replace(/T/, '_').substring(0, 19).replace(/:/g, '-')}.json`;
            const insertImportUrl = `${config.url}/rest/v1/importazioni`;
            await fetch(insertImportUrl, {
                method: 'POST',
                headers: { ...headers, 'Prefer': 'return=minimal' },
                body: JSON.stringify({
                    nome_file: importFileName,
                    camp: campTarget,
                    payload: allievi
                })
            });
        } catch (importErr) {
            console.error("Errore nel salvataggio storico file importazione:", importErr);
        }

        let importati = 0;
        let aggiornati = 0;
        const dettagliErrori = [];

        // Pre-fetch all existing students to do lookups in memory (performance optimization)
        let dbStudents = [];
        try {
            const fetchAllUrl = `${config.url}/rest/v1/allievi?select=id,nome,cognome,external_id,override_manual`;
            const fetchAllRes = await fetch(fetchAllUrl, { method: 'GET', headers });
            if (fetchAllRes.ok) {
                dbStudents = await fetchAllRes.json();
            }
        } catch (fetchErr) {
            console.error("Errore nel pre-fetch degli allievi per importazione:", fetchErr);
        }

        for (let i = 0; i < allievi.length; i++) {
            const a = allievi[i];
            const nomeCompleto = `${a.nome || ''} ${a.cognome || ''}`.trim();

            if (onProgress) onProgress(i + 1, allievi.length, nomeCompleto);

            try {
                const camp = this._determinaCamp(a, campTarget);
                const categoria = this._determinaCategoria(a);

                // Costruisce le note sanitarie dal campo segnalazioni_sanitarie
                const segnalazioni = (a.segnalazioni_sanitarie || '').trim();
                const patologie = (segnalazioni.toUpperCase() === 'NESSUNA' || segnalazioni === '') ? '' : segnalazioni;

                // Dati dell'allievo da salvare su Supabase
                const payload = {
                    external_id: String(a.id_allievo || a.Cod || '').trim(),
                    nome: (a.nome || '').trim(),
                    cognome: (a.cognome || '').trim(),
                    categoria: categoria,
                    camp: camp,
                    colore: (a.colore || '').trim(),  // Salvato così com'è per uso futuro
                    intolleranze: '',    // Non presente nel formato esterno — lasciato vuoto
                    patologie: patologie
                };

                // Prima controlla se esiste un allievo manuale (external_id inizia con '0X') con lo stesso nome e cognome
                let existing = [];
                const existingManual = dbStudents.filter(s => 
                    s.nome === payload.nome && 
                    s.cognome === payload.cognome && 
                    s.external_id && 
                    s.external_id.startsWith('0X')
                );
                
                if (existingManual.length > 0) {
                    // Trovato allievo manuale con lo stesso nome/cognome. Chiediamo all'operatore se è la stessa persona
                    const isSamePerson = confirm(
                        `Attenzione: L'allievo in importazione "${payload.nome} ${payload.cognome}" coincide con l'allievo inserito manualmente "${payload.nome} ${payload.cognome}" (ID: ${existingManual[0].external_id})?\n\nClicca OK per collegare i record e assegnare l'ID ufficiale, o Annulla per importarli come allievi separati.`
                    );
                    if (isSamePerson) {
                        // Fonde i due allievi aggiornando l'ID dell'allievo manuale con l'ID ufficiale in arrivo
                        const mergeUrl = `${config.url}/rest/v1/allievi?id=eq.${existingManual[0].id}`;
                        const mergeRes = await fetch(mergeUrl, {
                            method: 'PATCH',
                            headers,
                            body: JSON.stringify({
                                external_id: payload.external_id,
                                override_manual: true // Mantiene l'override manuale attivo
                            })
                        });
                        if (!mergeRes.ok) throw new Error(`Fusione record fallita: ${await mergeRes.text()}`);
                        
                        // Lo marchiamo come esistente con override_manual attivo per l'aggiornamento
                        existing = [{ id: existingManual[0].id, override_manual: true }];

                        // Aggiorna l'entry nel cache locale
                        const idx = dbStudents.findIndex(s => s.id === existingManual[0].id);
                        if (idx !== -1) {
                            dbStudents[idx].external_id = payload.external_id;
                            dbStudents[idx].override_manual = true;
                        }
                    }
                }

                // Se non c'è stata fusione, cerca l'allievo esistente tramite il suo external_id ufficiale
                if (existing.length === 0 && payload.external_id && !payload.external_id.startsWith('0X')) {
                    const match = dbStudents.find(s => s.external_id === payload.external_id);
                    if (match) {
                        existing = [{ id: match.id, override_manual: match.override_manual }];
                    }
                }

                if (existing && existing.length > 0) {
                    // AGGIORNAMENTO: controlla se c'è l'override manuale attivo
                    const overrideManual = existing[0].override_manual;
                    const updatePayload = overrideManual ? {
                        // Se c'è l'override manuale, non sovrascriviamo nome, cognome e categoria
                        camp: payload.camp,
                        colore: payload.colore,
                        patologie: payload.patologie
                    } : {
                        nome: payload.nome,
                        cognome: payload.cognome,
                        categoria: payload.categoria,
                        camp: payload.camp,
                        colore: payload.colore,
                        patologie: payload.patologie
                    };

                    const updateUrl = `${config.url}/rest/v1/allievi?id=eq.${existing[0].id}`;
                    const updateRes = await fetch(updateUrl, {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify(updatePayload)
                    });
                    if (!updateRes.ok) {
                        const err = await updateRes.text();
                        throw new Error(`PATCH fallito (${updateRes.status}): ${err}`);
                    }
                    aggiornati++;
                } else {
                    // INSERIMENTO: POST nuovo allievo
                    const insertUrl = `${config.url}/rest/v1/allievi`;
                    const insertRes = await fetch(insertUrl, {
                        method: 'POST',
                        headers, // Defaults to return=representation if Prefer is not specified
                        body: JSON.stringify({
                            ...payload,
                            turni: '1',
                            override_manual: false
                        })
                    });
                    if (!insertRes.ok) {
                        const err = await insertRes.text();
                        throw new Error(`POST fallito (${insertRes.status}): ${err}`);
                    }
                    
                    let newId = null;
                    try {
                        const insertedRows = await insertRes.json();
                        newId = insertedRows && insertedRows[0] ? insertedRows[0].id : null;
                    } catch (jsonErr) {
                        console.warn("Impossibile leggere ID allievo inserito:", jsonErr);
                    }

                    importati++;

                    // Inseriamo nel cache locale per evitare duplicati successivi nello stesso file
                    dbStudents.push({
                        id: newId,
                        nome: payload.nome,
                        cognome: payload.cognome,
                        external_id: payload.external_id,
                        override_manual: false
                    });
                }
            } catch (err) {
                dettagliErrori.push({ allievo: nomeCompleto, errore: err.message });
            }
        }

        return { importati, aggiornati, errori: dettagliErrori.length, dettagliErrori };
    },

    // ==========================================================================
    // STORICO GIORNALIERO (Statistiche)
    // ==========================================================================

    /**
     * Recupera lo snapshot storico per una data specifica.
     */
    async fetchHistory(dateStr) {
        if (!this.isOnlineMode()) {
            throw new Error('Supabase non configurato.');
        }

        const config = this.getSupabaseConfig();
        const url = `${config.url}/rest/v1/archivio_presenze?data=eq.${dateStr}&select=payload`;
        const response = await fetch(url, {
            method: 'GET',
            headers: this.getHeaders()
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Errore caricamento storico (${response.status}): ${errText}`);
        }

        const data = await response.json();
        if (data && data.length > 0 && data[0].payload) {
            return data[0].payload;
        }
        return []; // Nessuno storico trovato
    }
};

window.CampAPI = CampAPI;
