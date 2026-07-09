/**
 * api/archive-daily.js
 * Vercel Serverless Function — Archiviazione giornaliera presenze
 *
 * Scatta uno snapshot di tutti gli allievi e delle loro presenze del giorno
 * e lo salva come record JSON nella tabella "archivio_presenze".
 *
 * Eseguito automaticamente ogni notte a mezzanotte (tramite Vercel Crons).
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY; // Usa la Service Key lato server (bypass RLS)
const CRON_SECRET = process.env.CRON_SECRET;

module.exports = async function handler(req, res) {
    // Gestione CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. Verifica autorizzazione (Crons o chiamata manuale protetta)
    if (process.env.NODE_ENV === 'production') {
        const authHeader = req.headers.authorization;
        if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
            return res.status(401).json({ success: false, message: 'Non autorizzato.' });
        }
    }

    // 2. Determina la data da archiviare (default: ieri, o data passata via query)
    let dateStr = req.query.date;
    if (!dateStr) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const year = yesterday.getFullYear();
        const month = String(yesterday.getMonth() + 1).padStart(2, '0');
        const day = String(yesterday.getDate()).padStart(2, '0');
        dateStr = `${year}-${month}-${day}`;
    }

    // Valida il formato YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ success: false, message: 'Formato data non valido. Usa YYYY-MM-DD.' });
    }

    try {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json'
        };

        // 3. Recupera tutti gli allievi con le loro presenze associate alla data
        const studentsUrl = `${SUPABASE_URL}/rest/v1/allievi?select=*,presenze(*)&presenze.data=eq.${dateStr}`;
        const response = await fetch(studentsUrl, { headers });
        if (!response.ok) {
            throw new Error(`Errore recupero allievi (${response.status}): ${await response.text()}`);
        }
        
        const students = await response.json();

        if (!students || students.length === 0) {
            return res.status(200).json({
                success: true,
                message: `Nessun allievo trovato da archiviare per la data ${dateStr}.`
            });
        }

        // 4. Costruisce lo snapshot
        const snapshotData = students.map(s => {
            const p = s.presenze && s.presenze[0] ? s.presenze[0] : null;
            return {
                id_allievo: s.id,
                external_id: s.external_id,
                nome: s.nome,
                cognome: s.cognome,
                categoria: s.categoria,
                camp: s.camp,
                colore: s.colore,
                intolleranze: s.intolleranze,
                patologie: s.patologie,
                turni: s.turni,
                armadietto: s.armadietto,
                presente: p ? p.presente : null,
                pre_camp: p ? p.pre_camp : false,
                post_camp: p ? p.post_camp : false,
                entrata_anticipata: p ? p.entrata_anticipata : '',
                uscita_anticipata: p ? p.uscita_anticipata : ''
            };
        });

        // 5. Salva lo snapshot nella tabella archivio_presenze
        const insertUrl = `${SUPABASE_URL}/rest/v1/archivio_presenze`;
        const insertRes = await fetch(insertUrl, {
            method: 'POST',
            headers: { ...headers, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
                data: dateStr,
                payload: snapshotData
            })
        });

        if (!insertRes.ok) {
            throw new Error(`Errore inserimento snapshot (${insertRes.status}): ${await insertRes.text()}`);
        }

        return res.status(200).json({
            success: true,
            message: `Archiviazione completata con successo per la data ${dateStr}.`,
            elementi_archiviati: snapshotData.length
        });
    } catch (err) {
        console.error("Errore durante l'archiviazione notturna:", err);
        return res.status(500).json({
            success: false,
            message: 'Errore interno del server durante l'archiviazione.',
            errore: err.message
        });
    }
};
