const fs = require('fs');
const path = require('path');

const MISTRAL_MODEL_NAME = process.env.MISTRAL_MODEL || 'mistral-small';
const MISTRAL_URL = 'https://api.mistral.ai/v1/chat/completions';

function loadPrompt() {
    const promptFile = path.join(process.cwd(), 'prompt.md');
    if (fs.existsSync(promptFile)) {
        return fs.readFileSync(promptFile, 'utf8').trim();
    }
    return (process.env.MISTRAL_PROMPT || '').trim();
}

module.exports = async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');

    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
        return res.status(500).send('Chyba: Proměnná prostředí MISTRAL_API_KEY není nastavena');
    }

    const basePrompt = loadPrompt();
    if (!basePrompt) {
        return res.status(500).send('Chyba: Soubor prompt.md ani proměnná MISTRAL_PROMPT nebyly nalezeny');
    }

    const prompt = basePrompt + '\n\nID: ' + Date.now().toString(36) + Math.random().toString(36).slice(2);

    try {
        const response = await fetch(MISTRAL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify({
                model: MISTRAL_MODEL_NAME,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            }),
        });

        const raw = await response.text();
        let result;
        try {
            result = JSON.parse(raw);
        } catch (e) {
            return res.status(502).send(`Neočekávaná odpověď API (HTTP ${response.status}): ${raw}`);
        }

        if (result.error && result.error.message) {
            return res.status(502).send('Chyba API: ' + result.error.message);
        }

        const content = result.choices?.[0]?.message?.content
            ?? result.choices?.[0]?.text
            ?? result.output
            ?? result.text;

        if (typeof content === 'string' && content.trim()) {
            return res.status(200).send(content.trim());
        }

        return res.status(502).send(`Neočekávaná odpověď API (HTTP ${response.status}): ${raw}`);
    } catch (error) {
        return res.status(502).send('Chyba při volání API: ' + error.message);
    }
};
