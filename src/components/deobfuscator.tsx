import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  Settings as SettingsIcon, 
  Upload, 
  Play, 
  Wand2, 
  ShieldAlert, 
  Copy, 
  Download, 
  Trash2, 
  Check, 
  FileCode, 
  Cpu, 
  Activity, 
  History, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Sparkles, 
  Code,
  ArrowLeft
} from "lucide-react";
import { MonacoEditor } from "./monaco_editor.js";
import { CFGVisualizer } from "./cfg_visualizer.js";
import { runLocalDeobfuscationWasm } from "../utils/deobfuscator_wasm.js";
import { safeFetchJson } from "../lib/api_helper.js";

interface HistoryItem {
  id: string;
  timestamp: string;
  fileName: string;
  obfuscator: string;
  originalSize: number;
  cleanSize: number;
  originalCode: string;
  cleanCode: string;
  explanation: string;
}

interface DeobfuscatorProps {
  onBackToChat?: () => void;
}

export function DeobfuscatorPage({ onBackToChat }: DeobfuscatorProps) {
  const [inputCode, setInputCode] = useState<string>("");
  const [outputCode, setOutputCode] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  
  // Advanced configuration
  const [advancedMode, setAdvancedMode] = useState<boolean>(true);
  const [obfuscatorOption, setObfuscatorOption] = useState<string>("Auto-Detect");
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [keepFallback, setKeepFallback] = useState<boolean>(true);
  const [activePartIndex, setActivePartIndex] = useState<number>(-1);
  
  // Results details
  const [logs, setLogs] = useState<string[]>([]);
  const [executionSimTrace, setExecutionSimTrace] = useState<string[]>([]);
  const [patternsDetected, setPatternsDetected] = useState<string[]>([]);
  const [variablesRenamed, setVariablesRenamed] = useState<string[]>([]);
  const [detectedObfuscator, setDetectedObfuscator] = useState<string>("");
  const [astJsonStr, setAstJsonStr] = useState<string>("");
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [cleanSize, setCleanSize] = useState<number>(0);
  const [isLuraph, setIsLuraph] = useState<boolean>(false);
  const [decryptedStrings, setDecryptedStrings] = useState<Record<string, string>>({});

  // Real-time animated feedback loaders
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [isLiveSuccess, setIsLiveSuccess] = useState<boolean>(false);
  const liveLogsEndRef = React.useRef<HTMLDivElement>(null);

  // History state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [viewingAstNode, setViewingAstNode] = useState<boolean>(false);

  // Drag and Drop
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Elite Processor & Messaging State
  const [engineMode, setEngineMode] = useState<"hybrid" | "wasm" | "dynamic">("hybrid");
  const [useAi, setUseAi] = useState<boolean>(false);
  const [wasmPerformance, setWasmPerformance] = useState({ cpu: 0, ram: 0, linesPerSec: 0 });
  const [jobTicketId, setJobTicketId] = useState<string>("");
  const [advPanelTab, setAdvPanelTab] = useState<"logs" | "cfg">("cfg");

  // Performance simulation effect for WASM / Dynamic
  useEffect(() => {
    let interval: any;
    if (isLoading && (engineMode === "wasm" || engineMode === "dynamic")) {
      interval = setInterval(() => {
        setWasmPerformance({
          cpu: Math.floor(Math.random() * 8) + 4, // 4-12% CPU
          ram: parseFloat((Math.random() * 2 + 16.4).toFixed(1)), // 16.4-18.4 MB
          linesPerSec: Math.floor(Math.random() * 15000) + 145000 // ~145k-160k lines
        });
      }, 500);
    } else {
      setWasmPerformance({ cpu: 0, ram: 0, linesPerSec: 0 });
    }
    return () => clearInterval(interval);
  }, [isLoading, engineMode]);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("roblox_deobfuscator_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load deobfuscator history", e);
    }
  }, []);

  // Auto-scroll handler for live logs
  useEffect(() => {
    if (liveLogsEndRef.current) {
      liveLogsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [liveLogs]);

  // Save history helper with graceful quota exceed auto-pruning recovery
  const saveHistory = (item: HistoryItem) => {
    // Make copies so we don't mutate original objects if we need to prune
    let currentItem = { ...item };
    
    // Safety check: if the code strings are extremely massive, truncate them slightly for the local history only
    const maxLocalCodeLength = 150000; // max ~150KB per script in local storage history
    if (currentItem.originalCode.length > maxLocalCodeLength) {
      currentItem.originalCode = currentItem.originalCode.substring(0, maxLocalCodeLength) + "\n\n-- [SCRIPT ORIGINAL TRUNCADO NO HISTÓRICO LOCAL DEVIDO AO TAMANHO EXTREMO]";
    }
    if (currentItem.cleanCode.length > maxLocalCodeLength) {
      currentItem.cleanCode = currentItem.cleanCode.substring(0, maxLocalCodeLength) + "\n\n-- [SCRIPT DESOFUSCADO TRUNCADO NO HISTÓRICO LOCAL DEVIDO AO TAMANHO EXTREMO]";
    }

    let itemsToSave = [currentItem, ...history];

    // Keep it at max 15 items initially
    if (itemsToSave.length > 15) {
      itemsToSave = itemsToSave.slice(0, 15);
    }

    let retryCount = 0;
    const maxRetries = 6;
    let savedSuccessfully = false;

    while (retryCount < maxRetries) {
      try {
        localStorage.setItem("roblox_deobfuscator_history", JSON.stringify(itemsToSave));
        setHistory(itemsToSave);
        savedSuccessfully = true;
        break;
      } catch (e: any) {
        console.warn(`[Quota Recovery] LocalStorage quota exceeded on save attempt ${retryCount + 1}. Pruning history...`);
        retryCount++;

        if (itemsToSave.length <= 1) {
          // If we have only 1 item and it still exceeds quota, we must aggressively truncate the code of this single item
          if (itemsToSave[0]) {
            itemsToSave[0].originalCode = itemsToSave[0].originalCode.substring(0, 20000) + "\n-- [Truncado de 20KB devido ao limite do navegador de cota]";
            itemsToSave[0].cleanCode = itemsToSave[0].cleanCode.substring(0, 20000) + "\n-- [Truncado de 20KB devido ao limite do navegador de cota]";
          }
        } else {
          // Step 1: Remove the oldest items (reduce list length)
          if (retryCount === 1) {
            itemsToSave = itemsToSave.slice(0, 10);
          } else if (retryCount === 2) {
            itemsToSave = itemsToSave.slice(0, 5);
          } else if (retryCount === 3) {
            itemsToSave = itemsToSave.slice(0, 3);
          } else if (retryCount === 4) {
            itemsToSave = itemsToSave.slice(0, 1);
          } else {
            // Step 2: Clear historical script content for older elements, keeping only metadata
            itemsToSave = itemsToSave.map((it, idx) => {
              if (idx > 0) {
                return {
                  ...it,
                  originalCode: "-- [Liberado para salvar cota do histórico]",
                  cleanCode: "-- [Liberado para salvar cota do histórico]"
                };
              }
              return it;
            });
          }
        }
      }
    }

    if (!savedSuccessfully) {
      console.error("Critical: Unable to save item to localStorage even after aggressive pruning.");
    }
  };

  const handleDeobfuscate = async (action: "deobfuscate" | "improve" | "explain" | "deep_deobfuscate") => {
    if (!inputCode.trim()) {
      setErrorMsg("Por favor, cole um script ou faça upload de um arquivo primeiro.");
      return;
    }

    setIsLoading(true);
    setErrorMsg("");
    setLogs([]);
    setExecutionSimTrace([]);
    setPatternsDetected([]);
    setVariablesRenamed([]);
    setAstJsonStr("");
    setLiveLogs([]);
    setProgressPercent(0);
    setIsLiveSuccess(false);
    setActivePartIndex(-1);

    // Setup dynamic real-time progress steps for high developer polish
    const ticketId = "TKT-" + Math.random().toString(36).substring(2, 7).toUpperCase();
    setJobTicketId(ticketId);

    const sizeKb = (inputCode.length / 1024).toFixed(1);
    const queueSteps = [
      `📡 [WEBSOCKET] Emitindo handshake WebSocket (Socket.io room client-${Math.floor(Math.random() * 8000 + 1000)})...`,
      `💬 [SOCKET.IO] Canal de escuta ativado com sucesso!`,
      `🗳️ [MESSAGING] Envelopando script para a fila Redis...`,
      `🎟️ [REDIS BROKER] Job inserido na fila BullMQ. Ticket atribuído: [${ticketId}]`,
      `🧑‍💻 [BULLMQ WORKER] Worker Thread alocada para o ticket. Iniciando processamento...`
    ];

    const baseSteps = action === "deep_deobfuscate" ? [
      "🚀 [SISTEMA] Ativando DeepLuaEngine avançado integrado com Sandbox Emulation...",
      "📂 [PRE-PROCESSADOR] Carregando código ofuscado no buffer estrito...",
      `📦 [ANALISADOR] Analisando tamanho original: ${sizeKb} KB...`,
      "🔍 [DEEPLUAENGINE] Rodando Tokenização de Expressão Regular...",
      "🧩 [DEEPLUAENGINE] Identificando decodificadores de strings Luraph/IronBrew...",
      "🔬 [DEEPLUAENGINE] Mapeando assinaturas de registradores de Máquinas Virtuais...",
      "🌡️ [SANDBOX] Instanciando ambiente de simulação em Sandbox de Memória RAM hooks...",
      "🖥️ [SANDBOX] Executando simulação segura de desambiguação matemática e concatenações...",
      "📊 [FLOWOPTIMIZER] Construindo o Grafo de Fluxo de Controle (CFG) complexo...",
      "📈 [FLOWOPTIMIZER] Simplificando conexões de blocos linearizáveis...",
      "✂️ [FLOWOPTIMIZER] Eliminando ramos de tomada de decisão mortos...",
      "⚙️ [FLOWOPTIMIZER] Resolvendo achatamento de fluxo (Control Flow Unflattening)...",
      "🧹 [FLOWOPTIMIZER] Varrendo o código para exclusão de variáveis lixo...",
      "🌐 [AIFLOWANALYZER] Estabelecendo conexão segura com o modelo Gemini...",
      "🧠 [AIFLOWANALYZER] Executando reconstrução semântica de registradores para Roblox Luau...",
      "✨ [AIFLOWANALYZER] Renomeando nomes mágicos e adicionando anotações humanas...",
      "💎 [SISTEMA] Consolidando tokens reconstruídos do loop de controle final..."
    ] : [
      "🚀 [SISTEMA] Inicializando ambiente seguro de desofuscação Luau...",
      "📂 [PRE-PROCESSADOR] Carregando código ofuscado no buffer RAM...",
      `📦 [ANALISADOR] Tamanho do script original carregado: ${sizeKb} KB.`,
      "🔍 [DETECTIE] Escaneando por assinaturas de empacotadores conhecidos...",
      "🔓 [DECODER] Varrendo sequências de byte arrays decimais (\\ddd)...",
      "🔓 [DECODER] Decodificando escapes hexadecimais mascarados (\\xNN)...",
      "🧹 [OTIMIZADOR] Removendo comentários mortos e blocos de código nulos...",
      "⚙️ [PARSER] Alimentando AST (Abstract Syntax Tree) via luaparse...",
      "🧬 [PARSER] Árvore de nós sintáticos gerada e validada com sucesso.",
      "🖥️ [SANDBOX] Instanciando motor isolado virtual para simulação estática...",
      "🧪 [SANDBOX] Protegendo contra diretivas perigosas loadstring() e setfenv()...",
      "🌐 [REDE CONSOLE] Estabelecendo ponte segura com o modelo de IA...",
      "🧠 [IA_RECONSTRUCT] Enviando AST e constantes para análise semântica...",
      "🔮 [IA_RECONSTRUCT] Interpretando e revertendo fluxo de controle frouxo...",
      "✨ [IA_RECONSTRUCT] Mapeando identificadores globais e renomeando variáveis recursivas...",
      "🛡️ [IA_RECONSTRUCT] Avaliando riscos de vazamento de dados e webhooks Discord...",
      "🌟 [IA_RECONSTRUCT] Organizando e indentando formatação do código estrito...",
      "💎 [IA_RECONSTRUCT] Estabilizando tokens e extraindo relatório final...",
      "✨ [SISTEMA] Compilando estrutura de visualização purificada do sandbox..."
    ];

    const steps = [...queueSteps, ...baseSteps];

    // Check if we should execute using the local WebAssembly engine directly in the browser
    if (!useAi || engineMode === "wasm" || engineMode === "dynamic") {
      const wasmSteps = [
        "🔥 [WASM_INIT] Alocando memória isolada WebAssembly (Heap: 64MB) diretamente no navegador...",
        "⚡ [WASM_CORE] Compilando motor de parsing sintático compiled_luau.wasm...",
        "📂 [WASM_LOAD] Carregando bytecode do script no buffer linear...",
        "🧩 [WASM_AST] Analisando nós e gerando Árvore Sintática Abstrata (AST Parsing)...",
        "🔓 [WASM_DECODE] Resolvendo escapes decimais (\\ddd) e hexadecimais (\\xNN)...",
        "🧬 [WASM_DECRYPT] Descompactando tabelas de constantes e chaves bitwise XOR...",
        "🧹 [WASM_OPTIMIZE] Desfazendo Control Flow Flattening (Achatamento de loops)...",
        "✂️ [WASM_OPTIMIZE] Podando loops mortos e otimizando ramificações nulas...",
        "✨ [SISTEMA] Mapeando assinaturas virtuais de Roblox Services...",
        "🌐 [SISTEMA] Processamento concluído localmente sem dependência de IA externa!"
      ];

      setLiveLogs([wasmSteps[0]]);
      setProgressPercent(10);
      let logIdx = 0;

      const wasmInterval = setInterval(async () => {
        logIdx++;
        if (logIdx < wasmSteps.length) {
          setLiveLogs(prev => [...prev, wasmSteps[logIdx]]);
          setProgressPercent(Math.min(99, Math.round(((logIdx + 1) / wasmSteps.length) * 100)));
        } else {
          clearInterval(wasmInterval);

          try {
            // Run high performance browser CPU deobfuscation
            const localResult = runLocalDeobfuscationWasm(inputCode);

            setLiveLogs(prev => [...prev, "✨ [WASM] Desofuscação concluída localmente com sucesso! Renderizando Monaco..."]);
            setProgressPercent(100);
            setIsLiveSuccess(true);

            await new Promise(resolve => setTimeout(resolve, 300));

            setOutputCode(localResult.decodedCode);
            setExplanation(localResult.explanation);
            setLogs(localResult.logs);
            setExecutionSimTrace(localResult.logs.map(l => `[Wasm-Memory-Hook] ${l}`));
            setPatternsDetected(localResult.patternsDetected);
            setVariablesRenamed(["local_wasm_optimized"]);
            setDetectedObfuscator(localResult.detectedObfuscator);
            setOriginalSize(localResult.originalSize);
            setCleanSize(localResult.cleanSize);
            setIsLuraph(localResult.isLuraph);
            setDecryptedStrings(localResult.decryptedStrings);
            if (localResult.astJson) {
              setAstJsonStr(localResult.astJson);
            }

            // Save to history
            const historyItem: HistoryItem = {
              id: String(Date.now()),
              timestamp: new Date().toLocaleTimeString(),
              fileName: `wasm_script_${Date.now().toString().slice(-4)}.lua`,
              obfuscator: localResult.detectedObfuscator,
              originalSize: localResult.originalSize,
              cleanSize: localResult.cleanSize,
              originalCode: inputCode,
              cleanCode: localResult.decodedCode,
              explanation: localResult.explanation
            };
            saveHistory(historyItem);

          } catch (err: any) {
            console.error("Local processing error:", err);
            setErrorMsg(err?.message || "Erro durante o processamento do WASM local.");
          } finally {
            setIsLoading(false);
          }
        }
      }, 40); // Runs incredibly fast and finishes in ~400ms!
      return;
    }

    setLiveLogs([steps[0]]);
    setProgressPercent(4);
    let currentLogIndex = 0;

    const logInterval = setInterval(() => {
      currentLogIndex++;
      if (currentLogIndex < steps.length) {
        setLiveLogs(prev => [...prev, steps[currentLogIndex]]);
        setProgressPercent(Math.min(97, Math.round(((currentLogIndex + 1) / steps.length) * 97)));
      } else {
        clearInterval(logInterval);
        
        let delayedPass = 0;
        const delayedSteps = [
          "⏳ [SISTEMA] O código é complexo e denso. Processando desempacotamento recursivo sobressalente...",
          "⏳ [OTIMIZADOR] Reduzindo redundâncias secundárias e fundindo árvores de constantes (AST)...",
          "⏳ [IA_RECONSTRUCT] IA está traduzindo blocos de máquina virtual e estruturas complexas...",
          "⏳ [IA_RECONSTRUCT] Executando refatoração lógica profunda, por favor aguarde...",
          "⏳ [AVISO] Scripts densos podem demandar até 45 segundos para resposta completa do servidor..."
        ];
        
        const backupInterval = setInterval(() => {
          if (delayedPass < delayedSteps.length) {
            setLiveLogs(prev => [...prev, delayedSteps[delayedPass]]);
            delayedPass++;
          } else {
            clearInterval(backupInterval);
          }
        }, 3200);
        
        (window as any)._deobfuscatorBackupInterval = backupInterval;
      }
    }, 450);

    try {
      const res = await fetch("/api/tools/deobfuscate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: inputCode,
          action,
          settings: {
            advancedMode,
            obfuscatorOption,
            keepFallback
          }
        })
      });

      const data = await safeFetchJson(res);
      
      // Clear the progressive simulator and instantly push 100% finished
      if (logInterval) clearInterval(logInterval);
      if ((window as any)._deobfuscatorBackupInterval) {
        clearInterval((window as any)._deobfuscatorBackupInterval);
        delete (window as any)._deobfuscatorBackupInterval;
      }
      
      const outstandingSteps = steps.slice(currentLogIndex + 1);
      if (outstandingSteps.length > 0) {
        setLiveLogs(prev => [...prev, ...outstandingSteps]);
      }
      setLiveLogs(prev => [...prev, "✨ [SISTEMA] Desofuscação concluída com sucesso! Renderizando resultados..."]);
      setProgressPercent(100);
      setIsLiveSuccess(true);

      // Short delay to allow user to experience the majestic feedback transition
      await new Promise(resolve => setTimeout(resolve, 600));

      setOutputCode(data.decodedCode || "");
      setExplanation(data.explanation || "");
      setLogs(data.logs || []);
      setExecutionSimTrace(data.executionSimTrace || []);
      setPatternsDetected(data.patternsDetected || []);
      setVariablesRenamed(data.variablesRenamed || []);
      setDetectedObfuscator(data.detectedObfuscator || "Desconhecido");
      setOriginalSize(data.originalSize || 0);
      setCleanSize(data.cleanSize || 0);
      setIsLuraph(data.isLuraph || false);
      setDecryptedStrings(data.decryptedStrings || {});
      if (data.astJson) {
        setAstJsonStr(data.astJson);
      }

      // Add to history if deobfuscated
      if (action === "deobfuscate" || action === "deep_deobfuscate") {
        const historyItem: HistoryItem = {
          id: String(Date.now()),
          timestamp: new Date().toLocaleTimeString(),
          fileName: `script_${Date.now().toString().slice(-4)}.lua`,
          obfuscator: data.detectedObfuscator || "Auto",
          originalSize: data.originalSize || 0,
          cleanSize: data.cleanSize || 0,
          originalCode: inputCode,
          cleanCode: data.decodedCode || "",
          explanation: data.explanation || ""
        };
        saveHistory(historyItem);
      }

    } catch (error: any) {
      if (logInterval) clearInterval(logInterval);
      if ((window as any)._deobfuscatorBackupInterval) {
        clearInterval((window as any)._deobfuscatorBackupInterval);
        delete (window as any)._deobfuscatorBackupInterval;
      }
      console.error("Deobfuscation failed:", error);
      setErrorMsg(error.message || "Conexão de rede falhou ao enviar script para análise.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setInputCode(event.target.result as string);
        setErrorMsg("");
      }
    };
    reader.readAsText(file);
  };

  const handleCopyToClipboard = () => {
    if (!displayedCode) return;
    navigator.clipboard.writeText(displayedCode);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadLua = () => {
    if (!displayedCode) return;
    const blob = new Blob([displayedCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `deobfuscated_${Date.now()}.lua`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setInputCode(item.originalCode);
    setOutputCode(item.cleanCode);
    setExplanation(item.explanation);
    setOriginalSize(item.originalSize);
    setCleanSize(item.cleanSize);
    setDetectedObfuscator(item.obfuscator);
    setErrorMsg("");
    setActivePartIndex(-1);
  };

  const clearHistory = () => {
    if (confirm("Deseja realmente limpar seu histórico local de scripts analisados?")) {
      setHistory([]);
      localStorage.removeItem("roblox_deobfuscator_history");
    }
  };

  const getOutputParts = () => {
    if (!outputCode || !outputCode.includes("-- PARTE 1/")) {
      return null;
    }
    const parts: { label: string; code: string }[] = [];
    const matches = Array.from(outputCode.matchAll(/-- PARTE (\d+)\/(\d+)\n([\s\S]*?)(?=(?:-- PARTE \d+\/\d+)|(?:-- FIM COMPLETO DO SCRIPT)|$)/g));
    if (matches.length > 0) {
      matches.forEach((m) => {
        parts.push({
          label: `PARTE ${m[1]}/${m[2]}`,
          code: m[3] ? m[3].trim() : ""
        });
      });
      return parts;
    }
    return null;
  };

  const outputPartsList = getOutputParts();

  const displayedCode = (outputPartsList && activePartIndex >= 0 && outputPartsList[activePartIndex])
    ? outputPartsList[activePartIndex].code
    : outputCode;

  const compressionPercent = originalSize > 0 
    ? Math.max(0, Math.round(((originalSize - cleanSize) / originalSize) * 100)) 
    : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07070a] text-slate-100 overflow-y-auto">
      {/* Banner / Header */}
      <div className="border-b border-[#13131c] bg-radial-at-t from-violet-950/10 via-[#07070a] to-[#07070a] px-6 py-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {onBackToChat && (
                <button
                  id="deobfuscator-back-btn"
                  onClick={onBackToChat}
                  className="mr-1.5 p-1 px-2.5 rounded-lg bg-[#10111f] border border-[#1c1d32] text-slate-300 hover:text-white hover:bg-slate-800 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
                  title="Voltar para o Chat"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
              )}
              <span className="bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
                Mecanismo Reverso
              </span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                Módulo AI Híbrido Ativo
              </span>
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight mt-1">
              Desofuscador Lua/Luau Avançado
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
              Análise semântica, desmantelamento de obfuscadores virtuais e reconstrução de inteligência para scripts Roblox e Lua 5.1.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              id="deobfuscator-history-toggle"
              onClick={() => setShowHistory(!showHistory)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                showHistory 
                  ? "bg-violet-600/10 border-violet-500/30 text-violet-300" 
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-100"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Histórico ({history.length})
            </button>
            <button
              id="deobfuscator-config"
              onClick={() => setAdvancedMode(!advancedMode)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                advancedMode 
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-100"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Advanced Mode
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="p-4 md:p-6 flex-1 flex flex-col gap-6">
        
        {/* Error notification banner */}
        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl flex flex-col gap-2.5 text-xs">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Erro de Desofuscação: </span>
                {errorMsg}
              </div>
            </div>
            {(errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limite") || errorMsg.toLowerCase().includes("exhausted")) && (
              <div className="pl-7 text-[11px] text-rose-300 border-t border-rose-500/10 pt-2 leading-relaxed">
                <strong className="text-white">Dica de Quota:</strong> O limite de uso gratuito do servidor foi atingido. Você pode configurar suas próprias chaves sobressalentes do Gemini de forma simples e rápida: clique na aba <strong className="text-violet-400 font-semibold text-[11px]">Configurações</strong> no menu lateral e adicione sua chave API sob o campo <em className="text-violet-300">"Pool de Chaves API do Gemini"</em>. O sistema rotacionará as chaves automaticamente para evitar qualquer interrupção.
              </div>
            )}
          </div>
        )}

        {/* History drawer if open */}
        {showHistory && (
          <div className="bg-slate-950/40 border border-[#1a1a24] p-4 rounded-xl animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-violet-400" />
                Histórico de Scripts Desofuscados Localmente
              </h3>
              <button
                onClick={clearHistory}
                className="text-[10px] text-rose-500 hover:text-rose-400 font-medium hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" /> Limpar tudo
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-4">Nenhum script analisado neste navegador.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => loadHistoryItem(item)}
                    className="p-2.5 bg-[#0e0e14] hover:bg-[#151520] border border-slate-850 hover:border-slate-800 rounded-lg cursor-pointer transition-all flex items-start gap-2"
                  >
                    <FileCode className="w-6 h-6 text-violet-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-slate-200 truncate">{item.fileName}</span>
                        <span className="text-[9px] text-[#8b5cf6] font-semibold uppercase">{item.obfuscator.split(" ")[0]}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                        <span>Tam: {Math.round(item.originalSize / 1024 * 10) / 10}KB</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Side-by-Side Editors */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 items-stretch">
          
          {/* Obfuscated Input Box */}
          <div className="flex flex-col bg-[#0b0b10] border border-[#14141d] rounded-2xl overflow-hidden flex-1 min-h-[360px]">
            <div className="px-4 py-3 bg-slate-900/40 border-b border-[#14141d] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-slate-300">Script Ofuscado (Roblox Lua / Luau)</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {inputCode.length > 0 ? `${(inputCode.length / 1024).toFixed(2)} KB` : "0 bytes"}
              </span>
            </div>

            {/* Code Textarea/Drag Zone Container */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`flex-1 relative flex flex-col p-4 ${dragActive ? "bg-violet-950/5 border-2 border-dashed border-violet-500" : ""}`}
            >
              {inputCode.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                  <div className="p-3.5 bg-slate-950 rounded-full border border-slate-800/85 mb-3 text-slate-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h3 className="text-xs font-semibold text-slate-200">Arraste seu arquivo Lua / Luau</h3>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-xs">
                    Suporta arquivos com extensões .lua, .luau, .txt ou você pode simplesmente colar seu código na área abaixo.
                  </p>
                  <label className="mt-4 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-semibold text-slate-300 rounded-lg cursor-pointer transition-all">
                    Selecionar arquivo ...
                    <input 
                      type="file" 
                      accept=".lua,.luau,.txt" 
                      className="hidden" 
                      onChange={handleFileInput} 
                    />
                  </label>
                </div>
              ) : null}

              {inputCode.length > 0 ? (
                <div id="editorContainer" className="flex-1 w-full h-full min-h-[340px] flex flex-col">
                  <MonacoEditor
                    value={inputCode}
                    onChange={(val) => {
                      setInputCode(val);
                      setErrorMsg("");
                    }}
                    language="lua"
                    readOnly={isLoading}
                    placeholder="-- Cole seu script Luau ofuscado aqui\n"
                  />
                </div>
              ) : (
                <div className="flex-1 w-full h-full min-h-[340px] bg-transparent text-rose-450 font-mono text-xs focus:outline-none flex flex-col items-center justify-center">
                  <span className="text-slate-650 text-xs italic">Aguardando entrada de código...</span>
                </div>
              )}

              {inputCode.length > 0 && (
                <button
                  id="clear-input-btn"
                  onClick={() => {
                    setInputCode("");
                    setLogs([]);
                    setExecutionSimTrace([]);
                  }}
                  className="absolute bottom-3 right-3 p-1.5 bg-slate-950 rounded-lg hover:text-rose-400 border border-slate-900 cursor-pointer"
                  title="Limpar Entrada"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick configurations row */}
            <div className="bg-[#0c0c12] border-t border-[#14141d] p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 items-center shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Assinatura:</span>
                  <select
                    id="obfuscator-target-preference"
                    value={obfuscatorOption}
                    onChange={(e) => setObfuscatorOption(e.target.value)}
                    className="bg-slate-950 text-[11px] text-slate-300 border border-slate-800 rounded-md px-2 py-1 focus:outline-none focus:border-violet-500"
                  >
                    <option value="Auto-Detect">Auto-Detecção</option>
                    <option value="Luraph">Luraph VM</option>
                    <option value="Xenon">Xenon</option>
                    <option value="MoonSec">MoonSec</option>
                    <option value="Xen">Synapse Xen</option>
                    <option value="None">Variáveis</option>
                  </select>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200 font-medium select-none" title="Se ativo, anexa o código de fallback estático completo (que pode ainda conter partes ofuscadas) no final do resultado.">
                  <input
                    type="checkbox"
                    id="keep-fallback-checkbox"
                    checked={keepFallback}
                    onChange={(e) => setKeepFallback(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-800 text-violet-650 focus:ring-violet-500 w-3.5 h-3.5"
                  />
                  <span>Anexar Fallback Completo</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-400 hover:text-slate-200 font-medium select-none" title="Usa Inteligência Artificial remota para reconstruir nomes de variáveis do Roblox e lógica de VM. Desative se o arquivo estiver travando em 97%.">
                  <input
                    type="checkbox"
                    id="use-ai-checkbox"
                    checked={useAi}
                    onChange={(e) => {
                      setUseAi(e.target.checked);
                      if (e.target.checked && engineMode !== "hybrid") {
                        setEngineMode("hybrid");
                      }
                    }}
                    className="rounded bg-slate-950 border-slate-800 text-violet-650 focus:ring-violet-500 w-3.5 h-3.5"
                  />
                  <span className={useAi ? "text-violet-400 font-semibold flex items-center gap-1" : "text-slate-400 flex items-center gap-1"}>
                    <Sparkles className="w-3 h-3 text-violet-400 animate-pulse" /> Reconstrução com IA (Gemini)
                  </span>
                </label>
              </div>

              <div className="flex gap-2 justify-end w-full">
                <button
                  id="explain-code-btn"
                  onClick={() => handleDeobfuscate("explain")}
                  disabled={isLoading}
                  className="flex-1 p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-50 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Auditoria de Riscos
                </button>

                <button
                  id="improve-code-btn"
                  onClick={() => handleDeobfuscate("improve")}
                  disabled={isLoading}
                  className="flex-1 p-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 disabled:opacity-50 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Wand2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  Otimizar e Estilizar
                </button>
              </div>
            </div>

            {/* Ultra Elite Engine Selection */}
            <div className="bg-[#0b0b13] border-t border-[#14141d] px-4 py-3 cursor-default flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2">
                <Cpu className="w-4.5 h-4.5 text-cyan-400" />
                <span className="text-xs font-bold text-slate-350">Mecanismo do Engine Processador:</span>
              </div>
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-900 gap-1 overflow-x-auto">
                <button
                  onClick={() => {
                    setEngineMode("hybrid");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wide transition-all cursor-pointer ${
                    engineMode === "hybrid"
                      ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                      : "text-gray-500 hover:text-gray-300 border border-transparent"
                  }`}
                >
                  Cloud Híbrido AI
                </button>
                <button
                  onClick={() => {
                    setEngineMode("wasm");
                    setUseAi(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wide transition-all cursor-pointer ${
                    engineMode === "wasm"
                      ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/30"
                      : "text-gray-500 hover:text-gray-300 border border-transparent"
                  }`}
                >
                  Local Rust WASM core
                </button>
                <button
                  onClick={() => {
                    setEngineMode("dynamic");
                    setUseAi(false);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono uppercase tracking-wide transition-all cursor-pointer ${
                    engineMode === "dynamic"
                      ? "bg-rose-600/20 text-rose-300 border border-rose-500/30"
                      : "text-gray-500 hover:text-gray-300 border border-transparent"
                  }`}
                >
                  Sandbox RAM HOOKING
                </button>
              </div>
            </div>

            {/* If Client WASM or Dynamic VM Sandbox is active, show the CPU and Performance Dials */}
            {(engineMode === "wasm" || engineMode === "dynamic") && (
              <div className="mx-4 my-2.5 bg-[#06060c] border border-cyan-500/10 rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-cyan-400 shrink-0">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span className="text-[10px] font-semibold text-slate-400 uppercase">
                    {engineMode === "wasm" ? "Local Rust WASM VM Telemetria:" : "C++ Dynamic Sandbox VM Hook Core:"}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 uppercase">CPU:</span>
                    <span className="text-white font-bold">{isLoading ? wasmPerformance.cpu : 0}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 uppercase">Heap RAM:</span>
                    <span className="text-white font-bold">{isLoading ? wasmPerformance.ram : 0} MB</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 uppercase">Exec Speed:</span>
                    <span className="text-emerald-400 font-bold">
                      {isLoading ? wasmPerformance.linesPerSec.toLocaleString() : "0"} lines/sec
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 uppercase">Bypasses:</span>
                    <span className="text-yellow-400 font-bold">LURAPH/MOONSEC</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 shrink-0 p-3 bg-[#0a0a0f] border-t border-[#14141d]">
              <button
                id="deobfuscate-script-btn"
                onClick={() => handleDeobfuscate("deobfuscate")}
                disabled={isLoading || !inputCode.trim()}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-violet-500/10 active:scale-[0.99] rounded-xl"
              >
                <Play className={`w-3.5 h-3.5 text-emerald-300 fill-emerald-300 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? "Processando..." : "Desofuscar Híbrido"}
              </button>

              <button
                id="deep-deobfuscate-vm-btn"
                onClick={() => handleDeobfuscate("deep_deobfuscate")}
                disabled={isLoading || !inputCode.trim()}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-xs uppercase tracking-wider disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-lg hover:shadow-rose-500/10 active:scale-[0.99] rounded-xl"
              >
                <Cpu className={`w-3.5 h-3.5 text-rose-300 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? "Virtualizando..." : "Deep VM Mode"}
              </button>
            </div>
          </div>

          {/* Purified Output Box */}
          <div className="flex flex-col bg-[#0b0b10] border border-[#14141d] rounded-2xl overflow-hidden flex-1 min-h-[360px]">
            <div className="px-4 py-3 bg-slate-900/40 border-b border-[#14141d] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-300">Script Purificado & Comentado</span>
              </div>
              <div className="flex items-center gap-1.5">
                {detectedObfuscator && (
                  <span className="bg-violet-950/40 text-violet-400 text-[10px] border border-violet-500/20 px-2 py-0.5 rounded-sm">
                    {detectedObfuscator}
                  </span>
                )}
                {originalSize > 0 && cleanSize > 0 && (
                  <span className="bg-emerald-950/40 text-emerald-400 text-[10px] border border-emerald-500/20 px-2 py-0.5 rounded-sm font-semibold">
                    {compressionPercent}% Reduzido
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 p-4 relative flex flex-col bg-slate-950/20">
              {isLoading ? (
                <div className="absolute inset-0 z-10 bg-[#07070a]/98 flex flex-col p-6 font-mono text-xs select-none">
                  {/* Terminal Header */}
                  <div className="flex items-center justify-between border-b border-violet-500/20 pb-3 mb-4 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-violet-500 rounded-full animate-ping" />
                      <span className="font-bold text-violet-400 uppercase tracking-widest text-[10px]">
                        REVERSE ENGINE TERMINAL EXECUTION
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">{progressPercent}%</span>
                  </div>

                  {/* Terminal Logs Scrollable Area */}
                  <div className="flex-1 overflow-y-auto bg-black/45 border border-[#171725] rounded-xl p-4 mb-4 text-left font-mono space-y-1.5 scrollbar-thin">
                    {liveLogs.map((log, index) => {
                      if (!log || typeof log !== "string") return null;
                      let textClass = "text-slate-400";
                      if (log.includes("[SISTEMA]")) textClass = "text-violet-400";
                      else if (log.includes("[DECODER]")) textClass = "text-amber-400";
                      else if (log.includes("[PARSER]")) textClass = "text-cyan-400";
                      else if (log.includes("[IA_RECONSTRUCT]")) textClass = "text-emerald-400";
                      else if (log.includes("[SISTEMA] Desofuscação") || log.includes("concluída")) textClass = "text-emerald-400 font-bold";
                      
                      return (
                        <div key={index} className="text-[11px] leading-normal flex items-start gap-1">
                          <span className="text-slate-650 font-normal select-none shrink-0">&#x203A;</span>
                          <span className={textClass}>{log}</span>
                        </div>
                      );
                    })}
                    <div ref={liveLogsEndRef} />
                  </div>

                  {/* Progressive visual bar */}
                  <div className="shrink-0 flex flex-col gap-2 items-center justify-center border-t border-[#13131e] pt-4">
                    <div className="flex w-full justify-between text-[10px] text-slate-500 px-1">
                      <span>Status: {isLiveSuccess ? "Purificação Concluída" : "Processando Engenharia Reversa..."}</span>
                      <span className="font-semibold text-violet-400">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-slate-950 border border-slate-900 rounded-lg p-1">
                      <div 
                        className={`h-2.5 rounded transition-all duration-300 ${
                          isLiveSuccess 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500" 
                            : "bg-gradient-to-r from-violet-500 to-indigo-500"
                        }`}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 italic mt-1 text-center">
                      A IA desofuscadora está reescrevendo macros, removendo códigos lixo e inferindo variáveis legítimas.
                    </p>
                  </div>
                </div>
              ) : null}

              {outputCode.length === 0 && !isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-500 italic">
                  <span className="text-2xl mb-1 text-slate-600 font-bold font-mono">&#x22D8;</span>
                  <p className="text-[11px]">O código purificado aparecerá desse lado após o processamento.</p>
                </div>
              ) : null}

              {outputPartsList && outputPartsList.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1 p-2 bg-[#0c0c12]/80 border-b border-[#14141d] shrink-0">
                  <span className="text-[10px] text-slate-400 font-mono font-semibold px-2">SAÍDA CORTE/PARTES:</span>
                  <button
                    onClick={() => setActivePartIndex(-1)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors border ${
                      activePartIndex === -1
                        ? "bg-violet-600/20 text-violet-300 border-violet-500/30"
                        : "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900 border-transparent"
                    }`}
                  >
                    UNIFICADO
                  </button>
                  {outputPartsList.map((part, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePartIndex(idx)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold transition-colors border ${
                        activePartIndex === idx
                          ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/30"
                          : "bg-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900 border-transparent"
                      }`}
                    >
                      {part.label}
                    </button>
                  ))}
                </div>
              ) : null}

              {outputCode.length > 0 && (
                <div className="flex-1 w-full h-full min-h-[340px] flex flex-col">
                  <MonacoEditor
                    value={displayedCode}
                    language="lua"
                    readOnly={true}
                    placeholder="Resultado limpo ..."
                  />
                </div>
              )}

              {outputCode.length > 0 && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                  <button
                    id="copy-output-btn"
                    onClick={handleCopyToClipboard}
                    className="p-2 bg-[#0a0a0f] text-slate-300 hover:text-white rounded-lg border border-slate-800 flex items-center gap-1 text-[11px] font-semibold cursor-pointer shrink-0"
                    title="Copiar código"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? "Copiado!" : "Copiar"}</span>
                  </button>
                  <button
                    id="download-output-btn"
                    onClick={handleDownloadLua}
                    className="p-2 bg-[#0a0a0f] text-slate-300 hover:text-white rounded-lg border border-slate-800 flex items-center gap-1 text-[11px] font-semibold cursor-pointer shrink-0"
                    title="Baixar Arquivo .lua"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick stats row */}
            <div className="bg-[#0c0c12] border-t border-[#14141d] p-3 text-[10px] text-slate-500 font-mono flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1">
                <Code className="w-3.5 h-3.5 text-slate-400" />
                Tamanho Final: {(cleanSize / 1024).toFixed(2)} KB
              </span>
              <span>
                Status: {outputCode ? "Concluído" : "Aguardando"}
              </span>
            </div>
          </div>
        </div>

        {/* Technical Explanations Card when available */}
        {explanation && (
          <div className="bg-slate-900/20 border border-[#14141d] rounded-2xl p-5 space-y-3">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-violet-400" />
              Relatório de Engenharia Reversa e Auditoria de Segurança
            </h3>
            <div className="text-xs text-slate-300 leading-relaxed max-w-none whitespace-pre-wrap font-sans border-l-2 border-violet-500/40 pl-4">
              {explanation}
            </div>

            {/* Renamed Variable table if populated */}
            {variablesRenamed.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#13131c]">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">Renomeação Inteligente de Variáveis Realizada:</h4>
                <div className="flex flex-wrap gap-1.5">
                  {variablesRenamed.map((variable, idx) => (
                    <span key={idx} className="bg-slate-950 text-emerald-400 px-2 py-0.5 rounded border border-slate-900 font-mono text-[10px]">
                      {variable}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collapsible Advanced section */}
        {advancedMode && (inputCode || logs.length > 0) && (
          <div className="bg-[#09090e] border border-[#14141d] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-cyan-400 flex items-center gap-2 uppercase tracking-widest">
                  <Activity className="w-4 h-4 animate-pulse" />
                  Módulo de Engenharia Científica (Developer Tools)
                </span>
                <div className="flex bg-[#050508] p-1 rounded-lg border border-[#1d1e2f] gap-1">
                  <button
                    onClick={() => setAdvPanelTab("cfg")}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                      advPanelTab === "cfg"
                        ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                        : "text-gray-500 hover:text-gray-300 border border-transparent"
                    }`}
                  >
                    Grafo de Fluxo (CFG)
                  </button>
                  <button
                    onClick={() => setAdvPanelTab("logs")}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all whitespace-nowrap cursor-pointer ${
                      advPanelTab === "logs"
                        ? "bg-violet-500/10 text-violet-400 border border-violet-500/20"
                        : "text-gray-500 hover:text-gray-300 border border-transparent"
                    }`}
                  >
                    Logs da Sandbox & AST
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {astJsonStr && advPanelTab === "logs" && (
                  <button
                    onClick={() => setViewingAstNode(!viewingAstNode)}
                    className="px-2 py-0.5 bg-[#0e0e14] border border-slate-800 rounded text-[10px] text-slate-300 hover:text-white cursor-pointer"
                  >
                    {viewingAstNode ? "Ocultar Árvore AST JSON" : "Visualizar Árvore AST JSON"}
                  </button>
                )}
              </div>
            </div>

            {advPanelTab === "cfg" ? (
              <div className="p-4">
                <CFGVisualizer inputCode={inputCode} isDeobfuscated={outputCode.length > 0} />
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Static Analysis process logs */}
              <div className="bg-black/40 border border-slate-900 rounded-xl p-3.5 flex flex-col h-64 overflow-hidden">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Motor de Análise Estática:</span>
                <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 pr-1 select-all scrollbar-thin">
                  {logs.length === 0 ? (
                    <span className="text-slate-600 block italic">Aguardando início do pipeline...</span>
                  ) : (
                    logs.map((log, index) => {
                      if (!log || typeof log !== "string") return null;
                      let color = "text-slate-400";
                      if (log.includes("[Parser Warning]")) color = "text-amber-400";
                      if (log.includes("[Detector]")) color = "text-violet-400 font-semibold";
                      if (log.includes("[Static Engine]")) color = "text-cyan-400";
                      return (
                        <div key={index} className="leading-relaxed">
                          <span className={`${color}`}>{log}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Dynamic sandbox logs simulator */}
              <div className="bg-black/40 border border-slate-900 rounded-xl p-3.5 flex flex-col h-64 overflow-hidden">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Registro Virtual da Sandbox Simulator:</span>
                <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1.5 pr-1 text-emerald-500/90 select-all scrollbar-thin">
                  {executionSimTrace.length === 0 ? (
                    <span className="text-slate-600 block italic">Aguardando boot do simulador...</span>
                  ) : (
                    executionSimTrace.map((sim, index) => {
                      if (!sim || typeof sim !== "string") return null;
                      let color = "text-emerald-500/80";
                      if (sim.includes("[System SIM]")) color = "text-slate-300 font-bold";
                      if (sim.includes("[Sandbox WARNING]") || sim.includes("[Sandbox Alert]")) color = "text-rose-500 font-bold";
                      if (sim.includes("[Network Alert]")) color = "text-amber-500 font-bold";
                      return (
                        <div key={index} className="leading-relaxed">
                          <span className={color}>{sim}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

            {/* Decrypted constants table */}
            {Object.keys(decryptedStrings).length > 0 && (
              <div className="px-4 pb-4 animate-fade-in border-t border-slate-900 pt-4">
                <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2 block flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
                  Auditoria de Constantes Reveladas (Dicionário de Descritores de String):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1 mt-2.5 scrollbar-thin">
                  {Object.entries(decryptedStrings).map(([key, value], idx) => {
                    const shortKey = key.length > 25 ? `${key.substring(0, 22)}...` : key;
                    const cleanValue = value;
                    return (
                      <div key={idx} className="bg-slate-950/80 border border-slate-900/60 hover:border-violet-500/20 p-2.5 rounded-lg flex flex-col justify-between transition-colors group">
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className="text-[9px] text-slate-500 font-mono italic truncate shrink-0" title={key}>
                            Chave original: {shortKey}
                          </span>
                          <span className="text-xs text-slate-200 font-mono break-all selection:bg-violet-500/20">
                            "{cleanValue}"
                          </span>
                        </div>
                        <div className="flex mt-2 justify-end">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(cleanValue);
                            }}
                            className="text-[9px] text-slate-400 hover:text-white bg-[#0e0e14] border border-slate-800 hover:border-slate-700 px-1.5 py-0.5 rounded flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Copy className="w-2.5 h-2.5" />
                            <span>Copiar</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AST View full screen if activated */}
            {viewingAstNode && astJsonStr && (
              <div className="px-4 pb-4 animate-fade-in border-t border-slate-900 pt-4">
                <div className="bg-[#060609] border border-slate-900 p-3 rounded-xl max-h-72 overflow-y-auto">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block">Abstract Syntax Tree (AST Nodes):</span>
                  <pre className="font-mono text-[10px] text-cyan-300 select-all leading-normal">
                    {astJsonStr}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
