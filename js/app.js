/**
 * App.js - Logica principale dell'applicazione presenze Camp.
 * Gestisce l'interfaccia utente, lo stato globale e le interazioni.
 */

// STATO GLOBALE DELL'APPLICAZIONE
const AppState = {
    currentCamp: 'summer',           // 'summer' | 'spring' | 'winter'
    currentDate: new Date(),         // Oggetto Date della giornata selezionata
    currentTab: 'panel-presenze',    // 'panel-presenze' | 'panel-calendario' | 'panel-impostazioni'
    activeFilter: 'all',             // 'all' | 'baby' | 'bambino' | 'present' | 'absent' | 'precamp' | 'postcamp' | 'intolleranze' | 'patologie'
    searchQuery: '',                 // Testo digitato nella barra di ricerca
    activeActivityDay: '1',          // '1' (Lun) .. '5' (Ven)
    students: [],                    // Allievi caricati per la giornata corrente
    activities: [],                  // Attività caricate per il camp corrente
    historyDate: new Date()          // Data selezionata per lo storico
};

// MA MAPPATURA DEI GIORNI DELLA SETTIMANA
const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const MESI_ANNO = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];


// DOCUMENT READY / INIZIALIZZAZIONE
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

// Funzione principale di inizializzazione
async function initApp() {
    // Inizializza icone Lucide
    lucide.createIcons();
    
    // Ripristina camp precedentemente selezionato o impostazioni salvate
    const savedCamp = localStorage.getItem('last_active_camp');
    if (savedCamp && ['summer', 'spring', 'winter'].includes(savedCamp)) {
        AppState.currentCamp = savedCamp;
    }
    
    // Imposta il valore delle chiavi Supabase nelle impostazioni
    const config = window.CampAPI.getSupabaseConfig();
    const supabaseUrlInput = document.getElementById('settings-supabase-url');
    const supabaseKeyInput = document.getElementById('settings-supabase-key');
    if (supabaseUrlInput) supabaseUrlInput.value = config.url;
    if (supabaseKeyInput) supabaseKeyInput.value = config.key;

    // Applica il tema iniziale
    applyCampTheme(AppState.currentCamp);

    // Registra i gestori degli eventi (eseguito solo una volta all'avvio)
    registerEventListeners();

    // Controlla se l'utente è loggato
    const token = localStorage.getItem('camp_user_token');
    if (!token && window.CampAPI.isOnlineMode()) {
        document.getElementById('login-screen').classList.remove('hidden');
        return; // Interrompe il caricamento iniziale dei dati
    }

    // Se loggato, mostra l'email
    if (token) {
        const emailEl = document.getElementById('logged-user-email');
        if (emailEl) emailEl.innerText = localStorage.getItem('camp_user_email') || 'Staff';
    }

    // Aggiornamento automatico ogni 30 secondi se in modalità online (Supabase collegato e utente loggato)
    setInterval(async () => {
        if (AppState.currentTab === 'panel-presenze' && window.CampAPI.isOnlineMode() && localStorage.getItem('camp_user_token')) {
            console.log('Auto-refresh delle presenze da Supabase...');
            await loadStudentsData(true);
        }
    }, 30000);

    // Carica i dati per la prima volta
    await loadCurrentTabContent();
}

// ==========================================================================
// REGISTRAZIONE DEGLI EVENT LISTENERS
// ==========================================================================
function registerEventListeners() {
    
    // 1. Menu a 3 punti per il cambio Camp
    const campMenuBtn = document.getElementById('camp-menu-btn');
    const campDropdownContent = document.getElementById('camp-dropdown-content');
    
    campMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        campDropdownContent.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        campDropdownContent.classList.remove('show');
    });

    // Variazione tema al click sulle voci di dropdown
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            const selectedCamp = e.currentTarget.getAttribute('data-camp');
            
            // Aggiorna voci attive nel dropdown menu
            dropdownItems.forEach(di => di.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            // Applica il tema visivo
            applyCampTheme(selectedCamp);
            
            // Carica i dati per il nuovo camp selezionato
            AppState.currentCamp = selectedCamp;
            localStorage.setItem('last_active_camp', selectedCamp);
            
            await loadCurrentTabContent();
            campDropdownContent.classList.remove('show');
        });
    });

    // 2. Bottom Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            navItems.forEach(ni => ni.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const targetTab = e.currentTarget.getAttribute('data-target');
            
            // Nascondi tutti i pannelli e mostra quello attivo
            const panels = document.querySelectorAll('.app-panel');
            panels.forEach(p => p.classList.remove('active'));
            
            const targetPanel = document.getElementById(targetTab);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
            
            AppState.currentTab = targetTab;
            await loadCurrentTabContent();
        });
    });

    // 3. Navigazione Data
    document.getElementById('btn-prev-date').addEventListener('click', async () => {
        AppState.currentDate.setDate(AppState.currentDate.getDate() - 1);
        await loadStudentsData();
    });

    document.getElementById('btn-next-date').addEventListener('click', async () => {
        AppState.currentDate.setDate(AppState.currentDate.getDate() + 1);
        await loadStudentsData();
    });

    const dateDisplayContainer = document.querySelector('.date-display-container');
    const datePicker = document.getElementById('date-picker');
    
    dateDisplayContainer.addEventListener('click', () => {
        try {
            datePicker.showPicker(); // Forza l'apertura del calendario nativo del browser
        } catch (err) {
            datePicker.click(); // Fallback per vecchi browser
        }
    });

    datePicker.addEventListener('change', async (e) => {
        if (e.target.value) {
            AppState.currentDate = new Date(e.target.value);
            await loadStudentsData();
        }
    });

    // 3.b Navigazione Data Storico
    const historyDateDisplayContainer = document.querySelector('#panel-statistiche .date-display-container');
    const historyDatePicker = document.getElementById('history-date-picker');
    
    if (historyDateDisplayContainer && historyDatePicker) {
        historyDateDisplayContainer.addEventListener('click', () => {
            try {
                historyDatePicker.showPicker();
            } catch (err) {
                historyDatePicker.click();
            }
        });

        historyDatePicker.addEventListener('change', async (e) => {
            if (e.target.value) {
                AppState.historyDate = new Date(e.target.value);
                await loadHistoryTabContent();
            }
        });

        document.getElementById('btn-prev-history-date').addEventListener('click', async () => {
            AppState.historyDate.setDate(AppState.historyDate.getDate() - 1);
            await loadHistoryTabContent();
        });

        document.getElementById('btn-next-history-date').addEventListener('click', async () => {
            AppState.historyDate.setDate(AppState.historyDate.getDate() + 1);
            await loadHistoryTabContent();
        });
    }

    // 4. Ricerca e Filtri
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');

    searchInput.addEventListener('input', (e) => {
        AppState.searchQuery = e.target.value.toLowerCase().trim();
        if (AppState.searchQuery.length > 0) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        renderStudentsList();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        AppState.searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderStudentsList();
    });

    const filterPills = document.querySelectorAll('.filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            filterPills.forEach(fp => fp.classList.remove('active'));
            e.currentTarget.classList.add('active');
            AppState.activeFilter = e.currentTarget.getAttribute('data-filter');
            renderStudentsList();
        });
    });

    // 5. Modale Gestione Intolleranze e Patologie
    const medicalModal = document.getElementById('medical-modal');
    const timeEditModal = document.getElementById('time-edit-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');
    
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            medicalModal.classList.add('hidden');
            timeEditModal.classList.add('hidden');
            document.getElementById('activity-modal').classList.add('hidden');
            document.getElementById('student-modal').classList.add('hidden');
        });
    });

    document.getElementById('btn-save-medical').addEventListener('click', async () => {
        const studentId = document.getElementById('medical-modal-student-id').value;
        const intolleranzeVal = document.getElementById('input-intolleranze').value.trim();
        const patologieVal = document.getElementById('input-patologie').value.trim();

        // Trova l'allievo e aggiorna le sue informazioni mediche
        const student = AppState.students.find(s => s.id === studentId);
        if (student) {
            const oldIntolleranze = student.intolleranze;
            const oldPatologie = student.patologie;
            
            student.intolleranze = intolleranzeVal;
            student.patologie = patologieVal;
            
            try {
                // Salva tramite API
                await window.CampAPI.saveStudentMedicalInfo(AppState.currentCamp, studentId, intolleranzeVal, patologieVal);
                medicalModal.classList.add('hidden');
                renderStudentsList();
            } catch (err) {
                // Ripristina stato precedente
                student.intolleranze = oldIntolleranze;
                student.patologie = oldPatologie;
                alert("Errore durante il salvataggio su Supabase!\n\nVerifica:\n1. Di aver inserito URL e Anon Key corretti nella scheda 'Impostazioni'.\n2. Di aver eseguito la query SQL per aggiungere le colonne 'intolleranze' e 'patologie' sul tuo database Supabase.\n\nDettaglio errore: " + err.message);
                renderStudentsList();
            }
        }
    });

    document.getElementById('btn-clear-medical').addEventListener('click', async () => {
        const studentId = document.getElementById('medical-modal-student-id').value;
        const student = AppState.students.find(s => s.id === studentId);
        if (student) {
            const oldIntolleranze = student.intolleranze;
            const oldPatologie = student.patologie;
            
            student.intolleranze = '';
            student.patologie = '';
            
            try {
                // Salva tramite API
                await window.CampAPI.saveStudentMedicalInfo(AppState.currentCamp, studentId, '', '');
                medicalModal.classList.add('hidden');
                renderStudentsList();
            } catch (err) {
                student.intolleranze = oldIntolleranze;
                student.patologie = oldPatologie;
                alert("Errore durante la cancellazione su Supabase!\n\nDettaglio errore: " + err.message);
                renderStudentsList();
            }
        }
    });

    // Modale Modifica Singolo Orario (Entrata / Uscita)
    document.getElementById('btn-save-time').addEventListener('click', async () => {
        const studentId = document.getElementById('time-edit-student-id').value;
        const timeType = document.getElementById('time-edit-type').value; // 'entry' o 'exit'
        const timeVal = document.getElementById('input-edit-time').value;

        const student = AppState.students.find(s => s.id === studentId);
        if (student) {
            const oldVal = (timeType === 'entry') ? student.entrataAnticipata : student.uscitaAnticipata;
            if (timeType === 'entry') {
                student.entrataAnticipata = timeVal;
            } else {
                student.uscitaAnticipata = timeVal;
            }
            
            try {
                // Salva tramite API
                const dateStr = formatDateToISO(AppState.currentDate);
                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                timeEditModal.classList.add('hidden');
                renderStudentsList();
                updateStatsSummary();
            } catch (err) {
                if (timeType === 'entry') {
                    student.entrataAnticipata = oldVal;
                } else {
                    student.uscitaAnticipata = oldVal;
                }
                alert("Errore durante il salvataggio dell'orario su Supabase!\n\nDettaglio errore: " + err.message);
                renderStudentsList();
            }
        }
    });

    document.getElementById('btn-delete-time').addEventListener('click', async () => {
        const studentId = document.getElementById('time-edit-student-id').value;
        const timeType = document.getElementById('time-edit-type').value;

        const student = AppState.students.find(s => s.id === studentId);
        if (student) {
            const oldVal = (timeType === 'entry') ? student.entrataAnticipata : student.uscitaAnticipata;
            if (timeType === 'entry') {
                student.entrataAnticipata = '';
            } else {
                student.uscitaAnticipata = '';
            }
            
            try {
                // Salva tramite API
                const dateStr = formatDateToISO(AppState.currentDate);
                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                timeEditModal.classList.add('hidden');
                renderStudentsList();
                updateStatsSummary();
            } catch (err) {
                if (timeType === 'entry') {
                    student.entrataAnticipata = oldVal;
                } else {
                    student.uscitaAnticipata = oldVal;
                }
                alert("Errore durante l'eliminazione dell'orario su Supabase!\n\nDettaglio errore: " + err.message);
                renderStudentsList();
            }
        }
    });

    // 6. Impostazioni Supabase e Reset
    const btnSaveSettings = document.getElementById('btn-save-settings');
    if (btnSaveSettings) {
        btnSaveSettings.addEventListener('click', () => {
            const urlValue = document.getElementById('settings-supabase-url').value.trim();
            const keyValue = document.getElementById('settings-supabase-key').value.trim();
            window.CampAPI.setSupabaseConfig(urlValue, keyValue);
            
            const resultMsg = document.getElementById('api-test-result');
            if (resultMsg) {
                resultMsg.className = 'test-result-message success';
                resultMsg.innerText = 'Impostazioni salvate con successo!';
                
                setTimeout(() => {
                    resultMsg.innerText = '';
                }, 3000);
            }
        });
    }

    const btnTestApi = document.getElementById('btn-test-api');
    if (btnTestApi) {
        btnTestApi.addEventListener('click', async () => {
            const urlValue = document.getElementById('settings-supabase-url').value.trim();
            const keyValue = document.getElementById('settings-supabase-key').value.trim();
            const resultMsg = document.getElementById('api-test-result');
            if (resultMsg) {
                resultMsg.className = 'test-result-message';
                resultMsg.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; display:inline-block; margin-right:8px;"></div> Verification in corso...';
            }
            
            const test = await window.CampAPI.testConnection(urlValue, keyValue);
            if (resultMsg) {
                if (test.success) {
                    resultMsg.className = 'test-result-message success';
                    resultMsg.innerText = test.message;
                } else {
                    resultMsg.className = 'test-result-message error';
                    resultMsg.innerText = test.message;
                }
            }
        });
    }

    // 7. Calendario Attività: Filtro giorni
    const dayPills = document.querySelectorAll('.day-pill');
    dayPills.forEach(pill => {
        pill.addEventListener('click', (e) => {
            dayPills.forEach(dp => dp.classList.remove('active'));
            e.currentTarget.classList.add('active');
            AppState.activeActivityDay = e.currentTarget.getAttribute('data-day');
            renderActivitiesList();
        });
    });

    // 8. Calendario Attività: Aggiungi Attività
    const activityModal = document.getElementById('activity-modal');
    document.getElementById('btn-add-activity').addEventListener('click', () => {
        // Pre-compila il giorno con quello correntemente selezionato
        document.getElementById('activity-day').value = AppState.activeActivityDay;
        
        // Svuota gli altri campi
        document.getElementById('activity-name').value = '';
        document.getElementById('activity-time-start').value = '09:00';
        document.getElementById('activity-time-end').value = '10:00';
        document.getElementById('activity-target').value = 'tutti';
        
        activityModal.classList.remove('hidden');
    });

    document.getElementById('activity-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('activity-name').value.trim();
        const day = document.getElementById('activity-day').value;
        const start = document.getElementById('activity-time-start').value;
        const end = document.getElementById('activity-time-end').value;
        const target = document.getElementById('activity-target').value;

        const newAct = {
            nome: name,
            giorno: day,
            inizio: start,
            fine: end,
            target: target
        };

        try {
            await window.CampAPI.saveActivity(AppState.currentCamp, newAct);
            activityModal.classList.add('hidden');
            await loadActivitiesData();
        } catch (err) {
            alert("Errore durante il salvataggio dell'attività su Supabase!\n\nDettaglio errore: " + err.message);
        }
    });

    // 9. Filtro allievi al click sui box di riepilogo
    const statCards = document.querySelectorAll('.stat-card.clickable');
    statCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const filterType = e.currentTarget.getAttribute('data-filter-type');
            if (filterType) {
                // Imposta il filtro attivo
                AppState.activeFilter = filterType;
                
                // Aggiorna lo stato attivo delle pillole di filtro
                const filterPills = document.querySelectorAll('.filter-pill');
                filterPills.forEach(pill => {
                    if (pill.getAttribute('data-filter') === filterType) {
                        pill.classList.add('active');
                    } else {
                        pill.classList.remove('active');
                    }
                });
                
                // Renderizza la lista filtrata
                renderStudentsList();
            }
        });
    });

    // 10. Gestione Modal Inserimento/Modifica Allievo
    const studentModal = document.getElementById('student-modal');
    const btnAddStudent = document.getElementById('btn-add-student');
    if (btnAddStudent) {
        btnAddStudent.addEventListener('click', () => {
            document.getElementById('student-modal-title').innerText = "Aggiungi Allievo";
            document.getElementById('student-modal-id').value = '';
            document.getElementById('student-modal-name').value = '';
            document.getElementById('student-modal-surname').value = '';
            document.getElementById('student-modal-category').value = 'baby';
            document.getElementById('student-modal-intolleranze').value = '';
            document.getElementById('student-modal-patologie').value = '';
            
            // Resetta checkbox turni (turno 1 attivo di default)
            const checkboxes = document.querySelectorAll('.turn-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = (cb.value === '1');
            });

            // Nasconde il pulsante di eliminazione
            document.getElementById('btn-delete-student').style.display = 'none';
            
            studentModal.classList.remove('hidden');
        });
    }

    const studentForm = document.getElementById('student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const studentId = document.getElementById('student-modal-id').value;
            const nomeVal = document.getElementById('student-modal-name').value.trim();
            const cognomeVal = document.getElementById('student-modal-surname').value.trim();
            const categoriaVal = document.getElementById('student-modal-category').value;
            const intolleranzeVal = document.getElementById('student-modal-intolleranze').value.trim();
            const patologieVal = document.getElementById('student-modal-patologie').value.trim();
            
            // Estrae turni selezionati dalle checkbox
            const turnCheckboxes = document.querySelectorAll('.turn-checkbox:checked');
            const turniArr = Array.from(turnCheckboxes).map(cb => cb.value);
            const turniVal = turniArr.length > 0 ? turniArr.join(',') : '1';

            const studentData = {
                nome: nomeVal,
                cognome: cognomeVal,
                categoria: categoriaVal,
                intolleranze: intolleranzeVal,
                patologie: patologieVal,
                turni: turniVal,
                armadietto: ''
            };
            
            try {
                if (studentId) {
                    // MODIFICA
                    const localStudent = AppState.students.find(s => s.id === studentId);
                    studentData.armadietto = localStudent ? localStudent.armadietto : '';

                    await window.CampAPI.updateStudentInfo(studentId, studentData);
                    
                    // Aggiorna lo stato locale
                    if (localStudent) {
                        localStudent.nome = nomeVal;
                        localStudent.cognome = cognomeVal;
                        localStudent.categoria = categoriaVal;
                        localStudent.intolleranze = intolleranzeVal;
                        localStudent.patologie = patologieVal;
                        localStudent.turni = turniVal;
                    }
                } else {
                    // INSERIMENTO
                    const newStudent = await window.CampAPI.addStudent(AppState.currentCamp, studentData);
                    
                    // Inizializza lo stato per l'allievo locale appena inserito
                    const localNew = {
                        id: newStudent.id,
                        nome: newStudent.nome,
                        cognome: newStudent.cognome,
                        categoria: newStudent.categoria,
                        intolleranze: newStudent.intolleranze || '',
                        patologie: newStudent.patologie || '',
                        turni: newStudent.turni || '1',
                        armadietto: newStudent.armadietto || '',
                        overrideManual: newStudent.override_manual || false,
                        colore: newStudent.colore || '',
                        externalId: newStudent.external_id || '',
                        presente: null,
                        preCamp: false,
                        postCamp: false,
                        entrataAnticipata: '',
                        uscitaAnticipata: ''
                    };
                    AppState.students.push(localNew);

                    // Aggiunge la presenza per tutta la settimana corrente (Lunedì-Venerdì)
                    const weekDates = getWeekDates(AppState.currentDate);
                    for (const dStr of weekDates) {
                        try {
                            await window.CampAPI.saveStudentData(AppState.currentCamp, dStr, {
                                id: newStudent.id,
                                presente: null,
                                preCamp: false,
                                postCamp: false,
                                entrataAnticipata: '',
                                uscitaAnticipata: ''
                            });
                        } catch (errPres) {
                            console.error("Errore salvataggio presenza settimanale:", errPres);
                        }
                    }
                }
                
                studentModal.classList.add('hidden');
                await loadStudentsData(true); // Ricarica silenzioso per sincronizzare il DB
                renderStudentsList();
                updateStatsSummary();
            } catch (err) {
                alert("Errore durante il salvataggio dell'allievo su Supabase!\n\nDettaglio errore: " + err.message);
            }
        });
    }

    const btnDeleteStudent = document.getElementById('btn-delete-student');
    if (btnDeleteStudent) {
        btnDeleteStudent.addEventListener('click', async () => {
            const studentId = document.getElementById('student-modal-id').value;
            if (!studentId) return;
            
            const student = AppState.students.find(s => s.id === studentId);
            const studentName = student ? `${student.nome} ${student.cognome}` : 'questo allievo';
            
            if (confirm(`Sei sicuro di voler eliminare definitivamente ${studentName}? Tutti i suoi dati di presenza verranno rimossi.`)) {
                try {
                    await window.CampAPI.deleteStudent(studentId);
                    
                    // Rimuove lo studente dallo stato locale
                    AppState.students = AppState.students.filter(s => s.id !== studentId);
                    
                    studentModal.classList.add('hidden');
                    renderStudentsList();
                    updateStatsSummary();
                } catch (err) {
                    if (checkAuthError(err)) return;
                    alert("Errore durante l'eliminazione dell'allievo da Supabase!\n\nDettaglio errore: " + err.message);
                }
            }
        });
    }

    // 11. Gestione Login e Logout
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const errorMsg = document.getElementById('login-error-msg');
            const errorText = document.getElementById('login-error-text');
            const submitBtn = document.getElementById('btn-submit-login');
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            
            if (!email || !password) return;
            
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; display:inline-block;"></div>';
            errorMsg.classList.add('hidden');
            
            try {
                await window.CampAPI.login(email, password);
                
                // Nascondi schermata di login
                document.getElementById('login-screen').classList.add('hidden');
                
                // Imposta email account
                const emailEl = document.getElementById('logged-user-email');
                if (emailEl) emailEl.innerText = email;
                
                // Pulisci password
                passwordInput.value = '';
                
                // Carica i dati per la prima volta
                await loadCurrentTabContent();
            } catch (err) {
                console.error("Login fallito:", err);
                errorText.innerText = err.message || 'Credenziali errate o errore di connessione.';
                errorMsg.classList.remove('hidden');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<span>Accedi</span>';
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            if (confirm("Sei sicuro di voler effettuare il logout? Per rientrare nell'app dovrai accedere di nuovo.")) {
                window.CampAPI.logout();
                
                // Cancella lo stato locale
                AppState.students = [];
                AppState.activities = [];
                renderStudentsList();
                
                // Pulisci i campi login
                document.getElementById('login-password').value = '';
                
                // Mostra la schermata di login
                document.getElementById('login-screen').classList.remove('hidden');
            }
        });
    }

    // 12. Gestione Sezione Armadietti
    const btnCalculateLockers = document.getElementById('btn-calculate-lockers');
    if (btnCalculateLockers) {
        btnCalculateLockers.addEventListener('click', () => {
            runLockerAssignment();
        });
    }

    const viewTurnSelect = document.getElementById('lockers-view-turn');
    if (viewTurnSelect) {
        viewTurnSelect.addEventListener('change', () => {
            loadLockersTabContent();
        });
    }

    const pillLockersKids = document.getElementById('pill-lockers-kids');
    const pillLockersBaby = document.getElementById('pill-lockers-baby');\r
    const lockersKidsPanel = document.getElementById('lockers-kids-panel');\r
    const lockersBabyPanel = document.getElementById('lockers-baby-panel');\r
\r
    if (pillLockersKids && pillLockersBaby) {\r
        pillLockersKids.addEventListener('click', () => {\r
            pillLockersKids.classList.add('active');\r
            pillLockersBaby.classList.remove('active');\r
            if (lockersKidsPanel) lockersKidsPanel.style.display = 'block';\r
            if (lockersBabyPanel) lockersBabyPanel.style.display = 'none';\r
        });\r
\r
        pillLockersBaby.addEventListener('click', () => {\r
            pillLockersBaby.classList.add('active');\r
            pillLockersKids.classList.remove('active');\r
            if (lockersBabyPanel) lockersBabyPanel.style.display = 'block';\r
            if (lockersKidsPanel) lockersKidsPanel.style.display = 'none';\r
        });\r
    }\r
\r
    // 13. Importazione da API Esterna\r
    const btnImportExternal = document.getElementById('btn-import-external-api');\r
    if (btnImportExternal) {\r
        btnImportExternal.addEventListener('click', async () => {\r
            const jsonText = (document.getElementById('import-json-textarea').value || '').trim();\r
            const campTarget = document.getElementById('import-camp-select').value;\r
            const resultMsg = document.getElementById('import-result-msg');\r
            const progressWrapper = document.getElementById('import-progress-bar-wrapper');\r
            const progressFill = document.getElementById('import-progress-fill');\r
            const progressLabel = document.getElementById('import-progress-label');\r
\r
            // Reset UI\r
            resultMsg.className = 'test-result-message';\r
            resultMsg.innerText = '';\r
            progressWrapper.style.display = 'none';\r
            progressFill.style.width = '0%';\r
\r
            if (!jsonText) {\r
                resultMsg.className = 'test-result-message error';\r
                resultMsg.innerText = 'Errore: nessun dato JSON inserito.';\r
                return;\r
            }\r
\r
            // Parse JSON — accetta sia array diretto che oggetto wrapper { "allievi": [...] }\r
            let allievi;\r
            try {\r
                const parsed = JSON.parse(jsonText);\r
                if (Array.isArray(parsed)) {\r
                    allievi = parsed;\r
                } else if (parsed && Array.isArray(parsed.allievi)) {\r
                    allievi = parsed.allievi;\r
                } else {\r
                    throw new Error('Il JSON deve essere un array di allievi oppure un oggetto con chiave "allievi".');\r
                }\r
            } catch (parseErr) {\r
                resultMsg.className = 'test-result-message error';\r
                resultMsg.innerText = 'Errore nel parsing JSON: ' + parseErr.message;\r
                return;\r
            }\r
\r
            if (allievi.length === 0) {\r
                resultMsg.className = 'test-result-message error';\r
                resultMsg.innerText = 'L\'array è vuoto — nessun allievo da importare.';\r
                return;\r
            }\r
\r
            // Disabilita il pulsante durante l'importazione\r
            btnImportExternal.disabled = true;\r
            btnImportExternal.innerHTML = '<div class="spinner" style="width:16px;height:16px;display:inline-block;margin-right:8px;"></div> Importazione in corso...';\r
            progressWrapper.style.display = 'block';\r
\r
            try {\r
                const result = await window.CampAPI.importFromExternalAPI(\r
                    allievi,\r
                    campTarget,\r
                    (current, total, nome) => {\r
                        const pct = Math.round((current / total) * 100);\r
                        progressFill.style.width = pct + '%';\r
                        progressLabel.innerText = `${current}/${total} — ${nome}`;\r
                    }\r
                );\r
\r
                progressFill.style.width = '100%';\r
                progressLabel.innerText = 'Completato!';\r
\r
                // Mostra riepilogo\r
                let summaryHtml = `✅ Importazione completata!\n`;\r
                summaryHtml += `• Nuovi inseriti: ${result.importati}\n`;\r
                summaryHtml += `• Aggiornati: ${result.aggiornati}\n`;\r
                if (result.errori > 0) {\r
                    summaryHtml += `• Errori: ${result.errori}\n`;\r
                    result.dettagliErrori.forEach(e => {\r
                        summaryHtml += `  ↳ ${e.allievo}: ${e.errore}\n`;\r
                    });\r
                    resultMsg.className = 'test-result-message';\r
                } else {\r
                    resultMsg.className = 'test-result-message success';\r
                }\r
                resultMsg.innerText = summaryHtml;\r
\r
                // Ricarica gli allievi se siamo nel pannello presenze\r
                if (AppState.currentTab === 'panel-presenze') {\r
                    await loadStudentsData();\r
                }\r
            } catch (err) {\r
                resultMsg.className = 'test-result-message error';\r
                resultMsg.innerText = 'Errore durante l\'importazione: ' + err.message;\r
            } finally {\r
                btnImportExternal.disabled = false;\r
                btnImportExternal.innerHTML = '<i data-lucide="upload-cloud"></i> Avvia Importazione';\r
                lucide.createIcons();\r
            }\r
        });\r
    }\r
}

// ==========================================================================
// LOGICA CAMBIO TEMA E LOGHI
// ==========================================================================
function applyCampTheme(camp) {
    const body = document.body;
    const logoImg = document.getElementById('camp-logo');
    
    // Rimuove vecchi temi
    body.classList.remove('theme-summer', 'theme-spring', 'theme-winter');
    
    // Applica classe e logo specifici
    if (camp === 'summer') {
        body.classList.add('theme-summer');
        logoImg.src = 'assets/summer_camp_logo.jpg';
    } else if (camp === 'spring') {
        body.classList.add('theme-spring');
        logoImg.src = 'assets/spring_camp_logo.jpg';
    } else if (camp === 'winter') {
        body.classList.add('theme-winter');
        logoImg.src = 'assets/winter_camp_logo.jpg';
    }

    // Assicura che anche gli elementi all'interno del dropdown menu riflettano la selezione corretta
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
        if (item.getAttribute('data-camp') === camp) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// ==========================================================================
// CARICAMENTO E RENDERING PANNELLO ATTIVO
// ==========================================================================
async function loadCurrentTabContent() {
    if (AppState.currentTab === 'panel-presenze') {
        await loadStudentsData();
    } else if (AppState.currentTab === 'panel-calendario') {
        await loadActivitiesData();
    } else if (AppState.currentTab === 'panel-armadietti') {
        await loadLockersTabContent();
    } else if (AppState.currentTab === 'panel-statistiche') {
        await loadHistoryTabContent();
    }
}

// Caricamento presenze per la data selezionata
async function loadStudentsData(silent = false) {
    const listContainer = document.getElementById('students-list');
    
    if (!silent) {
        listContainer.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Caricamento allievi in corso...</p>
            </div>
        `;
    }

    // Aggiorna l'interfaccia della data
    updateDateDisplay();

    try {
        const dateStr = formatDateToISO(AppState.currentDate);
        AppState.students = await window.CampAPI.fetchStudents(AppState.currentCamp, dateStr);
        renderStudentsList();
        updateStatsSummary();
    } catch (err) {
        if (checkAuthError(err)) return;
        if (!silent) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="alert-triangle"></i>
                    <p>Si è verificato un errore nel caricamento dei dati.</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
}

// Caricamento storico
async function loadHistoryTabContent() {
    const listContainer = document.getElementById('history-students-list');
    const dateDisplay = document.getElementById('history-date-display');
    const datePicker = document.getElementById('history-date-picker');
    
    // Aggiorna display data
    const dateStr = formatDateToISO(AppState.historyDate);
    const dayName = GIORNI_SETTIMANA[AppState.historyDate.getDay()];
    const dayNum = AppState.historyDate.getDate();
    const monthName = MESI_ANNO[AppState.historyDate.getMonth()];
    const year = AppState.historyDate.getFullYear();
    
    if (dateDisplay) {
        dateDisplay.innerText = `${dayName}, ${dayNum} ${monthName} ${year}`;
    }
    if (datePicker) {
        datePicker.value = dateStr;
    }

    listContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Caricamento storico in corso...</p>
        </div>
    `;

    try {
        const historyData = await window.CampAPI.fetchHistory(dateStr);
        
        if (!historyData || historyData.length === 0) {
            document.getElementById('history-stat-present').innerText = '0';
            document.getElementById('history-stat-absent').innerText = '0';
            document.getElementById('history-stat-precamp').innerText = '0';
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>Nessun dato storico trovato per questa data.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        // Filtra solo quelli del camp corrente? Oppure tutti? (Il cron salva tutto)
        const currentCampData = historyData.filter(s => s.camp === AppState.currentCamp);
        
        let presentCount = 0;
        let absentCount = 0;
        let precampCount = 0;

        let html = '';
        
        if (currentCampData.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>Nessun allievo del ${AppState.currentCamp} camp trovato in questa data.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        currentCampData.forEach(student => {
            if (student.presente) presentCount++;
            if (student.presente === false) absentCount++;
            if (student.pre_camp) precampCount++;

            const isPresent = student.presente === true;
            const isAbsent = student.presente === false;
            let statusClass = 'neutral';
            if (isPresent) statusClass = 'present';
            if (isAbsent) statusClass = 'absent';

            let tagHtml = '';
            if (student.pre_camp) tagHtml += `<span class="time-tag">Pre-Camp</span>`;
            if (student.post_camp) tagHtml += `<span class="time-tag">Post-Camp</span>`;
            
            // Info mediche
            if (student.intolleranze) {
                tagHtml += `<span class="medical-tag warning" title="${student.intolleranze}"><i data-lucide="alert-circle" style="width:10px;height:10px;margin-right:2px;"></i> Intolleranze</span>`;
            }
            if (student.patologie) {
                tagHtml += `<span class="medical-tag danger" title="${student.patologie}"><i data-lucide="activity" style="width:10px;height:10px;margin-right:2px;"></i> Patologie</span>`;
            }

            html += `
                <div class="student-item ${statusClass}" style="opacity: 0.8; pointer-events: none;">
                    <div class="student-info">
                        <div class="student-name">
                            ${student.nome} ${student.cognome}
                        </div>
                        <div class="student-meta">
                            <span class="category-badge ${student.categoria}">${student.categoria.charAt(0).toUpperCase() + student.categoria.slice(1)}</span>
                            ${tagHtml}
                        </div>
                    </div>
                </div>
            `;
        });

        document.getElementById('history-stat-present').innerText = presentCount;
        document.getElementById('history-stat-absent').innerText = absentCount;
        document.getElementById('history-stat-precamp').innerText = precampCount;
        
        listContainer.innerHTML = html;
        lucide.createIcons();
        
    } catch (err) {
        if (checkAuthError(err)) return;
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="alert-triangle"></i>
                <p>Errore durante il caricamento dello storico.</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// Rendering lista allievi
function renderStudentsList() {
    const listContainer = document.getElementById('students-list');
    const manualListContainer = document.getElementById('students-list-manual');
    const titleSync = document.getElementById('title-section-sync');
    const titleManual = document.getElementById('title-section-manual');
    
    // Filtra la lista allievi per ricerca e filtro pillole
    let filteredStudents = AppState.students;
    
    // Filtro per ricerca testuale
    if (AppState.searchQuery) {
        filteredStudents = filteredStudents.filter(s => 
            s.nome.toLowerCase().includes(AppState.searchQuery) || 
            s.cognome.toLowerCase().includes(AppState.searchQuery)
        );
    }
    
    // Filtro categoria
    if (AppState.activeFilter === 'baby') {
        filteredStudents = filteredStudents.filter(s => s.categoria === 'baby');
    } else if (AppState.activeFilter === 'bambino') {
        filteredStudents = filteredStudents.filter(s => s.categoria === 'bambino');
    } else if (AppState.activeFilter === 'special') {
        filteredStudents = filteredStudents.filter(s => s.categoria === 'special');
    } else if (AppState.activeFilter === 'present') {
        filteredStudents = filteredStudents.filter(s => s.presente === true);
    } else if (AppState.activeFilter === 'absent') {
        filteredStudents = filteredStudents.filter(s => s.presente === false);
    } else if (AppState.activeFilter === 'precamp') {
        filteredStudents = filteredStudents.filter(s => s.preCamp === true);
    } else if (AppState.activeFilter === 'postcamp') {
        filteredStudents = filteredStudents.filter(s => s.postCamp === true);
    } else if (AppState.activeFilter === 'intolleranze') {
        filteredStudents = filteredStudents.filter(s => s.intolleranze && s.intolleranze.trim() !== '');
    } else if (AppState.activeFilter === 'patologie') {
        filteredStudents = filteredStudents.filter(s => s.patologie && s.patologie.trim() !== '');
    }

    // Caso lista vuota
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="users-round"></i>
                <p>Nessun allievo trovato per i filtri impostati.</p>
            </div>
        `;
        if (manualListContainer) manualListContainer.innerHTML = '';
        if (titleSync) titleSync.style.display = 'none';
        if (titleManual) titleManual.style.display = 'none';
        lucide.createIcons();
        return;
    }

    // Costruisce la lista di cards
    listContainer.innerHTML = '';
    if (manualListContainer) manualListContainer.innerHTML = '';

    const syncedStudents = filteredStudents.filter(s => !s.externalId || !s.externalId.startsWith('0X'));
    const manualStudents = filteredStudents.filter(s => s.externalId && s.externalId.startsWith('0X'));

    if (titleSync) titleSync.style.display = syncedStudents.length > 0 ? 'block' : 'none';
    if (titleManual) titleManual.style.display = manualStudents.length > 0 ? 'block' : 'none';

    // Rende allievi sincronizzati
    syncedStudents.forEach(student => {
        const card = createStudentCard(student);
        listContainer.appendChild(card);
    });

    // Rende allievi manuali
    manualStudents.forEach(student => {
        const card = createStudentCard(student);
        if (manualListContainer) {
            manualListContainer.appendChild(card);
        } else {
            listContainer.appendChild(card);
        }
    });

    // Inizializza icone caricate dinamicamente nelle card
    lucide.createIcons();

    // Aggancia gli eventi sulle cards appena renderizzate
    bindStudentCardEvents();
}

// Funzione helper per creare l'elemento card allievo
function createStudentCard(student) {
    const card = document.createElement('div');
    let cardStateClass = 'neutral';
    if (student.presente === true) cardStateClass = 'present';
    else if (student.presente === false) cardStateClass = 'absent';
    
    card.className = `student-card ${cardStateClass}`;
    
    // Verifica orari speciali da mostrare come badge
    let specialTimesHtml = '';
    if (student.entrataAnticipata) {
        specialTimesHtml += `
            <span class="badge-special-time" title="Clicca per modificare l'orario di ingresso" data-student-id="${student.id}" data-time-type="entry">
                <i data-lucide="clock"></i> Entra: ${student.entrataAnticipata}
            </span>`;
    }
    if (student.uscitaAnticipata) {
        specialTimesHtml += `
            <span class="badge-special-time" title="Clicca per modificare l'orario di uscita" data-student-id="${student.id}" data-time-type="exit">
                <i data-lucide="log-out"></i> Esce: ${student.uscitaAnticipata}
            </span>`;
    }

    // Box intolleranze alimentari
    const hasIntolleranze = student.intolleranze && student.intolleranze.trim() !== '';
    const intolleranzeBoxClass = hasIntolleranze ? 'medical-box intolleranze' : 'medical-box neutral';
    const intolleranzeText = hasIntolleranze ? student.intolleranze : 'Nessuna';

    // Box patologie sanitarie
    const hasPatologie = student.patologie && student.patologie.trim() !== '';
    const patologieBoxClass = hasPatologie ? 'medical-box patologie' : 'medical-box neutral';
    const patologieText = hasPatologie ? student.patologie : 'Nessuna';

    let categoryText = student.categoria;
    if (student.categoria === 'special') {
        categoryText = 'Special Camp';
    }

    card.innerHTML = `
        <div class="student-card-header">
            <div class="student-info-main">
                <div class="student-name-row">
                    <span class="student-name">${student.nome} ${student.cognome}</span>
                    <button class="btn-edit-student" data-student-id="${student.id}" title="Modifica allievo">
                        <i data-lucide="edit-3"></i>
                    </button>
                </div>
                <div class="badges-row">
                    <span class="badge-category ${student.categoria}">${categoryText}</span>
                    ${student.colore ? `<span class="badge-category neutral" style="background: rgba(255,255,255,0.1); color: var(--text-main); border: 1px solid var(--border-color);">${student.colore}</span>` : ''}
                </div>
                ${specialTimesHtml ? `<div class="student-times-stack">${specialTimesHtml}</div>` : ''}
            </div>
            
            <div class="presence-buttons-group">
                <button class="presence-btn btn-present ${student.presente === true ? 'active' : ''}" data-student-id="${student.id}" data-state="present" title="Segna Presente">
                    <i data-lucide="check"></i>
                </button>
                <button class="presence-btn btn-absent ${student.presente === false ? 'active' : ''}" data-student-id="${student.id}" data-state="absent" title="Segna Assente">
                    <i data-lucide="x"></i>
                </button>
            </div>
        </div>
        
        <div class="student-controls">
            <div class="camp-switch">
                <span>Pre-Camp</span>
                <label class="switch-control">
                    <input type="checkbox" class="toggle-pre-camp" data-student-id="${student.id}" ${student.preCamp ? 'checked' : ''}>
                    <span class="switch-slider"></span>
                </label>
            </div>
            <div class="camp-switch">
                <span>Post-Camp</span>
                <label class="switch-control">
                    <input type="checkbox" class="toggle-post-camp" data-student-id="${student.id}" ${student.postCamp ? 'checked' : ''}>
                    <span class="switch-slider"></span>
                </label>
            </div>
            
            <div class="${intolleranzeBoxClass}" data-student-id="${student.id}" title="Clicca per modificare le intolleranze alimentari">
                <i data-lucide="utensils"></i>
                <span class="medical-label">Intolleranze:</span>
                <span class="medical-value">${intolleranzeText}</span>
            </div>
            
            <div class="${patologieBoxClass}" data-student-id="${student.id}" title="Clicca per modificare le patologie sanitarie">
                <i data-lucide="shield-alert"></i>
                <span class="medical-label">Patologie:</span>
                <span class="medical-value">${patologieText}</span>
            </div>
        </div>
    `;
    return card;
}

// Funzione helper per ottenere le date ISO da lunedì a venerdì della settimana base
function getWeekDates(baseDate) {
    const dates = [];
    const currentDay = baseDate.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(baseDate);
    monday.setDate(baseDate.getDate() + mondayOffset);
    
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(formatDateToISO(d));
    }
    return dates;
}

// Collega gli eventi interni di ciascuna card allievo
function bindStudentCardEvents() {
    const dateStr = formatDateToISO(AppState.currentDate);

    // Pulsanti Presenza (Presente / Assente)
    const presenceBtns = document.querySelectorAll('.presence-btn');
    presenceBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const targetState = e.currentTarget.getAttribute('data-state'); // 'present' o 'absent'
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                const oldState = student.presente;
                // Determina il nuovo stato di presenza (se clicca quello già attivo, torna a null/Neutro)
                let newState = null;
                if (targetState === 'present') {
                    newState = (student.presente === true) ? null : true;
                } else if (targetState === 'absent') {
                    newState = (student.presente === false) ? null : false;
                }
                
                student.presente = newState;

                // Non azzeriamo più pre/post camp per poter contare gli iscritti al servizio per quel giorno
                
                try {
                    // Salva lo stato
                    await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                    // Ricarica la lista per applicare correttamente classi e stati disabilitati
                    renderStudentsList();
                    updateStatsSummary();
                } catch (err) {
                    student.presente = oldState;
                    alert("Errore durante il salvataggio della presenza su Supabase!\n\nDettaglio errore: " + err.message);
                    renderStudentsList();
                }
            }
        });
    });

    // Toggle Pre-Camp
    const preCampToggles = document.querySelectorAll('.toggle-pre-camp');
    preCampToggles.forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const studentId = e.target.getAttribute('data-student-id');
            const student = AppState.students.find(s => s.id === studentId);
            if (student) {
                const oldPreCamp = student.preCamp;
                const oldPresente = student.presente;
                const oldEntrata = student.entrataAnticipata;

                student.preCamp = e.target.checked;
                
                // Se attiva il preCamp, impostiamo automaticamente la presenza a true se non è già attiva
                if (student.preCamp) {
                    student.presente = true;
                    // Se attiva il preCamp e non ha un orario d'ingresso impostato, suggeriamo l'orario di default (07:45)
                    if (!student.entrataAnticipata) {
                        student.entrataAnticipata = '07:45';
                    }
                } else {
                    // se disattiva il preCamp, eliminiamo l'orario d'ingresso anticipato
                    student.entrataAnticipata = '';
                }

                try {
                    await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                    renderStudentsList(); // Reload completo della lista per aggiornare i badge
                    updateStatsSummary();
                } catch (err) {
                    student.preCamp = oldPreCamp;
                    student.presente = oldPresente;
                    student.entrataAnticipata = oldEntrata;
                    alert("Errore durante il salvataggio del Pre-Camp su Supabase!\n\nDettaglio errore: " + err.message);
                    renderStudentsList();
                }
            }
        });
    });

    // Toggle Post-Camp
    const postCampToggles = document.querySelectorAll('.toggle-post-camp');
    postCampToggles.forEach(toggle => {
        toggle.addEventListener('change', async (e) => {
            const studentId = e.target.getAttribute('data-student-id');
            const student = AppState.students.find(s => s.id === studentId);
            if (student) {
                const oldPostCamp = student.postCamp;
                const oldPresente = student.presente;
                const oldUscita = student.uscitaAnticipata;

                student.postCamp = e.target.checked;
                
                // Se attiva il postCamp, impostiamo automaticamente la presenza a true se non è già attiva
                if (student.postCamp) {
                    student.presente = true;
                    // Se attiva il postCamp e non ha un orario di uscita impostato, suggeriamo l'orario di default (17:30)
                    if (!student.uscitaAnticipata) {
                        student.uscitaAnticipata = '17:30';
                    }
                } else {
                    student.uscitaAnticipata = '';
                }

                try {
                    await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                    renderStudentsList();
                    updateStatsSummary();
                } catch (err) {
                    student.postCamp = oldPostCamp;
                    student.presente = oldPresente;
                    student.uscitaAnticipata = oldUscita;
                    alert("Errore durante il salvataggio del Post-Camp su Supabase!\n\nDettaglio errore: " + err.message);
                    renderStudentsList();
                }
            }
        });
    });

    // Apertura Modale Orario Singolo al click sui badge orario
    const specialTimeBadges = document.querySelectorAll('.badge-special-time');
    specialTimeBadges.forEach(badge => {
        badge.addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const timeType = e.currentTarget.getAttribute('data-time-type'); // 'entry' o 'exit'
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                document.getElementById('time-edit-student-name').innerText = `${student.nome} ${student.cognome}`;
                document.getElementById('time-edit-student-id').value = student.id;
                document.getElementById('time-edit-type').value = timeType;
                
                const timeVal = (timeType === 'entry') ? student.entrataAnticipata : student.uscitaAnticipata;
                document.getElementById('input-edit-time').value = timeVal || '';
                
                document.getElementById('label-edit-time').innerText = (timeType === 'entry') ? 'Orario d\'Ingresso Anticipato' : 'Orario d\'Uscita Anticipato';
                document.getElementById('time-edit-title').innerText = (timeType === 'entry') ? 'Modifica Orario Ingresso' : 'Modifica Orario Uscita';
                
                document.getElementById('time-edit-modal').classList.remove('hidden');
            }
        });
    });

    // Apertura Modale Intolleranze al click sul box medico
    const medicalBoxes = document.querySelectorAll('.medical-box');
    medicalBoxes.forEach(box => {
        box.addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                document.getElementById('medical-modal-student-name').innerText = `${student.nome} ${student.cognome}`;
                document.getElementById('medical-modal-student-id').value = student.id;
                document.getElementById('input-intolleranze').value = student.intolleranze || '';
                document.getElementById('input-patologie').value = student.patologie || '';
                
                document.getElementById('medical-modal').classList.remove('hidden');
            }
        });
    });

    // Apertura Modale Gestione Allievo per modifica
    const editStudentBtns = document.querySelectorAll('.btn-edit-student');
    editStudentBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                document.getElementById('student-modal-title').innerText = "Modifica Allievo";
                document.getElementById('student-modal-id').value = student.id;
                document.getElementById('student-modal-name').value = student.nome;
                document.getElementById('student-modal-surname').value = student.cognome;
                document.getElementById('student-modal-category').value = student.categoria;
                document.getElementById('student-modal-intolleranze').value = student.intolleranze || '';
                document.getElementById('student-modal-patologie').value = student.patologie || '';
                
                // Mostra il pulsante di eliminazione
                document.getElementById('btn-delete-student').style.display = 'inline-flex';
                
                document.getElementById('student-modal').classList.remove('hidden');
            }
        });
    });
}

// Caricamento attività per il camp corrente
async function loadActivitiesData() {
    const listContainer = document.getElementById('activities-list');
    listContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Caricamento attività...</p>
        </div>
    `;

    try {
        AppState.activities = await window.CampAPI.fetchActivities(AppState.currentCamp);
        renderActivitiesList();
    } catch (err) {
        if (checkAuthError(err)) return;
        listContainer.innerHTML = `<p>Si è verificato un errore durante il caricamento del calendario.</p>`;
    }
}

// Rendering lista attività
function renderActivitiesList() {
    const listContainer = document.getElementById('activities-list');
    
    // Filtra per giorno della settimana attivo
    const filteredActs = AppState.activities.filter(act => act.giorno === AppState.activeActivityDay);
    
    // Ordina per ora di inizio
    filteredActs.sort((a, b) => a.inizio.localeCompare(b.inizio));

    if (filteredActs.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="sparkles"></i>
                <p>Nessuna attività programmata per questo giorno.</p>
                <span style="font-size:11px; color:var(--text-light)">Clicca su "Aggiungi" per programmare un'attività.</span>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    listContainer.innerHTML = '';
    
    filteredActs.forEach(act => {
        const card = document.createElement('div');
        card.className = 'activity-card';
        
        let targetText = 'Tutti';
        let targetClass = 'tutti';
        if (act.target === 'baby') {
            targetText = 'Solo Baby';
            targetClass = 'baby';
        } else if (act.target === 'bambino') {
            targetText = 'Solo Bambini';
            targetClass = 'bambino';
        }

        card.innerHTML = `
            <div class="activity-info">
                <span class="activity-time-badge">
                    <i data-lucide="clock"></i> ${act.inizio} - ${act.fine}
                </span>
                <span class="activity-title">${act.nome}</span>
                <div style="margin-top:4px;">
                    <span class="badge-category ${targetClass}">${targetText}</span>
                </div>
            </div>
            <button class="btn-delete-activity" data-act-id="${act.id}" title="Elimina Attività">
                <i data-lucide="trash-2"></i>
            </button>
        `;
        listContainer.appendChild(card);
    });

    lucide.createIcons();

    // Event listener per la cancellazione dell'attività
    const deleteBtns = document.querySelectorAll('.btn-delete-activity');
    deleteBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Sei sicuro di voler eliminare questa attività?')) {
                const actId = e.currentTarget.getAttribute('data-act-id');
                try {
                    await window.CampAPI.deleteActivity(AppState.currentCamp, actId);
                    await loadActivitiesData();
                } catch (err) {
                    alert("Errore durante l'eliminazione dell'attività da Supabase!\n\nDettaglio errore: " + err.message);
                }
            }
        });
    });
}

// ==========================================================================
// FUNZIONI DI RIFERIMENTO E RIEPILOGO INTERFACCIA
// ==========================================================================

// Aggiorna la data visualizzata nell'header del pannello presenze
function updateDateDisplay() {
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    // Traduzione manuale per compatibilità locale estesa sui browser mobile italiani
    const dayName = GIORNI_SETTIMANA[AppState.currentDate.getDay()];
    const dayNum = AppState.currentDate.getDate();
    const monthName = MESI_ANNO[AppState.currentDate.getMonth()];
    const yearNum = AppState.currentDate.getFullYear();
    
    document.getElementById('date-display').innerText = `${dayName}, ${dayNum} ${monthName} ${yearNum}`;
    
    // Aggiorna anche il date-picker nascosto per riflettere il valore
    const datePicker = document.getElementById('date-picker');
    datePicker.value = formatDateToISO(AppState.currentDate);
}

// Aggiorna i contatori del riepilogo statistico superiore
function updateStatsSummary() {
    const total = AppState.students.length;
    const present = AppState.students.filter(s => s.presente === true).length;
    
    const babyTotal = AppState.students.filter(s => s.categoria === 'baby').length;
    const babyPresent = AppState.students.filter(s => s.presente === true && s.categoria === 'baby').length;
    
    const kidsTotal = AppState.students.filter(s => s.categoria === 'bambino').length;
    const kidsPresent = AppState.students.filter(s => s.presente === true && s.categoria === 'bambino').length;
    
    const preCampTotal = AppState.students.filter(s => s.preCamp === true).length;
    const preCampActive = AppState.students.filter(s => s.presente === true && s.preCamp === true).length;
    
    const postCampTotal = AppState.students.filter(s => s.postCamp === true).length;
    const postCampActive = AppState.students.filter(s => s.presente === true && s.postCamp === true).length;
    
    const absentTotal = AppState.students.filter(s => s.presente === false).length;

    document.getElementById('stat-total-present').innerText = `${present}/${total}`;
    document.getElementById('stat-baby-present').innerText = `${babyPresent}/${babyTotal}`;
    document.getElementById('stat-kids-present').innerText = `${kidsPresent}/${kidsTotal}`;
    document.getElementById('stat-pre-present').innerText = preCampActive;
    document.getElementById('stat-post-present').innerText = postCampActive;
    document.getElementById('stat-absent-total').innerText = absentTotal;
}




// ==========================================================================
// UTILITY HELPERS
// ==========================================================================
function formatDateToISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Intercettore degli errori per controllare se c'è stato un problema di autenticazione (es. sessione scaduta)
function checkAuthError(err) {
    if (err && err.message && (err.message.includes('401') || err.message.toLowerCase().includes('jwt') || err.message.toLowerCase().includes('unauthorized') || err.message.toLowerCase().includes('invalid token'))) {
        console.warn("Rilevato errore di autenticazione, forzo il logout:", err.message);
        window.CampAPI.logout();
        
        // Pulisce lo stato
        AppState.students = [];
        AppState.activities = [];
        renderStudentsList();
        
        // Pulisce campi password e mostra schermata login
        const passwordInput = document.getElementById('login-password');
        if (passwordInput) passwordInput.value = '';
        
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.remove('hidden');
        return true;
    }
    return false;
}

// ==========================================================================
// SEZIONE ARMADIETTI - LOGICA E CALCOLO
// ==========================================================================

async function loadLockersTabContent() {
    // Assicura che la lista allievi sia caricata per il camp corrente
    if (!AppState.students || AppState.students.length === 0) {
        const dateStr = formatDateToISO(AppState.currentDate);
        try {
            AppState.students = await window.CampAPI.fetchStudents(AppState.currentCamp, dateStr);
        } catch (err) {
            console.error("Errore nel recupero allievi per armadietti:", err);
        }
    }
    
    // Carica gli armadietti salvati in localStorage per il camp attivo
    const tallLockers = localStorage.getItem(`camp_lockers_tall_${AppState.currentCamp}`) || '';
    const lowLockers = localStorage.getItem(`camp_lockers_low_${AppState.currentCamp}`) || '';
    
    const tallInput = document.getElementById('lockers-tall-input');
    const lowInput = document.getElementById('lockers-low-input');
    
    if (tallInput) tallInput.value = tallLockers;
    if (lowInput) lowInput.value = lowLockers;
    
    if (tallLockers || lowLockers) {
        renderLockersForTurn();
    } else {
        // Nascondi i risultati se non c'è configurazione
        const lockerStats = document.getElementById('locker-stats');
        const lockerResults = document.getElementById('locker-results-container');
        if (lockerStats) lockerStats.style.display = 'none';
        if (lockerResults) lockerResults.style.display = 'none';
    }
}

async function runLockerAssignment() {
    const tallInputVal = document.getElementById('lockers-tall-input').value;
    const lowInputVal = document.getElementById('lockers-low-input').value;
    
    // Salva in localStorage per il camp corrente
    localStorage.setItem(`camp_lockers_tall_${AppState.currentCamp}`, tallInputVal);
    localStorage.setItem(`camp_lockers_low_${AppState.currentCamp}`, lowInputVal);
    
    // Funzione helper per ripulire e ordinare naturalmente gli armadietti
    const parseLockers = (inputStr) => {
        if (!inputStr) return [];
        return inputStr
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };
    
    const tallLockers = parseLockers(tallInputVal);
    const lowLockers = parseLockers(lowInputVal);
    
    // Resetta le assegnazioni degli allievi locali prima del ricalcolo
    AppState.students.forEach(s => {
        s.armadietto = '';
    });
    
    // Filtra per categorie: Bambino e Special vanno su armadietti Alti, Baby su Bassi
    const kids = AppState.students.filter(s => s.categoria === 'bambino' || s.categoria === 'special');
    const babies = AppState.students.filter(s => s.categoria === 'baby');
    
    // Esegui la risoluzione per turni per ciascun gruppo
    solveLockersForTurns(kids, tallLockers);
    solveLockersForTurns(babies, lowLockers);
    
    // Salva le nuove assegnazioni nel DB
    const btn = document.getElementById('btn-calculate-lockers');
    const oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;display:inline-block;margin-right:8px;"></div> Salvataggio...';
    
    try {
        for (const s of AppState.students) {
            await window.CampAPI.updateStudentInfo(s.id, {
                nome: s.nome,
                cognome: s.cognome,
                categoria: s.categoria,
                intolleranze: s.intolleranze,
                patologie: s.patologie,
                turni: s.turni || '1',
                armadietto: s.armadietto || ''
            });
        }
        renderLockersForTurn();
    } catch (err) {
        alert("Errore durante il salvataggio degli armadietti su Supabase: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = oldText;
    }
}

// Algoritmo di calcolo armadietti turni (1-13)
function solveLockersForTurns(students, lockers) {
    if (students.length === 0 || lockers.length === 0) return;
    
    // Calcoliamo turno per turno
    for (let w = 1; w <= 13; w++) {
        // 1. Identifica gli allievi iscritti al turno w
        const enrolled = students.filter(s => {
            const tList = (s.turni || '1').split(',');
            return tList.includes(String(w));
        });
        
        if (enrolled.length === 0) continue;
        
        // 2. Trova quali armadietti sono occupati in questo turno w
        const occupiedLockers = enrolled
            .map(s => s.armadietto)
            .filter(arm => arm !== '');
        
        // 3. Gli allievi del turno w senza armadietto
        const unassigned = enrolled.filter(s => s.armadietto === '');
        if (unassigned.length === 0) continue;
        
        // 4. Trova gli armadietti liberi nel turno w
        const availableLockers = lockers.filter(l => !occupiedLockers.includes(l));
        if (availableLockers.length === 0) continue;
        
        // 5. Raggruppa gli allievi non assegnati per cognome (fratelli)
        const groupsBySurname = {};
        unassigned.forEach(s => {
            const key = s.cognome.toLowerCase().trim();
            if (!groupsBySurname[key]) groupsBySurname[key] = [];
            groupsBySurname[key].push(s);
        });
        
        const entities = [];
        Object.keys(groupsBySurname).forEach(key => {
            entities.push({
                surname: groupsBySurname[key][0].cognome,
                students: groupsBySurname[key]
            });
        });
        
        // PRIORITÀ: ordina i gruppi dal più numeroso al più piccolo
        entities.sort((a, b) => {
            const sizeComp = b.students.length - a.students.length;
            if (sizeComp !== 0) return sizeComp;
            return a.surname.localeCompare(b.surname, 'it', { sensitivity: 'base' });
        });
        
        // 6. Assegna l'armadietto
        let lockerIndex = 0;
        entities.forEach(entity => {
            if (lockerIndex < availableLockers.length) {
                const l = availableLockers[lockerIndex];
                entity.students.forEach(s => {
                    s.armadietto = l;
                });
                lockerIndex++;
            }
        });
    }
}

// Estrae le assegnazioni correnti per il turno selezionato
function getAssignmentsForTurn(students, lockers, turn) {
    const enrolled = students.filter(s => (s.turni || '1').split(',').includes(String(turn)));
    const assignments = [];
    const unassigned = enrolled.filter(s => s.armadietto === '');
    
    // Raggruppa gli assegnati per armadietto
    const byLocker = {};
    enrolled.forEach(s => {
        if (s.armadietto !== '') {
            if (!byLocker[s.armadietto]) byLocker[s.armadietto] = [];
            byLocker[s.armadietto].push(s);
        }
    });
    
    let sharedCount = 0;
    Object.keys(byLocker).forEach(locker => {
        const list = byLocker[locker];
        assignments.push({
            locker,
            students: list,
            shared: list.length > 1
        });
        if (list.length > 1) {
            sharedCount += list.length;
        }
    });
    
    // Ordina gli armadietti naturalmente
    assignments.sort((a, b) => a.locker.localeCompare(b.locker, undefined, { numeric: true, sensitivity: 'base' }));
    
    return { assignments, unassigned, sharedCount };
}

function renderLockersForTurn() {
    const tallInputVal = document.getElementById('lockers-tall-input').value;
    const lowInputVal = document.getElementById('lockers-low-input').value;
    const viewTurnSelect = document.getElementById('lockers-view-turn');
    const viewTurn = viewTurnSelect ? viewTurnSelect.value : '1';
    
    const parseLockers = (inputStr) => {
        if (!inputStr) return [];
        return inputStr
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
    };
    
    const tallLockers = parseLockers(tallInputVal);
    const lowLockers = parseLockers(lowInputVal);
    
    const kids = AppState.students.filter(s => s.categoria === 'bambino' || s.categoria === 'special');
    const babies = AppState.students.filter(s => s.categoria === 'baby');
    
    const kidsRes = getAssignmentsForTurn(kids, tallLockers, viewTurn);
    const babiesRes = getAssignmentsForTurn(babies, lowLockers, viewTurn);
    
    renderLockerResults(kidsRes, babiesRes, tallLockers.length, lowLockers.length);
}

function renderLockerResults(kidsRes, babiesRes, totalTall, totalLow) {
    const lockerStats = document.getElementById('locker-stats');
    const lockerResults = document.getElementById('locker-results-container');
    
    if (lockerStats) lockerStats.style.display = 'grid';
    if (lockerResults) lockerResults.style.display = 'flex';
    
    const totalLockers = totalTall + totalLow;
    const assignedLockersCount = kidsRes.assignments.length + babiesRes.assignments.length;
    const totalSharedStudents = kidsRes.sharedCount + babiesRes.sharedCount;
    const totalUnassignedStudents = kidsRes.unassigned.length + babiesRes.unassigned.length;
    
    const statAssigned = document.getElementById('stat-lockers-assigned');
    const statShared = document.getElementById('stat-lockers-shared');
    const statUnassigned = document.getElementById('stat-lockers-unassigned');
    
    if (statAssigned) statAssigned.innerText = `${assignedLockersCount}/${totalLockers}`;
    if (statShared) statShared.innerText = totalSharedStudents;
    if (statUnassigned) statUnassigned.innerText = totalUnassignedStudents;
    
    // 1. RENDERIZZA RISULTATI BAMBINI (ALTI)
    const kidsUnassignedAlert = document.getElementById('kids-unassigned-alert');
    const kidsUnassignedList = document.getElementById('kids-unassigned-list');
    const kidsLockersList = document.getElementById('kids-lockers-list');
    
    if (kidsRes.unassigned.length > 0) {
        if (kidsUnassignedAlert) kidsUnassignedAlert.style.display = 'flex';
        if (kidsUnassignedList) {
            kidsUnassignedList.innerText = kidsRes.unassigned.map(s => `${s.nome} ${s.cognome}`).join(', ');
        }
    } else {
        if (kidsUnassignedAlert) kidsUnassignedAlert.style.display = 'none';
    }
    
    if (kidsLockersList) {
        kidsLockersList.innerHTML = '';
        if (kidsRes.assignments.length === 0) {
            kidsLockersList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>Nessun armadietto assegnato per questo turno.</p>
                </div>`;
        } else {
            kidsRes.assignments.forEach(item => {
                const card = document.createElement('div');
                card.className = `locker-card ${item.shared ? 'shared' : ''}`;
                card.innerHTML = `
                    <div class="locker-info-side">
                        <div class="locker-icon-wrapper">
                            ${item.locker}
                        </div>
                        <div class="locker-details">
                            <span class="locker-num-label">Armadietto Alto</span>
                            <span class="locker-students-names" title="${item.students.map(s => `${s.nome} ${s.cognome}`).join(' & ')}">
                                ${item.students.map(s => `${s.nome} ${s.cognome}`).join(' & ')}
                            </span>
                        </div>
                    </div>
                    <div class="locker-status-side">
                        ${item.shared ? '<span class="badge-shared-locker">Condiviso</span>' : ''}
                    </div>
                `;
                kidsLockersList.appendChild(card);
            });
        }
    }
    
    // 2. RENDERIZZA RISULTATI BABY (BASSI)
    const babyUnassignedAlert = document.getElementById('baby-unassigned-alert');
    const babyUnassignedList = document.getElementById('baby-unassigned-list');
    const babyLockersList = document.getElementById('baby-lockers-list');
    
    if (babiesRes.unassigned.length > 0) {
        if (babyUnassignedAlert) babyUnassignedAlert.style.display = 'flex';
        if (babyUnassignedList) {
            babyUnassignedList.innerText = babiesRes.unassigned.map(s => `${s.nome} ${s.cognome}`).join(', ');
        }
    } else {
        if (babyUnassignedAlert) babyUnassignedAlert.style.display = 'none';
    }
    
    if (babyLockersList) {
        babyLockersList.innerHTML = '';
        if (babiesRes.assignments.length === 0) {
            babyLockersList.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>Nessun armadietto assegnato per questo turno.</p>
                </div>`;
        } else {
            babiesRes.assignments.forEach(item => {
                const card = document.createElement('div');
                card.className = `locker-card ${item.shared ? 'shared' : ''}`;
                card.innerHTML = `
                    <div class="locker-info-side">
                        <div class="locker-icon-wrapper">
                            ${item.locker}
                        </div>
                        <div class="locker-details">
                            <span class="locker-num-label">Armadietto Basso</span>
                            <span class="locker-students-names" title="${item.students.map(s => `${s.nome} ${s.cognome}`).join(' & ')}">
                                ${item.students.map(s => `${s.nome} ${s.cognome}`).join(' & ')}
                            </span>
                        </div>
                    </div>
                    <div class="locker-status-side">
                        ${item.shared ? '<span class="badge-shared-locker">Condiviso</span>' : ''}
                    </div>
                `;
                babyLockersList.appendChild(card);
            });
        }
    }
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}


