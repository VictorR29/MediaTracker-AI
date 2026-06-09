import { Tv, Clapperboard, Film, BookOpen } from 'lucide-react';

export const MOOD_OPTIONS = [
  { emoji: "🤯", label: "Quiero algo que me vuele la cabeza", shortLabel: "Volar la cabeza", keywords: "mind-blowing, plot twist, unpredictable, psychological, non-linear narrative" },
  { emoji: "🍿", label: "Algo ligero para ver sin pensar", shortLabel: "Ligero y sin pensar", keywords: "lighthearted, feel-good, easy watching, episodic, comfort watch, comedy" },
  { emoji: "❤️", label: "Busco una historia que me rompa el corazón", shortLabel: "Romper el corazón", keywords: "emotional, heartbreaking, bittersweet, tragic, romance, drama, tearjerker" },
  { emoji: "🔥", label: "Necesito adrenalina pura y emoción", shortLabel: "Adrenalina pura", keywords: "action-packed, thrilling, fast-paced, intense, high-stakes, adrenaline" },
  { emoji: "🌌", label: "Algo que me transporte a otro mundo", shortLabel: "Otro mundo", keywords: "immersive worldbuilding, fantasy, sci-fi, escapism, atmospheric, imaginative" },
  { emoji: "🧘", label: "Quiero aprender o reflexionar sobre la vida", shortLabel: "Reflexionar", keywords: "philosophical, thought-provoking, introspective, character study, slice of life, meaningful" },
  { emoji: "👻", label: "Quiero sentir tensión y un poco de miedo", shortLabel: "Tensión y miedo", keywords: "suspenseful, horror, tension, psychological thriller, eerie, dark atmosphere" },
  { emoji: "🚬", label: "Algo crudo, oscuro y realista", shortLabel: "Crudo y oscuro", keywords: "gritty, realistic, dark, noir, mature themes, morally complex, raw" }
];

export const MEDIA_TYPES = [
  { label: 'Anime', value: 'Anime', icon: Tv, color: 'text-violet-400', activeColor: '#8b5cf6' },
  { label: 'Series', value: 'Serie', icon: Clapperboard, color: 'text-purple-400', activeColor: '#c084fc' },
  { label: 'Películas', value: 'Pelicula', icon: Film, color: 'text-pink-400', activeColor: '#f472b6' },
  { label: 'Libros', value: 'Libro', icon: BookOpen, color: 'text-emerald-400', activeColor: '#34d399' },
  { label: 'Manhwa/Manga', value: 'Manhwa', icon: BookOpen, color: 'text-orange-400', activeColor: '#fb923c' },
];

export const CARD_GRADIENTS = [
  { bg: 'from-pink-500 to-rose-600', shadow: '#e11d48' },
  { bg: 'from-violet-500 to-purple-600', shadow: '#7c3aed' },
  { bg: 'from-emerald-500 to-teal-600', shadow: '#0d9488' },
  { bg: 'from-amber-500 to-orange-600', shadow: '#ea580c' },
  { bg: 'from-blue-500 to-cyan-600', shadow: '#0891b2' },
  { bg: 'from-fuchsia-500 to-purple-600', shadow: '#9333ea' },
  { bg: 'from-red-500 to-orange-600', shadow: '#dc2626' },
];

export const getColorData = (title: string) => {
  const seed = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CARD_GRADIENTS[seed % CARD_GRADIENTS.length];
};
