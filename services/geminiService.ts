
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

export const searchMediaInfo = async (query: string, apiKey: string): Promise<AIWorkData> => {
  // Initialize AI client with the user-provided key
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash"; 
  
  const prompt = `
    Act as a media database expert. Search for information about the entertainment title: "${query}".
    
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
      "totalContent": "FOR ANIME/SERIES: You MUST use a list format separating lines with '\\n'. Example: '3 Temporadas:\\nTemporada 1: 24 Caps\\nTemporada 2: 12 Caps'. FOR OTHERS: Just string like '120 Capítulos' or 'Duración 1h 57m'.",
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
      .map((web: any) => ({ title: web.title, uri: web.uri })) || [];

    try {
      const parsed = extractJSON(text, false);
      
      // Normalize Genres immediately upon retrieval
      const normalizedGenres = Array.isArray(parsed.genres)
         ? parsed.genres.map((g: string) => normalizeGenre(g))
         : [];
      const uniqueGenres = [...new Set(normalizedGenres)]; // Dedupe after normalization

      return {
        ...parsed,
        genres: uniqueGenres,
        sourceUrls: sources
      };
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError, "Raw Text:", text);
      throw new Error("Could not parse AI response.");
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    // Fallback data in case of failure
    return {
      title: query,
      mediaType: "Otro",
      synopsis: "No se pudo obtener información automática. Por favor verifica tu API Key o conexión.",
      genres: [],
      status: "Desconocido",
      totalContent: "?",
      coverDescription: "abstract shapes",
      coverImage: "",
      sourceUrls: [],
      primaryColor: "#6366f1"
    };
  }
};

export interface RecommendationResult {
  title: string;
  synopsis: string;
  reason: string;
  mediaType: string;
}

export const getRecommendations = async (
  likedTitles: string[],
  topGenres: string[],
  excludedTitles: string[],
  mediaType: string,
  apiKey: string
): Promise<RecommendationResult[]> => {
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash";

  const prompt = `
    Act as a sophisticated media recommendation engine.
    
    CONTEXT:
    The user is looking for recommendations for media type: "${mediaType}".
    
    INPUT DATA (SEEDS):
    - Reference Titles (User loves these): ${likedTitles.slice(0, 20).join(", ") || "None specific provided, use genres"}
    - Key Genres/Vibe: ${topGenres.join(", ") || "General High Quality"}
    
    TASK:
    Recommend 4 NEW ${mediaType} titles that perfectly match the mood, themes, storytelling style, and atmosphere of the "Reference Titles" provided above.
    If no specific titles are provided, rely on the genres.
    
    CONSTRAINTS:
    1. EXCLUDE these titles (already in library): ${excludedTitles.join(", ")}.
    2. Focus on finding matches that share the same "DNA" as the reference titles (e.g. if reference is "Dark Souls", recommend dark fantasy).
    3. Ensure the recommendations are actually of type "${mediaType}".
    4. LANGUAGE: The response (synopsis and reason) MUST BE IN SPANISH.
    
    OUTPUT FORMAT:
    Return a strict JSON array of objects. Do not use Markdown.
    Structure:
    [
      {
        "title": "Title Name",
        "synopsis": "One sentence summary in SPANISH.",
        "reason": "Explain specifically WHY this matches the reference titles (in SPANISH).",
        "mediaType": "${mediaType}"
      }
    ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    const text = response.text || "";
    return extractJSON(text, true);
  } catch (error) {
    console.error("Recommendation Error:", error);
    return [];
  }
};

export const generateReviewSummary = async (
    title: string,
    rating: string,
    tags: string[],
    comment: string,
    apiKey: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });
    const modelId = "gemini-2.5-flash";

    const prompt = `
    Actúa como un asistente personal de redacción para reseñas de entretenimiento.
    
    TU TAREA:
    Sintetizar la opinión de un usuario sobre la obra "${title}" en un solo párrafo corto, cohesivo y natural (máximo 4 líneas).
    
    INPUTS DEL USUARIO:
    1. Calificación: "${rating || 'Sin calificar'}".
       - Esto define el TONO GENERAL. 
       - Ejemplo: "God Tier" = tono eufórico/maravillado. "Malo" = tono crítico/decepcionado. "Regular" = tono tibio.
    2. Etiquetas Emocionales: [${tags.join(', ')}].
       - Úsalas como los puntos clave o adjetivos de la descripción.
    3. Comentario Personal: "${comment}".
       - Intégralo orgánicamente en el texto, preferiblemente como conclusión o matiz personal.
    
    REGLAS DE REDACCIÓN:
    - Escribe en PRIMERA PERSONA (como si fueras el usuario).
    - NO hagas listas. Debe ser prosa fluida.
    - NO digas frases robóticas como "Mi calificación es X". Demuestra la calificación con tus palabras.
    - Si el comentario personal contradice la calificación, dales sentido (ej: "Aunque es buena, el final me decepcionó").
    - IDIOMA: Español neutro.
    
    OUTPUT:
    Devuelve ÚNICAMENTE el párrafo de texto generado. Nada más.
    `;

    try {
        const response = await ai.models.generateContent({
            model: modelId,
            contents: prompt,
        });
        return response.text?.trim() || "No se pudo generar la reseña.";
    } catch (error) {
        console.error("Generate Review Error:", error);
        // Fallback simple construction in case of error
        const tagText = tags.length > 0 ? `Destaco: ${tags.join(', ')}.` : '';
        return `Acabo de ver "${title}". ${rating ? `Mi veredicto: ${rating}.` : ''} ${tagText} ${comment}`;
    }
};
