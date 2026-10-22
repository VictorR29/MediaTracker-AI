import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  TRANSLATION_MODEL,
  buildTranslationPrompt,
  cleanTranslation,
  translateSynopsis,
} from '../synopsisTranslation';

// `vi.hoisted` keeps the mock factory and the assertions on the same function.
const { generateContent } = vi.hoisted(() => ({
  generateContent: vi.fn(),
}));

vi.mock('@google/genai', () => ({
  // A class, not an arrow mock: the service instantiates it with `new`.
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const SOURCE =
  'A young ninja seeks recognition from his peers and dreams of becoming the Hokage, the leader of his village.';

beforeEach(() => {
  generateContent.mockReset();
});

describe('buildTranslationPrompt', () => {
  it('embeds the source text', () => {
    expect(buildTranslationPrompt(SOURCE)).toContain(SOURCE);
  });

  it('asks for Spanish', () => {
    const prompt = buildTranslationPrompt(SOURCE).toLowerCase();
    expect(prompt).toContain('spanish');
    expect(prompt).toContain('translate');
  });
});

describe('cleanTranslation', () => {
  it('removes markdown fences', () => {
    expect(cleanTranslation('```\nHola mundo\n```')).toBe('Hola mundo');
    expect(cleanTranslation('```text\nHola mundo\n```')).toBe('Hola mundo');
  });

  it('removes a leading English preamble line', () => {
    expect(cleanTranslation('Here is the translation:\nHola mundo')).toBe('Hola mundo');
  });

  it('removes a leading Spanish preamble line', () => {
    expect(cleanTranslation('Aquí está la traducción:\nHola mundo')).toBe('Hola mundo');
  });

  it('strips wrapping double quotes', () => {
    expect(cleanTranslation('"Hola mundo"')).toBe('Hola mundo');
  });

  it('strips wrapping curly and guillemet quotes', () => {
    expect(cleanTranslation('“Hola mundo”')).toBe('Hola mundo');
    expect(cleanTranslation('«Hola mundo»')).toBe('Hola mundo');
  });

  it('trims surrounding whitespace', () => {
    expect(cleanTranslation('   Hola mundo   ')).toBe('Hola mundo');
  });

  it('collapses runs of blank lines but keeps paragraph breaks', () => {
    expect(cleanTranslation('Uno\n\n\n\nDos')).toBe('Uno\n\nDos');
  });

  it('returns an empty string for blank input', () => {
    expect(cleanTranslation('   ')).toBe('');
  });
});

describe('translateSynopsis', () => {
  it('returns null without calling the SDK when the text is too short', async () => {
    const result = await translateSynopsis('Too short', 'test-key');
    expect(result).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns null without calling the SDK when the api key is blank', async () => {
    const result = await translateSynopsis(SOURCE, '   ');
    expect(result).toBeNull();
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns the cleaned translation on success', async () => {
    generateContent.mockResolvedValue({
      text: '```\nAquí está la traducción: "Un joven ninja busca el reconocimiento de sus pares."\n```',
    });

    const result = await translateSynopsis(SOURCE, 'test-key');

    expect(result).toBe('Un joven ninja busca el reconocimiento de sus pares.');
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: TRANSLATION_MODEL,
        contents: expect.stringContaining(SOURCE),
        config: { temperature: 0.2 },
      }),
    );
  });

  it('returns null when the SDK throws', async () => {
    generateContent.mockRejectedValue(new Error('429 quota exceeded'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await translateSynopsis(SOURCE, 'test-key');

    expect(result).toBeNull();
    warn.mockRestore();
  });

  it('returns null when the response is empty', async () => {
    generateContent.mockResolvedValue({ text: '' });
    expect(await translateSynopsis(SOURCE, 'test-key')).toBeNull();
  });

  it('returns null when the response is identical to the source', async () => {
    generateContent.mockResolvedValue({ text: SOURCE });
    expect(await translateSynopsis(SOURCE, 'test-key')).toBeNull();
  });
});
