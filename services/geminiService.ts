
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
    - "Pelicula": Standalone movies (e.g., Inception, Spirited Away).
    - "Serie": TV Series or Web Series (e.g., Breaking Bad, Stranger Things).
    - "Anime": Japanese animation series (e.g., Naruto).
    - "Libro": Novels, Non-fiction books, Light Novels (e.g., Harry Potter, 1984).
    - "Manhwa" / "Manga" / "Comic": Graphical novels.
    
    The JSON structure must be:
    {
      "title": "Main title in Spanish or English",
      "originalTitle": "Original title if different",
      "mediaType": "One of: Anime, Serie, Pelicula, Manhwa, Manga, Comic, Libro, Otro",
      "synopsis": "A concise synopsis in Spanish (max 300 chars)",
      "genres": ["Genre1", "Genre2"],
      "status": "Publication/Broadcast status (e.g., En emisión, Finalizado, En pausa)",
      "totalContent": "String describing total content (e.g., '3 Temporadas, 64 Caps' or '120 Capítulos' or '300 Páginas')",
      "coverDescription": "A short English visual description of the official poster (e.g. 'poster of Naruto anime')",
      "coverImage": "Find a DIRECT public URL (https) for the official poster. PREFER URLs from 'upload.wikimedia.org', 'm.media-amazon.com', 'cdn.myanimelist.net' or 'static.wikia.nocookie.net'. The URL MUST end in .jpg, .png or .webp. If uncertain, leave empty.",
      "primaryColor": "Identify the DOMINANT HEX COLOR associated with the work's cover art or branding (e.g. '#FF5733' for Naruto orange, '#4B0082' for Gachiakuta purple). It MUST be a 6-digit HEX code."
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