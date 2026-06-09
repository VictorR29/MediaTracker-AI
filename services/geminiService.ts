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

// NEW: Smart Update Function
export const updateMediaInfo = async (currentData: AIWorkData, apiKey: string): Promise<{ updatedData: Partial<AIWorkData>, hasChanges: boolean }> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const prompt = `
    Act as a media database expert auditor.
    Target: "${currentData.title}" (${currentData.mediaType}).

    Current Data:
    - Status: ${currentData.status}
    - Total Content: ${currentData.totalContent}
    - Release Date: ${currentData.releaseDate || 'N/A'}
    - End Date: ${currentData.endDate || 'N/A'}
    - Current Synopsis: "${currentData.synopsis || ''}"

    Task: Search for the absolute latest status, content count (seasons/episodes) and broadcast dates.
    Compare with Current Data and apply the matching SCENARIO rule below.

    SCENARIO 1 — Season HAS STARTED since last check:
    The "Current Data" contains a "Temporada [X] Anunciada" and today is at or past its release date.
    Action: Merge it into the main season count, remove the "Anunciada" label, list its episodes naturally, and update the total season count in the first line.
    Example output: "2 Temporadas\\n- Temporada 1: 12 Caps\\n- Temporada 2: 1/12 Caps (En emisión)"

    SCENARIO 2 — Season STILL in the future:
    The "Current Data" contains a "Temporada [X] Anunciada" and today is BEFORE its release date.
    Action: Keep the "Anunciada" format but update the release date/year if new info is available.
    Example output: "1 Temporadas\\n- Temporada 1: 12 Caps\\nTemporada 2 Anunciada:\\n- Estreno: 2026-Q4"

    SCENARIO 3 — Season currently AIRING (was airing before too):
    A season in "Current Data" already has the "(En emisión)" suffix.
    Action: Update the [Current] count to the latest released episode count. Keep the "En emisión" label.
    Example output: "- Temporada 2: 5/12 Caps (En emisión)" (was 3/12 last time)

    SCENARIO 4 — Synopsis update:
    Action: ONLY rewrite the synopsis if:
      a) Current synopsis is empty, too short (< 50 chars), or placeholder text, OR
      b) There is a MAJOR plot update (e.g. a new season has started since the last synopsis).
    Otherwise return null for synopsis.

    Return a JSON object:
    {
      "status": "The latest correct status",
      "totalContent": "Vertical format per SCENARIO rules above",
      "releaseDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD (or null if ongoing)",
      "synopsis": "New string ONLY IF SCENARIO 4 rules are met, otherwise null",
      "hasChanges": boolean
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        // responseMimeType not supported with tools in this context
      },
    });

    const text = response.text || "{}";
    // Use manual extraction since responseMimeType is not used
    const result = extractJSON(text);

    return {
      updatedData: {
        status: result.status,
        totalContent: result.totalContent,
        releaseDate: result.releaseDate,
        endDate: result.endDate,
        ...(result.synopsis ? { synopsis: result.synopsis } : {})
      },
      hasChanges: result.hasChanges || !!result.synopsis // Ensure we flag change if synopsis was rewritten
    };

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