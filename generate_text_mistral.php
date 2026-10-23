<?php

header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Replace this placeholder with your actual Mistral API key.
const MISTRAL_API_KEY = '0BP1neEW1m2LykzFafw47RryDZdChGMq';
const MISTRAL_MODEL_NAME = 'mistral-small';

function generateText(): string
{
    $promptFile = __DIR__ . '/prompt.md';
    
    if (!file_exists($promptFile)) {
        return 'Chyba: Soubor prompt.md nebyl nalezen v: ' . __DIR__;
    }
    
    $prompt = file_get_contents($promptFile);
    
    if ($prompt === false) {
        return 'Chyba: Nepodařilo se načíst soubor prompt.md';
    }
    
    $prompt = ensureUtf8(trim($prompt));
    
    $prompt .= '\n\n' . 'ID: ' . uniqid('', true);

    $payload = json_encode([
        'model' => MISTRAL_MODEL_NAME,
        'messages' => [
            [
                'role' => 'user',
                'content' => $prompt,
            ],
        ],
        'temperature' => 0.7,
    ], JSON_UNESCAPED_UNICODE);

    if ($payload === false) {
        return 'Chyba JSON: ' . json_last_error_msg();
    }

    $url = 'https://api.mistral.ai/v1/chat/completions';
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'Authorization: Bearer ' . MISTRAL_API_KEY,
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false) {
        return "Chyba při volání API: " . $error;
    }

    $result = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $jsonError = json_last_error_msg();
        return "Neočekávaná odpověď API (HTTP $httpCode, JSON error: $jsonError): " . $response;
    }

    if (isset($result['error']['message'])) {
        return "Chyba API: " . $result['error']['message'];
    }

    if (isset($result['choices'][0]['message']['content'])) {
        return trim($result['choices'][0]['message']['content']);
    }

    if (isset($result['choices'][0]['text'])) {
        return trim($result['choices'][0]['text']);
    }

    if (isset($result['output'])) {
        return trim($result['output']);
    }

    if (isset($result['text'])) {
        return trim($result['text']);
    }

    return "Neočekávaná odpověď API (HTTP $httpCode): " . $response;
}

function ensureUtf8(string $text): string
{
    if (!mb_check_encoding($text, 'UTF-8')) {
        return mb_convert_encoding($text, 'UTF-8', 'auto');
    }
    return $text;
}

echo generateText() . PHP_EOL;
