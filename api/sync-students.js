/**
 * api/sync-students.js
 * Vercel Serverless Function — Endpoint di sincronizzazione allievi
 *
 * Riceve il payload dal sistema del tecnico (formato API esterna),
 * trasforma i dati nel formato Supabase e li inserisce/aggiorna via upsert.
 *
 * Metodo:  POST
 * URL:     https://[tuo-dominio].vercel.app/api/sync-students
 * Headers: Content-Type: application/json
 *          x-api-key: <SYNC_API_KEY> (chiave segreta configurata in Vercel)
 * Body:    { "allievi": [...] }  oppure direttamente [...]
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Usa la Service Key lato server (mai esposta al frontend)
const SYNC_API_KEY = process.env.SYNC_API_KEY;         // Chiave segreta che il tecnico deve includere nell'header

// Colori che identificano la categoria "baby" non sono più usati per determinare la categoria.
// (Il campo colore è stato rimosso dalla sincronizzazione esterna)

/**
 * Estrae l'anno di nascita a 4 cifre da diversi formati (YYYY-MM-DD o DD/MM/YYYY)
 */
function getBirthYear(dateStr) {
    if (!dateStr) return null;
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts[0].length === 4) return parseInt(parts[0], 10); // YYYY-MM-DD
        if (parts[2].length === 4) return parseInt(parts[2], 10); // DD-MM-YYYY
    }
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts[2].length === 4) return parseInt(parts[2], 10); // DD/MM/YYYY
        if (parts[0].length === 4) return parseInt(parts[0], 10); // YYYY/MM/DD
    }
    const match = dateStr.match(/\b\d{4}\b/);
    return match ? parseInt(match[0], 10) : null;
}

/**
 * Determina la categoria (baby/bambino) dall'allievo esterno.
 * Baby: 3-5 anni. Bambini: 6-18 anni.
 */
function determinaCategoria(a) {
    if (a.data_nascita) {
        const annoCamp = parseInt(a.annualita || new Date().getFullYear(), 10);
        const annoNascita = getBirthYear(a.data_nascita);
        if (annoNascita) {
            const eta = annoCamp - annoNascita;
            return (eta >= 3 && eta <= 5) ? 'baby' : 'bambino';
        }
    }
    return 'bambino'; // Default
}

/**
 * Determina il camp (summer/spring/winter) dal campo rd_camp.
 */
function determinaCamp(a) {
    const rdCamp = (a.rd_camp || '').toLowerCase();
    if (rdCamp.includes('summer') || rdCamp.includes('estiv')) return 'summer';
    if (rdCamp.includes('spring') || rdCamp.includes('primaver')) return 'spring';
    if (rdCamp.includes('winter') || rdCamp.includes('inver')) return 'winter';
    return 'summer'; // Default
}

/**
 * Trasforma un allievo dal formato API esterna al formato Supabase.
 */
function trasformaAllievo(a) {
    const segnalazioni = (a.segnalazioni_sanitarie || '').trim();
    const patologie = (segnalazioni.toUpperCase() === 'NESSUNA' || segnalazioni === '') ? '' : segnalazioni;

    return {
        external_id: String(a.id_allievo || a.Cod || '').trim(),
        nome: (a.nome || '').trim(),
        cognome: (a.cognome || '').trim(),
        categoria: determinaCategoria(a),
        camp: determinaCamp(a),
        patologie: patologie,
        
        // Nuovi campi
        data_nascita: (a.data_nascita || '').trim(),
        codice_fiscale: (a.codice_fiscale || '').trim(),
        comune_nascita: (a.comune_nascita || '').trim(),
        cognome_referente: (a.cognome_referente || '').trim(),
        nome_referente: (a.nome_referente || '').trim(),
        email: (a.email || '').trim(),
        recapiti_telefonici: (a.recapiti_telefonici || '').trim(),
        annualita: (a.annualita || '').trim(),
        gruppo: (a.gruppo || '').trim(),
        id_preiscrizione: String(a.id_preiscrizione || '').trim(),
        tipologia: (a.tipologia || '').trim(),
        num_turni: String(a.num_turni || '').trim(),
        num_gite: String(a.num_gite || '').trim(),
        turno1: (a.turno1 || '').trim(),
        gita1: (a.gita1 || '').trim(),
        turno2: (a.turno2 || '').trim(),
        gita2: (a.gita2 || '').trim(),
        turno3: (a.turno3 || '').trim(),
        gita3: (a.gita3 || '').trim(),
        turno4: (a.turno4 || '').trim(),
        gita4: (a.gita4 || '').trim(),
        turno5: (a.turno5 || '').trim(),
        gita5: (a.gita5 || '').trim(),
        turno6: (a.turno6 || '').trim(),
        gita6: (a.gita6 || '').trim(),
        turno7: (a.turno7 || '').trim(),
        gita7: (a.gita7 || '').trim(),
        turno8: (a.turno8 || '').trim(),
        gita8: (a.gita8 || '').trim(),
        turno9: (a.turno9 || '').trim(),
        gita9: (a.gita9 || '').trim(),
        turno10: (a.turno10 || '').trim(),
        gita10: (a.gita10 || '').trim(),
        turno11: (a.turno11 || '').trim(),
        gita11: (a.gita11 || '').trim(),
        turno12: (a.turno12 || '').trim(),
        gita12: (a.gita12 || '').trim(),
        turno13: (a.turno13 || '').trim(),
        gita13: (a.gita13 || '').trim(),
        turno14: (a.turno14 || '').trim(),
        gita14: (a.gita14 || '').trim()
    };
}

export default async function handler(req, res) {
    // ── CORS ──────────────────────────────────────────────────────────────────
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ── Solo POST ─────────────────────────────────────────────────────────────
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Metodo non consentito. Usa POST.' });
    }

    // ── Verifica chiave API ───────────────────────────────────────────────────
    if (SYNC_API_KEY) {
        const clientKey = req.headers['x-api-key'];
        if (clientKey !== SYNC_API_KEY) {
            return res.status(401).json({ success: false, message: 'Chiave API non valida o mancante.' });
        }
    }

    // ── Verifica configurazione Supabase ──────────────────────────────────────
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        return res.status(500).json({ success: false, message: 'Configurazione Supabase mancante sul server.' });
    }

    // ── Parsing body ──────────────────────────────────────────────────────────
    let allievi;
    try {
        const body = req.body;
        if (Array.isArray(body)) {
            allievi = body;
        } else if (body && Array.isArray(body.allievi)) {
            allievi = body.allievi;
        } else {
            return res.status(400).json({
                success: false,
                message: 'Body non valido. Aspettato: { "allievi": [...] } oppure array diretto.'
            });
        }
    } catch (e) {
        return res.status(400).json({ success: false, message: 'Errore nel parsing JSON: ' + e.message });
    }

    if (!allievi || allievi.length === 0) {
        return res.status(400).json({ success: false, message: 'Nessun allievo nel payload.' });
    }

    // ── Importazione ──────────────────────────────────────────────────────────
    const headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    // Salva l'importazione automatica come file storico nel database
    try {
        const importFileName = `api_sync_${new Date().toISOString().replace(/T/, '_').substring(0, 19).replace(/:/g, '-')}.json`;
        await fetch(`${SUPABASE_URL}/rest/v1/importazioni`, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                nome_file: importFileName,
                camp: 'api_sync',
                payload: allievi
            })
        });
    } catch (importErr) {
        console.error("Errore nel salvataggio storico file importazione:", importErr);
    }

    let importati = 0;
    let aggiornati = 0;
    const errori = [];

    // Pre-fetch all existing students to do lookups in memory (performance optimization)
    let dbStudents = [];
    try {
        const fetchAllRes = await fetch(
            `${SUPABASE_URL}/rest/v1/allievi?select=id,external_id,override_manual`,
            { method: 'GET', headers }
        );
        if (fetchAllRes.ok) {
            dbStudents = await fetchAllRes.json();
        }
    } catch (e) {
        console.error("Errore nel pre-fetch degli allievi per sync-students:", e);
    }

    for (const a of allievi) {
        const nomeCompleto = `${a.nome || ''} ${a.cognome || ''}`.trim();
        try {
            const dati = trasformaAllievo(a);

            // Cerca allievo esistente per external_id (solo se non vuoto e non inserito in manuale '0X')
            let existing = [];
            if (dati.external_id && !dati.external_id.startsWith('0X')) {
                const match = dbStudents.find(s => s.external_id === dati.external_id);
                if (match) {
                    existing = [{ id: match.id, override_manual: match.override_manual }];
                }
            }

            if (existing && existing.length > 0) {
                // Aggiorna rispettando l'override manuale dell'operatore
                const overrideManual = existing[0].override_manual;
                const updatePayload = overrideManual ? {
                    // Se l'allievo è stato modificato in manuale dall'operatore, non sovrascriviamo nome, cognome e categoria
                    camp: dati.camp,
                    patologie: dati.patologie,
                    data_nascita: dati.data_nascita,
                    codice_fiscale: dati.codice_fiscale,
                    comune_nascita: dati.comune_nascita,
                    cognome_referente: dati.cognome_referente,
                    nome_referente: dati.nome_referente,
                    email: dati.email,
                    recapiti_telefonici: dati.recapiti_telefonici,
                    annualita: dati.annualita,
                    gruppo: dati.gruppo,
                    id_preiscrizione: dati.id_preiscrizione,
                    tipologia: dati.tipologia,
                    num_turni: dati.num_turni,
                    num_gite: dati.num_gite,
                    turno1: dati.turno1, gita1: dati.gita1,
                    turno2: dati.turno2, gita2: dati.gita2,
                    turno3: dati.turno3, gita3: dati.gita3,
                    turno4: dati.turno4, gita4: dati.gita4,
                    turno5: dati.turno5, gita5: dati.gita5,
                    turno6: dati.turno6, gita6: dati.gita6,
                    turno7: dati.turno7, gita7: dati.gita7,
                    turno8: dati.turno8, gita8: dati.gita8,
                    turno9: dati.turno9, gita9: dati.gita9,
                    turno10: dati.turno10, gita10: dati.gita10,
                    turno11: dati.turno11, gita11: dati.gita11,
                    turno12: dati.turno12, gita12: dati.gita12,
                    turno13: dati.turno13, gita13: dati.gita13,
                    turno14: dati.turno14, gita14: dati.gita14
                } : {
                    ...dati // Aggiorniamo tutti i campi presi dalla trasformazione
                };

                const updateRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/allievi?id=eq.${existing[0].id}`,
                    {
                        method: 'PATCH',
                        headers,
                        body: JSON.stringify(updatePayload)
                    }
                );
                if (!updateRes.ok) throw new Error(`PATCH ${updateRes.status}: ${await updateRes.text()}`);
                aggiornati++;
            } else {
                // Inserisce nuovo allievo
                const insertRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/allievi`,
                    {
                        method: 'POST',
                        headers: { ...headers, 'Prefer': 'return=representation' },
                        body: JSON.stringify({
                            ...dati,
                            intolleranze: '',
                            turni: '1', // Turno di default all'inserimento
                            override_manual: false
                        })
                    }
                );
                if (!insertRes.ok) throw new Error(`POST ${insertRes.status}: ${await insertRes.text()}`);
                
                let newId = null;
                try {
                    const insertedRows = await insertRes.json();
                    newId = insertedRows && insertedRows[0] ? insertedRows[0].id : null;
                } catch (jsonErr) {
                    console.warn("Impossibile leggere ID allievo inserito in sync-students:", jsonErr);
                }

                importati++;

                dbStudents.push({
                    id: newId,
                    external_id: dati.external_id,
                    override_manual: false
                });
            }
        } catch (err) {
            errori.push({ allievo: nomeCompleto, errore: err.message });
        }
    }

    // ── Risposta ──────────────────────────────────────────────────────────────
    return res.status(200).json({
        success: true,
        riepilogo: {
            totale_ricevuti: allievi.length,
            nuovi_inseriti: importati,
            aggiornati: aggiornati,
            errori: errori.length
        },
        dettagli_errori: errori.length > 0 ? errori : undefined
    });
}
