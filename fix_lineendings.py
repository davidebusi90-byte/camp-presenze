import os

file_path = 'js/app.js'
with open(file_path, 'rb') as f:
    content = f.read()

bad_count = content.count(b'\r\r\n')
print(f'Righe con line ending errato (\\r\\r\\n): {bad_count}')

if bad_count > 0:
    fixed_content = content.replace(b'\r\r\n', b'\r\n')
    with open(file_path, 'wb') as f:
        f.write(fixed_content)
    print('Corretti con successo.')
else:
    print('Nessun problema trovato.')
