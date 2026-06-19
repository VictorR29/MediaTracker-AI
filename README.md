
# MediaTracker AI 🎬📚

![Status](https://img.shields.io/badge/Status-Stable-success)
![License](https://img.shields.io/badge/License-GPL_v3-blue)
![Tech](https://img.shields.io/badge/Stack-React_19_%7C_Tailwind_%7C_Gemini_AI-indigo)
![PWA](https://img.shields.io/badge/PWA-Installable-purple)

**MediaTracker AI** redefines your personal entertainment library management. It's not just a list — it's an immersive, private visual experience for tracking Anime, Series, Movies, Manhwas, and Books.

Powered by **Google Gemini 2.5**, the system transforms simple titles into a rich ecosystem of metadata, dynamic colors, and emotional recommendations, all stored securely on your device.

---

## ✨ The Immersive Experience

### 🧠 AI-Powered "Stack" Discovery
Forget static lists. MediaTracker implements a gestural discovery system inspired by high-end mobile interfaces:
- **3D Card Navigation:** Swipe, tilt, and explore AI-generated recommendations with realistic physics and shuffle effects.
- **Mood Refinement:** How are you feeling today? Filter not just by genre, but by emotional atmosphere (e.g., *"🤯 I want something mind-blowing"* or *"🍿 Something light to unwind"*).
- **Aesthetic Fallbacks:** Even when AI finds no results, the interface responds with designed status cards that maintain immersion.

### 🎨 Adaptive Design & Themes
The interface is alive. Every time you open a work, the app extracts the dominant color palette from its cover and **adapts the entire UI in real-time** (borders, shadows, gradients, and accents) to match the content's aesthetic.

### 👤 Character Gallery
A full-screen collector-style view for your favorite characters:
- **Trending Cards:** Stories-style full-screen cards with 3D tilt, swipe navigation, and tap-to-reveal cover art.
- **Physical 3D Interaction:** Cards respond to mouse/touch with 22° tilt, dynamic scaling, and light reflection that follows your cursor — like holding a real card.
- **Smart Shuffle:** Tap the card to reveal the work's cover, use the shuffle button to discover the next character with a smooth crossfade transition.
- **Per-Work Ranking:** Characters are ranked within their work (1/3, 2/3) when a work has multiple favorites.
- **Genre Filtering:** Filter characters by genre with animated pill selectors.
- **Progress Tracking:** Visual progress bar showing discovered characters vs total.

### 📊 Intelligent Library
- **Auto-Metadata:** Type "Solo Leveling" and AI fills in synopsis, status, chapter count, and cover art automatically.
- **Shelf Mode:** View your collection on intelligent horizontal "shelves," organized by viewing priority and genres.
- **Deep Insights:** Consumption distribution charts (Visual vs Reading), obsession rankings, and platform ecosystem analysis.

---

## 🔒 Privacy: Your Data is Yours

In an era of mass tracking, MediaTracker takes a radical stance:
- **Local-First:** All your data lives in **IndexedDB** in your browser. Nothing is sent to external servers.
- **Direct Connection:** You provide your own Google Gemini API Key. The connection is direct between your client and Google.
- **Import/Export:** You own your data. Export complete backups (JSON) or share sanitized public catalogs.

---

## 🛠️ Tech Stack

Built with the latest web technologies for native performance:

- **Core:** React 19 (Modern hooks & render optimization).
- **Animations:** Framer Motion for 3D flips, crossfades, and gesture-driven interactions.
- **AI:** Google GenAI SDK (`@google/genai` v1.31+).
- **Styles:** Tailwind CSS with custom utilities for Glassmorphism and 3D animations.
- **Persistence:** IndexedDB wrapper for robust client-side storage.
- **Iconography:** Lucide React.

---

## 🚀 Getting Started

### Prerequisites
You need a **Google Gemini API Key** (Free).
👉 [Get one at Google AI Studio](https://aistudio.google.com/app/apikey)

### Local Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/VictorR29/MediaTracker-AI.git
    cd MediaTracker-AI
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Start development server:**
    ```bash
    npm run dev
    ```

4.  **Configuration:** On first launch, complete the *Onboarding* by entering your name and API Key.

### Use as Mobile App (PWA)
MediaTracker is optimized for touch and gestures.
1. Open the web app in Safari (iOS) or Chrome (Android).
2. Tap "Share" -> "Add to Home Screen".
3. Enjoy the full-screen experience without browser bars.

---

## 🤝 Contributing

Pull Requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0**. See the `LICENSE` file for details.
