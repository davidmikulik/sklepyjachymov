# sklepyjachymov

## Nasazení na Vercel

1. Na [vercel.com](https://vercel.com) importujte tento GitHub repozitář (Framework Preset: **Other**, bez build příkazu).
2. V *Project Settings → Environment Variables* nastavte:
   - `MISTRAL_API_KEY` – API klíč pro Mistral (povinné)
   - `MISTRAL_PROMPT` – volitelně, přepíše prompt ze souboru `prompt.md`
   - `MISTRAL_MODEL` – volitelně, výchozí `mistral-small-latest`
3. Deploy (po změně proměnných prostředí je potřeba Redeploy).

Prompt pro text v boxu „Něco o Jáchymově“ je v souboru `prompt.md`; do funkce se přibaluje přes `includeFiles` ve `vercel.json`.

Stránka `sklepyjachymov.html` se servíruje na `/`, text generuje serverless funkce `api/generate-text.js`
(náhrada původních PHP skriptů, Vercel PHP nativně nepodporuje).

Lokální spuštění: `npx vercel dev` (proměnné do `.env`, viz `.env.example`).
