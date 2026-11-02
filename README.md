# sklepyjachymov

## Nasazení na Vercel

1. Na [vercel.com](https://vercel.com) importujte tento GitHub repozitář (Framework Preset: **Other**, bez build příkazu).
2. V *Project Settings → Environment Variables* nastavte:
   - `GEMINI_API_KEY` – API klíč z Google AI Studio (hlavní zdroj hlášek)
   - `GEMINI_MODEL` – volitelně, výchozí `gemini-flash-lite-latest`
   - `AI_PROMPT` – volitelně, přepíše prompt ze souboru `prompt.md`
   - `MISTRAL_API_KEY`, `MISTRAL_MODEL` – volitelně, záložní poskytovatel (výchozí `mistral-small-2603`)
3. Volitelně v *Storage* připojte **Upstash Redis** (Marketplace) – Vercel sám nastaví `KV_REST_API_URL`
   a `KV_REST_API_TOKEN` a funkce do něj ukládá posledních 200 vygenerovaných hlášek.
4. Deploy (po změně proměnných prostředí je potřeba Redeploy).

Box „Něco o Jáchymově“ plní serverless funkce `api/generate-text.js`: zkusí Gemini (a případně Mistral),
úspěšnou hlášku uloží do archivu a vrátí ji. Když AI volání odmítne, vrátí náhodnou hlášku z archivu,
jinak náhradní větu ze souboru `hlasky.json`. Prohlížeč si navíc ukládá posledních 50 hlášek a použije je, když server
nemá nic lepšího. Zdroj je v hlavičce `X-Hlaska-Source` (`ai`, `archiv`, `zaloha`).

Lokální spuštění: `npx vercel dev` (proměnné do `.env`, viz `.env.example`).
