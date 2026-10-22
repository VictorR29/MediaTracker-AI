import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiscoveryCandidate } from '../anilistDiscovery';

// --- Gemini mock --------------------------------------------------------------

const { generateContentMock, GoogleGenAIMock } = vi.hoisted(() => {
  const generateContentMock = vi.fn();
  // A `function` (not an arrow) so `new GoogleGenAI(...)` works.
  const GoogleGenAIMock = vi.fn(function GoogleGenAI() {
    return { models: { generateContent: generateContentMock } };
  });
  return { generateContentMock, GoogleGenAIMock };
});

vi.mock('@google/genai', () => ({ GoogleGenAI: GoogleGenAIMock }));

import { buildCurationPrompt, curateCandidates, parseCurationResponse } from '../discoveryCuration';

const candidate = (id: number, overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate => ({
  anilistId: id,
  title: `Work ${id}`,
  genres: ['Action'],
  tags: [
    { name: 'Guns', rank: 80 },
    { name: 'Survival', rank: 40 },
  ],
  format: 'TV',
  seasonYear: 2015,
  synopsis: `A synopsis for work ${id}.`,
  recommendedBy: [],
  votes: 0,
  popularity: 100,
  ...overrides,
});

/** Ten candidates: enough for a curation pass to be attempted at all. */
const pool = (size = 10): DiscoveryCandidate[] =>
  Array.from({ length: size }, (_, index) => candidate(index + 1));

const respondWith = (text: string | undefined): void => {
  generateContentMock.mockResolvedValueOnce({ text });
};

beforeEach(() => {
  generateContentMock.mockReset();
  GoogleGenAIMock.mockClear();
});

// --- Prompt -------------------------------------------------------------------

describe('buildCurationPrompt', () => {
  it('lists every candidate id and forbids inventing new ones', () => {
    const prompt = buildCurationPrompt({ moodLabel: 'Necesito adrenalina pura y emoción', maxItems: 8, candidates: pool() });

    for (const entry of pool()) {
      expect(prompt).toContain(`id: ${entry.anilistId}`);
      expect(prompt).toContain(entry.title);
    }

    expect(prompt).toContain('Necesito adrenalina pura y emoción');
    expect(prompt).toContain('HARD RULES');
    expect(prompt).toContain('Never invent');
    expect(prompt).toContain('AT MOST 8');
  });

  it('asks for Spanish reasons and a strict JSON array', () => {
    const prompt = buildCurationPrompt({ maxItems: 8, candidates: pool() });

    expect(prompt).toContain('Spanish sentence');
    expect(prompt).toContain('"id"');
    expect(prompt).toContain('"reason"');
    expect(prompt).toContain('No commentary');
  });

  it('caps the synopsis it sends per candidate', () => {
    const long = 'x'.repeat(1000);
    const prompt = buildCurationPrompt({ maxItems: 8, candidates: [candidate(1, { synopsis: long })] });

    expect(prompt).toContain('x'.repeat(280));
    expect(prompt).not.toContain('x'.repeat(281));
  });
});

// --- Parsing ------------------------------------------------------------------

describe('parseCurationResponse', () => {
  const allowed = new Set([1, 2, 3]);

  it('parses a plain JSON array', () => {
    const raw = JSON.stringify([{ id: 1, reason: 'Encaja por su tensión.' }]);
    expect(parseCurationResponse(raw, allowed, 10)).toEqual([{ anilistId: 1, reason: 'Encaja por su tensión.' }]);
  });

  it('strips markdown fences and surrounding commentary', () => {
    const raw = 'Aquí va la lista:\n```json\n[{"id":2,"reason":"Por su ritmo frenético."}]\n```\nListo.';
    expect(parseCurationResponse(raw, allowed, 10)).toEqual([{ anilistId: 2, reason: 'Por su ritmo frenético.' }]);
  });

  it('discards ids that were never offered', () => {
    const raw = JSON.stringify([
      { id: 1, reason: 'Válida.' },
      { id: 999, reason: 'Inventada.' },
      { id: 2, reason: 'También válida.' },
    ]);

    expect(parseCurationResponse(raw, allowed, 10)).toEqual([
      { anilistId: 1, reason: 'Válida.' },
      { anilistId: 2, reason: 'También válida.' },
    ]);
  });

  it('drops a repeated id, keeping the first occurrence order', () => {
    const raw = JSON.stringify([
      { id: 2, reason: 'Primera.' },
      { id: 1, reason: 'Segunda.' },
      { id: 2, reason: 'Duplicada.' },
    ]);

    expect(parseCurationResponse(raw, allowed, 10)).toEqual([
      { anilistId: 2, reason: 'Primera.' },
      { anilistId: 1, reason: 'Segunda.' },
    ]);
  });

  it('drops blank reasons, non-string reasons and malformed entries', () => {
    const raw = JSON.stringify([
      { id: 1, reason: '   ' },
      { id: 2, reason: 42 },
      { id: 3, reason: 'Válida.' },
      'nope',
      null,
      { reason: 'Sin id.' },
    ]);

    expect(parseCurationResponse(raw, allowed, 10)).toEqual([{ anilistId: 3, reason: 'Válida.' }]);
  });

  it('trims the reason and caps the result at maxItems', () => {
    const raw = JSON.stringify([
      { id: 1, reason: '  Primera razón.  ' },
      { id: 2, reason: 'Segunda razón.' },
      { id: 3, reason: 'Tercera razón.' },
    ]);

    expect(parseCurationResponse(raw, allowed, 2)).toEqual([
      { anilistId: 1, reason: 'Primera razón.' },
      { anilistId: 2, reason: 'Segunda razón.' },
    ]);
  });

  it('returns an empty list on anything that is not a JSON array', () => {
    expect(parseCurationResponse('', allowed, 10)).toEqual([]);
    expect(parseCurationResponse('sin json', allowed, 10)).toEqual([]);
    expect(parseCurationResponse('{"id":1,"reason":"x"}', allowed, 10)).toEqual([]);
    expect(parseCurationResponse('[{"id":1,', allowed, 10)).toEqual([]);
  });
});

// --- Curation call ------------------------------------------------------------

describe('curateCandidates', () => {
  const input = (overrides: Partial<Parameters<typeof curateCandidates>[0]> = {}) => ({
    apiKey: 'test-key',
    moodLabel: 'Necesito adrenalina pura y emoción',
    maxItems: 40,
    candidates: pool(),
    ...overrides,
  });

  it('returns null on a blank key and never calls Gemini', async () => {
    expect(await curateCandidates(input({ apiKey: '   ' }))).toBeNull();
    expect(GoogleGenAIMock).not.toHaveBeenCalled();
  });

  it('returns null when the pool is thinner than eight candidates', async () => {
    expect(await curateCandidates(input({ candidates: pool(7) }))).toBeNull();
    expect(GoogleGenAIMock).not.toHaveBeenCalled();
  });

  it('returns null when Gemini throws', async () => {
    generateContentMock.mockRejectedValueOnce(new Error('boom'));
    expect(await curateCandidates(input())).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    respondWith('No pude generar nada útil, lo siento.');
    expect(await curateCandidates(input())).toBeNull();
  });

  it('returns null when fewer than eight valid results survive', async () => {
    const few = Array.from({ length: 7 }, (_, index) => ({ id: index + 1, reason: `Razón ${index + 1}.` }));
    respondWith(JSON.stringify(few));

    expect(await curateCandidates(input())).toBeNull();
  });

  it('returns the ordered curated list on a valid response', async () => {
    const curated = [4, 2, 9, 1, 7, 3, 10, 5].map(id => ({ id, reason: `Razón para la obra ${id}.` }));
    respondWith(JSON.stringify(curated));

    const result = await curateCandidates(input());

    expect(result).toEqual(curated.map(entry => ({ anilistId: entry.id, reason: entry.reason })));
  });

  it('sends the model, json mime type and temperature, and never leaks the key', async () => {
    respondWith(JSON.stringify([1, 2, 3, 4, 5, 6, 7, 8].map(id => ({ id, reason: `Razón ${id}.` }))));

    await curateCandidates(input());

    expect(GoogleGenAIMock).toHaveBeenCalledWith({ apiKey: 'test-key' });
    const args = generateContentMock.mock.calls[0][0] as {
      model: string;
      contents: string;
      config: { responseMimeType: string; temperature: number };
    };
    expect(args.model).toBe('gemini-2.5-flash');
    expect(args.config).toEqual({ responseMimeType: 'application/json', temperature: 0.4 });
    expect(args.contents).not.toContain('test-key');
  });

  it('drops an invented id from the result', async () => {
    const curated = [1, 2, 3, 4, 5, 6, 7, 8].map(id => ({ id, reason: `Razón ${id}.` }));
    respondWith(JSON.stringify([...curated, { id: 4242, reason: 'Inventada.' }]));

    const result = await curateCandidates(input());

    expect(result).toHaveLength(8);
    expect(result?.some(entry => entry.anilistId === 4242)).toBe(false);
  });
});
