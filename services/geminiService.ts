/*
 * Project: MediaTracker AI
 * Copyright (C) 2024 [Tu Nombre]
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

export const searchMediaInfo = async (query: string, apiKey: string, mediaTypeContext?: string): Promise<AIWorkData> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash"; 
  
  const typeContextInstruction = mediaTypeContext 
    ? `IMPORTANT: The user is specifically looking for the "${mediaTypeContext}" version of this title. Ensure the data returned (synopsis, episode count, etc.) corresponds to the ${mediaTypeContext} format, NOT other adaptations (e.g. if searching for Anime, do not return Manga chapters).`
    : '';

  const prompt = `
    Act as a media database expert. Search for information about the entertainment title: "${query}".
    ${typeContextInstruction}
    
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
      "totalContent": "FOR ANIME/SERIES: You MUST use a strict vertical format separating lines with '\\n'. Structure:\nLine 1: '[X] Temporadas'\nLine 2+: '- Temporada 1: [X] Caps' (Indented with dash)\nLast Lines: Any Movies/OVAs/Specials listed separately.\n\nExample:\n'3 Temporadas\n- Temporada 1: 24 Caps\n- Temporada 2: 12 Caps\n1 Película ('Mugen Train')'\n\nFOR OTHERS: Just string like '120 Capítulos' or 'Duración 1h 57m'.",
      "coverDescription": "A short English visual description of the official poster (e.g. 'poster of Naruto anime')",
      "coverImage": "Find a DIRECT public URL (https) for the official poster. PREFER URLs from 'upload.wikimedia.org', 'm.media-amazon.com', 'cdn.myanimelist.net' or 'static.wikia.nocookie.net'. The URL MUST end in .jpg, .png or .webp. If uncertain, leave empty.",
      "primaryColor": "Identify the DOMINANT HEX COLOR associated with the work's cover art or branding (e.g. '#FF5733'). It MUST be a 6-digit HEX code.",
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
      coverDescription: jsonPart.coverDescription || "",
      coverImage: jsonPart.coverImage || "",
      sourceUrls: sources || [],
      primaryColor: jsonPart.primaryColor || "#6366f1",
      releaseDate: jsonPart.releaseDate,
      endDate: jsonPart.endDate,
      franchise_link: jsonPart.franchise_link
    };
  } catch (error) {
    console.error("Gemini Search Error:", error);
    return {
      title: query,
      mediaType: "Otro",
      synopsis: "No se pudo obtener información automática. Por favor edita los detalles manualmente.",
      genres: [],
      status: "Desconocido",
      totalContent: "?",
      coverDescription: "",
      coverImage: "",
      sourceUrls: [],
      primaryColor: "#6366f1"
    };
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
    
    Task: Search for the absolute latest status, content count (seasons/episodes) and broadcast dates.
    Compare with Current Data.
    
    Rules for Synopsis:
    - Do NOT suggest a new synopsis if the current one is still accurate.
    - ONLY suggest a new synopsis if there is a MAJOR update (e.g. a new season started with a different plot focus) AND the current synopsis is clearly outdated.
    
    Return a JSON object:
    {
      "status": "The latest correct status",
      "totalContent": "The latest episode/chapter/season count. IMPORTANT: Use vertical structure:\nLine 1: 'X Temporadas'\nLine 2+: '- Temporada X: Y Caps'\nThen Extras (Movies/OVAs).",
      "releaseDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD (or null if ongoing)",
      "synopsis": "New string OR null (if no major change needed)",
      "hasChanges": boolean (true ONLY if status, totalContent, or dates are factually different. False if they are effectively the same)
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
        hasChanges: result.hasChanges
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
    Genera una reseña corta, entusiasta y atractiva para redes sociales (Twitter/Instagram) sobre "${title}".
    
    Datos del usuario:
    - Calificación: ${rating}
    - Sentimientos: ${tags.join(', ')}
    - Comentario personal: "${comment}"
    
    La reseña debe ser en primera persona, natural, usar emojis y hashtags relevantes. Max 280 caracteres si es posible, pero prioriza el contenido.
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
  targetMood?: string
): Promise<RecommendationResult[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const moodInstruction = targetMood 
    ? `
    USER MOOD REQUEST: "${targetMood}"
    INSTRUCTION: Utiliza las obras seleccionadas (Favorite Titles) como base de estilo (si se han seleccionado, sino hazlo en base al perfil general) y el Mood como la atmósfera emocional predominante. Si son contradictorios, prioriza el Mood pero mantén elementos estéticos de las obras.
    `
    : '';

  const prompt = `
    Act as an expert recommender system for Entertainment Media.
    
    User Profile:
    - Favorite Titles: ${likedTitles.join(', ')}
    - Top Genres: ${topGenres.join(', ')}
    ${moodInstruction}
    
    Task: Recommend 6 UNIQUE titles of type "${targetType}" that the user might like.
    
    Constraints:
    - DO NOT recommend any of these already known titles: ${excludedTitles.join(', ')}
    - The titles must be real and popular enough to be found.
    - Diversity: Try to include 1 hidden gem and 5 hits.
    
    Return a JSON Array of objects with this structure:
    [
      {
        "title": "Title Name",
        "mediaType": "${targetType}",
        "synopsis": "A compelling, descriptive synopsis in Spanish (approx 40-60 words). It should clearly explain the premise and hook of the story, avoiding vague descriptions.",
        "reason": "A specific, personalized reason in Spanish (approx 25-40 words). Explain WHY this fits the user based on the specific themes, tone, or complexity of their 'Favorite Titles' ${targetMood ? 'and specifically their requested Mood' : ''}. Do not use generic phrases like 'Because you like anime'."
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
    return JSON.parse(text);
  } catch (error) {
    console.error("Recommendation Error:", error);
    return [];
  }
};
