const fs = require('fs');
const path = require('path');

// Hlavní zdroj: Google Gemini. Volitelně Mistral, pokud je nastaven MISTRAL_API_KEY.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || 'mistral-small-2603';

// Archiv vygenerovaných hlášek v Upstash Redis (integrace ve Vercelu). Vercel může proměnným
// přidat vlastní předponu (např. STORAGE_KV_REST_API_URL), proto se hledají podle konce názvu.
function findEnv(suffixes) {
    for (const suffix of suffixes) {
        if (process.env[suffix]) return suffix;
        const name = Object.keys(process.env).find(k => k.endsWith('_' + suffix) && process.env[k]);
        if (name) return name;
    }
    return null;
}
const REDIS_URL_VAR = findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL']);
const REDIS_TOKEN_VAR = findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']);
const REDIS_URL = REDIS_URL_VAR && process.env[REDIS_URL_VAR];
const REDIS_TOKEN = REDIS_TOKEN_VAR && process.env[REDIS_TOKEN_VAR];
const REDIS_KEY = 'jachymov:hlasky';
const ARCHIVE_SIZE = 200;

// prompt.md a hlasky.json se do funkce přibalují přes "includeFiles" ve vercel.json
function readBundled(name) {
    for (const file of [path.join(__dirname, '..', name), path.join(process.cwd(), name)]) {
        if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
    }
    return null;
}

function loadPrompt() {
    const fromEnv = (process.env.AI_PROMPT || process.env.MISTRAL_PROMPT || '').trim();
    return fromEnv || (readBundled('prompt.md') || '').trim();
}

function seedJokes() {
    try {
        return JSON.parse(readBundled('hlasky.json') || '[]').filter(t => typeof t === 'string' && t.trim());
    } catch (e) {
        return [];
    }
}

const pick = list => list[Math.floor(Math.random() * list.length)];

async function redis(command) {
    if (!REDIS_URL || !REDIS_TOKEN) return null;
    const response = await fetch(REDIS_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
    });
    if (!response.ok) throw new Error('Redis HTTP ' + response.status);
    return (await response.json()).result;
}

async function askGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
    const call = () => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.9 } }),
    });
    let response = await call();
    if (response.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        response = await call();
    }
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error(`Gemini HTTP ${response.status}: ${raw.slice(0, 200)}`); }
    if (!response.ok || data.error) throw new Error(`Gemini HTTP ${response.status} (${GEMINI_MODEL}): ${data.error?.message || raw.slice(0, 200)}`);
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('Gemini vrátil prázdnou odpověď');
    return text;
}

async function askMistral(prompt) {
    const key = process.env.MISTRAL_API_KEY;
    if (!key) return null;
    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: MISTRAL_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }),
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error(`Mistral HTTP ${response.status}: ${raw.slice(0, 200)}`); }
    const text = data.choices?.[0]?.message?.content;
    if (!response.ok || typeof text !== 'string' || !text.trim()) throw new Error(`Mistral HTTP ${response.status} (${MISTRAL_MODEL}): ${data.message || raw.slice(0, 200)}`);
    return text.trim();
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const basePrompt = loadPrompt();
    const errors = [];

    if (basePrompt) {
        const prompt = basePrompt + '\n\nID: ' + Date.now().toString(36) + Math.random().toString(36).slice(2);
        for (const ask of [askGemini, askMistral]) {
            try {
                const text = await ask(prompt);
                if (!text) continue;
                // uložit do archivu (chyba archivu nesmí shodit odpověď)
                try {
                    await redis(['LPUSH', REDIS_KEY, text]);
                    await redis(['LTRIM', REDIS_KEY, 0, ARCHIVE_SIZE - 1]);
                } catch (e) {
                    console.warn('Archiv hlášek:', e.message);
                }
                res.setHeader('X-Hlaska-Source', 'ai');
                return res.status(200).send(text);
            } catch (e) {
                errors.push(e.message);
            }
        }
        if (!process.env.GEMINI_API_KEY && !process.env.MISTRAL_API_KEY) errors.push('Není nastaven GEMINI_API_KEY');
    } else {
        errors.push('Chybí prompt.md');
    }
    if (errors.length) console.warn('AI hláška nedostupná:', errors.join(' | '));

    // záloha: uložená hláška z archivu, jinak ze sady v repozitáři
    try {
        const archived = await redis(['LRANGE', REDIS_KEY, 0, ARCHIVE_SIZE - 1]);
        if (Array.isArray(archived) && archived.length) {
            res.setHeader('X-Hlaska-Source', 'archiv');
            return res.status(200).send(pick(archived));
        }
    } catch (e) {
        errors.push('Archiv: ' + e.message);
    }
    const seed = seedJokes();
    if (seed.length) {
        res.setHeader('X-Hlaska-Source', 'zaloha');
        return res.status(200).send(pick(seed));
    }
    return res.status(502).send('Chyba: ' + errors.join(' | '));
};
