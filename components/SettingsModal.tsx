
import React, { useState, useRef, useMemo } from 'react';
import { UserProfile, MediaItem, RATING_TO_SCORE } from '../types';
import { useToast } from '../context/ToastContext';
import { saveMediaItem, deleteMediaItem } from '../services/storage';
import { hashPassword } from '../utils/password';
import { Shield, Key, Download, Upload, Trash2, X, Save, CheckCircle2, AlertTriangle, Eye, EyeOff, User, Image as ImageIcon, FileJson, Share2, HardDrive, Archive, RefreshCw, Minimize2 } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onUpdateProfile: (profile: UserProfile) => void;
  onImportBackup: (file: File) => void;
  onExportBackup: () => void;
  onImportCatalog: (file: File) => void;
  onExportCatalog: () => void;
  onClearLibrary?: () => void;
  library?: MediaItem[];
  onLibraryUpdate?: (newLibrary: MediaItem[]) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, userProfile, onUpdateProfile, onImportBackup, onExportBackup, onImportCatalog, onExportCatalog, onClearLibrary, library = [], onLibraryUpdate
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
  const [isProcessingClean, setIsProcessingClean] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const catalogInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap<HTMLDivElement>(isOpen, onClose);
  const [isDragging, setIsDragging] = useState(false);

  // --- STORAGE STATS CALCULATION ---
  const storageStats = useMemo(() => {
     const jsonString = JSON.stringify(library);
     const bytes = new Blob([jsonString]).size;
     const megabytes = bytes / (1024 * 1024);
     const count = library.length;
     
     const limitSoft = 50;
     const limitHard = 100;
     
     let status: 'healthy' | 'warning' | 'critical' = 'healthy';
     if (megabytes > limitHard) status = 'critical';
     else if (megabytes > limitSoft) status = 'warning';

     const percentUsed = Math.min(100, (megabytes / limitHard) * 100);

     const lowRated = library.filter(i => {
         const score = RATING_TO_SCORE[i.trackingData.rating] || 0;
         return score > 0 && score <= 3; 
     });

     const dropped = library.filter(i => i.trackingData.status === 'Descartado');

     const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
     const stalePlanned = library.filter(i => 
         i.trackingData.status === 'Planeado / Pendiente' && 
         i.createdAt < oneYearAgo &&
         i.trackingData.watchedEpisodes === 0
     );

     const heavyCompleted = library.filter(i => 
         i.trackingData.status === 'Completado' && 
         i.aiData.coverImage && 
         i.aiData.coverImage.startsWith('data:') &&
         i.aiData.coverImage.length > 130000 
     );

     return {
         megabytes: megabytes.toFixed(1),
         count,
         status,
         percentUsed,
         candidates: {
             lowRated,
             dropped,
             stalePlanned,
             heavyCompleted
         }
     };
  }, [library]);

  if (!isOpen) return null;

  // --- ACTIONS ---

  const handleSaveProfile = () => {
      const updatedProfile = { ...userProfile, username, avatarUrl };
      onUpdateProfile(updatedProfile);
      showToast("Perfil actualizado correctamente", "success");
  };

  const handleSaveSecurity = async () => {
    const updatedProfile = { ...userProfile, apiKey };
    if (newPassword.trim()) {
      updatedProfile.password = await hashPassword(newPassword.trim());
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

  // --- HELPER: IMAGE COMPRESSION ---
  const compressImage = (base64Str: string, maxWidth: number = 300, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                const newBase64 = canvas.toDataURL('image/webp', quality);
                resolve(newBase64);
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => resolve(base64Str);
    });
  };

  // --- CLEANING ACTIONS ---
  
  const executeClean = async (action: () => Promise<void>) => {
      if (!onLibraryUpdate) return;
      setIsProcessingClean(true);
      try {
          await action();
      } catch (e) {
          console.error(e);
          showToast("Error durante la limpieza", "error");
      } finally {
          setIsProcessingClean(false);
      }
  };

  const cleanLowRated = () => executeClean(async () => {
      const items = storageStats.candidates.lowRated;
      await Promise.all(items.map(i => deleteMediaItem(i.id)));
      onLibraryUpdate?.(library.filter(l => !items.find(i => i.id === l.id)));
      showToast(`Eliminadas ${items.length} obras de baja calificación`, "success");
  });

  const cleanDropped = () => executeClean(async () => {
      const items = storageStats.candidates.dropped;
      await Promise.all(items.map(i => deleteMediaItem(i.id)));
      onLibraryUpdate?.(library.filter(l => !items.find(i => i.id === l.id)));
      showToast(`Eliminadas ${items.length} obras descartadas`, "success");
  });

  const cleanStale = () => executeClean(async () => {
      const items = storageStats.candidates.stalePlanned;
      await Promise.all(items.map(i => deleteMediaItem(i.id)));
      onLibraryUpdate?.(library.filter(l => !items.find(i => i.id === l.id)));
      showToast(`Limpiados ${items.length} items de lista de deseos antigua`, "success");
  });

  const optimizeImages = () => executeClean(async () => {
      const items = storageStats.candidates.heavyCompleted;
      
      const updatedItems: MediaItem[] = [];
      let processedCount = 0;

      for (const item of items) {
          if (item.aiData.coverImage) {
              const compressed = await compressImage(item.aiData.coverImage);
              if (compressed.length < item.aiData.coverImage.length) {
                  const newItem = {
                      ...item,
                      aiData: { ...item.aiData, coverImage: compressed }
                  };
                  await saveMediaItem(newItem);
                  updatedItems.push(newItem);
                  processedCount++;
              }
          }
      }
      
      if (processedCount > 0) {
          const newLib = library.map(current => {
              const updated = updatedItems.find(u => u.id === current.id);
              return updated || current;
          });
          onLibraryUpdate?.(newLib);
          showToast(`Imágenes optimizadas en ${processedCount} obras.`, "success");
      } else {
          showToast("No se pudo reducir más el tamaño.", "info");
      }
  });

  // --- FILE HANDLERS ---
  const triggerImportBackup = () => fileInputRef.current?.click();
  const triggerImportCatalog = () => catalogInputRef.current?.click();

  const handleBackupFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImportBackup(file);
  };

  const handleCatalogFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onImportCatalog(file);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
      (e.target as HTMLInputElement).value = '';
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
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

  const tabs = [
    { id: 'profile' as const, label: 'Perfil', icon: User },
    { id: 'data' as const, label: 'Datos', icon: Download },
    { id: 'security' as const, label: 'API', icon: Shield },
  ];

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-[#111113] ring-1 ring-white/[0.06] rounded-2xl shadow-2xl w-full max-w-lg md:max-w-2xl overflow-hidden flex flex-col h-[85vh] md:h-auto md:max-h-[80vh] relative">
            
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <h2 id="settings-title" className="text-lg font-bold text-white">Configuración</h2>
                <button 
                    onClick={onClose} 
                    className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Tabs - Horizontal */}
            <div className="flex border-b border-white/[0.06] bg-zinc-900/30">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all relative ${
                            activeTab === tab.id
                                ? 'text-white'
                                : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-white rounded-full" />
                        )}
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 custom-scrollbar">
                {activeTab === 'profile' && (
                    <div className="space-y-6 animate-fade-in">
                        {/* Avatar Section */}
                        <div className="flex flex-col items-center">
                            <div 
                                className={`relative w-20 h-20 rounded-full border-2 border-dashed flex-shrink-0 flex items-center justify-center cursor-pointer overflow-hidden transition-all group ${
                                    isDragging ? 'border-white bg-white/10' : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
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
                                            <Upload className="w-5 h-5 text-white" />
                                        </div>
                                    </>
                                ) : (
                                    <Upload className="w-6 h-6 text-zinc-500" />
                                )}
                                <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={handleAvatarFileSelect} />
                            </div>
                            <p className="text-xs text-zinc-500 mt-2">Foto de perfil</p>
                        </div>

                        {/* Username */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Nombre de Usuario</label>
                            <input 
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:ring-white/20 outline-none transition-all"
                            />
                        </div>

                        <button 
                            onClick={handleSaveProfile}
                            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-3 rounded-xl transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Guardar Perfil
                        </button>
                    </div>
                )}

                {activeTab === 'data' && (
                    <div className="space-y-5 animate-fade-in">
                        {/* Storage Widget */}
                        <div className="bg-zinc-900/50 ring-1 ring-white/[0.04] rounded-xl p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                                    <HardDrive className={`w-3.5 h-3.5 ${storageStats.status === 'critical' ? 'text-red-400' : storageStats.status === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`} />
                                    Almacenamiento
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                    storageStats.status === 'critical' ? 'bg-red-500/20 text-red-400' : 
                                    storageStats.status === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-blue-500/20 text-blue-400'
                                }`}>
                                    {storageStats.megabytes} MB
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                                <div 
                                    className={`h-full transition-all duration-700 ${
                                        storageStats.status === 'critical' ? 'bg-gradient-to-r from-red-500 to-orange-500' :
                                        storageStats.status === 'warning' ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                                        'bg-gradient-to-r from-blue-500 to-cyan-400'
                                    }`}
                                    style={{ width: `${storageStats.percentUsed}%` }}
                                />
                            </div>
                            <p className="text-[11px] text-zinc-500">
                                {storageStats.count} obras
                                {storageStats.status === 'critical' && <span className="text-red-400 ml-1">• Reducí el tamaño</span>}
                                {storageStats.status === 'warning' && <span className="text-yellow-400 ml-1">• Considerá optimizar</span>}
                            </p>

                            {/* Quick Actions */}
                            {(storageStats.candidates.lowRated.length > 0 || storageStats.candidates.dropped.length > 0 || storageStats.candidates.heavyCompleted.length > 0) && (
                                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/[0.04]">
                                    {storageStats.candidates.lowRated.length > 0 && (
                                        <button onClick={cleanLowRated} disabled={isProcessingClean} className="text-[10px] font-medium px-2.5 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors">
                                            Limpiar malos ({storageStats.candidates.lowRated.length})
                                        </button>
                                    )}
                                    {storageStats.candidates.dropped.length > 0 && (
                                        <button onClick={cleanDropped} disabled={isProcessingClean} className="text-[10px] font-medium px-2.5 py-1.5 bg-zinc-500/10 text-zinc-400 hover:bg-zinc-500/20 rounded-lg transition-colors">
                                            Descartados ({storageStats.candidates.dropped.length})
                                        </button>
                                    )}
                                    {storageStats.candidates.heavyCompleted.length > 0 && (
                                        <button onClick={optimizeImages} disabled={isProcessingClean} className="text-[10px] font-medium px-2.5 py-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors flex items-center gap-1">
                                            <Minimize2 className="w-3 h-3" /> Optimizar ({storageStats.candidates.heavyCompleted.length})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Backup Section */}
                        <div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Respaldo
                            </h3>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => { onExportBackup(); showToast("Generando backup...", "info"); }}
                                    className="w-full px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl text-sm text-white font-medium transition-colors flex items-center gap-3"
                                >
                                    <Download className="w-4 h-4 text-emerald-400" />
                                    Descargar Copia Privada
                                </button>
                                <button 
                                    onClick={triggerImportBackup}
                                    className="w-full px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl text-sm text-white font-medium transition-colors flex items-center gap-3"
                                >
                                    <Upload className="w-4 h-4 text-blue-400" />
                                    Restaurar Backup
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleBackupFileChange} onClick={handleInputClick} className="hidden" accept=".json,application/json" />
                            </div>
                        </div>

                        {/* Catalog Section */}
                        <div>
                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <Share2 className="w-3.5 h-3.5" /> Compartir
                            </h3>
                            <div className="space-y-2">
                                <button 
                                    onClick={() => { onExportCatalog(); showToast("Generando catálogo...", "info"); }}
                                    className="w-full px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl text-sm text-white font-medium transition-colors flex items-center gap-3"
                                >
                                    <FileJson className="w-4 h-4 text-orange-400" />
                                    Exportar Lista Pública
                                </button>
                                <button 
                                    onClick={triggerImportCatalog}
                                    className="w-full px-4 py-3 bg-zinc-800/50 hover:bg-zinc-800 ring-1 ring-white/[0.06] rounded-xl text-sm text-white font-medium transition-colors flex items-center gap-3"
                                >
                                    <Upload className="w-4 h-4 text-purple-400" />
                                    Importar / Fusionar
                                </button>
                                <input type="file" ref={catalogInputRef} onChange={handleCatalogFileChange} onClick={handleInputClick} className="hidden" accept=".json,application/json" />
                            </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="pt-2">
                            <button 
                                onClick={() => setShowClearLibraryConfirm(true)}
                                className="w-full px-4 py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl text-sm text-red-400 font-medium transition-colors flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Eliminar Biblioteca
                            </button>
                        </div>

                        {/* Clear Library Confirmation */}
                        {showClearLibraryConfirm && (
                            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-[#1C1C1F] ring-1 ring-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center">
                                    <Trash2 className="w-10 h-10 text-red-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-white mb-2">¿Borrar TODO?</h3>
                                    <p className="text-sm text-zinc-400 mb-6">
                                        Perderás el progreso de <strong>todas</strong> tus obras.
                                    </p>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setShowClearLibraryConfirm(false)}
                                            className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors text-sm font-medium"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={confirmClearLibrary}
                                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-bold"
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
                    <div className="space-y-6 animate-fade-in">
                        {/* API Key */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Key className="w-3.5 h-3.5" /> Gemini API Key
                            </label>
                            <input 
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:ring-white/20 outline-none transition-all font-mono"
                                placeholder="sk-..."
                            />
                            <p className="text-[11px] text-zinc-500 mt-1.5">
                                Para buscar información de nuevas obras.
                            </p>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Contraseña
                            </label>
                            
                            {userProfile.password ? (
                                <div className="flex items-center justify-between p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-3">
                                    <span className="text-sm text-emerald-400 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Activa
                                    </span>
                                    <button 
                                        onClick={requestRemovePassword}
                                        className="text-xs text-red-400 hover:text-red-300"
                                    >
                                        Eliminar
                                    </button>
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-500 mb-3">Sin contraseña establecida.</p>
                            )}

                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="w-full bg-zinc-900/50 ring-1 ring-white/[0.06] rounded-xl px-4 py-3 text-sm text-white focus:ring-white/20 outline-none transition-all pr-10"
                                    placeholder={userProfile.password ? "Nueva contraseña..." : "Establecer contraseña..."}
                                />
                                <button 
                                    type="button" 
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                                </button>
                            </div>
                        </div>

                        <button 
                            onClick={handleSaveSecurity}
                            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-zinc-200 text-zinc-900 font-bold py-3 rounded-xl transition-colors"
                        >
                            <Save className="w-4 h-4" />
                            Guardar Cambios
                        </button>

                        {/* Password Confirm */}
                        {showDeletePasswordConfirm && (
                            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                                <div className="bg-[#1C1C1F] ring-1 ring-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full text-center">
                                    <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-3" />
                                    <h3 className="text-lg font-bold text-white mb-2">¿Eliminar Contraseña?</h3>
                                    <p className="text-sm text-zinc-400 mb-6">
                                        Cualquiera podrá ver tu biblioteca.
                                    </p>
                                    <div className="flex gap-3">
                                        <button 
                                            onClick={() => setShowDeletePasswordConfirm(false)}
                                            className="flex-1 px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-xl hover:bg-zinc-700 transition-colors text-sm font-medium"
                                        >
                                            Cancelar
                                        </button>
                                        <button 
                                            onClick={confirmRemovePassword}
                                            className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-bold"
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
