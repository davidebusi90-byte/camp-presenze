/**
 * App.js - Logica principale dell'applicazione presenze Camp.
 * Gestisce l'interfaccia utente, lo stato globale e le interazioni.
 */

// STATO GLOBALE DELL'APPLICAZIONE
const AppState = {
    currentCamp: 'summer',           // 'summer' | 'spring' | 'winter'
    currentDate: new Date(),         // Oggetto Date della giornata selezionata
    currentTab: 'panel-presenze',    // 'panel-presenze' | 'panel-calendario' | 'panel-impostazioni'
    activeFilter: 'all',             // 'all' | 'baby' | 'bambino' | 'present' | 'absent'
    searchQuery: '',                 // Testo digitato nella barra di ricerca
    activeActivityDay: '1',          // '1' (Lun) .. '5' (Ven)
    students: [],                    // Allievi caricati per la giornata corrente
    activities: []                   // Attività caricate per il camp corrente
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

    // Aggiornamento automatico ogni 30 secondi se in modalità online (Supabase collegato)
    setInterval(async () => {
        if (AppState.currentTab === 'panel-presenze' && window.CampAPI.isOnlineMode()) {
            console.log('Auto-refresh delle presenze da Supabase...');
            await loadStudentsData();
        }
    }, 30000);

    // Applica il tema iniziale
    applyCampTheme(AppState.currentCamp);

    // Registra i gestori degli eventi
    registerEventListeners();

    // Carica i dati per la prima volta
    await loadCurrentTabContent();
    updateSyncStatusBadge();
    updateSettingsStats();
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
        datePicker.showPicker(); // Forza l'apertura del calendario nativo del browser
    });

    datePicker.addEventListener('change', async (e) => {
        if (e.target.value) {
            AppState.currentDate = new Date(e.target.value);
            await loadStudentsData();
        }
    });

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

    // 5. Modale Gestione Orari (Ingresso/Uscita anticipata)
    const timeModal = document.getElementById('time-modal');
    const closeModalBtns = document.querySelectorAll('.close-modal-btn');
    
    closeModalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeModal.classList.add('hidden');
            document.getElementById('activity-modal').classList.add('hidden');
        });
    });

    document.getElementById('btn-save-times').addEventListener('click', async () => {
        const studentId = document.getElementById('modal-student-id').value;
        const entryTime = document.getElementById('input-early-entry').value;
        const exitTime = document.getElementById('input-early-exit').value;

        // Trova l'allievo e aggiorna gli orari
        const student = AppState.students.find(s => s.id === studentId);
        if (student) {
            student.entrataAnticipata = entryTime;
            student.uscitaAnticipata = exitTime;
            
            // Salva tramite API
            const dateStr = formatDateToISO(AppState.currentDate);
            await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
            
            timeModal.classList.add('hidden');
            renderStudentsList();
            updateStatsSummary();
        }
    });

    document.getElementById('btn-clear-times').addEventListener('click', async () => {
        const studentId = document.getElementById('modal-student-id').value;
        const student = AppState.students.find(s => s.id === studentId);
        if (student) {
            student.entrataAnticipata = '';
            student.uscitaAnticipata = '';
            
            // Salva tramite API
            const dateStr = formatDateToISO(AppState.currentDate);
            await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
            
            timeModal.classList.add('hidden');
            renderStudentsList();
            updateStatsSummary();
        }
    });

    // 6. Impostazioni Supabase e Reset
    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const urlValue = document.getElementById('settings-supabase-url').value.trim();
        const keyValue = document.getElementById('settings-supabase-key').value.trim();
        window.CampAPI.setSupabaseConfig(urlValue, keyValue);
        
        const resultMsg = document.getElementById('api-test-result');
        resultMsg.className = 'test-result-message success';
        resultMsg.innerText = 'Impostazioni salvate con successo!';
        
        updateSyncStatusBadge();
        updateSettingsStats();
        
        setTimeout(() => {
            resultMsg.innerText = '';
        }, 3000);
    });

    document.getElementById('btn-test-api').addEventListener('click', async () => {
        const urlValue = document.getElementById('settings-supabase-url').value.trim();
        const keyValue = document.getElementById('settings-supabase-key').value.trim();
        const resultMsg = document.getElementById('api-test-result');
        resultMsg.className = 'test-result-message';
        resultMsg.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; display:inline-block; margin-right:8px;"></div> Verifica in corso...';
        
        const test = await window.CampAPI.testConnection(urlValue, keyValue);
        if (test.success) {
            resultMsg.className = 'test-result-message success';
            resultMsg.innerText = test.message;
        } else {
            resultMsg.className = 'test-result-message error';
            resultMsg.innerText = test.message;
        }
    });

    document.getElementById('btn-reset-mock').addEventListener('click', async () => {
        if (confirm('Sei sicuro di voler ripristinare i dati di esempio locali? Questo cancellerà le presenze registrate finora offline.')) {
            window.CampAPI.resetMockData();
            updateSettingsStats();
            alert('Dati di esempio ripristinati correttamente.');
            if (AppState.currentTab === 'panel-presenze') {
                await loadStudentsData();
            } else if (AppState.currentTab === 'panel-calendario') {
                await loadActivitiesData();
            }
        }
    });

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

        await window.CampAPI.saveActivity(AppState.currentCamp, newAct);
        
        activityModal.classList.add('hidden');
        await loadActivitiesData();
    });
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
    } else if (AppState.currentTab === 'panel-impostazioni') {
        updateSettingsStats();
    }
}

// Caricamento presenze per la data selezionata
async function loadStudentsData() {
    const listContainer = document.getElementById('students-list');
    listContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Caricamento allievi in corso...</p>
        </div>
    `;

    // Aggiorna l'interfaccia della data
    updateDateDisplay();

    try {
        const dateStr = formatDateToISO(AppState.currentDate);
        AppState.students = await window.CampAPI.fetchStudents(AppState.currentCamp, dateStr);
        renderStudentsList();
        updateStatsSummary();
    } catch (err) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="alert-triangle"></i>
                <p>Si è verificato un errore nel caricamento dei dati.</p>
            </div>
        `;
        lucide.createIcons();
    }
}

// Rendering lista allievi
function renderStudentsList() {
    const listContainer = document.getElementById('students-list');
    
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
    } else if (AppState.activeFilter === 'present') {
        filteredStudents = filteredStudents.filter(s => s.presente);
    } else if (AppState.activeFilter === 'absent') {
        filteredStudents = filteredStudents.filter(s => !s.presente);
    }

    // Caso lista vuota
    if (filteredStudents.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="users-round"></i>
                <p>Nessun allievo trovato per i filtri impostati.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Costruisce la lista di cards
    listContainer.innerHTML = '';
    
    filteredStudents.forEach(student => {
        const card = document.createElement('div');
        card.className = `student-card ${student.presente ? 'present' : ''}`;
        
        // Verifica orari speciali da mostrare come badge
        let specialTimesHtml = '';
        if (student.entrataAnticipata) {
            specialTimesHtml += `
                <span class="badge-special-time" title="Entrata Anticipata">
                    <i data-lucide="clock"></i> Entra: ${student.entrataAnticipata}
                </span>`;
        }
        if (student.uscitaAnticipata) {
            specialTimesHtml += `
                <span class="badge-special-time" title="Uscita Anticipata">
                    <i data-lucide="log-out"></i> Esce: ${student.uscitaAnticipata}
                </span>`;
        }

        // Determina se il pulsante orari ha orari configurati (per lo stile)
        const hasSpecialTimes = student.entrataAnticipata || student.uscitaAnticipata;

        card.innerHTML = `
            <div class="student-card-header">
                <div class="student-info-main">
                    <span class="student-name">${student.nome} ${student.cognome}</span>
                    <div class="badges-row">
                        <span class="badge-category ${student.categoria}">${student.categoria}</span>
                        ${specialTimesHtml}
                    </div>
                </div>
                
                <button class="presence-toggle-btn ${student.presente ? 'present' : ''}" data-student-id="${student.id}">
                    <i data-lucide="${student.presente ? 'check' : 'square'}"></i>
                    <span>${student.presente ? 'Presente' : 'Assente'}</span>
                </button>
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
                
                <button class="btn-time-config ${hasSpecialTimes ? 'active' : ''}" data-student-id="${student.id}">
                    <i data-lucide="clock-arrow-up-right"></i>
                    <span>${hasSpecialTimes ? 'Modifica Orari Anticipo' : 'Segna Entrata/Uscita Anticipata'}</span>
                </button>
            </div>
        `;
        
        listContainer.appendChild(card);
    });
    
    // Inizializza icone caricate dinamicamente nelle card
    lucide.createIcons();

    // Aggancia gli eventi sulle cards appena renderizzate
    bindStudentCardEvents();
}

// Collega gli eventi interni di ciascuna card allievo
function bindStudentCardEvents() {
    const dateStr = formatDateToISO(AppState.currentDate);

    // Toggle Presenza Principale
    const presenceBtns = document.querySelectorAll('.presence-toggle-btn');
    presenceBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                student.presente = !student.presente;
                
                // Salva lo stato
                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                
                // Aggiorna l'aspetto grafico della singola card e i totali senza fare full-reload
                const card = e.currentTarget.closest('.student-card');
                if (student.presente) {
                    card.classList.add('present');
                    e.currentTarget.classList.add('present');
                    e.currentTarget.querySelector('span').innerText = 'Presente';
                    e.currentTarget.querySelector('i').setAttribute('data-lucide', 'check');
                } else {
                    card.classList.remove('present');
                    e.currentTarget.classList.remove('present');
                    e.currentTarget.querySelector('span').innerText = 'Assente';
                    e.currentTarget.querySelector('i').setAttribute('data-lucide', 'square');
                }
                
                lucide.createIcons();
                updateStatsSummary();
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
                student.preCamp = e.target.checked;
                
                // Se attiva il preCamp e non ha un orario d'ingresso impostato, suggeriamo l'orario di default
                if (student.preCamp && !student.entrataAnticipata) {
                    student.entrataAnticipata = '08:00';
                } else if (!student.preCamp) {
                    // se disattiva il preCamp, eliminiamo l'orario d'ingresso anticipato
                    student.entrataAnticipata = '';
                }

                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                renderStudentsList(); // Reload completo della lista per aggiornare i badge
                updateStatsSummary();
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
                student.postCamp = e.target.checked;
                
                // Se attiva il postCamp e non ha un orario di uscita impostato, suggeriamo l'orario di default
                if (student.postCamp && !student.uscitaAnticipata) {
                    student.uscitaAnticipata = '13:00';
                } else if (!student.postCamp) {
                    student.uscitaAnticipata = '';
                }

                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                renderStudentsList();
                updateStatsSummary();
            }
        });
    });

    // Bottone Apertura Modale Orari
    const timeConfigBtns = document.querySelectorAll('.btn-time-config');
    timeConfigBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                // Imposta valori nella modale
                document.getElementById('modal-student-name').innerText = `${student.nome} ${student.cognome}`;
                document.getElementById('modal-student-id').value = student.id;
                document.getElementById('input-early-entry').value = student.entrataAnticipata || '';
                document.getElementById('input-early-exit').value = student.uscitaAnticipata || '';
                
                // Mostra la modale
                document.getElementById('time-modal').classList.remove('hidden');
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
                await window.CampAPI.deleteActivity(AppState.currentCamp, actId);
                await loadActivitiesData();
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
    const present = AppState.students.filter(s => s.presente).length;
    
    const babyPresent = AppState.students.filter(s => s.presente && s.categoria === 'baby').length;
    const kidsPresent = AppState.students.filter(s => s.presente && s.categoria === 'bambino').length;
    
    const preCampActive = AppState.students.filter(s => s.preCamp).length;
    const postCampActive = AppState.students.filter(s => s.postCamp).length;

    document.getElementById('stat-total-present').innerText = `${present}/${total}`;
    document.getElementById('stat-baby-present').innerText = babyPresent;
    document.getElementById('stat-kids-present').innerText = kidsPresent;
    document.getElementById('stat-pre-post').innerText = `${preCampActive}/${postCampActive}`;
}

// Aggiorna l'icona e lo stato visualizzato online/offline
function updateSyncStatusBadge() {
    const badge = document.getElementById('sync-status');
    const isOnline = window.CampAPI.isOnlineMode();
    
    if (isOnline) {
        badge.className = 'sync-badge online';
        badge.querySelector('span').innerText = 'Online';
        badge.querySelector('i').setAttribute('data-lucide', 'cloud-lightning');
    } else {
        badge.className = 'sync-badge offline';
        badge.querySelector('span').innerText = 'Local (Offline)';
        badge.querySelector('i').setAttribute('data-lucide', 'cloud-off');
    }
    lucide.createIcons();
}

// Aggiorna i dati visibili nella sezione Impostazioni
function updateSettingsStats() {
    const isOnline = window.CampAPI.isOnlineMode();
    const statusText = document.getElementById('local-db-status');
    
    if (isOnline) {
        statusText.innerHTML = `<span style="color:var(--success)">Connesso a Supabase Cloud</span>`;
    } else {
        statusText.innerHTML = `In uso (Locale / Offline)`;
    }

    // Mostra il numero di allievi caricati localmente nel mock
    const localData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENTS)) || {};
    let totalSaved = 0;
    
    // Contiamo tutti i record memorizzati in locale
    Object.keys(localData).forEach(camp => {
        Object.keys(localData[camp]).forEach(date => {
            totalSaved += localData[camp][date].length;
        });
    });

    document.getElementById('local-db-count').innerText = totalSaved || MOCK_STUDENTS.length;
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
