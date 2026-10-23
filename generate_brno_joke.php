<?php

// Replace this placeholder with your actual Gemini API key.
const GEMINI_API_KEY = 'AQ.Ab8RN6KaylbAAD84pGh8z1YIB-Tuj3gmSIGp_ZG9jEhakfaJRw';
const GEMINI_MODEL_NAME = 'models/gemini-3.5-flash-lite';

function generateBrnoJoke(): string
{
    $prompt = "Napi¹ krátkou, vtipnou a lehce nekorektní hlá¹ku na téma obyvatelé Jáchymova. Buï hravý, ale ne pøíli¹ urá¾livý.";
    $prompt = ensureUtf8($prompt);

    $payload = json_encode([
        'contents' => [
            [
                'parts' => [
                    [
                        'text' => $prompt,
                    ],
                ],
            ],
        ],
    ], JSON_UNESCAPED_UNICODE);

    if ($payload === false) {
        return 'Chyba JSON: ' . json_last_error_msg();
    }

    $url = 'https://generativelanguage.googleapis.com/v1beta/' . GEMINI_MODEL_NAME . ':generateContent?key=' . urlencode(GEMINI_API_KEY);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);

    $response = curl_exec($ch);
    $error = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false) {
        return "Chyba pøi volání API: " . $error;
    }

    $result = json_decode($response, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        $jsonError = json_last_error_msg();
        return "Neoèekávaná odpovìï API (HTTP $httpCode, JSON error: $jsonError): " . $response;
    }

    if (isset($result['error']['message'])) {
        return "Chyba API: " . $result['error']['message'];
    }

    if (isset($result['candidates'][0]['content']['parts'][0]['text'])) {
        return trim($result['candidates'][0]['content']['parts'][0]['text']);
    }
    if (isset($result['candidates'][0]['output'])) {
        return trim($result['candidates'][0]['output']);
    }
    if (isset($result['output'])) {
        return trim($result['output']);
    }
    if (isset($result['text'])) {
        return trim($result['text']);
    }

    return "Neoèekávaná odpovìï API (HTTP $httpCode): " . $response;
}

function ensureUtf8(string $text): string
{
    if (!mb_check_encoding($text, 'UTF-8')) {
        return mb_convert_encoding($text, 'UTF-8', 'auto');
    }
    return $text;
}

echo generateBrnoJoke() . PHP_EOL;
