
import React, { useState, useRef } from 'react';
import { UserProfile } from '../types';
import { useToast } from '../context/ToastContext';
import { Shield, Key, Download, Upload, Trash2, X, Save, CheckCircle2, AlertTriangle, Eye, EyeOff, User, Image as ImageIcon, FileJson, Share2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onImportBackup: (file: File) => void;
  onExportBackup: () => void;
  onImportCatalog: (file: File) => void;
  onExportCatalog: () => void;
  onClearLibrary?: () => void; // New Prop
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, userProfile, onUpdateProfile, onImportBackup, onExportBackup, onImportCatalog, onExportCatalog, onClearLibrary
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'data'>('profile');
  const [username, setUsername] = useState(userProfile.username);
  const [avatarUrl, setAvatarUrl] = useState(userProfile.avatarUrl || '');
  const [apiKey, setApiKey] = useState(userProfile.apiKey);
  const [password, setPassword] = useState(userProfile.password || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Custom Confirm State
  const [showDeletePasswordConfirm, setShowDeletePasswordConfirm] = useState(false);
  const [showClearLibraryConfirm, setShowClearLibraryConfirm] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const handleSaveProfile = () => {
      const updatedProfile = { ...userProfile, username, avatarUrl };
      onUpdateProfile(updatedProfile);
      showToast("Perfil actualizado correctamente", "success");
  };

  const handleSaveSecurity = () => {
     const updatedProfile = { ...userProfile, apiKey };
     
     if (newPassword.trim()) {
         updatedProfile.password = newPassword.trim();
     }
     
     onUpdateProfile(updatedProfile);
     showToast("Configuración de seguridad actualizada", "success");
  };

  const requestRemovePassword = () => {
      setShowDeletePasswordConfirm(true);
  };

  const confirmRemovePassword = () => {
      const updatedProfile = { ...userProfile, password: undefined };
      setPassword('');
      setNewPassword('');
      onUpdateProfile(updatedProfile);
      setShowDeletePasswordConfirm(false);
      showToast("Contraseña eliminada. Acceso libre.", "warning");
  };

  const confirmClearLibrary = () => {
      if (onClearLibrary) {
          onClearLibrary();
          setShowClearLibraryConfirm(false);
          onClose();
          showToast("Biblioteca eliminada por completo.", "warning");
      }
  };

  const triggerImportBackup = () => {
    fileInputRef.current?.click();
  };

  const triggerImportCatalog = () => {
    catalogInputRef.current?.click();
  };

  const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImportBackup(file);
      }
  };

  const handleCatalogFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onImportCatalog(file);
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
      if (!file.type.startsWith('image/')) {
        showToast("Archivo no válido. Debe ser una imagen.", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
          if (e.target?.result) setAvatarUrl(e.target.result as string);
      };
      reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        {/* CHANGED: max-w-2xl -> max-w-4xl, md:h-auto -> md:h-auto md:max-h-[85vh] to limit vertical growth */}
        <div className="bg-surface border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col md:flex-row h-[600px] md:h-auto md:max-h-[85vh] relative">
            
            {/* Close Button - Positioned absolutely relative to container for better mobile layout */}
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 z-50"
            >
                <X className="w-5 h-5" />
            </button>

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
                                    <label className="block text-sm font-bold text-slate-200 mb-2 flex items-center justify-center gap-2">
                                        <ImageIcon className="w-4 h-4"/> Foto de Perfil
                                    </label>
                                    <div className="flex justify-center">
                                        <div 
                                            className={`relative w-24 h-24 rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden transition-all group ${
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
                                                        <Upload className="w-6 h-6 text-white" />
                                                    </div>
                                                </>
                                            ) : (
                                                <Upload className="w-8 h-8 text-slate-400" />
                                            )}
                                            <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileSelect} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2 text-center">
                                        Arrastra una imagen o haz clic para seleccionarla.
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
                    <div className="space-y-8 animate-fade-in relative">
                        {/* Section 1: Full Backup */}
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                             <h3 className="text-sm font-bold text-indigo-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Copia de Seguridad Completa
                            </h3>
                            <div className="space-y-3">
                                <button 
                                    onClick={() => { onExportBackup(); showToast("Generando backup optimizado...", "info"); }}
                                    className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-between group"
                                >
                                    <span className="flex items-center gap-2">
                                        <Download className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                        Copia de Seguridad (Privada)
                                    </span>
                                    <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded">Incluye todo</span>
                                </button>

                                <div className="flex gap-2 items-center">
                                    <button 
                                        type="button"
                                        onClick={triggerImportBackup}
                                        className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Upload className="w-4 h-4 text-blue-400" />
                                        Restaurar Backup
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    onChange={handleBackupFileChange} 
                                    onClick={handleInputClick}
                                    className="hidden" 
                                    accept=".json,application/json" 
                                />
                                <p className="text-xs text-slate-500 italic px-1">
                                    * Contiene tu API Key y progreso.
                                </p>
                            </div>
                        </div>
                        
                        {/* Section 2: Catalog Share */}
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                            <h3 className="text-sm font-bold text-emerald-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Share2 className="w-4 h-4" /> Compartir Catálogo
                            </h3>
                            <div className="space-y-3">
                                <button 
                                    onClick={() => { onExportCatalog(); showToast("Generando catálogo optimizado...", "info"); }}
                                    className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-between group"
                                >
                                    <span className="flex items-center gap-2">
                                        <FileJson className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                                        Exportar Catálogo (Público)
                                    </span>
                                    <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded">Sin datos personales</span>
                                </button>

                                <button 
                                    type="button"
                                    onClick={triggerImportCatalog}
                                    className="w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-4 h-4 text-purple-400" />
                                    Importar Catálogo (Fusionar)
                                </button>
                                <input 
                                    type="file" 
                                    ref={catalogInputRef} 
                                    onChange={handleCatalogFileChange} 
                                    onClick={handleInputClick}
                                    className="hidden" 
                                    accept=".json,application/json" 
                                />
                                <p className="text-xs text-slate-500 italic px-1">
                                    * Solo exporta la lista de obras. Excluye progreso y notas.
                                </p>
                            </div>
                        </div>

                         {/* DANGER ZONE - Clear Library */}
                         <div className="bg-red-900/10 p-4 rounded-xl border border-red-900/30 mt-6">
                            <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Zona de Peligro
                            </h3>
                             <button 
                                onClick={() => setShowClearLibraryConfirm(true)}
                                className="w-full px-4 py-3 bg-red-900/20 hover:bg-red-900/40 border border-red-800/50 rounded-lg text-red-200 text-sm font-medium transition-colors flex items-center justify-center gap-2"
                             >
                                 <Trash2 className="w-4 h-4" />
                                 Eliminar Toda la Biblioteca
                             </button>
                             <p className="text-xs text-red-400/70 mt-2 text-center">
                                 Esta acción no se puede deshacer. Borra todas las obras.
                             </p>
                         </div>

                         {/* Clear Library Confirmation Overlay */}
                         {showClearLibraryConfirm && (
                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl">
                                <div className="bg-surface border border-red-500/50 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 text-center">
                                    <Trash2 className="w-12 h-12 text-red-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-white mb-2">¿Borrar TODO?</h3>
                                    <p className="text-sm text-slate-300 mb-6">
                                        Perderás el progreso de <strong>todas</strong> tus obras. Tu perfil se mantendrá.
                                    </p>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setShowClearLibraryConfirm(false)}
                                            className="flex-1 px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={confirmClearLibrary}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold shadow-lg shadow-red-600/20"
                                        >
                                            SÍ, BORRAR
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="space-y-6 animate-fade-in relative">
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
                                        onClick={requestRemovePassword}
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

                        {/* Custom Confirmation Modal Overlay */}
                        {showDeletePasswordConfirm && (
                            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm flex items-center justify-center z-10 rounded-xl">
                                <div className="bg-surface border border-slate-700 p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 text-center">
                                    <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-white mb-2">¿Eliminar Contraseña?</h3>
                                    <p className="text-sm text-slate-400 mb-6">
                                        Cualquiera con acceso a este dispositivo podrá ver tu biblioteca completa.
                                    </p>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setShowDeletePasswordConfirm(false)}
                                            className="flex-1 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={confirmRemovePassword}
                                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-bold"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
