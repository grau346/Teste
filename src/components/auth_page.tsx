import React, { useState, useEffect } from "react";
import { db, handleFirestoreError, OperationType } from "../firebase.js";
import { ChatPage } from "./chat.js";
import { UsageLogsPanel } from "./usage_logs_panel.js";
import { Conversation } from "../types.js";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy 
} from "firebase/firestore";
import { 
  Key, 
  Lock, 
  Trash2, 
  Plus, 
  LogOut, 
  ArrowLeft, 
  Check, 
  Copy, 
  Clock, 
  AlertCircle, 
  Calendar, 
  ShieldAlert,
  Terminal,
  Activity,
  Heart,
  Bot,
  Search
} from "lucide-react";

interface AuthPageProps {
  onUnlock: (key: string) => void;
}

interface AccessKey {
  keyId: string;
  createdAt: string;
  expiresAt: string;
  durationHours: number;
  notes: string;
  status: string;
}

export function AuthPage({ onUnlock }: AuthPageProps) {
  // Key state
  const [enteredKey, setEnteredKey] = useState("");
  const [isVerifyingKey, setIsVerifyingKey] = useState(false);
  const [keyError, setKeyError] = useState("");

  // Mode state
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Admin Auth state
  const [adminPassword, setAdminPassword] = useState("");
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminSuccess, setAdminSuccess] = useState("");

  // Key operations
  const [keysList, setKeysList] = useState<AccessKey[]>([]);
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [durationHours, setDurationHours] = useState<number>(24);
  const [keyNotes, setKeyNotes] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Admin Chat state
  const [adminSubTab, setAdminSubTab] = useState<"keys" | "chat" | "logs">("keys");
  const [adminConversations, setAdminConversations] = useState<Conversation[]>([]);
  const [adminActiveConvId, setAdminActiveConvId] = useState<number | null>(null);
  const [confirmAdminDeleteId, setConfirmAdminDeleteId] = useState<number | null>(null);
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null);

  const fetchAdminConversations = async () => {
    try {
      const res = await fetch("/api/conversations", {
        headers: { "x-user-key": "admin" }
      });
      const data = await res.json();
      setAdminConversations(data);
    } catch (err) {
      console.error("Error fetching admin chats:", err);
    }
  };

  const handleAdminNewChat = async () => {
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-key": "admin"
        },
        body: JSON.stringify({ title: "Nova Conversa Admin" })
      });
      const newConv = await res.json();
      setAdminActiveConvId(newConv.id);
      await fetchAdminConversations();
    } catch (err) {
      console.error("Error creating admin chat:", err);
    }
  };

  useEffect(() => {
    if (isAdminAuthenticated && adminSubTab === "chat") {
      fetchAdminConversations();
    }
  }, [isAdminAuthenticated, adminSubTab]);

  // Check persistent admin session
  useEffect(() => {
    const isAuth = sessionStorage.getItem("admin_authenticated_session");
    if (isAuth === "true") {
      setIsAdminAuthenticated(true);
      fetchKeys();
    }
  }, []);

  // Fetch keys from firestore
  const fetchKeys = async () => {
    setIsLoadingKeys(true);
    try {
      const q = query(collection(db, "access_keys"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const keys: AccessKey[] = [];
      snapshot.forEach((doc) => {
        keys.push(doc.data() as AccessKey);
      });
      setKeysList(keys);
    } catch (err: any) {
      console.error("Error fetching keys:", err);
      try {
        handleFirestoreError(err, OperationType.LIST, "access_keys");
      } catch (e) {
        // Handled formatted console error
      }
    } finally {
      setIsLoadingKeys(false);
    }
  };

  // Helper to generate key formats (RAI-XXXX-XXXX-XXXX)
  const generateKeyId = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let p1 = "";
    let p2 = "";
    let p3 = "";
    for (let i = 0; i < 4; i++) {
      p1 += chars.charAt(Math.floor(Math.random() * chars.length));
      p2 += chars.charAt(Math.floor(Math.random() * chars.length));
      p3 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `RAI-${p1}-${p2}-${p3}`;
  };

  // Create Key handler
  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminAuthenticated) return;
    setIsGenerating(true);
    setAdminError("");

    const newKeyId = generateKeyId();
    const now = new Date();
    let expiresAt = "infinite";

    if (durationHours !== -1) {
      expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000).toISOString();
    }

    const keyObj: AccessKey = {
      keyId: newKeyId,
      createdAt: now.toISOString(),
      expiresAt,
      durationHours,
      notes: keyNotes.trim() || "Chave de acesso",
      status: "active"
    };

    try {
      await setDoc(doc(db, "access_keys", newKeyId), keyObj);
      setKeyNotes("");
      setAdminSuccess(`Chave ${newKeyId} gerada com sucesso!`);
      // Update local keys list
      setKeysList((prev) => [keyObj, ...prev]);
      
      // Auto-clear success banner
      setTimeout(() => setAdminSuccess(""), 4000);
    } catch (err: any) {
      setAdminError("Erro ao criar chave no Firestore secundário.");
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.CREATE, `access_keys/${newKeyId}`);
      } catch (e) {
        // Handled formatted console error
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete key handler
  const handleDeleteKey = async (keyId: string) => {
    try {
      await deleteDoc(doc(db, "access_keys", keyId));
      setKeysList((prev) => prev.filter((k) => k.keyId !== keyId));
      setAdminSuccess("Chave deletada com sucesso!");
      setTimeout(() => setAdminSuccess(""), 3000);
    } catch (err) {
      setAdminError("Erro ao remover chave.");
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.DELETE, `access_keys/${keyId}`);
      } catch (e) {
        // Handled formatted console error
      }
    }
  };

  // Verify and Claim key handler (FIRST PAGE)
  const handleVerifyKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = enteredKey.trim();
    if (!cleanKey) {
      setKeyError("Por favor, digite uma chave de acesso.");
      return;
    }

    setIsVerifyingKey(true);
    setKeyError("");

    try {
      const docRef = doc(db, "access_keys", cleanKey);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as AccessKey;

        // Verify expiration
        if (data.expiresAt !== "infinite" && new Date(data.expiresAt) < new Date()) {
          setKeyError("Esta chave de acesso já expirou.");
          return;
        }

        if (data.status === "active") {
          // Successful key claim! Save to localStorage
          localStorage.setItem("user_access_key", cleanKey);
          onUnlock(cleanKey);
        } else {
          setKeyError("Essa chave está inativa ou suspensa.");
        }
      } else {
        setKeyError("Chave de acesso inválida ou inexistente.");
      }
    } catch (err: any) {
      setKeyError("Falha ao comunicar com o servidor de licenças. Tente reiniciar.");
      console.error(err);
      try {
        handleFirestoreError(err, OperationType.GET, `access_keys/${cleanKey}`);
      } catch (e) {
        // Handled formatted console error
      }
    } finally {
      setIsVerifyingKey(false);
    }
  };

  // Secure API-based Admin Authentication
  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError("");
    setAdminSuccess("");

    if (!adminPassword) {
      setAdminError("Insira a senha do administrador.");
      return;
    }

    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        sessionStorage.setItem("admin_authenticated_session", "true");
        setIsAdminAuthenticated(true);
        setAdminSuccess("Acesso administrador autorizado!");
        setAdminPassword("");
        fetchKeys();
      } else {
        setAdminError(result.error || "Senha inválida ou incorreta.");
      }
    } catch (err: any) {
      setAdminError("Falha operacional no servidor de validação.");
      console.error(err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Admin Logout action
  const handleAdminLogout = () => {
    sessionStorage.removeItem("admin_authenticated_session");
    setIsAdminAuthenticated(false);
    setAdminSuccess("Sessão finalizada com sucesso.");
    setKeysList([]);
    setTimeout(() => setAdminSuccess(""), 2000);
  };

  // Helper to copy text to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(text);
    setTimeout(() => setCopiedKeyId(null), 2500);
  };

  // Helper remaining hours text
  const getRemainingTimeText = (expiresAt: string) => {
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

  const filteredKeysList = keysList.filter((k) => {
    if (!adminSearchQuery) return true;
    const queryStr = adminSearchQuery.toLowerCase().trim();
    const notesMatch = k.notes ? k.notes.toLowerCase().includes(queryStr) : false;
    const keyMatch = k.keyId ? k.keyId.toLowerCase().includes(queryStr) : false;
    return notesMatch || keyMatch;
  });

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between items-center bg-[#07070a] text-gray-200 font-sans p-4 relative overflow-y-auto">
      {/* Decorative background grid and ambient lighting */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f16_1px,transparent_1px),linear-gradient(to_bottom,#0f0f16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/8 right-10 w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Top logo header */}
      <header className="w-full max-w-sm flex flex-col items-center pt-8 pb-4 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-indigo-600 flex items-center justify-center border border-indigo-400/20 shadow-[0_0_20px_rgba(79,70,229,0.3)] mb-3">
          <Terminal className="text-white w-6 h-6 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-indigo-200 tracking-tight">
          Roblox AI Suite
        </h1>
        <p className="text-xs text-gray-400/80 mt-1 uppercase tracking-widest font-mono">
          Sistema de Proteção e Licenças
        </p>
      </header>

      {/* Main Interactive Dialog Card */}
      <main className="w-full max-w-4xl flex items-center justify-center my-6 relative z-10">
        {!isAdminMode ? (
          /* SECTION 1: STANDARD CLIENT KEY VALIDATION VIEW */
          <div className="w-full max-w-md bg-[#0d0d15]/95 border border-[#1b1c2b] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.8)] rounded-2xl p-6 relative backdrop-blur-md transition-all duration-300">
            <h2 className="text-lg font-semibold text-white tracking-wide mb-1 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              Liberar Software (Key)
            </h2>
            <p className="text-xs text-gray-400 mb-6 font-sans">
              Insira a chave de verificação correta gerada por um administrador para desbloquear o uso da IA e do Descompilador.
            </p>

            <form onSubmit={handleVerifyKey} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-2 font-mono">
                  Digite sua Key
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Key className="h-4.5 w-4.5" />
                  </div>
                  <input
                    type="text"
                    value={enteredKey}
                    onChange={(e) => {
                      setEnteredKey(e.target.value);
                      if (keyError) setKeyError("");
                    }}
                    placeholder="RAI-XXXX-XXXX-XXXX"
                    className="block w-full pl-10 pr-4 py-3 bg-[#06060a]/90 text-sm border border-[#212338] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all font-mono"
                    disabled={isVerifyingKey}
                  />
                </div>
                {keyError && (
                  <div className="mt-3 p-3 bg-red-950/30 border border-red-500/20 rounded-lg flex items-start gap-2 text-xs text-red-400 anim-fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{keyError}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isVerifyingKey}
                className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-400/10 shadow-[0_4px_12px_rgba(99,102,241,0.2)] hover:shadow-[0_4px_20px_rgba(99,102,241,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                {isVerifyingKey ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Verificando Key...
                  </>
                ) : (
                  <>
                    Validar Chave & Entrar
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#131424] flex items-center justify-between">
              <span className="text-xs text-gray-500 font-sans">Desenvolvido com Firebase</span>
              <button
                onClick={() => {
                  setIsAdminMode(true);
                  setKeyError("");
                  setAdminError("");
                }}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors hover:underline cursor-pointer font-sans"
              >
                Painel do Administrador
              </button>
            </div>
          </div>
        ) : !isAdminAuthenticated ? (
          /* SECTION 2: ADMIN SECURE LOGIN - SINGLE SECURE ACCESS PASSWORD */
          <div className="w-full max-w-sm bg-[#0d0d15]/95 border border-[#1b1c2b] shadow-2xl rounded-2xl p-6 relative backdrop-blur-md">
            <button
              onClick={() => {
                setIsAdminMode(false);
                setAdminError("");
                setAdminSuccess("");
              }}
              className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors h-8 w-8 rounded-lg flex items-center justify-center bg-[#151624]/50 hover:bg-[#1a1b30] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="text-center mt-6 mb-6">
              <h2 className="text-lg font-bold text-white flex items-center justify-center gap-2">
                <ShieldAlert className="w-5 h-5 text-indigo-400" />
                Painel de Gestão
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Insira a senha mestra segura do administrador para acessar o gerador de chaves.
              </p>
            </div>

            <form onSubmit={handleAdminAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1 font-mono">
                  Senha Secreta do ADM
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Sua senha secreta do servidor"
                    className="block w-full pl-10 pr-3 py-2.5 bg-[#06060a]/90 text-sm border border-[#212338] rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                  />
                </div>
              </div>

              {adminError && (
                <div className="p-3 bg-red-950/20 border border-red-500/10 rounded-xl flex items-start gap-2 text-xs text-red-400 anim-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminError}</span>
                </div>
              )}

              {adminSuccess && (
                <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded-xl flex items-start gap-2 text-xs text-emerald-400 anim-fade-in">
                  <Check className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{adminSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed border border-indigo-400/10 shadow-lg cursor-pointer transition-all font-sans"
              >
                {isLoggingIn ? "Autenticando..." : "Desbloquear Painel"}
              </button>
            </form>
          </div>
        ) : (
          /* SECTION 3: EXPANDED ADMIN ACCESS KEY COMMAND CENTER */
          <div className="w-full max-w-6xl bg-[#0d0d15]/95 border border-[#1b1c2b] shadow-2xl rounded-2xl p-6 relative backdrop-blur-md flex flex-col gap-6 animate-fade-in">
            {/* Admin Header with Tab Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1b1c2b] pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-indigo-400" />
                <div>
                  <h2 className="text-lg font-bold text-white font-sans tracking-tight">Painel de Administração</h2>
                  <p className="text-xs text-gray-400 font-sans">Gerenciamento de chaves e utilitários de IA</p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/* Sub tabs switcher */}
                <div className="flex bg-[#07070d] p-1 rounded-xl border border-[#212338]/60 transition-all flex-wrap">
                  <button
                    onClick={() => setAdminSubTab("keys")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      adminSubTab === "keys"
                        ? "bg-indigo-600 text-white shadow-md font-bold"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Gerenciador de Chaves
                  </button>
                  <button
                    onClick={() => setAdminSubTab("chat")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      adminSubTab === "chat"
                        ? "bg-indigo-600 text-white shadow-md font-bold"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Chat com IA (Admin)
                  </button>
                  <button
                    onClick={() => setAdminSubTab("logs")}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                      adminSubTab === "logs"
                        ? "bg-indigo-600 text-white shadow-md font-bold"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    Métricas & Logs
                  </button>
                </div>

                <button
                  onClick={handleAdminLogout}
                  title="Sair do Administrador"
                  className="p-2 bg-red-950/20 border border-red-500/10 text-red-400 hover:bg-red-900/30 hover:text-red-300 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 text-xs font-bold"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: KEYS KEYSET LIST */}
            {adminSubTab === "keys" ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left controls column */}
                <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-[#191a2e] pb-6 md:pb-0 md:pr-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono">Nova Chave</h3>
                      <p className="text-[11px] text-gray-500 font-sans">Cadastrada instantaneamente no Firebase</p>
                    </div>
                  </div>

                  <form onSubmit={handleGenerateKey} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 font-mono">
                        Escolher Horário / Tempo
                      </label>
                      <select
                        value={durationHours}
                        onChange={(e) => setDurationHours(Number(e.target.value))}
                        className="block w-full py-2.5 px-3 bg-[#06060a] border border-[#212338] rounded-xl text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                      >
                        <option value={1}>1 Hora</option>
                        <option value={6}>6 Horas</option>
                        <option value={12}>12 Horas</option>
                        <option value={24}>24 Horas (1 Dia)</option>
                        <option value={168}>7 Dias (1 Semana)</option>
                        <option value={720}>30 Dias (1 Mês)</option>
                        <option value={2160}>90 Dias (3 Meses)</option>
                        <option value={8760}>1 Ano</option>
                        <option value={-1}>Infinito (Vitalício)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 font-mono">
                        Nome / Descrição (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Usuário Pedro, Revenda..."
                        value={keyNotes}
                        onChange={(e) => setKeyNotes(e.target.value)}
                        className="block w-full py-2.5 px-3 bg-[#06060a] border border-[#212338] text-sm rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isGenerating}
                      className="w-full py-2.5 px-4 bg-[#4f46e5] hover:bg-[#4338ca] text-white text-sm font-semibold rounded-xl border border-indigo-400/10 shadow-[0_4px_12px_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="w-4 h-4" />
                      {isGenerating ? "Registrando no Firebase..." : "Gerar Nova Key"}
                    </button>
                  </form>

                  {adminSuccess && (
                    <div className="p-3 bg-emerald-950/20 border border-emerald-500/10 rounded-xl text-xs text-emerald-400 flex items-start gap-1.5 anim-fade-in">
                      <Check className="w-4.5 h-4.5 shrink-0 text-emerald-400" />
                      <span>{adminSuccess}</span>
                    </div>
                  )}

                  {adminError && (
                    <div className="p-3 bg-red-950/20 border border-red-500/10 rounded-xl text-xs text-red-400 flex items-start gap-1.5 anim-fade-in">
                      <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                      <span>{adminError}</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setIsAdminMode(false);
                      setAdminError("");
                      setAdminSuccess("");
                    }}
                    className="w-full py-2.5 px-4 bg-[#141524] hover:bg-[#1b1c35] text-gray-300 text-xs font-medium rounded-xl border border-gray-700/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar para Tela de Login de Key
                  </button>
                </div>

                {/* Right keys table list */}
                <div className="md:col-span-2 flex flex-col h-[400px]">
                  <div className="flex items-center justify-between mb-3 text-sm">
                    <h3 className="font-bold text-gray-100 flex items-center gap-1.5 font-sans">
                      <Activity className="w-4.5 h-4.5 text-indigo-400" />
                      Acompanhamento de Chaves ({keysList.length})
                    </h3>
                    <button
                      onClick={fetchKeys}
                      disabled={isLoadingKeys}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-mono hover:underline cursor-pointer"
                    >
                      {isLoadingKeys ? "Atualizando..." : "Sincronizar"}
                    </button>
                  </div>

                  {keysList.length > 0 && (
                    <div className="relative mb-3 flex-shrink-0">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-3.5 w-3.5 text-gray-500" />
                      </div>
                      <input
                        type="text"
                        placeholder="Pesquisar por notas ou ID da Key..."
                        value={adminSearchQuery}
                        onChange={(e) => setAdminSearchQuery(e.target.value)}
                        className="block w-full pl-9 pr-12 py-2 bg-[#0c0d18] border border-[#212338] rounded-xl text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all font-sans"
                      />
                      {adminSearchQuery && (
                        <button
                          onClick={() => setAdminSearchQuery("")}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] text-gray-400 hover:text-gray-200 cursor-pointer font-sans"
                        >
                          Limpar
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex-1 overflow-y-auto pr-1 space-y-2 border border-[#212338]/30 rounded-xl bg-[#06060a]/50 p-2">
                    {isLoadingKeys ? (
                      <div className="h-full flex items-center justify-center text-xs text-gray-500">
                        Sincronizando dados com o Firestore...
                      </div>
                    ) : keysList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-gray-500 p-8 text-center space-y-2">
                        <Key className="w-8 h-8 text-gray-700 stroke-1 animate-pulse" />
                        <span>Nenhuma key gerada ainda. Use o painel esquerdo para registrar chaves de acesso.</span>
                      </div>
                    ) : filteredKeysList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-xs text-gray-500 p-8 text-center space-y-2">
                        <Search className="w-8 h-8 text-gray-600 stroke-1" />
                        <span>Nenhuma key corresponde à pesquisa "{adminSearchQuery}".</span>
                      </div>
                    ) : (
                      filteredKeysList.map((k) => (
                        <div 
                          key={k.keyId} 
                          className="p-3 bg-[#0c0d18] border border-[#1f2038]/60 hover:border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                        >
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-indigo-300 font-bold tracking-tight bg-indigo-950/20 px-2 py-0.5 rounded font-mono border border-indigo-950/40 select-all">
                                {k.keyId}
                              </code>
                              <button
                                onClick={() => copyToClipboard(k.keyId)}
                                className="text-gray-500 hover:text-indigo-400 transition-colors inline-flex cursor-pointer"
                                title="Copiar Key"
                              >
                                {copiedKeyId === k.keyId ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono leading-none ${
                                k.status === "active" && (k.expiresAt === "infinite" || new Date(k.expiresAt) > new Date())
                                  ? "bg-emerald-990/10 text-emerald-400 border border-emerald-800/10"
                                  : "bg-red-950/20 text-red-400 border border-red-900/10"
                              }`}>
                                {k.status === "active" && (k.expiresAt === "infinite" || new Date(k.expiresAt) > new Date()) 
                                  ? "Ativa" 
                                  : "Expirada"}
                              </span>
                            </div>

                            <div className="flex text-[10px] text-gray-400 gap-y-1 gap-x-3 flex-wrap">
                              <span className="flex items-center gap-1 font-sans">
                                <b>Nota:</b> {k.notes}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                {getRemainingTimeText(k.expiresAt)}
                              </span>
                              <span className="flex items-center gap-1 font-mono">
                                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                                {new Date(k.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (confirmDeleteKeyId !== k.keyId) {
                                setConfirmDeleteKeyId(k.keyId);
                                setTimeout(() => setConfirmDeleteKeyId(null), 3000);
                              } else {
                                handleDeleteKey(k.keyId);
                                setConfirmDeleteKeyId(null);
                              }
                            }}
                            className={`p-1.5 rounded-lg transition-all shrink-0 cursor-pointer border ${
                              confirmDeleteKeyId === k.keyId
                                ? "text-red-400 bg-red-950 border-red-500 animate-pulse scale-110"
                                : "text-gray-500 hover:text-red-400 hover:bg-red-950/30 border-transparent hover:border-red-500/10"
                            }`}
                            title={confirmDeleteKeyId === k.keyId ? "Clique novamente para confirmar" : "Deletar Key"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : adminSubTab === "logs" ? (
              /* TAB CONTENT: METRICS & TELEMETRY LOGS */
              <UsageLogsPanel />
            ) : (
              /* TAB CONTENT: ADMIN IA CHAT SYSTEM */
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[600px] border border-[#212338]/30 rounded-2xl bg-[#08080f]/80 overflow-hidden relative">
                {/* Conversations List sidebar */}
                <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-[#191a2e] flex flex-col bg-[#07070d]/50 shrink-0 h-full overflow-hidden">
                  <div className="p-3 border-b border-[#191a2e] flex items-center justify-between shrink-0 bg-[#090a12]/50">
                    <span className="text-xs font-bold text-gray-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <Bot className="w-4 h-4 text-indigo-400 animate-pulse" />
                      Históricos (Admin)
                    </span>
                    <button 
                      onClick={handleAdminNewChat}
                      className="p-1 hover:bg-[#121323] text-indigo-400 rounded-lg hover:text-indigo-300 transition-colors cursor-pointer"
                      title="Nova Conversa IA"
                    >
                      <Plus className="w-4.5 h-4.5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {adminConversations.length === 0 ? (
                      <div className="p-6 text-center text-[11px] text-gray-500 italic">Nenhum histórico ativo</div>
                    ) : (
                      adminConversations.map((c) => (
                        <div 
                          key={c.id}
                          onClick={() => setAdminActiveConvId(c.id)}
                          className={`p-2.5 rounded-xl cursor-pointer border transition-all text-xs flex items-center justify-between group ${
                            adminActiveConvId === c.id 
                              ? "bg-indigo-600/15 border-indigo-500/30 text-[#e0e7ff]" 
                              : "border-transparent bg-transparent hover:bg-[#121324]/50 text-gray-400 hover:text-gray-200"
                          }`}
                        >
                          <span className="truncate font-sans font-medium pr-1">{c.title || "Aba de Chat"}</span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirmAdminDeleteId !== c.id) {
                                setConfirmAdminDeleteId(c.id);
                                setTimeout(() => setConfirmAdminDeleteId(null), 3000);
                              } else {
                                try {
                                  await fetch(`/api/conversations/${c.id}`, { 
                                    method: "DELETE", 
                                    headers: { "x-user-key": "admin" } 
                                  });
                                  if (adminActiveConvId === c.id) {
                                    setAdminActiveConvId(null);
                                  }
                                  await fetchAdminConversations();
                                } catch (error) {
                                  console.error("Failed clear index:", error);
                                }
                                setConfirmAdminDeleteId(null);
                              }
                            }}
                            className={`p-1 rounded-md transition-all cursor-pointer shrink-0 ${
                              confirmAdminDeleteId === c.id
                                ? "opacity-100 text-rose-500 bg-rose-500/15 scale-110 ring-1 ring-rose-500/30"
                                : "opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 hover:bg-slate-800"
                            }`}
                            title={confirmAdminDeleteId === c.id ? "Clique novamente para confirmar" : "Deletar Conversa"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Main Active Chat Component Frame */}
                <div className="md:col-span-3 flex flex-col h-full overflow-hidden bg-[#07070a]/90 relative">
                  {adminActiveConvId ? (
                    <div className="flex-1 h-full overflow-hidden flex flex-col">
                      <ChatPage
                        conversationId={adminActiveConvId}
                        onSelectConversation={setAdminActiveConvId}
                        onNewChat={handleAdminNewChat}
                        onToggleSidebar={() => {}} 
                        conversations={adminConversations}
                        onRefreshConversations={fetchAdminConversations}
                        userKey="admin"
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-gray-400 space-y-3">
                      <Bot className="w-10 h-10 text-indigo-400 animate-pulse stroke-1" />
                      <div>
                        <p className="font-semibold text-gray-200 text-sm">Chat com Inteligência Artificial</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Clique em "Nova Conversa" ou selecione canais históricos ao lado</p>
                      </div>
                      <button
                        onClick={handleAdminNewChat}
                        className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-xl text-xs tracking-wide shadow-md shadow-indigo-600/20 transition-all cursor-pointer border border-indigo-400/10"
                      >
                        Iniciar Nova Conversa
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Aesthetic Footer */}
      <footer className="w-full py-4 text-center text-[10px] text-gray-600 tracking-wider font-mono select-none relative z-10 flex items-center justify-center gap-1">
        <span>© 2026 ROBLOX AI SUITE</span>
        <span>•</span>
        <span>AUTENTICAÇÃO INTEGRADA E SEGURA COM FIREBASE FIRESTORE</span>
        <Heart className="w-3 h-3 text-indigo-500 inline fill-indigo-500/20" />
      </footer>
    </div>
  );
}
