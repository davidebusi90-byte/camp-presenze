const fs = require('fs');
const file = 'js/app.js';
const c = fs.readFileSync(file);
const str = c.toString('binary');
const matches = str.match(/\r\r\n/g);
const bad = matches ? matches.length : 0;
console.log('Righe errate:', bad);
if (bad > 0) {
    const fixed = str.replace(/\r\r\n/g, '\r\n');
    fs.writeFileSync(file, Buffer.from(fixed, 'binary'));
    console.log('Corrette.');
} else {
    console.log('OK, nessun problema.');
}
