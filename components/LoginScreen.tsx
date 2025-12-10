
import React, { useState } from 'react';
import { Lock, ArrowRight, Sparkles, User } from 'lucide-react';

interface LoginScreenProps {
  onUnlock: (password: string) => boolean;
  username?: string;
  avatarUrl?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onUnlock, username, avatarUrl }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = onUnlock(password);
    if (!success) {
      setError(true);
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
           <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-slate-700 mx-auto mb-6 flex items-center justify-center overflow-hidden shadow-2xl relative group">
               {avatarUrl ? (
                   <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
               ) : (
                   <User className="w-10 h-10 text-slate-400" />
               )}
               {/* Optional Lock Overlay if avatar present, or always present on hover to indicate lock status */}
               <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <Lock className="w-6 h-6 text-white" />
               </div>
           </div>
           
           <h1 className="text-2xl font-bold text-white mb-2">
               {username ? `Hola, ${username}` : 'Colección Privada'}
           </h1>
           <p className="text-slate-400">Ingresa tu contraseña para acceder</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-slate-700 p-2 rounded-2xl shadow-xl flex items-center p-2 relative overflow-hidden group">
          <input 
            type="password" 
            autoFocus
            className="bg-transparent border-none text-white px-4 py-3 flex-grow outline-none placeholder-slate-600 text-lg"
            placeholder="Contraseña..."
            value={password}
            onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
            }}
          />
          <button 
            type="submit"
            className={`p-3 rounded-xl transition-all duration-300 ${
                password ? 'bg-primary text-white shadow-lg' : 'bg-slate-800 text-slate-500 cursor-default'
            }`}
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          
          {/* Error Shake Animation Wrapper */}
          {error && (
            <div className="absolute inset-0 pointer-events-none border-2 border-red-500/50 rounded-2xl animate-[shake_0.5s_ease-in-out]"></div>
          )}
        </form>
        
        {error && (
            <p className="text-red-400 text-sm text-center mt-4 animate-fade-in">Contraseña incorrecta</p>
        )}
      </div>
    </div>
  );
};
