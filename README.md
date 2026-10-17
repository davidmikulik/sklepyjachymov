# sklepyjachymov

## Nasazení na Vercel

1. Na [vercel.com](https://vercel.com) importujte tento GitHub repozitář (Framework Preset: **Other**, bez build příkazu).
2. V *Project Settings → Environment Variables* nastavte:
   - `MISTRAL_API_KEY` – API klíč pro Mistral (povinné)
   - `MISTRAL_PROMPT` – text promptu, pokud v repozitáři není soubor `prompt.md`
   - `MISTRAL_MODEL` – volitelně, výchozí `mistral-small`
3. Deploy.

Stránka `sklepyjachymov.html` se servíruje na `/`, text generuje serverless funkce `api/generate-text.js`
(náhrada původního `generate_text_mistral.php`, Vercel PHP nativně nepodporuje).

Lokální spuštění: `npx vercel dev` (proměnné do `.env`, viz `.env.example`).
