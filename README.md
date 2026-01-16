
# MediaTracker AI 🎬📚

![Status](https://img.shields.io/badge/Status-Stable-success)
![License](https://img.shields.io/badge/License-GPL_v3-blue)
![Tech](https://img.shields.io/badge/Stack-React_19_%7C_Tailwind_%7C_Gemini_AI-indigo)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)

**MediaTracker AI** redefine la gestión de tu biblioteca de entretenimiento personal. No es solo una lista; es una experiencia visual inmersiva y privada para el seguimiento de Anime, Series, Películas, Manhwas y Libros.

Potenciado por **Google Gemini 2.5**, el sistema transforma simples títulos en un ecosistema rico en metadatos, colores dinámicos y recomendaciones emocionales, todo guardado de forma segura en tu dispositivo.

---

## ✨ La Experiencia Inmersiva

### 🧠 Descubrimiento IA "Stack"
Olvídate de las listas estáticas. MediaTracker implementa un sistema de descubrimiento gestual inspirado en interfaces móviles de alta gama:
- **Navegación por Tarjetas 3D:** Desliza, inclina y explora recomendaciones generadas por IA con físicas realistas y efectos de "barajeo".
- **Refinamiento por Mood:** ¿Cómo te sientes hoy? Filtra no solo por género, sino por atmósfera emocional (ej. *"🤯 Quiero algo que me vuele la cabeza"* o *"🍿 Algo ligero para desconectar"*).
- **Fallos Estéticos:** Incluso si la IA no encuentra resultados, la interfaz responde con tarjetas de estado diseñadas para mantener la inmersión.

### 🎨 Diseño Adaptativo & Temas
La interfaz está viva. Cada vez que abres una obra, la aplicación extrae la paleta de colores dominante de su portada y **adapta toda la UI en tiempo real** (bordes, sombras, gradientes y acentos) para coincidir con la estética del contenido.

### 📊 Biblioteca Inteligente
- **Auto-Metadatos:** Escribe "Solo Leveling" y la IA completará sinopsis, estado, número de capítulos y portada automáticamente.
- **Modo Catálogo (Estantería):** Visualiza tu colección en "estanterías" horizontales inteligentes, organizadas por prioridad de visualización y géneros.
- **Insights Profundos:** Gráficos de distribución de consumo (Visual vs Lectura), ranking de obsesiones y análisis de tu ecosistema de plataformas.

---

## 🔒 Privacidad: Tu Data es Tuya

En una era de tracking masivo, MediaTracker toma una postura radical:
- **Local-First:** Todos tus datos viven en **IndexedDB** dentro de tu navegador. Nada se envía a servidores externos de la app.
- **Conexión Directa:** Tú provees tu propia API Key de Google Gemini. La conexión es directa entre tu cliente y Google.
- **Importación/Exportación:** Eres dueño de tus datos. Exporta copias de seguridad completas (JSON) o comparte catálogos públicos sanitizados.

---

## 🛠️ Stack Tecnológico

Construido con las últimas tecnologías web para un rendimiento nativo:

- **Core:** React 19 (Hooks modernos & optimización de renderizado).
- **IA:** Google GenAI SDK (`@google/genai` v1.31+).
- **Estilos:** Tailwind CSS con utilidades personalizadas para Glassmorphism y animaciones 3D.
- **Persistencia:** IndexedDB wrapper para almacenamiento robusto en el cliente.
- **Iconografía:** Lucide React.

---

## 🚀 Cómo Empezar

### Prerrequisitos
Necesitas una **API Key de Google Gemini** (Gratuita).
👉 [Consíguela en Google AI Studio](https://aistudio.google.com/app/apikey)

### Instalación Local

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/mediatracker-ai.git
    cd mediatracker-ai
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Iniciar servidor de desarrollo:**
    ```bash
    npm run dev
    ```

4.  **Configuración:** Al abrir la app, completa el *Onboarding* ingresando tu nombre y tu API Key.

### Uso como App Móvil (PWA)
MediaTracker está optimizada para tacto y gestos.
1. Abre la web en Safari (iOS) o Chrome (Android).
2. Toca "Compartir" -> "Agregar a Inicio".
3. Disfruta de la experiencia a pantalla completa sin barras de navegador.

---

## 🤝 Contribución

Las Pull Requests son bienvenidas. Para cambios mayores, por favor abre primero un issue para discutir lo que te gustaría cambiar.

---

## 📄 Licencia

Este proyecto está licenciado bajo la **GNU General Public License v3.0**. Consulta el archivo `LICENSE` para más detalles.
