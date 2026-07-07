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

// Helper per aggiornare in sicurezza un'icona Lucide che è stata convertita in SVG
function setLucideIcon(parentElement, newIconName) {
    const existingIcon = parentElement.querySelector('i') || parentElement.querySelector('svg');
    if (existingIcon) {
        const newIcon = document.createElement('i');
        newIcon.setAttribute('data-lucide', newIconName);
        existingIcon.replaceWith(newIcon);
        lucide.createIcons();
    }
}

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
        filteredStudents = filteredStudents.filter(s => s.presente === true);
    } else if (AppState.activeFilter === 'absent') {
        filteredStudents = filteredStudents.filter(s => s.presente === false);
    } else if (AppState.activeFilter === 'precamp') {
        filteredStudents = filteredStudents.filter(s => s.preCamp === true);
    } else if (AppState.activeFilter === 'postcamp') {
        filteredStudents = filteredStudents.filter(s => s.postCamp === true);
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
        const intolleranzeText = hasIntolleranze ? student.intolleranze : 'Nessuna intolleranza alimentare';

        // Box patologie sanitarie
        const hasPatologie = student.patologie && student.patologie.trim() !== '';
        const patologieBoxClass = hasPatologie ? 'medical-box patologie' : 'medical-box neutral';
        const patologieText = hasPatologie ? student.patologie : 'Nessuna patologia sanitaria';

        card.innerHTML = `
            <div class="student-card-header">
                <div class="student-info-main">
                    <span class="student-name">${student.nome} ${student.cognome}</span>
                    <div class="badges-row">
                        <span class="badge-category ${student.categoria}">${student.categoria}</span>
                        ${specialTimesHtml}
                    </div>
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
                    <span class="medical-label">Intolleranze Alimentari:</span>
                    <span class="medical-value">${intolleranzeText}</span>
                </div>
                
                <div class="${patologieBoxClass}" data-student-id="${student.id}" title="Clicca per modificare le patologie sanitarie">
                    <i data-lucide="shield-alert"></i>
                    <span class="medical-label">Patologie Sanitarie:</span>
                    <span class="medical-value">${patologieText}</span>
                </div>
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

    // Pulsanti Presenza (Presente / Assente)
    const presenceBtns = document.querySelectorAll('.presence-btn');
    presenceBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const studentId = e.currentTarget.getAttribute('data-student-id');
            const targetState = e.currentTarget.getAttribute('data-state'); // 'present' o 'absent'
            const student = AppState.students.find(s => s.id === studentId);
            
            if (student) {
                // Determina il nuovo stato di presenza (se clicca quello già attivo, torna a null/Neutro)
                let newState = null;
                if (targetState === 'present') {
                    newState = (student.presente === true) ? null : true;
                } else if (targetState === 'absent') {
                    newState = (student.presente === false) ? null : false;
                }
                
                student.presente = newState;

                // Non azzeriamo più pre/post camp per poter contare gli iscritti al servizio per quel giorno
                
                // Salva lo stato
                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                
                // Ricarica la lista per applicare correttamente classi e stati disabilitati
                renderStudentsList();
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
                
                // Se attiva il preCamp e non ha un orario d'ingresso impostato, suggeriamo l'orario di default (07:45)
                if (student.preCamp && !student.entrataAnticipata) {
                    student.entrataAnticipata = '07:45';
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
                
                // Se attiva il postCamp e non ha un orario di uscita impostato, suggeriamo l'orario di default (17:30)
                if (student.postCamp && !student.uscitaAnticipata) {
                    student.uscitaAnticipata = '17:30';
                } else if (!student.postCamp) {
                    student.uscitaAnticipata = '';
                }

                await window.CampAPI.saveStudentData(AppState.currentCamp, dateStr, student);
                renderStudentsList();
                updateStatsSummary();
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
    const present = AppState.students.filter(s => s.presente === true).length;
    
    const babyTotal = AppState.students.filter(s => s.categoria === 'baby').length;
    const babyPresent = AppState.students.filter(s => s.presente === true && s.categoria === 'baby').length;
    
    const kidsTotal = AppState.students.filter(s => s.categoria === 'bambino').length;
    const kidsPresent = AppState.students.filter(s => s.presente === true && s.categoria === 'bambino').length;
    
    const preCampTotal = AppState.students.filter(s => s.preCamp === true).length;
    const preCampActive = AppState.students.filter(s => s.presente === true && s.preCamp === true).length;
    
    const postCampTotal = AppState.students.filter(s => s.postCamp === true).length;
    const postCampActive = AppState.students.filter(s => s.presente === true && s.postCamp === true).length;

    document.getElementById('stat-total-present').innerText = `${present}/${total}`;
    document.getElementById('stat-baby-present').innerText = `${babyPresent}/${babyTotal}`;
    document.getElementById('stat-kids-present').innerText = `${kidsPresent}/${kidsTotal}`;
    document.getElementById('stat-pre-present').innerText = preCampActive;
    document.getElementById('stat-post-present').innerText = postCampActive;
}

// Aggiorna l'icona e lo stato visualizzato online/offline
function updateSyncStatusBadge() {
    const badge = document.getElementById('sync-status');
    const isOnline = window.CampAPI.isOnlineMode();
    
    if (isOnline) {
        badge.className = 'sync-badge online';
        badge.querySelector('span').innerText = 'Online';
        setLucideIcon(badge, 'cloud-lightning');
    } else {
        badge.className = 'sync-badge offline';
        badge.querySelector('span').innerText = 'Local (Offline)';
        setLucideIcon(badge, 'cloud-off');
    }
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


