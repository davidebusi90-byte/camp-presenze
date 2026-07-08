
$apikey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlZ2t5dGRhd3dhanB3eXNqc2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNDIyOTAsImV4cCI6MjA5ODkxODI5MH0.lo_eiSTk0KmataFfpuBtW2s2K9nsmOIPo3nZL_qFalQ"
$token = "eyJhbGciOiJFUzI1NiIsImtpZCI6ImU2MGJiNDc5LThjMTUtNDFkMS1iNDQ4LThiNjU0MTAxZjgxNCIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2VlZ2t5dGRhd3dhanB3eXNqc2xpLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI1MmQyZWNhYi1iZGE5LTRiYTctYTc1Ny03MWNhZDIwYTY3ODciLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzgzNTEzMTE0LCJpYXQiOjE3ODM1MDk1MTQsImVtYWlsIjoidWZmaWNpb2V2ZW50aUByaXRtb2RhbnphLm5ldCIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnsiZW1haWxfdmVyaWZpZWQiOnRydWV9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzgzNTA5NTE0fV0sInNlc3Npb25faWQiOiJmNzJhODJmOC0zZWE4LTRlOWYtYjJlNS0zMDA2MzEyNjFkNWQiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.pGbQOQ3wosCYU_x-K0fnyFIvwVNRyOygcKF1p6t7Z3yQYnSSNuIM4-F2dA6k6BiQioM3xNdBs20lGtaH6VvdbA"
$baseUrl = "https://eegkytdawwajpwysjsli.supabase.co/rest/v1/allievi"

$headers = @{
    "apikey"        = $apikey
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
    "Prefer"        = "return=minimal"
}

function Insert-Allievo($nome, $cognome, $categoria, $intolleranze, $patologie) {
    $obj = [PSCustomObject]@{
        camp         = "summer"
        nome         = $nome
        cognome      = $cognome
        categoria    = $categoria
        intolleranze = $intolleranze
        patologie    = $patologie
    }
    $body = $obj | ConvertTo-Json -Compress
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    
    try {
        $response = Invoke-WebRequest -Uri $baseUrl -Method POST -Headers $headers -Body $bodyBytes -UseBasicParsing
        if ($response.StatusCode -eq 201 -or $response.StatusCode -eq 200) {
            Write-Host "  OK: $nome $cognome" -ForegroundColor Green
            return $true
        } else {
            Write-Host "  ERRORE ($($response.StatusCode)): $nome $cognome" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "  ERRORE: $nome $cognome -> $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$successCount = 0
$errorCount = 0

# =====================================================
# BABY (categoria: baby) - 30 allievi
# =====================================================
Write-Host "=== IMPORTAZIONE BABY (30 allievi) ===" -ForegroundColor Cyan

$r = Insert-Allievo "ANTONIO"           "ARGIOLAS MISURACA"   "baby"    ""                              "RICORDARGLI DI APPLICARE CREMA STICK SUL SOPRACIGLIO DESTRO"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "PIETRO"            "ATTISANO"             "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LAVINIA"           "BUA"                  "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ALESSIO"           "CAGNAZZO"             "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FEDERICO"          "COCCHI"               "baby"    "ALLERGICO AL KIWI"            ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FRANCESCO"         "COLONNA"              "baby"    ""                              "Nuoto"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GIOELE"            "CULICI"               "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LODOVICA RITA"     "CULICI"               "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "DANTE"             "FACCHINI VERTUANI"    "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FRANCESCA VITTORIA" "FANTONI"             "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ALICE"             "GIORNO"               "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MATHIAS"           "GRAZIA"               "baby"    ""                              "Difficolta' a fare la cacca"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MARGOT"            "IARDINO"              "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "BEATRICE"          "INSERRA"              "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GAIA"              "LOMBARDO"             "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MATTEO"            "MAGLIULO"             "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ALICE"             "MARTELLA"             "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GIULIA"            "NEGRO"                "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LEONARDO"          "NEGRO"                "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LEONARDO"          "NERI"                 "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ASIA"              "PENTELICO"            "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FEDERICO"          "PITONI"               "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "DARIUS GABRIEL"    "POPA"                 "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MATILDE"           "ROSSI"                "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LEONARDO"          "ROSSI"                "baby"    "ALLERGIA POLVERI E MUFFE"     "BRONCOSPASMA"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ALICE"             "SCHIAVI"              "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SAMUELE"           "SERRA"                "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GINEVRA"           "STABILE"              "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "CLOE"              "TIENGO"               "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GIOIA"             "VALENTE"              "baby"    ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }

# =====================================================
# BAMBINI (categoria: bambino) - 40 allievi
# =====================================================
Write-Host ""
Write-Host "=== IMPORTAZIONE BAMBINI (40 allievi) ===" -ForegroundColor Cyan

$r = Insert-Allievo "PENELOPE"          "BORIN"                "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SOFIA"             "BREVEGLIERI"          "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GINEVRA"           "BUA"                  "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SAMANTA"           "BUCI"                 "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ELETTRA"           "CAGNAZZO"             "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MIA"               "CARAFOLI"             "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "AMLA"              "CENI"                 "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "BEATRICE"          "COCCHI"               "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SOFIA"             "COTTI"                "bambino" ""                              "DIETA PER REFLUSSO GASTROESOFAGEO"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SOFIA"             "DOMENICHINI"          "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "CAMILLA"           "FIORINI"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ILARIA"            "GIANAROLI"            "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "AMELIA"            "GOLINELLI"            "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SOFIA"             "GORETTI"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LINDA"             "GUERIBI"              "bambino" "NO MAIALE"                    ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GRETA"             "GUIDA"                "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LARISSA ANDREEA"   "HOTEA"                "bambino" ""                              "Difficolta' a parlare ed esprimersi - sostegno 104 - logopedista"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "NICOLE"            "IARDINO"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MARINA"            "LAMORGESE"            "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ALICE"             "MONARI"               "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "CHIARA"            "NEPOTI"               "bambino" ""                              "ALLERGIA FARMACO AMOXICILLINA"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FEDERICA"          "PALMA"                "bambino" "CELIACHIA"                    ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ELEONORA"          "PATTOCCHIO"           "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SARA"              "PICCIONI"             "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MATILDE"           "RAGUSA"               "bambino" ""                              "RINITE ALLERGICA"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "ALICE"             "RELICS"               "bambino" ""                              "ALLERGIA ALLE POLVERI"
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GINEVRA"           "RIGHI"                "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GIOIA"             "ROSANOVA"             "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "MARIANNA"          "ROSSI"                "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FRANCESCO"         "SCHIAVI"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SERENA"            "SCHIAVI"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "AURORA MIA"        "STABILE"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "LUDOVICA"          "TAGLIATI"             "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "REBECCA"           "VALENTE"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "FRANCESCA"         "VENTURA"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "BEATRICE"          "VENTURINI"            "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "VITTORIA"          "VERRASTRO"            "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "SOFIA"             "VITALE"               "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GIORGIA"           "ZANETTI"              "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }
$r = Insert-Allievo "GABRIELE"          "ZUCCHELLI"            "bambino" ""                              ""
if ($r) { $successCount++ } else { $errorCount++ }

Write-Host ""
Write-Host "=== RISULTATO ===" -ForegroundColor Yellow
Write-Host "Inseriti con successo: $successCount / 70" -ForegroundColor Green
Write-Host "Errori: $errorCount" -ForegroundColor Red
