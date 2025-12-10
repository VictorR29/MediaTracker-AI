
import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { Shield, Key, Download, Upload, Trash2, X, Save, CheckCircle2, AlertTriangle, Eye, EyeOff, User, Image as ImageIcon } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onImportData: (file: File) => void;
  onExportData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, userProfile, onUpdateProfile, onImportData, onExportData 
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'data'>('profile');
  const [username, setUsername] = useState(userProfile.username);
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl || '');
  const [apiKey, setApiKey] = useState(userProfile.apiKey);
  const [password, setPassword] = useState(userProfile.password || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
      const updatedProfile = { ...userProfile, username, avatarUrl };
      onUpdateProfile(updatedProfile);
      alert("Perfil actualizado correctamente.");
  };

  const handleSaveSecurity = () => {
     const updatedProfile = { ...userProfile, apiKey };
     
     if (newPassword.trim()) {
         updatedProfile.password = newPassword.trim();
     }
     
     onUpdateProfile(updatedProfile);
     alert("Configuración de seguridad actualizada.");
  };

  const handleRemovePassword = () => {
      if (confirm("¿Estás seguro de querer eliminar la contraseña? Tu colección será accesible para cualquiera en este dispositivo.")) {
          const updatedProfile = { ...userProfile, password: undefined };
          setPassword('');
          setNewPassword('');
          onUpdateProfile(updatedProfile);
      }
  };

  const triggerImport = () => {
    // Trigger the file browser dialog
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImportData(file);
      }
  };

  // Clear value on click to allow selecting the same file again
  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
      (e.target as HTMLInputElement).value = '';
  };

  // Avatar Upload Logic for Settings
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
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
          if (e.target?.result) setAvatarUrl(e.target.result as string);
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col md:flex-row h-[600px] md:h-auto">
            
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-slate-900/50 border-b md:border-b-0 md:border-r border-slate-700 p-4 md:p-6 flex flex-col gap-2">
                <h2 className="text-xl font-bold text-white mb-4 px-2">Configuración</h2>
                
                <button 
                  onClick={() => setActiveTab('profile')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                      activeTab === 'profile' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                    <User className="w-4 h-4" />
                    Perfil
                </button>

                <button 
                  onClick={() => setActiveTab('data')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                      activeTab === 'data' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                    <Download className="w-4 h-4" />
                    Datos y Backup
                </button>

                <button 
                  onClick={() => setActiveTab('security')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
                      activeTab === 'security' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                    <Shield className="w-4 h-4" />
                    Seguridad y API
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-800/20 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white p-2">
                    <X className="w-5 h-5" />
                </button>

                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-indigo-400" /> Identidad
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-2">Nombre de Usuario</label>
                                    <input 
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                                        <ImageIcon className="w-4 h-4"/> Foto de Perfil
                                    </label>
                                    <div className="flex gap-4 items-center">
                                        <div 
                                            className={`relative w-16 h-16 rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden transition-all group ${
                                                isDragging ? 'border-primary bg-primary/10' : 'border-slate-600 hover:border-slate-500 bg-slate-800'
                                            }`}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            onClick={() => avatarInputRef.current?.click()}
                                        >
                                            {avatarUrl ? (
                                                <>
                                                    <img src={avatarUrl} className="w-full h-full object-cover" alt="Preview" onError={(e) => e.currentTarget.style.display = 'none'} />
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                        <Upload className="w-4 h-4 text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <Upload className="w-5 h-5 text-slate-400" />
                                            )}
                                            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileSelect} />
                                        </div>

                                        <div className="flex-grow">
                                            <input 
                                                type="url"
                                                value={avatarUrl}
                                                onChange={(e) => setAvatarUrl(e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                                placeholder="https://ejemplo.com/avatar.jpg"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Pega un enlace o sube una imagen directamente.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={handleSaveProfile}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl transition-colors shadow-lg"
                            >
                                <Save className="w-4 h-4" />
                                Guardar Perfil
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-8 animate-fade-in">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <Download className="w-5 h-5 text-indigo-400" /> Exportar Datos
                            </h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Descarga una copia completa de tu biblioteca y perfil en formato JSON.
                            </p>
                            <button 
                                onClick={onExportData}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                Descargar Respaldo JSON
                            </button>
                        </div>
                        
                        <div className="border-t border-slate-700 pt-6">
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <Upload className="w-5 h-5 text-emerald-400" /> Importar Datos
                            </h3>
                            <p className="text-sm text-slate-400 mb-4">
                                Restaura tu biblioteca desde un archivo JSON. <br/>
                                <span className="text-yellow-500 flex items-center gap-1 mt-1 text-xs">
                                    <AlertTriangle className="w-3 h-3"/>
                                    Esto fusionará los datos nuevos con los existentes.
                                </span>
                            </p>
                            <button 
                                type="button"
                                onClick={triggerImport}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Seleccionar Archivo
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                onChange={handleFileChange} 
                                onClick={handleInputClick}
                                className="hidden" 
                                accept=".json,application/json" 
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* API Key Section */}
                        <div>
                            <label className="block text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                                <Key className="w-4 h-4 text-primary" /> Gemini API Key
                            </label>
                            <input 
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all font-mono"
                                placeholder="sk-..."
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                Esta clave se usa para buscar información de nuevas obras.
                            </p>
                        </div>

                        <hr className="border-slate-700/50" />

                        {/* Password Section */}
                        <div>
                            <label className="block text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-400" /> Contraseña de Acceso
                            </label>
                            
                            {userProfile.password ? (
                                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3 mb-4 flex items-center justify-between">
                                    <span className="text-sm text-emerald-400 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Contraseña activa
                                    </span>
                                    <button 
                                        onClick={handleRemovePassword}
                                        className="text-xs text-red-400 hover:text-red-300 hover:underline"
                                    >
                                        Eliminar protección
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500 mb-4">No tienes contraseña establecida. Tu colección es pública en este dispositivo.</p>
                            )}

                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:ring-2 focus:ring-emerald-500 outline-none transition-all pr-10"
                                    placeholder={userProfile.password ? "Cambiar contraseña..." : "Establecer nueva contraseña..."}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                onClick={handleSaveSecurity}
                                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-indigo-600 text-white font-bold py-2.5 rounded-xl transition-colors shadow-lg"
                            >
                                <Save className="w-4 h-4" />
                                Guardar Cambios
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
