
import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, THEME_COLORS, parseAccentToRgb } from '../types';
import { useToast } from '../context/ToastContext';
import { Sparkles, Key, Lock, Eye, EyeOff, Upload, UserCircle, ChevronRight, Check } from 'lucide-react';

interface OnboardingProps {
  onComplete: (profile: UserProfile) => void;
  onImport: (file: File) => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onImport }) => {
  const { showToast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedColor, setSelectedColor] = useState(THEME_COLORS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-advance step 4 to app after 1.5s
  useEffect(() => {
    if (currentStep === 3) {
      const timer = setTimeout(() => {
        handleSubmitFinal();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  const goToStep = (step: number) => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentStep(step);
      setIsTransitioning(false);
    }, 200);
  };

  const handleSubmitFinal = () => {
    if (username.trim() && apiKey.trim()) {
      onComplete({
        username: username.trim(),
        avatarUrl: avatarUrl.trim(),
        accentColor: selectedColor.value,
        apiKey: apiKey.trim(),
        password: password.trim() || undefined
      });
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
    if (e.target) e.target.value = '';
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
      showToast("El archivo debe ser una imagen valida", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) setAvatarUrl(e.target.result as string);
    };
    reader.readAsDataURL(file);
  };

  const selectedRgb = parseAccentToRgb(selectedColor.value);

  // Step indicator
  const StepIndicator = () => (
    <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-3 pt-6">
      {[0, 1, 2, 3].map((step) => (
        <div
          key={step}
          className={`h-1 rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            step === currentStep
              ? 'w-8'
              : step < currentStep
              ? 'w-4'
              : 'w-4'
          }`}
          style={{
            background:
              step === currentStep
                ? `rgb(${selectedRgb})`
                : step < currentStep
                ? `rgba(${selectedRgb},0.6)`
                : 'rgba(255,255,255,0.12)'
          }}
        />
      ))}
    </div>
  );

  // ─── Step 0: Welcome ──────────────────────────────────────────────
  const renderStepWelcome = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 relative">
      {/* Subtle accent gradient orb */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.07] pointer-events-none blur-[120px]"
        style={{ background: `rgb(${selectedRgb})` }}
      />

      {/* Logo */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shadow-lg" style={{ background: `linear-gradient(135deg, rgb(${selectedRgb}), rgba(${selectedRgb},0.5))` }}>
          <Sparkles className="text-white w-8 h-8" />
        </div>

        <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3" style={{ letterSpacing: '-0.03em' }}>
          MediaTracker AI
        </h1>
        <p className="text-zinc-400 text-base md:text-lg leading-relaxed mb-10">
          Tu santuario personal para anime, series y lecturas
        </p>

        {/* Username Input */}
        <div className="w-full max-w-sm mb-5">
          <input
            type="text"
            required
            className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-2xl px-6 py-4 text-white text-center text-xl placeholder-zinc-600 focus:ring-2 focus:ring-white/20 outline-none transition-all duration-200"
            style={{ letterSpacing: '-0.01em' }}
            placeholder="Tu nombre..."
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        {/* Avatar Upload */}
        <div className="flex flex-col items-center mb-8">
          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Avatar</label>
          <div
            className={`relative w-24 h-24 rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden transition-all duration-200 ${
              isDragging
                ? 'ring-2 ring-white bg-white/10 scale-105'
                : 'ring-1 ring-zinc-700 hover:ring-zinc-500 bg-zinc-900 hover:bg-zinc-800/80'
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
                <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Upload className="w-5 h-5 text-white" />
                </div>
              </>
            ) : (
              <Upload className="w-7 h-7 text-zinc-600" />
            )}
            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileSelect} />
          </div>
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={() => goToStep(1)}
          disabled={!username.trim()}
          className="w-full max-w-sm py-4 px-6 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-full shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
        >
          <span>Continuar</span>
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Restore backup link */}
        <button
          type="button"
          onClick={handleImportClick}
          className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
        >
          Ya tengo una copia de seguridad
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
  );

  // ─── Step 1: Configura ────────────────────────────────────────────
  const renderStepConfigura = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 relative">
      {/* Subtle accent gradient orb */}
      <div
        className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.05] pointer-events-none blur-[100px]"
        style={{ background: `rgb(${selectedRgb})` }}
      />

      <div className="relative z-10 w-full max-w-md">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2" style={{ letterSpacing: '-0.03em' }}>
          Configura
        </h2>
        <p className="text-zinc-500 text-sm mb-8">
          Necesita acceso a la IA para analizar tu contenido.
        </p>

        <div className="space-y-5">
          {/* API Key */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-400 uppercase mb-2 ml-1">
              <Key className="w-3.5 h-3.5 text-white" /> Gemini API Key
            </label>
            <input
              type="password"
              required
              className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl px-4 py-3.5 text-white placeholder-zinc-600 focus:ring-2 focus:ring-white/20 outline-none transition-all font-mono text-sm"
              placeholder="Pega tu API Key aqui..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
            <p className="text-[10px] text-zinc-500 mt-1.5 ml-1">
              Consiguela gratis en{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-zinc-300 hover:underline">
                Google AI Studio
              </a>
            </p>
          </div>

          {/* Password (Optional) */}
          <div className="p-4 bg-white/[0.02] rounded-xl ring-1 ring-white/[0.06] space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <Lock className="w-4 h-4 text-zinc-400" />
              <label className="text-xs font-bold text-zinc-400 uppercase">Contrasena (Opcional)</label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-white/[0.03] ring-1 ring-white/[0.06] rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:ring-1 focus:ring-white/20 outline-none transition-all"
                  placeholder="Contrasena"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              <input
                type="password"
                className={`w-full bg-white/[0.03] ring-1 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-600 focus:ring-1 outline-none transition-all ${
                  password
                    ? password === confirmPassword
                      ? 'ring-emerald-500/50 focus:ring-emerald-500'
                      : 'ring-red-500/50 focus:ring-red-500'
                    : 'ring-white/[0.06]'
                }`}
                placeholder="Confirmar"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={!password}
              />
            </div>
          </div>
        </div>

        {/* Continue Button */}
        <button
          type="button"
          onClick={() => goToStep(2)}
          disabled={!apiKey.trim() || (!!password && password !== confirmPassword)}
          className="w-full py-4 px-6 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-full shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed mt-8 flex items-center justify-center gap-2 text-base"
        >
          <span>Continuar</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // ─── Step 2: Elige tu firma ───────────────────────────────────────
  const renderStepColor = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 relative">
      {/* Dynamic accent background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.06] pointer-events-none blur-[140px] transition-colors duration-700"
        style={{ background: `rgb(${selectedRgb})` }}
      />

      <div className="relative z-10 w-full max-w-lg">
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2 text-center" style={{ letterSpacing: '-0.03em' }}>
          Elige tu firma
        </h2>
        <p className="text-zinc-500 text-sm mb-8 text-center">
          Un toque de color que te define.
        </p>

        {/* Color Swatches */}
        <div className="flex items-center justify-center gap-4 mb-10">
          {THEME_COLORS.map((color) => (
            <button
              key={color.name}
              type="button"
              onClick={() => setSelectedColor(color)}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 ${
                selectedColor.name === color.name
                  ? 'ring-2 ring-white ring-offset-2 ring-offset-[#09090B] scale-110'
                  : 'ring-1 ring-white/10 hover:ring-white/20'
              }`}
              style={{ backgroundColor: color.hex }}
              title={color.name}
            >
              {selectedColor.name === color.name && (
                <Check className="w-5 h-5 text-white drop-shadow-lg" />
              )}
            </button>
          ))}
        </div>

        {/* Live Preview */}
        <div className="space-y-4 mb-10">
          <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider text-center">Preview en vivo</p>

          {/* Mock Header Pill */}
          <div className="flex justify-center">
            <div
              className="rounded-full px-5 py-2.5 ring-1 ring-white/[0.08]"
              style={{
                background: 'rgba(24,24,27,0.75)',
                backdropFilter: 'blur(40px) saturate(1.8)',
                boxShadow: `0 4px 24px rgba(0,0,0,0.35), inset 0 -1px 0 rgba(${selectedRgb}, 0.18), 0 0 0 1px rgba(255,255,255,0.06)`
              }}
            >
              <span className="text-white font-bold text-sm">Preview del header</span>
            </div>
          </div>

          {/* Mock Nav Bar */}
          <div className="flex justify-center">
            <div
              className="rounded-2xl px-6 py-3 flex items-center gap-4"
              style={{
                background: 'linear-gradient(to top, rgba(9,9,11,0.92) 0%, rgba(24,24,27,0.78) 100%)',
                backdropFilter: 'blur(40px) saturate(1.8)',
                borderTop: `1px solid rgba(${selectedRgb},0.12)`,
                boxShadow: `0 -4px 24px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04)`
              }}
            >
              <div
                className="w-5 h-5 rounded-sm"
                style={{
                  background: `rgba(${selectedRgb},0.3)`,
                  filter: `drop-shadow(0 0 6px rgba(${selectedRgb},0.50))`
                }}
              />
              <div className="w-5 h-5 rounded-sm bg-white/10" />
              <div
                className="w-8 h-8 rounded-full bg-white flex items-center justify-center -mt-4"
                style={{
                  boxShadow: `0 0 20px rgba(${selectedRgb},0.35), 0 0 40px rgba(${selectedRgb},0.15), 0 8px 24px rgba(0,0,0,0.50)`
                }}
              >
                <span className="text-zinc-900 text-xs font-bold">+</span>
              </div>
              <div className="w-5 h-5 rounded-sm bg-white/10" />
              <div className="w-5 h-5 rounded-sm bg-white/10" />
            </div>
          </div>

          {/* Mock Greeting */}
          <div className="flex justify-center">
            <div
              className="rounded-2xl p-4 ring-1 ring-white/[0.08] max-w-sm w-full relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, rgba(${selectedRgb},0.08) 0%, rgba(${selectedRgb},0.03) 40%, #09090B 100%)`
              }}
            >
              <div
                className="absolute -top-8 -left-8 w-32 h-32 rounded-full opacity-25 pointer-events-none blur-[50px]"
                style={{ background: `rgb(${selectedRgb})` }}
              />
              <div className="relative z-10">
                <p className="text-white text-sm font-semibold tracking-tight">Buenos dias, {username || ' Usuario'}.</p>
                <p className="text-zinc-500 text-xs mt-1">Tu biblioteca esta lista para ti.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Start Button */}
        <button
          type="button"
          onClick={() => goToStep(3)}
          className="w-full py-4 px-6 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-full shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 active:scale-[0.97] flex items-center justify-center gap-2 text-base"
        >
          <span>Comenzar</span>
          <Sparkles className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // ─── Step 3: Confirmation ─────────────────────────────────────────
  const renderStepConfirm = () => (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 relative">
      {/* Accent glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full opacity-15 pointer-events-none blur-[100px]"
        style={{ background: `rgb(${selectedRgb})` }}
      />

      <div className="relative z-10 text-center">
        <h1
          className="text-4xl md:text-6xl font-extrabold tracking-tight mb-3"
          style={{
            letterSpacing: '-0.03em',
            color: 'white',
            textShadow: `0 0 40px rgba(${selectedRgb},0.40), 0 0 80px rgba(${selectedRgb},0.20)`
          }}
        >
          ¡Listo, {username}!
        </h1>
        <p className="text-zinc-400 text-lg">Tu santuario esta preparado.</p>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────
  const steps = [renderStepWelcome, renderStepConfigura, renderStepColor, renderStepConfirm];
  const isLastContentStep = currentStep === 2;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto transition-colors duration-700"
      style={{ background: `radial-gradient(ellipse at 50% 30%, rgba(${selectedRgb},0.04) 0%, #09090B 60%)` }}
    >
      <StepIndicator />

      <div
        className={`transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'
        }`}
      >
        {steps[currentStep]()}
      </div>
    </div>
  );
};
