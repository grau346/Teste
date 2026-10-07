import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Send, 
  Bot, 
  User, 
  Code2, 
  Paperclip, 
  Copy, 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight, 
  Menu, 
  Zap, 
  Shield, 
  Eye, 
  Gamepad2, 
  Crosshair, 
  Wand2, 
  Image as ImageIcon,
  AlertTriangle,
  Loader,
  FolderOpen,
  FileCode,
  Search,
  FolderUp,
  Play,
  CheckCircle2
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import { Message, Conversation, ExtractedScript } from "../types.js";
import { safeFetchJson } from "../lib/api_helper.js";

// Quick Prompt presets matching SiteIA exactly
const QUICK_PROMPTS = [
  { icon: Eye, label: "ESP Completo", prompt: "Faz um script completo de ESP com caixas, nomes, distância e tracers usando Drawing API ou Highlight" },
  { icon: Crosshair, label: "Silent Aim", prompt: "Cria um silent aim script com configuração de FOV circle, smoothness e whitelist de partes do corpo do adversário" },
  { icon: Zap, label: "Speed / Fly Hack", prompt: "Script de speed hack, fly e infinite jump com toggle de tecla (Ex: F ou X) e configuração de velocidade" },
  { icon: Gamepad2, label: "Auto Farm", prompt: "Faz um autofarm genérico com pathfinding, coleta automática de itens distantes e sistema Anti-AFK" },
  { icon: Shield, label: "Anti-Cheat Bypass", prompt: "Script com estruturas de anti-detecção de kick, hook de remotes perigosos e proteções contra Namecalls" },
  { icon: Wand2, label: "GUI do Zero", prompt: "Cria uma GUI completa com janela arrastável, abas, botões com tween e toggle de fechar/minimizar" },
  { icon: ImageIcon, label: "Copiar GUI da Foto", prompt: "Analise a estrutura de GUI na foto que vou enviar e replique ela puramente em Roblox Luau utilizando coordenadas UDim2 e TweenService" },
  { icon: Code2, label: "Analisar Script", prompt: "Vou colar um script abaixo. Analise bugs, nil errors, vazamentos de conexões e me dê a versão corrigida:\n\n-- [Insira o código aqui]" }
];

// Custom code block renderer with direct Copy option
function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);
  const isLua = ["lua", "luau"].includes(language?.toLowerCase());

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl overflow-hidden border border-slate-900 bg-[#0d0d14]">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#12121e] border-b border-[#1b1b28]">
        <span className="text-[10px] font-mono font-bold tracking-wider text-violet-400 uppercase">{language || "lua"}</span>
        <div className="flex items-center gap-1.5">
          {isLua && (
            <span className="text-[10px] bg-slate-900 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded-sm font-semibold">
              Roblox Script
            </span>
          )}
          <button
            onClick={handleCopy}
            className="h-6 px-2 flex items-center gap-1 text-[10px] text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? "Copiado!" : isLua ? "Copiar Script" : "Copiar"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[500px]">
        <pre className="p-3 text-xs font-mono text-cyan-100 leading-relaxed whitespace-pre font-light select-text">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
}

// Collapsible internal model reasoning thinker block
function ThinkBlock({ content }: { content: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="my-2.5 border border-slate-900 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 px-3 flex items-center gap-2 text-[10px] text-slate-400 font-semibold uppercase tracking-wider bg-slate-950/20 hover:bg-slate-950/40 transition-colors"
      >
        {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>Raciocínio Interno do Agente</span>
      </button>
      {isOpen && (
        <div className="px-4 py-3 text-[11px] text-slate-500 font-mono italic leading-relaxed whitespace-pre-wrap bg-slate-950/10 border-t border-slate-900">
          {content}
        </div>
      )}
    </div>
  );
}

// Custom Markdown message body parser with components modifiers
function MessageContent({ content }: { content: string }) {
  const parts: { type: "think" | "text"; content: string }[] = [];
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
  let lastIndex = 0;
  let match;

  while ((match = thinkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "think", content: match[1] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return (
    <div className="space-y-1 select-text">
      {parts.map((p, i) =>
        p.type === "think" ? (
          <ThinkBlock key={i} content={p.content} />
        ) : (
          <div key={i} className="prose prose-invert max-w-none break-words text-slate-300 text-xs leading-relaxed font-light">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }: any) {
                  const matchName = /language-(\w+)/.exec(className || "");
                  const codeString = String(children).replace(/\n$/, "");
                  return !inline && matchName ? (
                    <CodeBlock code={codeString} language={matchName[1]} />
                  ) : (
                    <code {...props} className="bg-slate-900 text-cyan-400 border border-slate-800 px-1 py-0.5 rounded text-[11px] font-mono font-medium">
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <>{children}</>;
                }
              }}
            >
              {p.content}
            </ReactMarkdown>
          </div>
        )
      )}
    </div>
  );
}

// Extracted Scripts List Dialog
interface ScriptsModalProps {
  conversationId: number;
  onClose: () => void;
  userKey?: string;
}

function ScriptsModal({ conversationId, onClose, userKey }: ScriptsModalProps) {
  const [scripts, setScripts] = useState<ExtractedScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const activeKey = userKey || localStorage.getItem("user_access_key") || "";
        const res = await fetch(`/api/conversations/${conversationId}/scripts`, {
          headers: { "x-user-key": activeKey }
        });
        const data = await safeFetchJson(res);
        setScripts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load scripts", err);
      } finally {
        setLoading(false);
      }
    };
    fetchScripts();
  }, [conversationId, userKey]);

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div id="scripts-view-modal shadow-2xl" className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#0a0a0f] border border-[#1a1a24] rounded-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a24] bg-slate-950/40">
          <div className="flex items-center gap-2">
            <Code2 className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-bold text-slate-100 uppercase tracking-wider">Scripts Extraídos do Agente</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center fill-current text-slate-500">
              <Loader className="w-6 h-6 animate-spin mb-2" />
              <span className="text-xs">Identificando cadeias secundárias de strings...</span>
            </div>
          ) : scripts.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 italic">
              Nenhum bloco de script ou código Luau foi compilado nesta sessão ainda.
            </div>
          ) : (
            scripts.map((script, idx) => (
              <div key={idx} className="border border-slate-900 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-slate-950/40 border-b border-slate-900">
                  <span className="text-[10px] font-mono text-slate-400 tracking-wider">
                    {script.language?.toUpperCase()} MODULE — SCRIPT {idx + 1}
                  </span>
                  <button
                    onClick={() => handleCopy(script.code, idx)}
                    className="h-6 px-2 text-[10px] flex items-center gap-1 hover:text-white text-slate-400 rounded hover:bg-slate-800 transition-all cursor-pointer"
                  >
                    {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedIdx === idx ? "Copiado!" : "Copiar"}
                  </button>
                </div>
                <pre className="p-3 bg-[#0c0c12] text-xs font-mono text-cyan-200 overflow-x-auto max-h-56 leading-relaxed">
                  <code>{script.code}</code>
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Helper to parse Lua codes and construct metadata in local browser for better API compatibility
function parseLuaCode(content: string, fileName: string) {
  const lines = content.split("\n");
  const servicesMapped = new Set<string>();
  const eventsMapped = new Set<string>();
  const functionsMapped = new Set<string>();

  // Look for Roblox Services: GetService("Players"), game:GetService'ReplicatedStorage', etc.
  const serviceRegex = /GetService\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
  // Look for Remotes: FireServer, OnServerEvent, etc.
  const remoteRegex = /(FireServer|OnServerEvent|OnClientEvent|FireClient|InvokeServer|OnServerInvoke|RemoteEvent|RemoteFunction)/gi;
  // Look for function names
  const functionRegex = /(?:local\s+)?function\s+([a-zA-Z0-9_\.:]+)/gi;

  content.replace(serviceRegex, (m, p1) => {
    servicesMapped.add(p1);
    return m;
  });

  content.replace(remoteRegex, (m, p1) => {
    eventsMapped.add(p1);
    return m;
  });

  content.replace(functionRegex, (m, p1) => {
    functionsMapped.add(p1);
    return m;
  });

  // Extract a compact visual preview (first 12 meaningful lines without giant header comments)
  const codeLines = lines
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("--"))
    .slice(0, 12)
    .join("\n");

  return {
    services: Array.from(servicesMapped),
    events: Array.from(eventsMapped),
    functions: Array.from(functionsMapped),
    briefPreview: codeLines
  };
}

// Main page view controller
interface ChatPageProps {
  conversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onToggleSidebar: () => void;
  conversations: Conversation[];
  onRefreshConversations: () => void;
  userKey?: string;
}

export function ChatPage({
  conversationId,
  onSelectConversation,
  onNewChat,
  onToggleSidebar,
  conversations,
  onRefreshConversations,
  userKey
}: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  
  // Base64 file attachments handling
  const [fileAttachment, setFileAttachment] = useState<{
    url: string;
    name: string;
    isImage: boolean;
  } | null>(null);

  // Extracted City/Map Roblox code items from Zip or Folders with advanced browser metadata
  const [analyzedFiles, setAnalyzedFiles] = useState<{
    name: string;
    content: string;
    size: number;
    selected: boolean;
    services?: string[];
    events?: string[];
    functions?: string[];
    briefPreview?: string;
  }[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState("");
  const [optimizeForAI, setOptimizeForAI] = useState(true);
  const [zipSearchQuery, setZipSearchQuery] = useState("");
  const [viewingFileDetails, setViewingFileDetails] = useState<{
    name: string;
    content: string;
    services?: string[];
    events?: string[];
    functions?: string[];
  } | null>(null);
  const [attachmentDropdownOpen, setAttachmentDropdownOpen] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeConversation = conversations.find(c => c.id === conversationId);

  const handleContinueGeneration = async () => {
    if (!conversationId || isPending || isContinuing) return;
    setIsContinuing(true);
    try {
      const activeKey = userKey || localStorage.getItem("user_access_key") || "";
      const res = await fetch(`/api/conversations/${conversationId}/continue`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeKey ? { "x-user-key": activeKey } : {})
        }
      });
      if (res.ok) {
        const updatedMsg = await res.json();
        setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Erro ao continuar script.");
      }
    } catch (e: any) {
      console.error("Error continuing script:", e);
      alert("Falha na requisição ao servidor.");
    } finally {
      setIsContinuing(false);
    }
  };

  // Load message logs of selected session
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const loadMessages = async () => {
      try {
        const activeKey = userKey || localStorage.getItem("user_access_key") || "";
        const res = await fetch(`/api/conversations/${conversationId}/messages`, {
          headers: { "x-user-key": activeKey }
        });
        const data = await safeFetchJson(res);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error reading messages:", err);
        setMessages([]);
      }
    };
    loadMessages();
  }, [conversationId, userKey]);

  // Handle smooth scroll-to-bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isPending]);

  const handleSendMessage = async () => {
    const textToSend = inputMessage.trim();
    const selectedFiles = analyzedFiles.filter(f => f.selected);
    if (!textToSend && !fileAttachment && selectedFiles.length === 0) return;

    setInputMessage("");
    setIsPending(true);

    let activeId = conversationId;

    try {
      // 1. Double check and auto-create conversation instance if none is active
      if (!activeId) {
        const activeKey = userKey || localStorage.getItem("user_access_key") || "";
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "x-user-key": activeKey
          },
          body: JSON.stringify({ title: textToSend.substring(0, 24) || "Nova Conversa" })
        });
        const newConvObj = await safeFetchJson(createRes);
        activeId = newConvObj.id;
        onSelectConversation(newConvObj.id);
        onRefreshConversations();
      }

      // Format payload content to include selected file contents
      let contentWithFiles = textToSend;
      let displayContent = textToSend;

      if (selectedFiles.length > 0) {
        if (optimizeForAI) {
          let fileSection = "\n\n### [MAPA DA CIDADE - MAPA DE SCRIPTS E RECURSOS]\n";
          fileSection += "O usuário carregou arquivos de script da cidade/mapa do jogo. Para máxima performance e evitar limites de tamanho, abaixo está a ESTRUTURA INTELECTUAL do código, detectando automaticamente as dependências, os remotos, as conexões e os primeiros comandos executados:\n\n";
          
          selectedFiles.forEach(file => {
            fileSection += `#### 📄 Arquivo: \`${file.name}\` (${(file.size / 1024).toFixed(1)} KB)\n`;
            if (file.services && file.services.length > 0) {
              fileSection += `- **Serviços Roblox:** ${file.services.map(s => `\`${s}\``).join(", ")}\n`;
            }
            if (file.events && file.events.length > 0) {
              fileSection += `- **Comutadores e Eventos (RemoteEvents/RemoteFunctions):** ${file.events.map(e => `\`${e}\``).join(", ")}\n`;
            }
            if (file.functions && file.functions.length > 0) {
              fileSection += `- **Funções localizadas:** ${file.functions.map(f => `\`${f}\``).slice(0, 10).join(", ")}${file.functions.length > 10 ? "..." : ""}\n`;
            }
            if (file.briefPreview) {
              fileSection += `- **Vetor / Começo do código:**\n\`\`\`lua\n${file.briefPreview}\n\`\`\`\n`;
            }
            fileSection += "\n";
          });

          fileSection += "--------------------------------------------------\n";
          fileSection += "Instruções adicionais de engenharia Roblox:\n";
          fileSection += "Use o mapeamento de variáveis, remotos e funções acima para fabricar novos scripts, triggers perfeitamente compatíveis com as redes de eventos da cidade do usuário. Se você precisar do código completo de algum módulo para analisar de forma robusta, responda identificando-o para o usuário.\n";
          
          contentWithFiles = textToSend 
            ? `${textToSend}${fileSection}` 
            : `Analise a estrutura dos scripts da cidade extraídos e gere os scripts e sugestões compatíveis:\n${fileSection}`;
          
          displayContent = `[Análise Map-Structure de ${selectedFiles.length} script(s) da cidade]\n\n${textToSend || "Analise a estrutura dos scripts extraídos da cidade e gere novas sugestões."}`;
        } else {
          let fileSection = "\n\n### [CONTEÚDO ANALISADO DOS ARQUIVOS DA CIDADE - FONTE COMPLETO]\n";
          fileSection += "Abaixo estão os códigos da cidade/pasta fornecida pelo usuário:\n\n";
          
          // If total size is massive (> 250KB), prioritize combat/security/remotes to prevent token overflow
          let filesToInclude = [...selectedFiles];
          const totalSize = filesToInclude.reduce((acc, f) => acc + (f.content?.length || 0), 0);
          if (totalSize > 250000) {
            const priorityTerms = ["combat", "pvp", "gun", "weapon", "damage", "hitbox", "aim", "anticheat", "bypass", "remote", "network", "mochila", "armas"];
            filesToInclude.sort((a, b) => {
              const aScore = priorityTerms.reduce((acc, t) => acc + (a.name.toLowerCase().includes(t) || a.content.toLowerCase().includes(t) ? 1 : 0), 0);
              const bScore = priorityTerms.reduce((acc, t) => acc + (b.name.toLowerCase().includes(t) || b.content.toLowerCase().includes(t) ? 1 : 0), 0);
              return bScore - aScore;
            });
          }

          let currentSize = 0;
          const MAX_PAYLOAD = 250000;
          filesToInclude.forEach(file => {
            if (currentSize > MAX_PAYLOAD) return;
            const chunkSize = Math.min(file.content.length, Math.max(800, Math.floor((MAX_PAYLOAD - currentSize) / (filesToInclude.length > 5 ? 5 : 2))));
            const snippet = file.content.slice(0, chunkSize);
            fileSection += `#### Arquivo: \`${file.name}\` (${(file.size / 1024).toFixed(1)} KB)\n`;
            fileSection += "```lua\n" + snippet + (file.content.length > chunkSize ? "\n-- ...[resto do código omitido para caber no contexto da IA]..." : "") + "\n```\n\n";
            currentSize += snippet.length + 100;
          });
          fileSection += "--------------------------------------------------\n";
          
          contentWithFiles = textToSend 
            ? `${textToSend}${fileSection}` 
            : `Analise os códigos enviados na íntegra para gerar scripts:\n${fileSection}`;
          
          displayContent = `[Análise Completa de ${selectedFiles.length} arquivo(s)]\n\n${textToSend || "Analise os scripts do mapa e recomende adaptações."}`;
        }
      }

      // Optimistic layout update with user message
      const optimisticMsg: Message = {
        id: Math.random(),
        conversationId: activeId!,
        role: "user",
        content: displayContent,
        fileUrl: fileAttachment?.url,
        fileName: fileAttachment?.name,
        createdAt: new Date().toISOString()
      };

      setMessages((prev) => [...prev, optimisticMsg]);
      setFileAttachment(null);

      // Send actual request
      const activeKey = userKey || localStorage.getItem("user_access_key") || "";
      const chatRes = await fetch(`/api/conversations/${activeId}/chat`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-key": activeKey
        },
        body: JSON.stringify({
          content: contentWithFiles,
          fileName: optimisticMsg.fileName,
          fileData: fileAttachment?.url // Raw base64 is wrapped inside fileUrl as attachment source
        })
      });

      const responseMsgObj = await safeFetchJson(chatRes);
      
      // Load current full message list to correctly display stored id and sync
      const reloadRes = await fetch(`/api/conversations/${activeId}/messages`, {
        headers: { "x-user-key": activeKey }
      });
      const updatedList = await safeFetchJson(reloadRes);
      setMessages(Array.isArray(updatedList) ? updatedList : []);
      onRefreshConversations();

    } catch (error: any) {
      console.error("Transmission Error:", error);
      const rawErrorMsg = error?.message || "Falha na transmissão de rede.";
      const isFetchError = rawErrorMsg.includes("Failed to fetch") || rawErrorMsg.includes("fetch");

      const errorText = isFetchError
        ? "⚠️ **Erro de Conexão:** Não foi possível se comunicar com o servidor backend. Por favor, verifique sua conexão ou tente novamente em alguns segundos."
        : `⚠️ **Erro ao processar mensagem:** ${rawErrorMsg}`;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          conversationId: activeId || 0,
          role: "assistant",
          content: errorText,
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setIsPending(false);
    }
  };

  const handleQuickPromptClick = (prompt: string) => {
    setInputMessage(prompt);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Convert uploaded attachments instantly to Base64 in standard FileReader flow
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 7 * 1024 * 1024) {
      alert("Arquivo muito grande. O limite máximo para anexos é de 7MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const isImg = /image\/(png|jpe?g|gif|webp)/i.test(file.type);
      setFileAttachment({
        url: base64Data, // Stores full header and bytes
        name: file.name,
        isImage: isImg
      });
    };
    reader.onerror = () => {
      alert("Erro ao ler dados do arquivo.");
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  };

function extractRobloxXmlScripts(xmlContent: string, baseFileName: string) {
  const extracted: { name: string; content: string }[] = [];
  const scriptRegex = /<Item\s+class="(Script|LocalScript|ModuleScript)"[^>]*>([\s\S]*?)<\/Item>/gi;
  let match;
  while ((match = scriptRegex.exec(xmlContent)) !== null) {
    const itemClass = match[1];
    const body = match[2];
    const nameMatch = body.match(/<string\s+name="Name">([\s\S]*?)<\/string>/i);
    const sourceMatch = body.match(/<ProtectedString\s+name="Source">(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/ProtectedString>/i);
    if (sourceMatch && sourceMatch[1]?.trim()) {
      const scriptName = (nameMatch && nameMatch[1]?.trim()) || `${itemClass}_${extracted.length + 1}`;
      extracted.push({
        name: `${baseFileName} > ${scriptName} (${itemClass}).lua`,
        content: sourceMatch[1].trim()
      });
    }
  }
  return extracted;
}

  // Extract Zip archives directly in browser using JSZip safely
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setExtractionStatus(`Lendo arquivo ZIP: ${file.name}...`);
    try {
      const zip = await JSZip.loadAsync(file);
      const tempFiles: { 
        name: string; 
        content: string; 
        size: number; 
        selected: boolean;
        services: string[];
        events: string[];
        functions: string[];
        briefPreview: string;
      }[] = [];

      const interestingExtensions = ["lua", "luau", "txt", "json", "js", "ts", "cpp", "h", "rbxlx", "rbxmx", "xml", "csv", "md"];
      const filePromises: Promise<void>[] = [];
      let totalToExtract = 0;

      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const ext = relativePath.split(".").pop()?.toLowerCase();
          if (interestingExtensions.includes(ext || "")) {
            totalToExtract++;
          }
        }
      });

      let extractedCount = 0;
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
          const ext = relativePath.split(".").pop()?.toLowerCase();
          if (interestingExtensions.includes(ext || "")) {
            const promise = zipEntry.async("string").then((content) => {
              extractedCount++;
              setExtractionStatus(`Processando (${extractedCount}/${totalToExtract}): ${relativePath}...`);
              
              if (["rbxlx", "rbxmx", "xml"].includes(ext || "")) {
                const subScripts = extractRobloxXmlScripts(content, relativePath);
                if (subScripts.length > 0) {
                  for (const sub of subScripts) {
                    const analysis = parseLuaCode(sub.content, sub.name);
                    tempFiles.push({
                      name: sub.name,
                      content: sub.content,
                      size: sub.content.length,
                      selected: true,
                      services: analysis.services,
                      events: analysis.events,
                      functions: analysis.functions,
                      briefPreview: analysis.briefPreview
                    });
                  }
                  return;
                }
              }

              const analysis = parseLuaCode(content, relativePath);
              tempFiles.push({
                name: relativePath,
                content,
                size: content.length,
                selected: true,
                services: analysis.services,
                events: analysis.events,
                functions: analysis.functions,
                briefPreview: analysis.briefPreview
              });
            });
            filePromises.push(promise);
          }
        }
      });

      await Promise.all(filePromises);
      if (tempFiles.length > 0) {
        setAnalyzedFiles((prev) => [...prev, ...tempFiles]);
        setExtractionStatus(`Concluído! ${tempFiles.length} scripts analisados com sucesso.`);
      } else {
        alert("Nenhum arquivo de código compatível (.lua, .luau, .txt, .json, .rbxlx, .rbxmx) foi encontrado dentro do arquivo ZIP.");
      }
    } catch (err) {
      console.error("Error reading ZIP archive:", err);
      alert("Falha ao descompactar ou processar o arquivo ZIP.");
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  };

  // Upload entire map/folders recursively
  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesList = e.target.files;
    if (!filesList || filesList.length === 0) return;

    setIsExtracting(true);
    setExtractionStatus(`Preparando para listar arquivos da pasta...`);
    const tempFiles: { 
      name: string; 
      content: string; 
      size: number; 
      selected: boolean;
      services: string[];
      events: string[];
      functions: string[];
      briefPreview: string;
    }[] = [];

    const interestingExtensions = ["lua", "luau", "txt", "json", "js", "ts", "cpp", "h", "rbxlx", "rbxmx", "xml", "csv", "md"];

    try {
      let matchCount = 0;
      for (let i = 0; i < filesList.length; i++) {
        const ext = filesList[i].name.split(".").pop()?.toLowerCase();
        if (interestingExtensions.includes(ext || "")) {
          matchCount++;
        }
      }

      let readIndex = 0;
      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        const relativePath = (file as any).webkitRelativePath || file.name;
        const ext = file.name.split(".").pop()?.toLowerCase();
        
        if (interestingExtensions.includes(ext || "")) {
          readIndex++;
          setExtractionStatus(`Lendo (${readIndex}/${matchCount}): ${relativePath}...`);
          const content = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
          
          if (["rbxlx", "rbxmx", "xml"].includes(ext || "")) {
            const subScripts = extractRobloxXmlScripts(content, relativePath);
            if (subScripts.length > 0) {
              for (const sub of subScripts) {
                const analysis = parseLuaCode(sub.content, sub.name);
                tempFiles.push({
                  name: sub.name,
                  content: sub.content,
                  size: sub.content.length,
                  selected: true,
                  services: analysis.services,
                  events: analysis.events,
                  functions: analysis.functions,
                  briefPreview: analysis.briefPreview
                });
              }
              continue;
            }
          }

          const analysis = parseLuaCode(content, relativePath);
          tempFiles.push({
            name: relativePath,
            content,
            size: content.length,
            selected: true,
            services: analysis.services,
            events: analysis.events,
            functions: analysis.functions,
            briefPreview: analysis.briefPreview
          });
        }
      }

      if (tempFiles.length > 0) {
        setAnalyzedFiles((prev) => [...prev, ...tempFiles]);
        setExtractionStatus(`Concluído! ${tempFiles.length} scripts analisados com sucesso.`);
      } else {
        alert("Nenhum arquivo de script compatível foi detectado na pasta selecionada.");
      }
    } catch (err) {
      console.error("Error reading folder files:", err);
      alert("Falha ao ler conteúdos da pasta.");
    } finally {
      setIsExtracting(false);
      e.target.value = "";
    }
  };

  const handleToggleFileSelection = (index: number) => {
    setAnalyzedFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, selected: !f.selected } : f))
    );
  };

  const handleSelectAllFiles = (select: boolean) => {
    setAnalyzedFiles((prev) => prev.map((f) => ({ ...f, selected: select })));
  };

  const handleRemoveAnalyzedFile = (index: number) => {
    setAnalyzedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleClearAllAnalyzedFiles = () => {
    setAnalyzedFiles([]);
  };

  return (
    <div id="chat-view" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#07070a]">
      {showScripts && conversationId && (
        <ScriptsModal conversationId={conversationId} onClose={() => setShowScripts(false)} />
      )}

      {/* Header */}
      <header className="h-13 border-b border-[#1a1a24] bg-[#0a0a0f] flex items-center px-4 md:px-5 shrink-0 justify-between select-none">
        <div className="flex items-center gap-3">
          <button
            id="mobile-sidebar-toggle"
            onClick={onToggleSidebar}
            className="p-1.5 md:hidden -ml-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:flex items-center gap-2 border-r border-[#1a1a24] pr-4 mr-1 text-xs text-violet-400 font-bold tracking-tight">
            <Bot className="w-4.5 h-4.5 animate-pulse-glow" />
            <span>ROBLOX AI AGENT</span>
          </div>
          <h1 className="font-semibold text-slate-100 text-xs md:text-sm truncate">
            {activeConversation ? activeConversation.title : "RobloxAI Dashboard"}
          </h1>
        </div>

        {conversationId && (
          <button
            id="open-scripts-modal-btn"
            onClick={() => setShowScripts(true)}
            className="h-8 px-3 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 text-violet-400 hover:text-violet-300 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-all duration-150"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Scripts</span>
          </button>
        )}
      </header>

      {/* Messages viewport */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
        
        {/* Welcome screen (shown only when database conversation messages list is empty) */}
        {!conversationId && (
          <div className="max-w-2xl mx-auto flex flex-col items-center justify-center text-center h-full pb-8">
            <div className="w-14 h-14 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg mb-4.5 border border-violet-400/20 active:scale-95 duration-100 transition-all">
              <Bot className="w-7 h-7 text-white animate-pulse-glow" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Roblox Execução & Modelagem AI</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Inicie um chat generativo especializado de alto nível para scripts Luau, overlays de ESP, aimbots silenciados, engenharia com exploits ou conversão de imagens.
            </p>

            {/* Quick Presets Menu */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-8 w-full">
              {QUICK_PROMPTS.map((qp, index) => {
                const IconComp = qp.icon;
                return (
                  <button
                    key={index}
                    id={`quick-prompt-${index}`}
                    onClick={() => handleQuickPromptClick(qp.prompt)}
                    className="group border border-slate-900 p-3 bg-[#0a0a0f]/60 hover:bg-violet-600/5 hover:border-violet-500/40 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 transition-all text-xs cursor-pointer active:scale-98 duration-100"
                  >
                    <IconComp className="w-4.5 h-4.5 text-slate-500 group-hover:text-violet-400 transition-colors duration-150" />
                    <span className="font-semibold text-slate-400 text-[10px] group-hover:text-slate-200 tracking-tight leading-none">
                      {qp.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {conversationId && messages.length === 0 && !isPending && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 italic text-xs">
            Nenhuma mensagem ativa. Envie uma mensagem abaixo para iniciar o agente.
          </div>
        )}

        {/* Message bubble streams */}
        {messages.map((msg) => {
          const isBot = msg.role === "assistant";
          return (
            <div
              key={msg.id}
              className={`max-w-3xl mx-auto flex gap-3 md:gap-4 ${
                isBot ? "" : "flex-row-reverse"
              }`}
            >
              {/* Profile glyph indicator */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 select-none ${
                  isBot
                    ? "bg-violet-600/10 border-violet-500/20 text-violet-400"
                    : "bg-slate-900 border-slate-800 text-slate-400"
                }`}
              >
                {isBot ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              {/* Message card payload */}
              <div className="flex-1 min-w-0 flex flex-col">
                <div
                  className={`px-4 py-3.5 rounded-xl border leading-relaxed ${
                    isBot
                      ? "bg-[#09090e]/80 border-slate-900/60 shadow-xs"
                      : "bg-violet-600/10 border-violet-500/20 max-w-[85%] self-end"
                  }`}
                >
                  {/* File attachment preview inside bubbles */}
                  {msg.fileUrl && (
                    <div className="mb-3">
                      {msg.fileUrl.startsWith("data:image/") || msg.fileName?.match(/\.(png|jpe?g|gif|webp)$/i) ? (
                        <img
                          src={msg.fileUrl}
                          alt={msg.fileName || "Anexo"}
                          referrerPolicy="no-referrer"
                          className="max-h-56 max-w-full rounded-lg border border-slate-800 object-contain selection:bg-transparent"
                        />
                      ) : (
                        <div className="p-2.5 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
                          <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate max-w-[200px]">{msg.fileName || "Arquivo anexo"}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Body text rendering markup */}
                  {isBot ? (
                    <>
                      <MessageContent content={msg.content} />
                      {/* Bot response actions bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-850/60 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                        <div className="flex items-center gap-2">
                          {msg.content.includes("```lua") && (
                            <span className="flex items-center gap-1 text-emerald-400 font-mono font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              Script Luau Verificado
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleContinueGeneration()}
                            disabled={isPending || isContinuing}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-600/10 hover:bg-violet-600/20 border border-violet-500/20 text-violet-300 font-medium cursor-pointer transition-all hover:border-violet-500/40 disabled:opacity-50"
                            title="Completar script ou adicionar novas funções sem cortar"
                          >
                            {isContinuing ? (
                              <Loader className="w-3 h-3 animate-spin text-violet-400" />
                            ) : (
                              <Play className="w-3 h-3 text-violet-400" />
                            )}
                            <span>{isContinuing ? "Completando..." : "Continuar / Completar Script"}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-200 text-xs font-light whitespace-pre-wrap font-sans select-text">
                      {msg.content}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Streaming / Generation activity feedback bubble */}
        {isPending && (
          <div className="max-w-3xl mx-auto flex gap-3 md:gap-4">
            <div className="w-7 h-7 rounded-lg bg-violet-600/10 border border-violet-500/20 text-violet-400 flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="py-3.5 px-4 bg-[#09090e] border border-slate-900/60 rounded-xl flex items-center gap-2">
              <Loader className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
              <span className="text-[11px] font-mono text-slate-500 select-none">
                Agente compilando dados...
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* Main chat input panel container footer */}
      <footer className="shrink-0 p-4 border-t border-[#1a1a24] bg-[#09090e]">
        
        {/* File unpacking state feedback indicator */}
        {isExtracting && (
          <div className="max-w-3xl mx-auto mb-2.5 p-3 bg-violet-600/10 border border-violet-500/20 rounded-xl flex items-center gap-2.5 animate-pulse">
            <Loader className="w-4 h-4 text-violet-400 animate-spin shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-xs text-slate-300 font-medium">Extraindo e analisando os códigos Luau... Por favor, aguarde...</span>
              {extractionStatus && (
                <span className="text-[10px] text-violet-400 font-mono truncate block max-w-full">
                  {extractionStatus}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Extracted zip/folder files explorer panel */}
        {analyzedFiles.length > 0 && (
          <div className="max-w-3xl mx-auto mb-3 border border-[#1a1a24] bg-[#09090e] rounded-xl overflow-hidden p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#14141d]/80 pb-3">
              <div className="flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-violet-400 shrink-0" />
                <div>
                  <h4 className="text-[11px] font-bold text-slate-100 uppercase tracking-wider">CÓDIGOS DA CIDADE / MAPA UPADO ({analyzedFiles.length})</h4>
                  <p className="text-[10px] text-slate-500 font-medium font-sans">
                    {analyzedFiles.filter(f => f.selected).length} arquivo(s) selecionado(s) para o prompt da IA
                  </p>
                </div>
              </div>

              {/* Intelligent optimization toggles */}
              <div className="flex items-center gap-2 bg-violet-600/5 hover:bg-violet-600/10 border border-violet-500/15 rounded-lg px-2.5 py-1 transition-colors self-start sm:self-auto cursor-pointer">
                <input
                  type="checkbox"
                  id="optimize-ai-toggle"
                  checked={optimizeForAI}
                  onChange={(e) => setOptimizeForAI(e.target.checked)}
                  className="w-3.5 h-3.5 text-violet-600 bg-[#0a0a0f] border-slate-800 rounded focus:ring-violet-500 cursor-pointer accent-violet-600 shrink-0"
                />
                <label htmlFor="optimize-ai-toggle" className="text-[10px] font-medium text-slate-300 cursor-pointer select-none">
                  Resumir código para velocidade (Desativado: Enviando completo) 🚀
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => handleSelectAllFiles(true)}
                  className="text-[10px] font-semibold h-6 px-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-md hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Selecionar Tudo
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllFiles(false)}
                  className="text-[10px] font-semibold h-6 px-2.5 border border-slate-800 text-slate-400 hover:text-white rounded-md hover:bg-slate-900 transition-all cursor-pointer"
                >
                  Desmarcar Tudo
                </button>
                <button
                  type="button"
                  onClick={handleClearAllAnalyzedFiles}
                  className="text-[10px] font-semibold h-6 px-2.5 border border-rose-500/20 text-rose-400 hover:text-rose-300 rounded-md hover:bg-rose-950/20 transition-all cursor-pointer"
                >
                  Limpar Todos
                </button>
              </div>
            </div>

            {/* Search/filtering input within list */}
            <div className="flex items-center gap-2 bg-[#050508] border border-slate-950 rounded-lg px-2.5 py-1.5 focus-within:border-violet-500/30 transition-all">
              <Search className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <input
                type="text"
                placeholder="Pesquisar nos scripts extraídos (Ex: Admin, Server, Config)..."
                value={zipSearchQuery}
                onChange={(e) => setZipSearchQuery(e.target.value)}
                className="bg-transparent border-none text-slate-300 outline-none text-xs w-full p-0 focus:ring-0 placeholder:text-slate-600 font-sans"
              />
              {zipSearchQuery && (
                <button
                  type="button"
                  onClick={() => setZipSearchQuery("")}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Scrollable grid file browser container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1">
              {analyzedFiles
                .filter(file => file.name.toLowerCase().includes(zipSearchQuery.toLowerCase()))
                .length === 0 ? (
                <div className="col-span-2 text-center py-6 text-xs text-slate-500 italic font-light font-sans">
                  Nenhum arquivo encontrado para "{zipSearchQuery}".
                </div>
              ) : (
                analyzedFiles
                  .filter(file => file.name.toLowerCase().includes(zipSearchQuery.toLowerCase()))
                  .map((file, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between gap-1.5 p-2 rounded-lg border transition-all ${
                        file.selected 
                          ? "bg-[#0b0c14]/40 border-violet-500/20" 
                          : "bg-[#06060c]/40 border-slate-900/60"
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer select-none truncate flex-1 md:max-w-xs">
                        <input
                          type="checkbox"
                          checked={file.selected}
                          onChange={() => {
                            const realIdx = analyzedFiles.findIndex(f => f.name === file.name);
                            if (realIdx !== -1) handleToggleFileSelection(realIdx);
                          }}
                          className="w-3.5 h-3.5 text-violet-600 bg-[#0a0a0f] border-slate-800 rounded focus:ring-violet-500 cursor-pointer accent-violet-600"
                        />
                        <FileCode className={`w-3.5 h-3.5 shrink-0 ${file.selected ? "text-violet-400" : "text-slate-600"}`} />
                        <div className="truncate flex-1">
                          <span className={`text-[11px] font-mono tracking-tight block truncate ${file.selected ? "text-slate-200" : "text-slate-500"}`}>
                            {file.name}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] text-slate-600 font-mono">
                              {(file.size / 1024).toFixed(1)} KB
                            </span>
                            {file.services && file.services.length > 0 && (
                              <span className="text-[8px] tracking-tight bg-cyan-950/20 text-cyan-400 px-1 border border-cyan-500/10 rounded font-sans leading-none pb-0.5 select-none">
                                {file.services.length} Serv.
                              </span>
                            )}
                            {file.events && file.events.length > 0 && (
                              <span className="text-[8px] tracking-tight bg-violet-950/20 text-violet-400 px-1 border border-violet-500/10 rounded font-sans leading-none pb-0.5 select-none">
                                {file.events.length} Remotos
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      <button
                        type="button"
                        onClick={() => setViewingFileDetails(file)}
                        className="text-[10px] font-sans font-semibold text-slate-400 hover:text-violet-400 bg-slate-950/20 hover:bg-slate-950/60 border border-slate-900 px-2 py-0.5 rounded transition cursor-pointer"
                      >
                        Visualizar
                      </button>
                    </div>
                  ))
              )}
            </div>

            {/* Quick action button to trigger direct AI holistic analysis map-wide */}
            <div className="flex justify-end pt-2 border-t border-[#14141d]/80 select-none">
              <button
                type="button"
                onClick={() => {
                  // Ensure all active files are selected
                  handleSelectAllFiles(true);
                  // Setup holistic analysis instruction
                  setInputMessage("Gere uma análise completa sobre os scripts do mapa/cidade carregados acima. Com base neles, faça um relatório com todos os RemoteEvents disponíveis, conexões de rede identificadas e sugira scripts ideais e ferramentas compatíveis com as redes de eventos da cidade para obtermos recursos ou funções facilitadoras de gameplay!");
                  // Small delay to let selection settle, then focus input text area
                  setTimeout(() => {
                    textareaRef.current?.focus();
                  }, 100);
                }}
                className="w-full sm:w-auto h-8 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-md hover:shadow-violet-600/10 text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Bot className="w-3.5 h-3.5 animate-pulse" />
                <span>⚡ Enviar Análise Geral da Cidade de forma Otimizada</span>
              </button>
            </div>
          </div>
        )}

        {/* Active attachment display */}
        {fileAttachment && (
          <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2">
            {fileAttachment.isImage ? (
              <div className="relative border border-slate-800 rounded-lg p-0.5 bg-slate-950 overflow-hidden shrink-0 shadow">
                <img
                  src={fileAttachment.url}
                  alt={fileAttachment.name}
                  className="h-10 w-10 rounded object-cover select-none"
                />
                <button
                  type="button"
                  onClick={() => setFileAttachment(null)}
                  className="absolute -top-1 -right-1 bg-rose-500 rounded-full text-white p-0.5 hover:bg-rose-400 cursor-pointer"
                  title="Excluir Anexo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg py-1 px-2.5 flex items-center gap-1.5 text-xs text-slate-400 font-sans">
                <Paperclip className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate max-w-[200px] text-[11px] font-mono">{fileAttachment.name}</span>
                <button
                  type="button"
                  onClick={() => setFileAttachment(null)}
                  className="text-slate-500 hover:text-white rounded ml-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <span className="text-[10px] text-slate-500 font-sans">Anexo pronto para auditoria da IA.</span>
          </div>
        )}

        {/* Text Input Block */}
        <div className="max-w-3xl mx-auto flex items-end gap-2 bg-[#0c0c12] border border-slate-900 rounded-xl p-1.5 focus-within:border-violet-500/50 transition-colors">
          
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            id="file-attachment-input"
            accept="image/*"
          />

          <input
            ref={zipInputRef}
            type="file"
            className="hidden"
            accept=".zip"
            onChange={handleZipUpload}
            id="file-zip-input"
          />

          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            {...({ webkitdirectory: "", directory: "" } as any)}
            multiple
            onChange={handleFolderUpload}
            id="file-folder-input"
          />

          <div className="relative shrink-0 select-none">
            <button
              type="button"
              id="attach-file-menu-btn"
              onClick={() => setAttachmentDropdownOpen(!attachmentDropdownOpen)}
              className={`h-9 w-9 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                attachmentDropdownOpen ? "text-violet-400 bg-slate-900" : "text-slate-500 hover:text-slate-200 hover:bg-slate-900"
              }`}
              title="Anexar arquivos, imagens ou pastas de cidade"
            >
              <Paperclip className="w-4.5 h-4.5" />
            </button>

            {attachmentDropdownOpen && (
              <>
                {/* Backdrop handler to close dropdown easily */}
                <div 
                  className="fixed inset-0 z-10 bg-transparent" 
                  onClick={() => setAttachmentDropdownOpen(false)}
                />
                
                <div className="absolute bottom-11 left-0 z-20 w-52 bg-[#09090e] border border-[#1a1a24] rounded-xl py-1.5 shadow-xl flex flex-col font-sans animate-fade-in">
                  <div className="px-3 py-1 border-b border-[#14141d] mb-1 font-mono">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">IMPORTAÇÃO ROBLOX</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentDropdownOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Anexar Imagem (GUI)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentDropdownOpen(false);
                      zipInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-violet-400" />
                    <span>Carregar .ZIP de Cidade</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentDropdownOpen(false);
                      folderInputRef.current?.click();
                    }}
                    className="px-3.5 py-2 text-left text-xs text-slate-300 hover:text-white hover:bg-slate-900/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <FolderUp className="w-3.5 h-3.5 text-amber-500" />
                    <span>Carregar Pasta de Cidade</span>
                  </button>
                </div>
              </>
            )}
          </div>

          <textarea
            ref={textareaRef}
            rows={1}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Peça um script de exploit, ESP, autotracers, bypass ou anexe uma foto e digite..."
            className="flex-1 max-h-44 bg-transparent resize-none border-none outline-none text-slate-200 text-xs px-2 py-2.5 min-h-[38px] placeholder:text-slate-600 focus:ring-0"
          />

          <button
            id="send-message-btn"
            onClick={handleSendMessage}
            disabled={(!inputMessage.trim() && !fileAttachment && analyzedFiles.filter(f => f.selected).length === 0) || isPending}
            className="h-9 w-9 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-30 disabled:pointer-events-none rounded-lg text-white flex items-center justify-center shadow transition-all shrink-0 active:scale-95 duration-100 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>

        </div>
        <p className="text-center text-[10px] text-slate-600 pt-2 shrink-0 select-none">
          Enter para enviar • Shift+Enter nova linha • Carregue arquivos ZIP ou Pastas para analisar código da cidade • Imagens são mapeadas pela IA
        </p>
      </footer>

      {/* Code viewer modal */}
      {viewingFileDetails && (
        <div id="file-viewer-modal" className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0a0a0f] border border-[#1a1a24] rounded-xl w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#1a1a24] bg-slate-950/40 select-none">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-violet-400" />
                <span className="text-xs font-mono text-slate-100 truncate max-w-xs md:max-w-md">
                  Visualizando: {viewingFileDetails.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingFileDetails(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Micro analysis metadata indicators */}
            {(viewingFileDetails.services && viewingFileDetails.services.length > 0) || (viewingFileDetails.events && viewingFileDetails.events.length > 0) ? (
              <div className="p-3 bg-[#0d0d14] border-b border-[#1a1a24] flex flex-wrap gap-2 text-[10px] select-none">
                {viewingFileDetails.services && viewingFileDetails.services.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-[#050508] border border-slate-900/60 rounded px-2.5 py-1">
                    <span className="text-slate-400 font-semibold uppercase">Serviços usados:</span>
                    {viewingFileDetails.services.map((s, idx) => (
                      <span key={idx} className="text-cyan-400 font-mono font-medium">{s}</span>
                    ))}
                  </div>
                )}
                {viewingFileDetails.events && viewingFileDetails.events.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 bg-[#050508] border border-slate-900/60 rounded px-2.5 py-1">
                    <span className="text-slate-400 font-semibold uppercase">Remotos / Conexões:</span>
                    {viewingFileDetails.events.map((e, idx) => (
                      <span key={idx} className="text-violet-400 font-mono font-medium">{e}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Code view workspace body */}
            <div className="flex-1 overflow-y-auto p-4 bg-[#07070a] border-b border-[#1a1a24]">
              <pre className="text-xs font-mono text-cyan-100 leading-relaxed whitespace-pre font-light select-text">
                <code>{viewingFileDetails.content}</code>
              </pre>
            </div>

            {/* Footer containing metrics and dynamic triggers */}
            <div className="px-5 py-3 bg-slate-950/40 flex items-center justify-between select-none">
              <span className="text-[10px] text-slate-500 font-mono">
                {(viewingFileDetails.content.length / 1024).toFixed(1)} KB • {viewingFileDetails.content.split("\n").length} linhas
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(viewingFileDetails.content);
                  alert("Código copiado para a área de transferência!");
                }}
                className="px-3.5 py-2 text-xs bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-lg shadow-md hover:shadow-violet-600/10 transition-all cursor-pointer"
              >
                Copiar Todo o Código
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
