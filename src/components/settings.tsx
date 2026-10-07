import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  Save, 
  Settings as SettingsIcon, 
  Cpu, 
  Radio, 
  EyeOff, 
  FileText,
  User,
  Key,
  Clock,
  Calendar,
  Eye,
  Copy,
  Check,
  ShieldCheck,
  MessageSquare,
  Wand2,
  ArrowLeft
} from "lucide-react";
import { Settings, ExecutorType, PlatformType, ObfuscationType, UiLibPreferenceType } from "../types.js";

interface SettingsProps {
  initialSettings: Settings;
  onSave: (settings: Settings) => Promise<void>;
  isSaving: boolean;
  activeKeyDetails?: {
    keyId: string;
    notes?: string;
    expiresAt: string;
    status: string;
    createdAt?: string;
  } | null;
  stats?: {
    totalConversations: number;
    totalMessages: number;
    totalScripts: number;
  } | null;
  onBackToChat?: () => void;
}

export function SettingsPage({ 
  initialSettings, 
  onSave, 
  isSaving,
  activeKeyDetails,
  stats,
  onBackToChat
}: SettingsProps) {
  const [formData, setFormData] = useState<Settings>(initialSettings);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [showKeyId, setShowKeyId] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setFormData(initialSettings);
  }, [initialSettings]);

  const handleChange = (key: keyof Settings, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
      setMessage({ text: "Perfis e configurações salvos com sucesso!", type: "success" });
      setTimeout(() => setMessage(null), 3500);
    } catch {
      setMessage({ text: "Falha ao salvar as configurações.", type: "error" });
    }
  };

  const handleCopyKey = () => {
    if (activeKeyDetails?.keyId) {
      navigator.clipboard.writeText(activeKeyDetails.keyId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Helper remaining hours text
  const getRemainingTimeText = (expiresAt: string) => {
    if (!expiresAt) return "Buscando informações...";
    if (expiresAt === "infinite") return "Infinity (Vitalício)";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expirado";

    const totalMinutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h restantes`;
    }
    return `${hours}h ${mins}m restantes`;
  };

  const getClientSystemInfo = () => {
    const ua = navigator.userAgent;
    let os = "Sistema Luau";
    if (ua.indexOf("Win") !== -1) os = "Windows OS";
    else if (ua.indexOf("Mac") !== -1) os = "macOS";
    else if (ua.indexOf("Linux") !== -1) os = "Linux Engine";
    else if (ua.indexOf("Android") !== -1) os = "Android Platform";
    else if (ua.indexOf("like Mac") !== -1) os = "iOS Platform";

    let browser = "Navegador Web";
    if (ua.indexOf("Chrome") !== -1) browser = "Google Chrome";
    else if (ua.indexOf("Firefox") !== -1) browser = "Mozilla Firefox";
    else if (ua.indexOf("Safari") !== -1 && ua.indexOf("Chrome") === -1) browser = "Apple Safari";
    else if (ua.indexOf("Edge") !== -1 || ua.indexOf("Edg") !== -1) browser = "Microsoft Edge";

    return `${os} via ${browser}`;
  };

  return (
    <div id="settings-view" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#07070a]">
      {/* Header */}
      <header className="h-13 border-b border-[#1a1a24] bg-[#0a0a0f] flex items-center px-6 shrink-0 justify-between">
        <div className="flex items-center gap-3">
          {onBackToChat && (
            <button
              id="settings-back-btn"
              onClick={onBackToChat}
              className="p-1 px-2.5 rounded-lg bg-[#10111f] border border-[#1c1d32] text-slate-300 hover:text-white hover:bg-slate-800 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              title="Voltar para o Chat"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-violet-400" />
            <h1 className="font-semibold text-slate-100 text-sm">Configuração de Desenvolvimento</h1>
          </div>
        </div>
        <div className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded">
          Roblox API Profile Engine
        </div>
      </header>

      {/* Main Settings Form */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-8">
          
          {/* USER AND LICENSE SECTIONS */}
          <div className="bg-[#0b0c15] border border-[#17192b] rounded-2xl p-5 md:p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-[#1b1d35] pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">Painel do Usuário & Licença</h2>
                  <p className="text-[10px] text-gray-500">Monitoramento ativo de cotas e acesso</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Modo Seguro</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* CARD 1: LICENSE DETAILS */}
              <div className="bg-[#10111f] border border-[#1c1d32] rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    Chave de Acesso
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => setShowKeyId(!showKeyId)}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                      title={showKeyId ? "Ocultar Chave" : "Mostrar Chave"}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      onClick={handleCopyKey}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition-colors"
                      title="Copiar Chave"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-200 truncate" title={activeKeyDetails?.notes}>
                    {activeKeyDetails?.notes || "Carregando..."}
                  </p>
                  <p className="text-[10px] font-mono text-slate-500 break-all select-all">
                    {activeKeyDetails?.keyId 
                      ? (showKeyId ? activeKeyDetails.keyId : `${activeKeyDetails.keyId.substring(0, 8)}••••••••••••••••`)
                      : "offline-demo-key"
                    }
                  </p>
                </div>
              </div>

              {/* CARD 2: EXPIRATION TIME */}
              <div className="bg-[#10111f] border border-[#1c1d32] rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Tempo Restante
                  </span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded">
                    Ativa
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-300">
                    {activeKeyDetails ? getRemainingTimeText(activeKeyDetails.expiresAt) : "Calculando tempo..."}
                  </p>
                  <p className="text-[9px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-2.5 h-2.5" />
                    <span>
                      Válida até: {activeKeyDetails?.expiresAt === "infinite" 
                        ? "Vitalício" 
                        : (activeKeyDetails?.expiresAt ? new Date(activeKeyDetails.expiresAt).toLocaleString("pt-BR") : "N/A")
                      }
                    </span>
                  </p>
                </div>
              </div>

              {/* CARD 3: CLIENT & USER PLATFORM */}
              <div className="bg-[#10111f] border border-[#1c1d32] rounded-xl p-4 flex flex-col justify-between space-y-3 md:col-span-2 lg:col-span-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-semibold flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Dispositivo Local
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-200 truncate">
                    {getClientSystemInfo()}
                  </p>
                  <p className="text-[9px] text-slate-500 font-mono">
                    IP Seguro / TLS Ativo
                  </p>
                </div>
              </div>

            </div>

            {/* CARD 4: CONVERSATION & MESSAGE STATS */}
            {stats && (
              <div className="bg-[#10111f]/60 border border-[#1c1d32]/60 rounded-xl p-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mb-3 flex items-center gap-1.5">
                  <Wand2 className="w-3 h-3 text-violet-400" />
                  Estatísticas de Copiloto da Conta
                </p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[#0b0c15]/50 border border-[#17192c] py-2 rounded-lg">
                    <div className="text-base font-bold text-slate-200 leading-none">{stats.totalConversations}</div>
                    <div className="text-[9.2px] text-slate-500 font-medium mt-1">Sessões Virtuais</div>
                  </div>
                  <div className="bg-[#0b0c15]/50 border border-[#17192c] py-2 rounded-lg">
                    <div className="text-base font-bold text-violet-400 leading-none">{stats.totalMessages}</div>
                    <div className="text-[9.2px] text-slate-500 font-medium mt-1">Instruções Enviadas</div>
                  </div>
                  <div className="bg-[#0b0c15]/50 border border-[#17192c] py-2 rounded-lg">
                    <div className="text-base font-bold text-amber-400 leading-none">{stats.totalScripts}</div>
                    <div className="text-[9.2px] text-slate-500 font-medium mt-1">Scripts Luau</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {message && (
              <div
                id="settings-status-alert"
                className={`p-4 rounded-xl border text-sm flex items-center gap-2 ${
                  message.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                <span>{message.text}</span>
              </div>
            )}

          {/* Quick Notice Card */}
          <div className="p-4 rounded-xl border border-violet-500/10 bg-gradient-to-r from-violet-600/5 to-transparent flex gap-3 text-xs leading-relaxed text-slate-400">
            <ShieldAlert className="w-5 h-5 text-violet-400 shrink-0" />
            <div>
              <strong className="text-slate-100 font-medium block mb-0.5">Executor Virtual Ativado</strong>
              Ao alterar as preferências de executor, o RobloxAI se adapta automaticamente injetando instruções de compatibilidade de APIs específicas (tais como <code className="text-violet-300">getgenv()</code>, hooks de metatabela ou bibliotecas de interface) no motor de IA.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            
            {/* Target Executor */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500" /> Executor Alvo
              </label>
              <select
                id="select-executor"
                value={formData.executor}
                onChange={(e) => handleChange("executor", e.target.value)}
                className="w-full h-11 bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="Synapse X">Synapse X (syn.request, syn.protect_gui)</option>
                <option value="KRNL">KRNL (getgenv, loadstring, custom cache)</option>
                <option value="Fluxus">Fluxus (fluxus.request, getinstancestate)</option>
                <option value="Delta">Delta (mobile click, virtual touch keys)</option>
                <option value="Hydrogen">Hydrogen (cloneref, secure execution)</option>
                <option value="Custom">Custom Executor (APIs Genéricas Luau)</option>
              </select>
            </div>

            {/* Target Platform */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-slate-500" /> Plataforma Alvo
              </label>
              <select
                id="select-platform"
                value={formData.platform}
                onChange={(e) => handleChange("platform", e.target.value)}
                className="w-full h-11 bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="PC">PC (Teclado, Mouse, FPS Otimizado)</option>
                <option value="Mobile">Mobile (Touch, Interface Escalável, Otimizado para Desempenho)</option>
                <option value="Console">Console (Controle / Gamepad, Raycasts Adaptados)</option>
              </select>
            </div>

            {/* Obfuscation Level */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <EyeOff className="w-3.5 h-3.5 text-slate-500" /> Nível de Ofuscação
              </label>
              <select
                id="select-obfuscation"
                value={formData.obfuscation}
                onChange={(e) => handleChange("obfuscation", e.target.value)}
                className="w-full h-11 bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="None">Nenhuma (Código Limpo e Comentado)</option>
                <option value="Light">Leve (Troca de variáveis por hashes de 1 caractere, lzw)</option>
                <option value="Heavy">Pesada (Virtualização de código, empacotadores de metatabela)</option>
              </select>
            </div>

            {/* UI Library preference */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" /> Biblioteca de GUI Preferida
              </label>
              <select
                id="select-ui"
                value={formData.uiLibPreference}
                onChange={(e) => handleChange("uiLibPreference", e.target.value)}
                className="w-full h-11 bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              >
                <option value="None">Nenhuma (GUI nativa pura do zero em ScreenGui)</option>
                <option value="Rayfield">Rayfield API UI Library (Bordas arredondadas e Key System)</option>
                <option value="Fluent">Fluent UI Library (Aparência Windows Fluida e moderna)</option>
                <option value="Orion">Orion UI Library (Tema escuro neon clássico e rápido)</option>
                <option value="Custom">Custom Framework (GUI com abas redefinível)</option>
              </select>
            </div>

            {/* Roblox Version */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Versão do Roblox
              </label>
              <input
                type="text"
                id="input-roblox-version"
                value={formData.robloxVersion}
                onChange={(e) => handleChange("robloxVersion", e.target.value)}
                placeholder="Ex: Latest / V610"
                className="w-full h-11 bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>

            {/* Script style */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                Estilo de Codificação
              </label>
              <input
                type="text"
                id="input-script-style"
                value={formData.scriptStyle}
                onChange={(e) => handleChange("scriptStyle", e.target.value)}
                placeholder="Ex: Clean, Object-Oriented, Under 100 lines"
                className="w-full h-11 bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              />
            </div>

          </div>

          {/* Custom API Keys Pool */}
          <div className="space-y-2 font-sans">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest block">
              Pool de Chaves API do Gemini (Backup)
            </label>
            <textarea
              id="textarea-custom-api-keys"
              value={formData.customApiKeys || ""}
              onChange={(e) => handleChange("customApiKeys", e.target.value)}
              placeholder="Cole chaves adicionais do Gemini (uma por linha ou separadas por vírgula) para prevenção automática de limites de cota..."
              className="w-full min-h-[90px] bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg p-3 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
            />
            <p className="text-[10px] text-slate-500">
              O sistema detecta automaticamente se uma chave atingiu o limite gratuito de cota e troca instantaneamente para a próxima da lista, sem interromper as suas gerações de scripts.
            </p>
          </div>

          {/* Extra system prompt Instructions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Instruções Customizadas Extras da IA
            </label>
            <textarea
              id="textarea-extra-instructions"
              value={formData.systemPromptExtra}
              onChange={(e) => handleChange("systemPromptExtra", e.target.value)}
              placeholder="Instruções adicionais que você quer injetar no contexto da IA... Ex: Sempre use task.defer() para guis ou prefira usar pcall em todos os remote hooks."
              className="w-full min-h-[140px] bg-[#101018] border border-[#1a1a24] text-slate-200 text-xs rounded-lg p-3 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
            />
            <p className="text-[10px] text-slate-500">
              Essas diretrizes adicionais são inseridas no fim das instruções de controle da IA.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              id="save-settings-btn"
              disabled={isSaving}
              className="w-full md:w-auto h-11 px-8 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all active:scale-95 duration-150 cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Gravando Configurações..." : "Salvar Configurações"}
            </button>
          </div>

        </form>
        </div>
      </div>
    </div>
  );
}
