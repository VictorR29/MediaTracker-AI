import { Tv, Clapperboard, Film, BookOpen } from 'lucide-react';

export const MOOD_OPTIONS = [
  { emoji: "🤯", label: "Quiero algo que me vuele la cabeza" },
  { emoji: "🍿", label: "Algo ligero para ver sin pensar" },
  { emoji: "❤️", label: "Busco una historia que me rompa el corazón" },
  { emoji: "🔥", label: "Necesito adrenalina pura y emoción" },
  { emoji: "🌌", label: "Algo que me transporte a otro mundo" },
  { emoji: "🧘", label: "Quiero aprender o reflexionar sobre la vida" },
  { emoji: "👻", label: "Quiero sentir tensión y un poco de miedo" },
  { emoji: "🚬", label: "Algo crudo, oscuro y realista" }
];

export const MEDIA_TYPES = [
  { label: 'Anime', value: 'Anime', icon: Tv, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/50' },
  { label: 'Series', value: 'Serie', icon: Clapperboard, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/50' },
  { label: 'Películas', value: 'Pelicula', icon: Film, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/50' },
  { label: 'Libros', value: 'Libro', icon: BookOpen, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/50' },
  { label: 'Manhwa/Manga', value: 'Manhwa', icon: BookOpen, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/50' },
];

export const CARD_GRADIENTS = [
  { bg: 'from-pink-500 to-rose-600', shadow: '#e11d48' },
  { bg: 'from-indigo-500 to-violet-600', shadow: '#7c3aed' },
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
