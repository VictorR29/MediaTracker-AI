/*
 * Project: MediaTracker AI
 * Copyright (C) 2026 Victor Ramones
 * Licensed under the GNU General Public License v3.0
 */
import { GoogleGenAI } from '@google/genai';
import type { DiscoveryCandidate } from './anilistDiscovery';

/**
 * The model that was verified to work from this codebase: 2.5-flash-lite 404s
 * and the 3.x lite models answer 429, so the full 2.5-flash is the one used.
 */
const CURATION_MODEL = 'gemini-2.5-flash';
const SYNOPSIS_CHAR_LIMIT = 280;
const MAX_TOP_TAGS = 8;
/** Below this the model has too little to choose from and curation is skipped. */
const MIN_CANDIDATES_FOR_CURATION = 8;
/** A valid curation must at least fill one reveal batch worth of cards. */
const MIN_VALID_RESULTS = 8;

export interface CurationInput {
  apiKey: string;
  moodLabel?: string;
  maxItems: number;
  candidates: DiscoveryCandidate[];
}

export interface CurationResult {
  anilistId: number;
  reason: string;
}

const truncate = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit).trimEnd()}…`;

/** The eight highest-ranked tags: the model sees signal, not the whole tag soup. */
const topTags = (candidate: DiscoveryCandidate): string =>
  [...candidate.tags]
    .sort((a, b) => b.rank - a.rank)
    .slice(0, MAX_TOP_TAGS)
    .map(tag => `${tag.name} (${tag.rank})`)
    .join(', ') || 'none';

/**
 * Prompt builder: English instructions, Spanish output.
 *
 * The model is a curator, never a search engine: it is handed the whole
 * candidate pool and may only reorder or select from the ids it received.
 */
export const buildCurationPrompt = (input: Omit<CurationInput, 'apiKey'>): string => {
  const mood = input.moodLabel?.trim() || 'an unspecified mood';

  const catalog = input.candidates
    .map(candidate =>
      [
        `- id: ${candidate.anilistId}`,
        `  title: ${candidate.title}`,
        `  year: ${candidate.seasonYear ?? 'unknown'}`,
        `  format: ${candidate.format ?? 'unknown'}`,
        `  genres: ${candidate.genres.join(', ') || 'none'}`,
        `  topTags: ${topTags(candidate)}`,
        `  synopsis: ${truncate(candidate.synopsis, SYNOPSIS_CHAR_LIMIT) || 'not available'}`,
      ].join('\n'),
    )
    .join('\n');

  return `You are curating an anime discovery deck for a viewer who asked for: "${mood}".

Below is the candidate pool, already fetched from AniList. For each entry you get its id, title, year, format, genres, its most representative community tags with their confidence rank (0-100), and a short synopsis.

Pick the works that best fit THAT MOOD, in the order the viewer should watch them (best first), and write one reason per work.

HARD RULES:
- Use ONLY the ids listed below. Never invent, guess or recall an id that is not in the pool. An unknown id is a failure.
- Return AT MOST ${input.maxItems} entries, and never more than the number of ids provided.
- Do not return an id twice.
- Each reason must be a single Spanish sentence, between 12 and 22 words, explaining why that specific work fits THAT mood in particular — not a generic summary of the plot.
- Return a strict JSON array of objects with exactly the keys "id" (number) and "reason" (string). No commentary, no markdown, no extra keys.

Candidate pool:
${catalog}

Return only the JSON array.`;
};

/** Pulls the first JSON array out of a response, tolerating markdown fences. */
const extractJsonArray = (raw: string): unknown => {
  const withoutFences = raw.replace(/```(?:json)?/gi, '');
  const start = withoutFences.indexOf('[');
  const end = withoutFences.lastIndexOf(']');
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    return null;
  }
};

/**
 * Pure and defensive: an entry survives only when its id is in `allowedIds`, its
 * reason is a non-blank string, and it has not been seen before. The result is
 * capped at `maxItems`. Secrets never pass through here.
 */
export const parseCurationResponse = (
  raw: string,
  allowedIds: Set<number>,
  maxItems: number,
): CurationResult[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  if (!(allowedIds instanceof Set) || allowedIds.size === 0) return [];
  if (!Number.isFinite(maxItems) || maxItems <= 0) return [];

  const parsed = extractJsonArray(raw);
  if (!Array.isArray(parsed)) return [];

  const results: CurationResult[] = [];
  const seen = new Set<number>();

  for (const entry of parsed) {
    if (results.length >= maxItems) break;
    if (!entry || typeof entry !== 'object') continue;

    const id = (entry as { id?: unknown }).id;
    const reason = (entry as { reason?: unknown }).reason;
    if (typeof id !== 'number' || !Number.isFinite(id)) continue;
    if (typeof reason !== 'string') continue;

    const trimmed = reason.trim();
    if (!trimmed) continue;

    const anilistId = Math.trunc(id);
    if (!allowedIds.has(anilistId) || seen.has(anilistId)) continue;

    seen.add(anilistId);
    results.push({ anilistId, reason: trimmed });
  }

  return results;
};

/**
 * Opt-in Gemini curation of an already ranked pool.
 *
 * This adds one Gemini round trip to the deck build and it is deliberately
 * blocking: the reveal starts when the deck is ready, so the order is final by
 * the time the first card renders instead of shuffling underneath the viewer.
 *
 * Never throws and never empties a deck: on a blank key, a thin pool, an
 * exception, invalid JSON or too few valid entries it returns `null`, and the
 * caller keeps its local order.
 */
export async function curateCandidates(input: CurationInput): Promise<CurationResult[] | null> {
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : '';
  if (!apiKey) return null;

  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  if (candidates.length < MIN_CANDIDATES_FOR_CURATION) return null;

  const maxItems = Math.max(1, Math.trunc(Number(input.maxItems) || 0));

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: CURATION_MODEL,
      contents: buildCurationPrompt({ moodLabel: input.moodLabel, maxItems, candidates }),
      config: { responseMimeType: 'application/json', temperature: 0.4 },
    });

    const text = typeof response.text === 'string' ? response.text : '';
    const allowedIds = new Set(candidates.map(candidate => candidate.anilistId));
    const results = parseCurationResponse(text, allowedIds, maxItems);

    return results.length >= MIN_VALID_RESULTS ? results : null;
  } catch {
    return null;
  }
}
