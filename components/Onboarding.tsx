
import React, { useState, useRef } from 'react';
import { UserProfile, THEME_COLORS } from '../types';
import { useToast } from '../context/ToastContext';
import { Sparkles, Key, Lock, Eye, EyeOff, Upload, UserCircle, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
  onImport: (file: File) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onImport }) => {
  const { showToast } = useToast();
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(THEME_COLORS[0]);
  const [showPassword, setShowPassword] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password && password !== confirmPassword) {
        showToast("Las contraseñas no coinciden", "error");
        return;
    }
    if (username.trim() && apiKey.trim()) {
      onComplete({
        username: username.trim(),
        avatarUrl: avatarUrl.trim(),
        accentColor: selectedColor.value,
        apiKey: apiKey.trim(),
        password: password.trim() || undefined
      });
      showToast(`¡Bienvenido, ${username}!`, "success");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        onImport(file);
    }
    if (e.target) e.target.value = ''; // Reset
  };

  // Avatar Upload Logic
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processAvatarFile(file);
  };

  const handleAvatarFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processAvatarFile(file);
  };

  const processAvatarFile = (file: File) => {
      if (!file.type.startsWith('image/')) {
        showToast("El archivo debe ser una imagen válida", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
          if (e.target?.result) setAvatarUrl(e.target.result as string);
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/95 backdrop-blur-md">
      <div className="min-h-full w-full flex items-center justify-center p-4 py-8 md:p-6">
        <div className="bg-surface border border-slate-700 rounded-3xl shadow-2xl w-full max-w-5xl flex flex-col md:flex-row overflow-hidden animate-fade-in-up">
          
          {/* LEFT COLUMN: Welcome & Restore */}
          <div className="md:w-5/12 bg-slate-900 p-6 md:p-10 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-700 relative overflow-hidden shrink-0">
               {/* Background Decoration */}
               <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>
               
               <div className="relative z-10 text-center md:text-left">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-lg shadow-indigo-500/20 mx-auto md:mx-0">
                      <Sparkles className="text-white w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <h2 className="text-2xl md:text-4xl font-bold text-white mb-2 md:mb-3">MediaTracker AI</h2>
                  <p className="text-sm md:text-base text-slate-400 mb-6 md:mb-8 leading-relaxed">
                      Tu santuario personal para anime, series y lecturas. Organiza, descubre y sigue tus historias favoritas con el poder de la IA.
                  </p>

                  {/* Restore Backup Section */}
                  <div className="mt-2 md:mt-4 pt-4 md:pt-6 border-t border-slate-800">
                      <p className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 md:mb-3">¿Ya tienes una cuenta?</p>
                      <button 
                          type="button"
                          onClick={handleImportClick}
                          className="w-full flex items-center justify-center gap-2 md:gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl text-slate-200 text-xs md:text-sm font-medium transition-all group"
                      >
                          <Upload className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                          <span>Restaurar Copia de Seguridad</span>
                      </button>
                      <input 
                          type="file" 
                          ref={fileInputRef} 
                          onChange={handleFileChange} 
                          className="hidden" 
                          accept=".json,application/json" 
                      />
                  </div>
               </div>
          </div>

          {/* RIGHT COLUMN: Registration Form */}
          <div className="md:w-7/12 p-6 md:p-10 bg-surface flex flex-col justify-center">
              
              <div className="mb-6 md:hidden flex items-center gap-3">
                  <div className="h-px bg-slate-700 flex-1"></div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">O empieza de cero</span>
                  <div className="h-px bg-slate-700 flex-1"></div>
              </div>

              <div className="mb-6 hidden md:block">
                  <h3 className="text-xl font-bold text-white">Configura tu perfil</h3>
                  <p className="text-sm text-slate-500">Crea tu biblioteca local privada.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
              {/* Identity Grid */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-start">
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1">Nombre de Usuario</label>
                          <div className="relative">
                              <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                              <input
                                  type="text"
                                  required
                                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm md:text-base"
                                  placeholder="Ej. OtakuMaster99"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                              />
                          </div>
                      </div>
                  </div>

                  {/* Avatar Compact */}
                  <div className="flex flex-col items-center md:items-end">
                       <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 text-center md:text-right w-full">Avatar</label>
                       <div 
                              className={`relative w-14 h-14 md:w-[3.25rem] md:h-[3.25rem] rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden transition-all group ${
                                  isDragging ? 'border-primary bg-primary/10' : 'border-slate-600 hover:border-slate-500 bg-slate-900'
                              }`}
                              onDragOver={handleDragOver}
                              onDragLeave={handleDragLeave}
                              onDrop={handleDrop}
                              onClick={() => avatarInputRef.current?.click()}
                              title="Subir foto"
                          >
                              {avatarUrl ? (
                                  <>
                                      <img src={avatarUrl} alt="Preview" className="w-full h-full object-cover" />
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                          <Upload className="w-4 h-4 text-white" />
                                      </div>
                                  </>
                              ) : (
                                  <Upload className="w-5 h-5 text-slate-500" />
                              )}
                              <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileSelect} />
                      </div>
                  </div>
              </div>

              {/* API Key */}
              <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 ml-1 flex items-center gap-2">
                      <Key className="w-3 h-3 text-primary" /> Gemini API Key
                  </label>
                  <input
                      type="password"
                      required
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all font-mono text-xs md:text-sm"
                      placeholder="Pega tu API Key aquí..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5 ml-1">
                      Consíguela gratis en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>.
                  </p>
              </div>

              {/* Password (Optional) */}
              <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <label className="text-xs font-bold text-slate-300 uppercase">Contraseña (Opcional)</label>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="relative">
                          <input
                              type={showPassword ? "text" : "password"}
                              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                              placeholder="Contraseña"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                          />
                          <button 
                          type="button" 
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                          >
                              {showPassword ? <EyeOff className="w-3 h-3"/> : <Eye className="w-3 h-3"/>}
                          </button>
                      </div>
                      
                      <input
                          type="password"
                          className={`w-full bg-slate-800 border rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:ring-1 outline-none transition-all ${
                              password 
                              ? (password === confirmPassword ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-red-500/50 focus:border-red-500')
                              : 'border-slate-700'
                          }`}
                          placeholder="Confirmar"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          disabled={!password}
                      />
                  </div>
              </div>

              {/* Accent Color */}
              <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2 ml-1">Tema de Color</label>
                  <div className="flex flex-wrap gap-3">
                  {THEME_COLORS.map((color) => (
                      <button
                      key={color.name}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${
                          selectedColor.name === color.name ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : ''
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                      >
                      {selectedColor.name === color.name && (
                          <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      )}
                      </button>
                  ))}
                  </div>
              </div>

              <button
                  type="submit"
                  disabled={!username.trim() || !apiKey.trim() || (!!password && password !== confirmPassword)}
                  className="w-full py-4 px-6 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed mt-4 flex items-center justify-center gap-2 text-sm md:text-base"
              >
                  <span>Comenzar Aventura</span>
                  <ArrowRight className="w-5 h-5" />
              </button>
              </form>
          </div>
        </div>
      </div>
    </div>
  );
};
