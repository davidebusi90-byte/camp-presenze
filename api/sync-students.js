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

// Colori che identificano la categoria "baby" non sono più usati per determinare la categoria,
// ma salviamo il colore originale così com'è nel database.

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
        colore: (a.colore || '').trim(),
        patologie: patologie
        // intolleranze e turni non vengono toccati dall'importatore API
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

    let importati = 0;
    let aggiornati = 0;
    const errori = [];

    for (const a of allievi) {
        const nomeCompleto = `${a.nome || ''} ${a.cognome || ''}`.trim();
        try {
            const dati = trasformaAllievo(a);

            // Cerca allievo esistente per external_id (solo se non vuoto e non inserito in manuale '0X')
            let existing = [];
            if (dati.external_id && !dati.external_id.startsWith('0X')) {
                const checkRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/allievi?external_id=eq.${encodeURIComponent(dati.external_id)}&select=id,override_manual`,
                    { method: 'GET', headers }
                );
                if (checkRes.ok) {
                    existing = await checkRes.json();
                }
            }

            if (existing && existing.length > 0) {
                // Aggiorna rispettando l'override manuale dell'operatore
                const overrideManual = existing[0].override_manual;
                const updatePayload = overrideManual ? {
                    // Se l'allievo è stato modificato in manuale dall'operatore, non sovrascriviamo nome, cognome e categoria
                    camp: dati.camp,
                    colore: dati.colore,
                    patologie: dati.patologie
                } : {
                    nome: dati.nome,
                    cognome: dati.cognome,
                    categoria: dati.categoria,
                    camp: dati.camp,
                    colore: dati.colore,
                    patologie: dati.patologie
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
                        headers: { ...headers, 'Prefer': 'return=minimal' },
                        body: JSON.stringify({
                            ...dati,
                            intolleranze: '',
                            turni: '1', // Turno di default all'inserimento
                            override_manual: false
                        })
                    }
                );
                if (!insertRes.ok) throw new Error(`POST ${insertRes.status}: ${await insertRes.text()}`);
                importati++;
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
