/**
 * server.js - Semplice server HTTP statico per Node.js (senza dipendenze esterne)
 * Permette di testare l'app localmente.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json'
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);

    // Pulisce l'URL per rimuovere parametri di query o hash
    let safeUrl = req.url.split('?')[0].split('#')[0];
    
    // Default a index.html
    if (safeUrl === '/' || safeUrl === '') {
        safeUrl = '/index.html';
    }

    const filePath = path.join(__dirname, safeUrl);
    
    // Verifica che il file sia all'interno della directory del progetto (sicurezza di base)
    if (!filePath.startsWith(__dirname)) {
        res.statusCode = 403;
        res.end('Accesso negato');
        return;
    }

    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.end(`File non trovato: ${safeUrl}`);
            return;
        }

        fs.readFile(filePath, (readErr, content) => {
            if (readErr) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                res.end(`Errore interno del server: ${readErr.message}`);
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            
            res.statusCode = 200;
            res.setHeader('Content-Type', contentType);
            res.end(content);
        });
    });
});

// Avvia il server in locale (accessibile solo da questo computer)
server.listen(PORT, '127.0.0.1', () => {
    console.log('\n======================================================');
    console.log(`Server Presenze Camp avviato con successo!`);
    console.log(`PORTA: ${PORT}`);
    console.log('======================================================');
    console.log(`\nACCESSO LOCALE (da questo computer):`);
    console.log(`  http://localhost:${PORT}`);
    console.log('\nPremi CTRL+C per arrestare il server.\n');
});
