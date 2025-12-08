
import { GoogleGenAI } from "@google/genai";
import { AIWorkData } from "../types";

export const searchMediaInfo = async (query: string, apiKey: string): Promise<AIWorkData> => {
  // Initialize AI client with the user-provided key
  const ai = new GoogleGenAI({ apiKey });
  const modelId = "gemini-2.5-flash"; 
  
  const prompt = `
    Act as a media database expert. Search for information about the entertainment title: "${query}".
    
    You MUST return a JSON object containing the following details. 
    If exact numbers aren't found, estimate based on the latest available info.
    
    CRITICAL - MEDIA TYPE CLASSIFICATION:
    - "Pelicula": Standalone movies, theatrical releases (e.g., Inception, Spirited Away, Dune).
    - "Serie": TV Series, Web Series, Miniseries (e.g., Breaking Bad, Stranger Things).
    - "Anime": Japanese animation series (e.g., Naruto, One Piece).
    - "Libro": Novels, Non-fiction books, Light Novels, Literature (e.g., Harry Potter, 1984, Brandon Sanderson books).
    - "Manhwa" / "Manga" / "Comic": Graphical novels, webtoons, comics.
    
    The JSON structure must be:
    {
      "title": "Main title in Spanish or English",
      "originalTitle": "Original title if different",
      "mediaType": "One of: Anime, Serie, Pelicula, Manhwa, Manga, Comic, Libro, Otro",
      "synopsis": "A concise synopsis in Spanish (max 300 chars)",
      "genres": ["Genre1", "Genre2"],
      "status": "Publication/Broadcast status (e.g., En emisión, Finalizado, En pausa)",
      "totalContent": "String describing total content (e.g., '3 Temporadas, 64 Caps' or '120 Capítulos' or '300 Páginas' or 'Duración 2h 30m')",
      "coverDescription": "A short English visual description of the official poster (e.g. 'poster of Naruto anime')",
      "coverImage": "Find a DIRECT public URL (https) for the official poster. PREFER URLs from 'upload.wikimedia.org', 'm.media-amazon.com', 'cdn.myanimelist.net' or 'static.wikia.nocookie.net'. The URL MUST end in .jpg, .png or .webp. If uncertain, leave empty.",
      "primaryColor": "Identify the DOMINANT HEX COLOR associated with the work's cover art or branding (e.g. '#FF5733' for Naruto orange, '#4B0082' for Gachiakuta purple). It MUST be a 6-digit HEX code.",
      "releaseDate": "The release date or year (e.g. '2023' or '2023-10-05').",
      "endDate": "The end date or year. Use 'Presente' or 'En curso' if ongoing. Leave empty if it's a Movie."
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

    // Attempt to parse JSON from the response text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        sourceUrls: sources
      };
    } else {
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
    
    USER PROFILE:
    - Highly Rated Titles: ${likedTitles.slice(0, 20).join(", ") || "None yet"}
    - Favorite Genres: ${topGenres.join(", ") || "General High Quality"}
    
    TASK:
    Recommend 4 NEW ${mediaType} titles that perfectly match this user's taste.
    
    CONSTRAINTS:
    1. EXCLUDE these titles (already in library): ${excludedTitles.join(", ")}.
    2. Focus on hidden gems or highly acclaimed masterpieces that match the mood of the liked titles.
    3. Ensure the recommendations are actually of type "${mediaType}".
    
    OUTPUT FORMAT:
    Return a strict JSON array of objects. Do not use Markdown.
    Structure:
    [
      {
        "title": "Title Name",
        "synopsis": "One sentence summary.",
        "reason": "Why this specific user would like it based on their history.",
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
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      console.warn("Could not parse recommendations JSON", text);
      return [];
    }
  } catch (error) {
    console.error("Recommendation Error:", error);
    return [];
  }
};
