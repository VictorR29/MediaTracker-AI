# MediaTracker AI 🎬📚

![Status](https://img.shields.io/badge/Status-Active-success)
![Tech](https://img.shields.io/badge/Tech-React%20%7C%20Gemini%20API%20%7C%20Tailwind-blue)
![PWA](https://img.shields.io/badge/PWA-Ready-purple)

**MediaTracker AI** es una biblioteca inteligente y privada para el seguimiento de medios de entretenimiento (Anime, Series, Películas, Manhwas, Mangas y Libros). 

A diferencia de los trackers tradicionales, esta aplicación utiliza la **IA de Google Gemini** para enriquecer automáticamente los metadatos, generar recomendaciones semánticas basadas en tus gustos y ofrecer análisis profundos sobre tus hábitos de consumo.

---

## ✨ Características Principales

### 🧠 Impulsado por Inteligencia Artificial (Gemini 2.5)
- **Auto-Metadatos:** Ingresa solo el nombre de la obra y la IA buscará sinopsis, portadas, géneros, estado de publicación y colores temáticos automáticamente.
- **Recomendaciones Semánticas:** Un motor de descubrimiento que analiza el "ADN" de tus obras favoritas para sugerir títulos similares, explicando el *porqué* de cada recomendación.
- **Reseñas Sintetizadas:** Genera textos atractivos para compartir en redes sociales basados en tus etiquetas emocionales y calificación.

### 📊 Seguimiento Granular & Estadísticas
- **Soporte Multi-Formato:** Rastreo especializado para medios visuales (episodios/temporadas) y lectura (capítulos/volúmenes/páginas).
- **Sistema de Clasificación "God Tier":** Califica desde "Pérdida de tiempo" hasta "God Tier", influyendo en tus estadísticas.
- **Insights Profundos:** 
  - Cálculo de tiempo total invertido (Visual vs. Lectura).
  - Gráficos de distribución por emociones y géneros.
  - "Obsession Tracker": Identifica tus top 3 obsesiones por tiempo consumido.
  - Sistema de Rangos gamificado (de "Explorador Novato" a "Maestro del Consumo").

### 🔒 Privacidad & Local-First
- **Cero Tracking Externo:** Todos los datos se almacenan localmente en tu dispositivo usando **IndexedDB**.
- **Bloqueo de Seguridad:** Protege tu biblioteca con una contraseña opcional.
- **Importación/Exportación:** 
  - *Backup Completo:* Guarda tu perfil, API Key y biblioteca.
  - *Catálogo Público:* Exporta solo tu lista de obras para compartir con amigos (formato JSON sanitizado).

### 🎨 Experiencia de Usuario (UX)
- **Diseño Adaptativo:** Interfaz moderna y fluida construida con Tailwind CSS.
- **Temas Dinámicos:** La interfaz se adapta al color predominante de la portada de la obra que estás viendo.
- **Saludo Contextual:** La pantalla de inicio te saluda dinámicamente basándose en la última obra con la que interactuaste y la hora del día.
- **PWA (Progressive Web App):** Instalable en móviles y escritorio, funciona offline (funcionalidad básica).

---

## 🛠️ Tecnologías Utilizadas

- **Frontend:** React 19, TypeScript.
- **Estilos:** Tailwind CSS, Lucide React (Iconos).
- **IA Integration:** Google GenAI SDK (`@google/genai`).
- **Almacenamiento:** IndexedDB (Natival browser storage).
- **Build Tool:** Vite (implícito).

---

## 🚀 Instalación y Uso Local

Sigue estos pasos para ejecutar el proyecto en tu máquina local:

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/tu-usuario/mediatracker-ai.git
    cd mediatracker-ai
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Ejecutar en desarrollo:**
    ```bash
    npm run dev
    ```

4.  **Configuración Inicial:**
    - Al abrir la app, verás una pantalla de **Onboarding**.
    - Necesitarás una **API Key de Google Gemini** (Gratuita).
    - Consíguela aquí: [Google AI Studio](https://aistudio.google.com/app/apikey).
    - La API Key se guarda **exclusivamente en tu navegador**.

---

## 📱 Funcionalidad PWA (Móvil)

Esta aplicación está optimizada para funcionar como una app nativa en iOS y Android.

1. Abre la aplicación en tu navegador móvil (Chrome/Safari).
2. Selecciona "Agregar a pantalla de inicio".
3. La app se instalará, eliminará la barra de navegación del navegador y funcionará en pantalla completa.

---

## 📂 Estructura del Proyecto

```text
/src
  ├── components/      # Componentes UI (Cards, Modals, Stats, etc.)
  ├── context/         # Contexto global (Toast Notifications)
  ├── services/        # Lógica de negocio (Gemini Service, Storage DB)
  ├── types/           # Definiciones TypeScript
  ├── App.tsx          # Router principal y lógica de vistas
  └── index.tsx        # Punto de entrada
```

---

## 🤝 Contribución

¡Las contribuciones son bienvenidas! Si tienes ideas para mejorar el algoritmo de recomendación o añadir soporte para nuevos tipos de medios:

1. Haz un Fork del proyecto.
2. Crea una rama para tu característica (`git checkout -b feature/AmazingFeature`).
3. Haz Commit de tus cambios (`git commit -m 'Add some AmazingFeature'`).
4. Haz Push a la rama (`git push origin feature/AmazingFeature`).
5. Abre un Pull Request.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - mira el archivo [LICENSE](LICENSE) para más detalles.
