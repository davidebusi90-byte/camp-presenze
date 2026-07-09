// supabase/functions/sync-students/index.ts
// Edge Function Supabase — Sincronizzazione allievi dal sistema esterno
//
// URL: POST https://eegkytdawwajpwysjsli.supabase.co/functions/v1/sync-students
// Headers:
//   apikey: <SUPABASE_ANON_KEY>
//   Content-Type: application/json
// Body: { "allievi": [...] }  oppure direttamente [...]

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getBirthYear(dateStr: string): number | null {
  if (!dateStr) return null
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-')
    if (parts[0].length === 4) return parseInt(parts[0], 10) // YYYY-MM-DD
    if (parts[2].length === 4) return parseInt(parts[2], 10) // DD-MM-YYYY
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/')
    if (parts[2].length === 4) return parseInt(parts[2], 10) // DD/MM/YYYY
    if (parts[0].length === 4) return parseInt(parts[0], 10) // YYYY/MM/DD
  }
  const match = dateStr.match(/\b\d{4}\b/)
  return match ? parseInt(match[0], 10) : null
}

function determinaCategoria(a: Record<string, string>): string {
  if (a.data_nascita) {
    const annoCamp = parseInt(a.annualita || String(new Date().getFullYear()), 10)
    const annoNascita = getBirthYear(a.data_nascita)
    if (annoNascita) {
      const eta = annoCamp - annoNascita
      return (eta >= 3 && eta <= 5) ? 'baby' : 'bambino'
    }
  }
  return 'bambino'
}

function determinaCamp(a: Record<string, string>): string {
  const rdCamp = (a.rd_camp || '').toLowerCase()
  if (rdCamp.includes('summer') || rdCamp.includes('estiv')) return 'summer'
  if (rdCamp.includes('spring') || rdCamp.includes('primaver')) return 'spring'
  if (rdCamp.includes('winter') || rdCamp.includes('inver')) return 'winter'
  return 'summer'
}

function trasformaAllievo(a: Record<string, string>) {
  const segnalazioni = (a.segnalazioni_sanitarie || '').trim()
  const patologie = (segnalazioni.toUpperCase() === 'NESSUNA' || segnalazioni === '') ? '' : segnalazioni

  return {
    external_id: String(a.id_allievo || a.Cod || '').trim(),
    nome: (a.nome || '').trim(),
    cognome: (a.cognome || '').trim(),
    categoria: determinaCategoria(a),
    camp: determinaCamp(a),
    colore: (a.colore || '').trim(),
    patologie: patologie
  }
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Usa il metodo POST.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Client Supabase con Service Role (ha accesso completo, bypassa RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Parsing body
  let allievi: Record<string, string>[]
  try {
    const body = await req.json()
    if (Array.isArray(body)) {
      allievi = body
    } else if (body && Array.isArray(body.allievi)) {
      allievi = body.allievi
    } else {
      return new Response(
        JSON.stringify({ success: false, message: 'Body non valido. Invia { "allievi": [...] } oppure un array diretto.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, message: 'Errore parsing JSON: ' + e.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!allievi || allievi.length === 0) {
    return new Response(
      JSON.stringify({ success: false, message: 'Nessun allievo nel payload.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Importazione allievo per allievo
  let importati = 0
  let aggiornati = 0
  const errori: { allievo: string; errore: string }[] = []

  for (const a of allievi) {
    const nomeCompleto = `${a.nome || ''} ${a.cognome || ''}`.trim()
    try {
      const dati = trasformaAllievo(a)

      // Cerca allievo esistente tramite external_id (solo se non vuoto e non inserito in manuale '0X')
      let existing: any[] | null = null
      if (dati.external_id && !dati.external_id.startsWith('0X')) {
        const { data } = await supabase
          .from('allievi')
          .select('id, override_manual')
          .eq('external_id', dati.external_id)
          .limit(1)
        existing = data
      }

      if (existing && existing.length > 0) {
        // Aggiorna rispettando l'override manuale dell'operatore
        const overrideManual = existing[0].override_manual
        const updatePayload = overrideManual ? {
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
        }

        const { error } = await supabase
          .from('allievi')
          .update(updatePayload)
          .eq('id', existing[0].id)

        if (error) throw new Error(error.message)
        aggiornati++
      } else {
        // INSERISCE nuovo allievo
        const { error } = await supabase
          .from('allievi')
          .insert({
            ...dati,
            intolleranze: '',
            turni: '1', // Turno di default all'inserimento
            override_manual: false
          })

        if (error) throw new Error(error.message)
        importati++
      }
    } catch (err) {
      errori.push({ allievo: nomeCompleto, errore: err.message })
    }
  }

  // Risposta finale con riepilogo
  return new Response(
    JSON.stringify({
      success: true,
      riepilogo: {
        totale_ricevuti: allievi.length,
        nuovi_inseriti: importati,
        aggiornati: aggiornati,
        errori: errori.length,
      },
      dettagli_errori: errori.length > 0 ? errori : undefined,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
