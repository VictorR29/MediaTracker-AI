/*
 * Project: MediaTracker AI
 * Copyright (C) 2026 Victor Ramones
 * Licensed under the GNU General Public License v3.0
 */
import { GoogleGenAI } from "@google/genai";

/**
 * AniList describes works in English only, so this service is the single place
 * that turns a synopsis into Spanish. It is purely additive: every failure mode
 * (missing key, network error, empty answer) returns `null` and the caller keeps
 * showing the English text. It never throws and never touches UI state.
 *
 * Model note: `gemini-2.5-flash` is the only verified model for this key.
 * `gemini-2.5-flash-lite` returns 404 and the 3.x lite variants return 429.
 */
export const TRANSLATION_MODEL = 'gemini-2.5-flash';

/** Below this length a "translation" is noise, not worth a request. */
const MIN_TRANSLATABLE_LENGTH = 20;

const PREAMBLE_PATTERN =
  /^(?:here(?:'s| is)|below is|the translation is|translation|aquí (?:está|esta)|aqui esta|esta es|traducción)(?:[^\n:]*):\s*/i;

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],
  ['‘', '’'],
  ['«', '»'],
];

/** English instructions. The output language is fixed: neutral Latin American Spanish. */
export const buildTranslationPrompt = (text: string): string => `You are a professional literary translator working on anime synopses.

Translate the synopsis below into neutral Latin American Spanish.

Rules:
- Use neutral Latin American Spanish. Avoid regional slang and avoid Spain-specific vocabulary (use "ustedes", not "vosotros"; prefer "computadora", "celular", "videojuego").
- Keep character names, work titles, and proper nouns exactly as they appear in the source.
- Do not translate names of people, places, or fictional works.
- Preserve paragraph breaks from the source.
- Return ONLY the translation: no preamble, no commentary, no explanation, no notes, no quotes around the result, and no markdown formatting.

Synopsis:
"""
${text}
"""`;

/**
 * Removes the wrappers a model sometimes adds around a translation: markdown
 * fences, an introductory line, and quotes wrapping the whole text.
 * Pure and exported so it can be tested without the network.
 */
export const cleanTranslation = (raw: string): string => {
  if (typeof raw !== 'string') return '';

  let text = raw
    .replace(/^\s*```[^\n]*$/gm, '')
    .replace(/```/g, '')
    .trim();

  // Drop a leading "Here is the translation:" style line, with or without a line break.
  text = text.replace(PREAMBLE_PATTERN, '').trim();

  // Strip wrapping quotes, repeatedly: models sometimes double-wrap.
  let stripped = true;
  while (stripped) {
    stripped = false;
    const first = text.charAt(0);
    const last = text.charAt(text.length - 1);
    for (const [open, close] of QUOTE_PAIRS) {
      if (text.length > 1 && first === open && last === close) {
        text = text.slice(1, -1).trim();
        stripped = true;
        break;
      }
    }
  }

  return text.replace(/\n{3,}/g, '\n\n').trim();
};

/**
 * Translates one synopsis. Returns `null` whenever Spanish is not available,
 * which is the caller's signal to keep the English text.
 */
export async function translateSynopsis(text: string, apiKey: string): Promise<string | null> {
  const source = typeof text === 'string' ? text.trim() : '';
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';

  if (source.length < MIN_TRANSLATABLE_LENGTH || key.length === 0) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: TRANSLATION_MODEL,
      contents: buildTranslationPrompt(source),
      config: { temperature: 0.2 },
    });

    const translated = cleanTranslation(typeof response.text === 'string' ? response.text : '');

    if (!translated) return null;
    // Some models echo the source instead of translating; that is not a translation.
    if (translated.toLowerCase() === source.toLowerCase()) return null;

    return translated;
  } catch (error) {
    // Only the message: the client object can carry request internals.
    const detail = error instanceof Error ? error.message : String(error);
    console.warn('Synopsis translation unavailable; keeping the original text.', detail);
    return null;
  }
}
