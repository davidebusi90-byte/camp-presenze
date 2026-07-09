const SUPABASE_URL = 'https://eegkytdawwajpwysjsli.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZ2t5dGRhd3dhanB3eXNqc2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDIyOTAsImV4cCI6MjA5ODkxODI5MH0.lo_eiSTk0KmataFfpuBtW2s2K9nsmOIPo3nZL_qFalQ';

async function check() {
    try {
        console.log("Logging in...");
        const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: 'ufficioeventi@ritmodanza.net', password: 'admin' })
        });

        console.log(`Login status: ${loginRes.status}`);
        const loginData = await loginRes.json();
        if (!loginRes.ok) {
            console.error("Login failed:", loginData);
            return;
        }

        const token = loginData.access_token;
        console.log("Login successful. Got token!");

        const authHeaders = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        };

        // Count allievi
        const resAllievi = await fetch(`${SUPABASE_URL}/rest/v1/allievi?select=count`, {
            headers: { ...authHeaders, 'Prefer': 'count=exact' }
        });
        const countAllievi = resAllievi.headers.get('content-range');
        
        // Count presenze
        const resPresenze = await fetch(`${SUPABASE_URL}/rest/v1/presenze?select=count`, {
            headers: { ...authHeaders, 'Prefer': 'count=exact' }
        });
        const countPresenze = resPresenze.headers.get('content-range');

        // Get count per camp
        const resSummer = await fetch(`${SUPABASE_URL}/rest/v1/allievi?camp=eq.summer&select=count`, {
            headers: { ...authHeaders, 'Prefer': 'count=exact' }
        });
        const countSummer = resSummer.headers.get('content-range');

        const resSpring = await fetch(`${SUPABASE_URL}/rest/v1/allievi?camp=eq.spring&select=count`, {
            headers: { ...authHeaders, 'Prefer': 'count=exact' }
        });
        const countSpring = resSpring.headers.get('content-range');

        const resWinter = await fetch(`${SUPABASE_URL}/rest/v1/allievi?camp=eq.winter&select=count`, {
            headers: { ...authHeaders, 'Prefer': 'count=exact' }
        });
        const countWinter = resWinter.headers.get('content-range');

        console.log(`Allievi totali: ${countAllievi}`);
        console.log(`Presenze totali: ${countPresenze}`);
        console.log(`Summer camp allievi: ${countSummer}`);
        console.log(`Spring camp allievi: ${countSpring}`);
        console.log(`Winter camp allievi: ${countWinter}`);

        // Fetch a few students to check structure
        const resSample = await fetch(`${SUPABASE_URL}/rest/v1/allievi?limit=2`, {
            headers: authHeaders
        });
        console.log("Sample student records:", await resSample.json());

    } catch (e) {
        console.error(e);
    }
}

check();
