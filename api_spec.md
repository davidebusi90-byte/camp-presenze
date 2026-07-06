# Specifica Tecnica API - Sincronizzazione Presenze Camp
**Destinatario:** Sviluppatore Backend / Programmatore API

Questo documento descrive i contratti JSON, le rotte e i requisiti necessari per creare il backend di supporto all'applicazione frontend **Ritmo Danza - Presenze Camp**. 

L'applicazione gestisce le presenze giornaliere di tre camp stagionali (`summer`, `spring`, `winter`), distinguendo gli allievi tra categorie (`baby` o `bambino`), consentendo la configurazione del pre/post camp, degli orari di entrata/uscita anticipata e la gestione di un calendario settimanale delle attività.

---

## 1. Configurazione Generale e Sicurezza (CORS)

Poiché l'applicazione frontend può essere ospitata su un dominio statico o eseguita localmente in ambiente di sviluppo, il server backend **deve obbligatoriamente implementare e abilitare il CORS (Cross-Origin Resource Sharing)**.

Il server deve rispondere con i seguenti header per tutte le richieste provenienti dal client:
```http
Access-Control-Allow-Origin: * (o il dominio specifico del frontend)
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, Accept
```
Le richieste HTTP con metodo `OPTIONS` (preflight request) devono restituire uno stato HTTP `200 OK`.

---

## 2. Endpoint Richiesti

L'applicazione consente all'utente di definire l'URL di base dell'API (es: `https://api.iltuodominio.com/camp`) tramite la schermata **Impostazioni**. Tutte le rotte descritte di seguito faranno riferimento a tale URL di base.

### 2.1 Verifica Connessione (Health Check)
Rileva la raggiungibilità dell'API.
* **Metodo:** `GET`
* **Rotta:** `/health` (In alternativa l'app proverà ad effettuare una fetch su `/students` con parametri di test).
* **Risposta Successo (200 OK):**
  ```json
  {
    "status": "ok"
  }
  ```

---

### 2.2 Ottenere la lista degli Allievi e Presenze
Recupera l'anagrafica degli allievi e il loro stato di presenza per un determinato camp e una determinata data.
* **Metodo:** `GET`
* **Rotta:** `/students`
* **Parametri Query:**
  * `camp` (string, obbligatorio): `summer` | `spring` | `winter`
  * `date` (string, obbligatorio, formato `YYYY-MM-DD`): la data dell'appello
* **Risposta Successo (200 OK):**
  Un array JSON contenente gli allievi iscritti al camp e il loro stato di presenza per la data specificata.
  
  *Nota di implementazione backend:* Se per la data specificata non esiste ancora un record di presenza nel database, il backend dovrebbe restituire la lista di tutti gli iscritti al camp con `"presente": false` (tutti assenti) e gli orari vuoti di default.
  
  ```json
  [
    {
      "id": "1",
      "nome": "Sofia",
      "cognome": "Rossi",
      "categoria": "baby",
      "preCamp": false,
      "postCamp": false,
      "entrataAnticipata": "",
      "uscitaAnticipata": "",
      "presente": false
    },
    {
      "id": "2",
      "nome": "Leonardo",
      "cognome": "Bianchi",
      "categoria": "bambino",
      "preCamp": true,
      "postCamp": false,
      "entrataAnticipata": "08:00",
      "uscitaAnticipata": "",
      "presente": true
    },
    {
      "id": "3",
      "nome": "Giulia",
      "cognome": "Ferrari",
      "categoria": "baby",
      "preCamp": false,
      "postCamp": true,
      "entrataAnticipata": "",
      "uscitaAnticipata": "13:00",
      "presente": true
    }
  ]
  ```

---

### 2.3 Salvataggio/Aggiornamento dello Stato di un Allievo
Invia lo stato aggiornato di un allievo (incluso appello, pre/post camp, e orari straordinari d'ingresso/uscita).
* **Metodo:** `POST`
* **Rotta:** `/attendance`
* **Body Richiesta (JSON):**
  ```json
  {
    "camp": "summer",
    "date": "2026-07-06",
    "student": {
      "id": "2",
      "nome": "Leonardo",
      "cognome": "Bianchi",
      "categoria": "bambino",
      "preCamp": true,
      "postCamp": true,
      "entrataAnticipata": "07:45",
      "uscitaAnticipata": "12:45",
      "presente": true
    }
  }
  ```
* **Risposta Successo (200 OK):**
  ```json
  {
    "success": true,
    "message": "Presenza aggiornata con successo"
  }
  ```

---

### 2.4 Ottenere il Calendario delle Attività
Recupera l'elenco delle attività settimanali pianificate per il camp selezionato.
* **Metodo:** `GET`
* **Rotta:** `/activities`
* **Parametri Query:**
  * `camp` (string, obbligatorio): `summer` | `spring` | `winter`
* **Risposta Successo (200 OK):**
  Un array delle attività pianificate per la settimana di quel camp.
  ```json
  [
    {
      "id": "act-101",
      "nome": "Hip Hop e Ritmo",
      "giorno": "1", 
      "inizio": "09:30",
      "fine": "10:30",
      "target": "tutti"
    },
    {
      "id": "act-102",
      "nome": "Piscina",
      "giorno": "1",
      "inizio": "11:00",
      "fine": "12:30",
      "target": "bambino"
    }
  ]
  ```
  *Nota sui campi:*
  * `giorno`: Stringa numerica da `"1"` (Lunedì) a `"5"` (Venerdì).
  * `target`: Destinatari dell'attività: `"tutti"` | `"baby"` | `"bambino"`.

---

### 2.5 Aggiungere un'Attività al Calendario
Salva una nuova attività nel calendario del camp specifico.
* **Metodo:** `POST`
* **Rotta:** `/activities`
* **Body Richiesta (JSON):**
  ```json
  {
    "camp": "summer",
    "activity": {
      "nome": "Laboratorio di Fiabe",
      "giorno": "2",
      "inizio": "10:00",
      "fine": "11:30",
      "target": "baby"
    }
  }
  ```
* **Risposta Successo (200 OK / 201 Created):**
  Restituisce l'oggetto attività salvato comprensivo dell'ID generato dal database.
  ```json
  {
    "id": "act-509",
    "nome": "Laboratorio di Fiabe",
    "giorno": "2",
    "inizio": "10:00",
    "fine": "11:30",
    "target": "baby"
  }
  ```

---

### 2.6 Rimuovere un'Attività dal Calendario
Elimina un'attività programmata nel calendario.
* **Metodo:** `DELETE`
* **Rotta:** `/activities/:id`
* **Parametri Query:**
  * `camp` (string, obbligatorio): `summer` | `spring` | `winter` (necessario per contestualizzare la partizione)
* **Risposta Successo (200 OK):**
  ```json
  {
    "success": true,
    "message": "Attività eliminata con successo"
  }
  ```
