/*
 * Project: MediaTracker AI
 * Copyright (C) 2026 Victor Ramones
 * Licensed under the GNU General Public License v3.0
 */
import { GoogleGenAI } from "@google/genai";
import { AIWorkData, normalizeGenre } from "../types";

// Helper to reliably extract JSON from potential markdown or messy text
const extractJSON = (text: string, isArray: boolean = false): any => {
  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';

  // 1. Try identifying markdown code blocks first
  const codeBlockRegex = isArray
    ? /```(?:json)?\s*(\[[\s\S]*?\])\s*```/
    : /```(?:json)?\s*(\{[\s\S]*?\})\s*```/;

  const markdownMatch = text.match(codeBlockRegex);
  if (markdownMatch) {
    try {
      return JSON.parse(markdownMatch[1]);
    } catch (e) {
      console.warn("Failed to parse JSON from markdown block, falling back to heuristic extraction.");
    }
  }

  // 2. Heuristic extraction: Find first open brace and try closing braces from the end
  const firstOpen = text.indexOf(openChar);
  if (firstOpen !== -1) {
    let currentClose = text.lastIndexOf(closeChar);

    while (currentClose > firstOpen) {
      const candidate = text.substring(firstOpen, currentClose + 1);
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // If parsing fails, try the next closing brace found backwards
        currentClose = text.lastIndexOf(closeChar, currentClose - 1);
      }
    }
  }

  throw new Error(`No valid JSON ${isArray ? 'Array' : 'Object'} found in response.`);
};

export const searchMediaInfo = async (query: string, apiKey: string, mediaTypeContext?: string): Promise<AIWorkData | null> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const typeContextInstruction = mediaTypeContext
    ? `IMPORTANT: The user is specifically looking for the "${mediaTypeContext}" version of this title. Ensure the data returned (synopsis, episode count, etc.) corresponds to the ${mediaTypeContext} format, NOT other adaptations (e.g. if searching for Anime, do not return Manga chapters).`
    : '';

  const prompt = `
    Act as a media database expert. Search for information about the entertainment title: "${query}".
    ${typeContextInstruction}

    FOREIGN-LANGUAGE / VARIANT SEARCH RULES (CRITICAL):
    - If the exact title isn't found, search for alternate titles, romanizations, original kanji/hangul/han characters, and common variants (e.g., "manhwa", "webtoon", "manga", "light novel").
    - Korean, Chinese, and Japanese works frequently have multiple romanizations of the same title (e.g. Revised vs McCune-Reischauer for Korean, Hepburn vs Kunrei-shiki for Japanese, Pinyin vs Wade-Giles for Chinese). Try at least one alternate romanization before giving up.
    - Also try the work in its native script when the query is a romanization. Example: if "Reality Quest" returns nothing, try "리얼리티 퀘스트" or append "manhwa" / "webtoon" to the query.
    - If the query contains a suffix like "manhwa" / "manga" / "webtoon" / "anime", keep it — the user is signaling the medium.
    - Always attempt at least one alternate form before declaring no results. Only return a non-result JSON if, after several genuine variants and known platforms (WEBTOON, Naver, MangaPlus, MyAnimeList, AniList, Wikipedia, Fandom), nothing is found.

    You MUST return a JSON object containing the following details.
    If exact numbers aren't found, estimate based on the latest available info.

    CRITICAL - MEDIA TYPE CLASSIFICATION RULES:
    1. "Pelicula": Use this for ANY standalone movie or theatrical release.
       - IMPORTANT: If it is an Anime Movie (e.g. 'Demon Slayer: Mugen Train', 'The End of Evangelion'), it MUST be classified as "Pelicula", NOT "Anime".
    2. "Serie": Live-action TV Series.
    3. "Anime": Japanese animation SERIES (TV format, ONAs, OVAs that are series-like).
    4. "Libro": Novels, Light Novels.
    5. "Manhwa" / "Manga" / "Comic".

    FRANCHISE LINKING:
    If the item is a "Pelicula" that belongs to a larger Series/Anime franchise (e.g., the query is "Demon Slayer Mugen Train"),
    you MUST populate the "franchise_link" field with the name of the PARENT franchise (e.g., "Demon Slayer: Kimetsu no Yaiba").
    If it is a standalone movie (e.g. "Inception"), leave "franchise_link" empty.

    The JSON structure must be:
    {
      "title": "Main title in Spanish or English",
      "originalTitle": "Original title if different",
      "mediaType": "One of: Anime, Serie, Pelicula, Manhwa, Manga, Comic, Libro, Otro",
      "synopsis": "A concise synopsis in Spanish (max 300 chars)",
      "genres": ["Genre1", "Genre2"],
      "status": "Publication/Broadcast status (e.g., En emisión, Finalizado, En pausa)",
      "totalContent": "FOR ANIME/SERIES: Use vertical format '\\n'.\n1. Released Seasons (Count ONLY currently released/airing):\n'[X] Temporadas'\n'- Temporada 1: [X] Caps'\n\n2. CURRENTLY AIRING / SIMULCAST RULE:\nIf a season is currently broadcasting (new episodes coming out weekly), format it as:\n'- Temporada [X]: [Released So Far]/[Total Planned] Caps (En emisión)'\nExample: '- Temporada 2: 3/12 Caps (En emisión)' or '- Temporada 1: 5/? Caps (En emisión)'.\n\n3. Future Seasons (If officially announced):\n'Temporada [X] Anunciada:\n- Estreno: [YYYY-MM-DD or Season Year]'\n\nFOR OTHERS: Just string like '120 Capítulos' or 'Duración 1h 57m'.",
      "releaseDate": "The release date or year (ISO 'YYYY-MM-DD').",
      "endDate": "The end date or year. Leave empty if it's a Movie.",
      "franchise_link": "Name of the parent franchise if applicable, or empty string."
    }

    Do NOT use Markdown formatting for the JSON. Just return the raw JSON string.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "";

    // Extract Sources from Grounding
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks
      ?.map((chunk: any) => chunk.web)
      .filter((web: any) => web)
      .map((web: any) => ({ title: web.title, uri: web.uri }));

    const jsonPart = extractJSON(text);

    return {
      title: jsonPart.title || query,
      originalTitle: jsonPart.originalTitle,
      mediaType: jsonPart.mediaType || "Otro",
      synopsis: jsonPart.synopsis || "Sinopsis no disponible.",
      genres: jsonPart.genres || [],
      status: jsonPart.status || "Desconocido",
      totalContent: jsonPart.totalContent || "?",
      coverDescription: "",
      coverImage: "",
      sourceUrls: sources || [],
      primaryColor: "#c084fc",
      releaseDate: jsonPart.releaseDate,
      endDate: jsonPart.endDate
  };
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return null;
  }
};

// Update model / thinking budget.
//
// Verified against the AI Studio free-tier key (2026-10-19):
//   - "gemini-2.5-flash-lite" -> HTTP 404 "no longer available to new users".
//   - "gemini-3.5-flash-lite" / "gemini-3.1-flash-lite" -> HTTP 429, no free quota.
//   - "gemini-2.5-flash" -> works, and is what the rest of this service already uses.
//
// Thinking is the real latency cost here (default run: ~5k thought tokens, 28-65s).
// Measured on the same prompt: budget 0 -> ~4s but hallucinates season numbers;
// budget 512 -> ~7s but over-lists every season; budget 1024 -> ~10s with the same
// clean, concise structure as an unbounded run. Hence 1024.
const UPDATE_MODEL_ID = "gemini-2.5-flash";
const UPDATE_THINKING_BUDGET = 1024;

// Smart Update: refreshes structure/status/dates only. Never touches the synopsis.
export const updateMediaInfo = async (currentData: AIWorkData, apiKey: string): Promise<{ updatedData: Partial<AIWorkData>, hasChanges: boolean }> => {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Act as a media database auditor.
    Target: "${currentData.title}" (${currentData.mediaType}).

    Current Data:
    - Status: ${currentData.status}
    - Structure: ${currentData.totalContent}
    - Release Date: ${currentData.releaseDate || 'N/A'}
    - End Date: ${currentData.endDate || 'N/A'}

    Task: search for the latest status, released content count and broadcast dates.
    Scope: status, structure and dates ONLY. Never return plot text, summaries or a synopsis.

    STRUCTURE FORMAT — rebuild the WHOLE string every time, never return a diff or a patch:
    1. Line 1, released seasons only: "[X] Temporadas"
    2. One line per released season: "- Temporada [N]: [X] Caps"
    3. Currently airing season (new episodes still coming weekly):
       "- Temporada [N]: [Released so far]/[Total planned] Caps (En emisión)"
       Use "?" for an unknown total, e.g. "- Temporada 1: 5/? Caps (En emisión)".
    4. Officially announced future seasons, last:
       "Temporada [X] Anunciada:"
       "- Estreno: [YYYY-MM-DD or season/year]"

    Rules:
    - The header count MUST include only seasons already released. A season moves out of
      "Anunciada" into the numbered list only once its release date has passed; then drop
      the label and list its episodes as released.
    - If a season already has "(En emisión)", update only its released episode count.
    - For non-seasonal media use a single line like "120 Capítulos" or "Duración 1h 57m".

    Examples:
    - Airing season: "2 Temporadas\\n- Temporada 1: 12 Caps\\n- Temporada 2: 5/12 Caps (En emisión)"
    - Announced season: "1 Temporadas\\n- Temporada 1: 12 Caps\\nTemporada 2 Anunciada:\\n- Estreno: 2026-Q4"

    If the current data is already correct, return it unchanged and set hasChanges to false.
    Never invent episodes, seasons or dates you cannot confirm.

    Return a JSON object:
    {
      "status": "The latest correct status",
      "totalContent": "Full structure string in the format above",
      "releaseDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD (or null if ongoing)",
      "hasChanges": boolean
    }

    Respond with the JSON object ONLY, no commentary before or after it.
  `;

  try {
    const response = await ai.models.generateContent({
      model: UPDATE_MODEL_ID,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // Bounded thinking: without it this call spends ~5k thought tokens (28-65s)
        thinkingConfig: { thinkingBudget: UPDATE_THINKING_BUDGET },
        // responseMimeType not supported with tools in this context
      },
    });

    const text = response.text || "{}";
    // Use manual extraction since responseMimeType is not used
    const result = extractJSON(text);

    const updatedData: Partial<AIWorkData> = {
      status: result.status,
      totalContent: result.totalContent,
      releaseDate: result.releaseDate,
      // Only overwrite the end date with a concrete value, never with null
      ...(result.endDate ? { endDate: result.endDate } : {}),
    };

    // Trust the model's flag, but verify against the actual diff as a safety net
    const changed = (next: unknown, current: unknown): boolean =>
      next !== undefined && next !== null && String(next).trim() !== String(current ?? '').trim();

    const hasChanges = result.hasChanges === true
      || changed(updatedData.status, currentData.status)
      || changed(updatedData.totalContent, currentData.totalContent)
      || changed(updatedData.releaseDate, currentData.releaseDate)
      || changed(updatedData.endDate, currentData.endDate);

    return { updatedData, hasChanges };

  } catch (error) {
    console.error("Update check failed", error);
    throw error;
  }
};

export const generateReviewSummary = async (title: string, rating: string, tags: string[], comment: string, apiKey: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const prompt = `
    Genera una reseña corta, entusiasta y atractiva para redes sociales (Twitter/Instagram/TikTok) sobre "${title}".
    
    Datos del usuario:
    - Calificación: ${rating}
    - Sentimientos: ${tags.join(', ')}
    - Comentario personal: "${comment}"
    
    La reseña debe ser en primera persona, natural, usar emojis y hashtags relevantes. Max 300 caracteres si es posible, pero prioriza el contenido.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt
    });
    return response.text || "Reseña generada.";
  } catch (e) {
    console.error(e);
    return `¡Acabo de ver ${title}! ${rating}. ${tags.join(' ')}.`;
  }
};

export interface RecommendationResult {
  title: string;
  mediaType: string;
  synopsis: string;
  reason: string;
}

export const getRecommendations = async (
  likedTitles: string[],
  topGenres: string[],
  excludedTitles: string[],
  targetType: string,
  apiKey: string,
  targetMood?: string,
  topEmotions: string[] = [],
  isLoadMore = false
): Promise<RecommendationResult[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const moodInstruction = targetMood
? `
USER MOOD REQUEST: "${targetMood}"
INSTRUCTION: Utiliza las obras seleccionadas (Favorite Titles) como base de estilo (si se han seleccionado, sino hazlo en base al perfil general) y el Mood como la atmósfera emocional predominante. Si son contradictorios, prioriza el Mood pero mantén elementos estéticos de las obras.
`
: '';

  const emotionInstruction = topEmotions.length > 0
? `- Emotional Profile: The user consistently tags their favorites with: ${topEmotions.join(', ')}. Use these as STRONG signals of what resonates emotionally. Prioritize recommendations that match these emotional qualities.`
: '';

  const diversityInstruction = isLoadMore
? `
DIVERSIFICATION (2nd+ batch): The user has already seen the first batch of recommendations. You MUST diversify from the previous results:
- Try a DIFFERENT sub-genre, era, demographic, or narrative style than what you would typically suggest first.
- If the first batch leaned action-heavy, try something character-driven. If it leaned dark, try something with hope.
- Still respect the user's core profile, but explore adjacent tastes.
`
: '';

  const prompt = `
Act as an expert recommender system for Entertainment Media.

User Profile:
- Favorite Titles: ${likedTitles.join(', ')}
- Top Genres: ${topGenres.join(', ')}
${emotionInstruction}
${moodInstruction}

Task: Recommend 6 UNIQUE titles of type "${targetType}" that the user might like.

Constraints:
- DO NOT recommend any of these already known titles: ${excludedTitles.join(', ')}
- VERIFIED EXISTENCE: Every title MUST be real and verifiable on MyAnimeList, IMDB, Letterboxd, or Goodreads. If you are unsure whether a title exists, DO NOT include it. Prefer well-known or critically acclaimed titles over obscure ones you might misremember. Using the official/primary title (in original language or English) significantly reduces hallucination — always prefer the most recognized title for that medium.
- Diversity: Try to include 1 hidden gem (lesser-known but high quality) and 5 hits.
- NO SEQUELS of excluded titles unless the sequel is a standalone story.
${diversityInstruction}

Return a JSON Array of objects with this structure:
[
  {
    "title": "Official Title Name (use the most recognized title for this medium)",
    "mediaType": "${targetType}",
    "synopsis": "A compelling, descriptive synopsis in Spanish (approx 40-60 words). It should clearly explain the premise and hook of the story, avoiding vague descriptions.",
    "reason": "A specific, personalized reason in Spanish (approx 25-40 words). Explain WHY this fits the user based on the specific themes, tone, or complexity of their 'Favorite Titles' ${targetMood ? 'and specifically their requested Mood' : ''}${topEmotions.length > 0 ? " and their emotional preferences" : ''}. Do not use generic phrases like 'Because you like anime'."
  }
]
`;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "[]";
    return extractJSON(text, true);
  } catch (error) {
    console.error("Recommendation Error:", error);
    return [];
  }
};