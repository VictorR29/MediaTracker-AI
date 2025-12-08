
import React, { useState } from 'react';
import { UserProfile, THEME_COLORS } from '../types';
import { Sparkles, Key, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(THEME_COLORS[0]);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password !== confirmPassword) {
        alert("Las contraseñas no coinciden");
        return;
    }
    if (username.trim() && apiKey.trim()) {
      onComplete({
        username: username.trim(),
        accentColor: selectedColor.value,
        apiKey: apiKey.trim(),
        password: password.trim() || undefined
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-surface border border-slate-700 p-8 rounded-2xl shadow-2xl max-w-lg w-full animate-fade-in-up my-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Bienvenido</h2>
          <p className="text-slate-400">Configura tu biblioteca privada en MediaTracker AI</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">¿Cómo te llamas?</label>
            <input
              type="text"
              required
              className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="Tu nombre de usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* API Key */}
          <div>
             <label className="block text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" /> Gemini API Key
             </label>
             <div className="relative">
                <input
                    type="password"
                    required
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-sm"
                    placeholder="Pega tu API Key de Google AI Studio"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                />
             </div>
             <p className="text-xs text-slate-500 mt-2">
                Necesitas una API Key gratuita de <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
             </p>
          </div>

          {/* Password (Optional) */}
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 space-y-4">
             <div className="flex items-center gap-2 mb-1">
                 <Lock className="w-4 h-4 text-emerald-400" />
                 <label className="text-sm font-medium text-slate-300">Contraseña de Acceso (Opcional)</label>
             </div>
             <p className="text-xs text-slate-400 mb-3">Si estableces una contraseña, tu colección se bloqueará al iniciar.</p>
             
             <div className="relative">
                <input
                    type={showPassword ? "text" : "password"}
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="Nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                </button>
             </div>
             
             {password && (
                 <input
                    type="password"
                    className={`w-full bg-slate-900 border rounded-lg px-4 py-2.5 text-white placeholder-slate-600 focus:ring-1 outline-none transition-all ${password === confirmPassword ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-red-500/50 focus:border-red-500'}`}
                    placeholder="Confirmar contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                />
             )}
          </div>

          {/* Accent Color */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">Elige tu estilo</label>
            <div className="grid grid-cols-6 gap-2">
              {THEME_COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                    selectedColor.name === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : ''
                  }`}
                  style={{ backgroundColor: color.hex }}
                  title={color.name}
                >
                  {selectedColor.name === color.name && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!username.trim() || !apiKey.trim() || (!!password && password !== confirmPassword)}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
          >
            Comenzar Aventura
          </button>
        </form>
      </div>
    </div>
  );
};
