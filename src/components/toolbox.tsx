import React, { useState } from "react";
import { 
  Wand2, 
  Search, 
  Bug, 
  Activity, 
  Layout, 
  Terminal, 
  Play, 
  Copy, 
  Check, 
  AlertTriangle, 
  ArrowRight,
  Gauge,
  ArrowLeft
} from "lucide-react";
import { 
  AnalysisResponse, 
  RemoteResponse, 
  ErrorDiagnosticResponse, 
  ProfilerResponse, 
  GuiResponse 
} from "../types.js";
import { safeFetchJson } from "../lib/api_helper.js";

interface ToolboxProps {
  onBackToChat?: () => void;
}

export function ToolboxPage({ onBackToChat }: ToolboxProps) {
  const [activeTool, setActiveTool] = useState<"analyzer" | "scanner" | "diagnostic" | "profiler" | "guibuilder">("analyzer");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form Inputs
  const [luaCodeInput, setLuaCodeInput] = useState("");
  const [errorLogInput, setErrorLogInput] = useState("");
  const [originalCodeInput, setOriginalCodeInput] = useState("");
  const [guiPromptInput, setGuiPromptInput] = useState("");
  const [guiStyle, setGuiStyle] = useState("modern dark");

  // API Outputs
  const [analyzerOutput, setAnalyzerOutput] = useState<AnalysisResponse | null>(null);
  const [scannerOutput, setScannerOutput] = useState<RemoteResponse | null>(null);
  const [diagnosticOutput, setDiagnosticOutput] = useState<ErrorDiagnosticResponse | null>(null);
  const [profilerOutput, setProfilerOutput] = useState<ProfilerResponse | null>(null);
  const [guiOutput, setGuiOutput] = useState<GuiResponse | null>(null);

  const [apiError, setApiError] = useState<string | null>(null);

  const handleCopyCode = (codeText: string) => {
    navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTool = async () => {
    setIsLoading(true);
    setApiError(null);
    try {
      let endpoint = "";
      let payload = {};

      if (activeTool === "analyzer") {
        endpoint = "/api/tools/analyze-script";
        payload = { code: luaCodeInput || "-- Insira seu script Luau aqui" };
      } else if (activeTool === "scanner") {
        endpoint = "/api/tools/remote-scanner";
        payload = { code: luaCodeInput || "-- Insira seu script Luau aqui" };
      } else if (activeTool === "diagnostic") {
        endpoint = "/api/tools/error-diagnostic";
        payload = { errorLog: errorLogInput, originalCode: originalCodeInput };
      } else if (activeTool === "profiler") {
        endpoint = "/api/tools/profiler";
        payload = { code: luaCodeInput || "-- Insira seu script Luau aqui" };
      } else if (activeTool === "guibuilder") {
        endpoint = "/api/tools/gui-builder";
        payload = { prompt: guiPromptInput || "Dashboard de exploits clássico com abas e toggles", style: guiStyle };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await safeFetchJson(res);

      if (activeTool === "analyzer") setAnalyzerOutput(data);
      else if (activeTool === "scanner") setScannerOutput(data);
      else if (activeTool === "diagnostic") setDiagnosticOutput(data);
      else if (activeTool === "profiler") setProfilerOutput(data);
      else if (activeTool === "guibuilder") setGuiOutput(data);

    } catch (err: any) {
      setApiError(err.message || "Falha ao processar ferramentas.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="toolbox-view" className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#07070a] text-slate-200">
      
      {/* Header */}
      <header className="h-13 border-b border-[#1a1a24] bg-[#0a0a0f] flex items-center px-6 shrink-0 justify-between">
        <div className="flex items-center gap-3">
          {onBackToChat && (
            <button
              id="toolbox-back-btn"
              onClick={onBackToChat}
              className="p-1 px-2.5 rounded-lg bg-[#10111f] border border-[#1c1d32] text-slate-300 hover:text-white hover:bg-slate-800 transition-all font-semibold text-xs flex items-center gap-1.5 cursor-pointer"
              title="Voltar para o Chat"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>
          )}
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-cyan-400" />
            <h1 className="font-semibold text-slate-100 text-sm">Roblox Exploiting Toolbox</h1>
          </div>
        </div>
        <div className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-2 py-0.5 rounded flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
          Modulo Auditor de Código
        </div>
      </header>

      {/* Tool Navigation Tabs */}
      <div className="h-11 border-b border-[#1a1a24] bg-[#08080c] flex items-center px-4 overflow-x-auto shrink-0 gap-1.5 scrollbar-none">
        <button
          id="btn-nav-analyzer"
          onClick={() => { setActiveTool("analyzer"); setApiError(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            activeTool === "analyzer"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          Analisar Script
        </button>

        <button
          id="btn-nav-scanner"
          onClick={() => { setActiveTool("scanner"); setApiError(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            activeTool === "scanner"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          Scanner de Remotos
        </button>

        <button
          id="btn-nav-diagnostic"
          onClick={() => { setActiveTool("diagnostic"); setApiError(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            activeTool === "diagnostic"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          <Bug className="w-3.5 h-3.5" />
          Diagnosticar Erro
        </button>

        <button
          id="btn-nav-profiler"
          onClick={() => { setActiveTool("profiler"); setApiError(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            activeTool === "profiler"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          <Gauge className="w-3.5 h-3.5" />
          Performance Profiler
        </button>

        <button
          id="btn-nav-guibuilder"
          onClick={() => { setActiveTool("guibuilder"); setApiError(null); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
            activeTool === "guibuilder"
              ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400"
              : "text-slate-400 hover:text-slate-100"
          }`}
        >
          <Layout className="w-3.5 h-3.5" />
          Criar Roblox GUI
        </button>
      </div>

      {/* Main content grid */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Input Sidebar Panel */}
        <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-[#1a1a24] bg-[#09090e] p-5 overflow-y-auto shrink-0 flex flex-col gap-4">
          
          <div className="border-l-2 border-cyan-500/60 pl-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {activeTool === "analyzer" && "Parâmetros do Analizador"}
              {activeTool === "scanner" && "Identificar Remotes"}
              {activeTool === "diagnostic" && "Análise de Traceback"}
              {activeTool === "profiler" && "FPS & Performance Check"}
              {activeTool === "guibuilder" && "Inteligência de Interface"}
            </h2>
            <p className="text-[10px] text-slate-500">
              {activeTool === "analyzer" && "Identifica brechas de segurança no script Luau alvo."}
              {activeTool === "scanner" && "Busca menções a RemoteEvents executados."}
              {activeTool === "diagnostic" && "Informe o log do erro para diagnóstico."}
              {activeTool === "profiler" && "Verifica loops pesados e threads pendentes."}
              {activeTool === "guibuilder" && "Gera ScreenGuis otimizados com Toggles."}
            </p>
          </div>

          {/* Form Inputs based on active tool */}
          {(activeTool === "analyzer" || activeTool === "scanner" || activeTool === "profiler") && (
            <div className="flex-1 flex flex-col gap-2 min-h-[180px]">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Script Luau Alvo
              </label>
              <textarea
                id="toolbox-script-input"
                value={luaCodeInput}
                onChange={(e) => setLuaCodeInput(e.target.value)}
                placeholder="-- Cole seu script de exploit ou gui do roblox aqui...&#10;wait(2)&#10;game.Players.LocalPlayer.Character.Humanoid.WalkSpeed = 50"
                className="w-full flex-1 min-h-[220px] bg-[#0c0c12] border border-[#1a1a24] text-[#a5f3fc] p-3 rounded-lg text-xs font-mono outline-none focus:border-cyan-500"
              />
            </div>
          )}

          {activeTool === "diagnostic" && (
            <div className="space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Log / Rastro do Erro
                </label>
                <textarea
                  id="diagnostic-log-input"
                  value={errorLogInput}
                  onChange={(e) => setErrorLogInput(e.target.value)}
                  placeholder="Ex: Players.grau346.PlayerGui.ExploitGui.Handler:15: attempt to index nil with 'Character'"
                  className="w-full h-24 bg-[#0c0c12] border border-[#1a1a24] text-rose-300 p-2.5 rounded-lg text-xs font-mono outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5 flex-1 flex flex-col min-h-[140px]">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Script Original (Opcional)
                </label>
                <textarea
                  id="diagnostic-code-input"
                  value={originalCodeInput}
                  onChange={(e) => setOriginalCodeInput(e.target.value)}
                  placeholder="-- Cole o script que gerou o rastro do erro para a IA auditar e corrigir"
                  className="w-full flex-1 bg-[#0c0c12] border border-[#1a1a24] text-slate-300 p-2.5 rounded-lg text-xs font-mono outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          )}

          {activeTool === "guibuilder" && (
            <div className="space-y-4 flex-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  O que a GUI deve conter?
                </label>
                <textarea
                  id="gui-prompt-input"
                  value={guiPromptInput}
                  onChange={(e) => setGuiPromptInput(e.target.value)}
                  placeholder="Ex: Hub de Aim Assist clássico com aba de Combat (Toggles WalkSpeed, Infinite jump) e aba de Visuals (Toggle ESP Boxes)"
                  className="w-full h-36 bg-[#0c0c12] border border-[#1a1a24] text-slate-300 p-2.5 rounded-lg text-xs outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Esquema de Estilo
                </label>
                <select
                  id="gui-style-select"
                  value={guiStyle}
                  onChange={(e) => setGuiStyle(e.target.value)}
                  className="w-full h-10 bg-[#101018] border border-[#1a1a24] text-xs text-slate-300 rounded-lg px-2 focus:outline-none focus:border-cyan-500"
                >
                  <option value="modern dark">Modern Dark (Translucent, Purple Accents)</option>
                  <option value="retro neon cyan">Retro Neon (Cyberpunk, Glowing Cyan)</option>
                  <option value="brutalist sleek">Minimalist (Sleek monochrome blocks)</option>
                  <option value="sakura soft">Vaporwave (Soft pink, warm glow)</option>
                </select>
              </div>
            </div>
          )}

          {/* Action Trigger Button */}
          <button
            id="run-tool-btn"
            onClick={handleRunTool}
            disabled={isLoading}
            className="w-full h-11 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 duration-100 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            {isLoading ? "Compilando Engenharia..." : "Executar Auditoria"}
          </button>
          
        </div>

        {/* Right Output Panel */}
        <div className="flex-1 bg-[#050508] p-5 overflow-y-auto flex flex-col">
          
          {apiError && (
            <div id="api-error-alert" className="p-4 mb-4 border border-rose-500/20 bg-rose-500/10 text-rose-400 rounded-xl text-xs flex flex-col gap-2">
              <div className="flex gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{apiError}</span>
              </div>
              {(apiError.toLowerCase().includes("quota") || apiError.toLowerCase().includes("limite") || apiError.toLowerCase().includes("exhausted")) && (
                <div className="pl-6.5 text-[11px] text-rose-300 border-t border-rose-500/10 pt-2 leading-relaxed">
                  <strong className="text-white">Dica de Quota:</strong> O limite de uso gratuito do servidor foi atingido. Você pode configurar suas próprias chaves sobressalentes do Gemini de forma simples e rápida: clique na aba <strong className="text-violet-400 font-semibold text-[11px]">Configurações</strong> no menu lateral e adicione sua chave API sob o campo <em className="text-violet-300">"Pool de Chaves API do Gemini"</em>. O sistema rotacionará as chaves automaticamente para evitar qualquer interrupção.
                </div>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin mb-4" />
              <p className="text-sm font-semibold tracking-wider text-slate-300">Auditoria Generativa Iniciada</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">Analisando strings e montando árvore léxica Luau via Gemini... por favor, aguarde.</p>
            </div>
          ) : (
            <div className="flex-1 flex flex-col">
              
              {/* Fallback Empty State */}
              {(!analyzerOutput && !scannerOutput && !diagnosticOutput && !profilerOutput && !guiOutput) && (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                  <Terminal className="w-12 h-12 text-slate-800 mb-2 animate-pulse" />
                  <p className="text-sm text-slate-400 font-medium">Saída Virtual Vazia</p>
                  <p className="text-xs text-slate-600 mt-1 max-w-xs">Adicione os parâmetros no painel esquerdo e execute a auditoria para carregar os resultados gerados.</p>
                </div>
              )}

              {/* 1. ANALYZER OUTPUT */}
              {activeTool === "analyzer" && analyzerOutput && (
                <div className="space-y-6">
                  {/* Score circle */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-950/40 p-4 border border-[#1a1a24] rounded-xl">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Pontuação de Integridade do Código</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Pontuação baseada em falhas lógicas e de chamadas remotas.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-mono font-bold text-gradient">{analyzerOutput.score}/100</span>
                      <div className="h-2 w-32 bg-slate-900 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" 
                          style={{ width: `${analyzerOutput.score}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Issues List */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Bugs & Vulnerabilidades
                      </h4>
                      <ul className="bg-slate-950/20 border border-slate-900/60 rounded-xl p-3 divide-y divide-slate-900 text-xs text-slate-400 space-y-2">
                        {analyzerOutput.issues.length === 0 ? (
                          <li className="py-2 italic text-emerald-400/80">Código livre de bugs detectáveis!</li>
                        ) : (
                          analyzerOutput.issues.map((issue, idx) => (
                            <li key={idx} className="py-1.5 flex items-start gap-2 text-[11px] leading-relaxed">
                              <span className="text-rose-500 font-semibold mt-0.5">•</span>
                              {issue}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>

                    {/* Optimizations */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" /> Recomendações e Otimizações
                      </h4>
                      <ul className="bg-slate-950/20 border border-slate-900/60 rounded-xl p-3 divide-y divide-slate-900 text-xs text-slate-400 space-y-2">
                        {analyzerOutput.optimizations.length === 0 ? (
                          <li className="py-2 italic text-slate-500">Nenhum ganho expressivo de performance encontrado.</li>
                        ) : (
                          analyzerOutput.optimizations.map((opt, idx) => (
                            <li key={idx} className="py-1.5 flex items-start gap-2 text-[11px]">
                              <span className="text-emerald-500 font-bold mt-0.5">✓</span>
                              {opt}
                            </li>
                          ))
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Fixed Code */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Script Corrigido & Otimizado</h4>
                      <button 
                        onClick={() => handleCopyCode(analyzerOutput.fixedCode)}
                        className="py-1 px-2.5 rounded hover:bg-slate-900 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer transition-all border border-slate-900"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copiado!" : "Copiar Código"}
                      </button>
                    </div>
                    <pre className="p-4 bg-[#0d0d14] rounded-xl border border-slate-900 overflow-x-auto text-xs font-mono text-cyan-200">
                      <code>{analyzerOutput.fixedCode}</code>
                    </pre>
                  </div>

                  {/* Explanation text */}
                  <div className="bg-[#09090e] p-4 rounded-xl border border-slate-900 text-xs leading-relaxed text-slate-400">
                    <strong className="text-slate-200 block mb-1">Nota do Auditor:</strong>
                    {analyzerOutput.explanation}
                  </div>
                </div>
              )}

              {/* 2. SCANNER OUTPUT */}
              {activeTool === "scanner" && scannerOutput && (
                <div className="space-y-6">
                  <h3 className="text-sm font-bold text-slate-200">Chamadas de Rede Remotas Identificadas</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {scannerOutput.remotes.length === 0 ? (
                      <div className="p-8 border border-dashed border-slate-800 text-xs text-center text-slate-500 italic">
                        Nenhum RemoteEvent/RemoteFunction acionado neste script.
                      </div>
                    ) : (
                      scannerOutput.remotes.map((rem, idx) => (
                        <div key={idx} className="bg-slate-950/40 p-4 border border-[#1a1a24] rounded-xl flex flex-col gap-2">
                          <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                            <span className="font-mono text-xs font-semibold text-emerald-400">{rem.name}</span>
                            <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider">
                              {rem.type}
                            </span>
                          </div>
                          <div className="text-[11px] space-y-1 text-slate-400">
                            <div><strong className="text-slate-300">Caminho no Jogo:</strong> <code className="font-mono text-slate-500">{rem.path}</code></div>
                            <div><strong className="text-slate-300">Estrutura de Argumentos:</strong> <code className="font-mono text-cyan-400/90">[{rem.args.join(", ") || "nenhum"}]</code></div>
                            <div className="mt-2 bg-[#0c0c12] p-2.5 rounded border border-slate-900/60 text-slate-400 text-xs mt-1.5">
                              <strong className="text-slate-200 text-[10px] uppercase tracking-wider block mb-1">Gancho / Forçamento de Bypass:</strong>
                              {rem.bypassSuggestion}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* General scanning suggestions */}
                  {scannerOutput.suggestions.length > 0 && (
                    <div className="bg-[#09090e] p-4 rounded-xl border border-slate-900/60 text-xs text-slate-400 space-y-1.5 leading-relaxed">
                      <strong className="text-slate-200 block mb-1">Ideias de Metatable Hooks:</strong>
                      {scannerOutput.suggestions.map((sug, i) => (
                        <div key={i} className="flex gap-2">
                          <span>•</span>
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 3. DIAGNOSTIC OUTPUT */}
              {activeTool === "diagnostic" && diagnosticOutput && (
                <div className="space-y-5">
                  <div className="bg-rose-500/5 p-4 border border-rose-500/20 rounded-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
                      <Bug className="w-32 h-32 text-rose-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-rose-300">Bug Triggers Detectados</h3>
                      <p className="text-[11px] text-slate-500 mt-1 max-w-md">Estrutura de traceback resolvida correlacionada ao script fornecido.</p>
                    </div>
                    {diagnosticOutput.line && (
                      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono font-medium px-3 py-1.5 rounded-lg shrink-0">
                        Linha Crítica: {diagnosticOutput.line}
                      </div>
                    )}
                  </div>

                  {/* Explanation card */}
                  <div className="bg-slate-950/20 p-4 border border-slate-900 rounded-xl text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-200 block mb-1">Causa Raiz Identificada:</strong>
                    {diagnosticOutput.rootCause}
                  </div>

                  {/* Fixed Code block */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-rose-400 uppercase tracking-widest">Código Corrigido (Anti-Crash)</h4>
                      <button 
                        onClick={() => handleCopyCode(diagnosticOutput.fixedCode)}
                        className="py-1 px-2.5 rounded hover:bg-slate-900 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer transition-all border border-slate-900"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copiado!" : "Copiar Antidoto"}
                      </button>
                    </div>
                    <pre className="p-4 bg-[#0d0d14] rounded-xl border border-slate-900 overflow-x-auto text-xs font-mono text-cyan-200">
                      <code>{diagnosticOutput.fixedCode}</code>
                    </pre>
                  </div>

                  <div className="bg-[#09090e] p-4 rounded-xl border border-slate-900 text-[11px] text-slate-500 leading-relaxed">
                    <strong className="text-slate-200 text-xs block mb-1">Exclusão Passo a Passo:</strong>
                    {diagnosticOutput.explanation}
                  </div>
                </div>
              )}

              {/* 4. PROFILER OUTPUT */}
              {activeTool === "profiler" && profilerOutput && (
                <div className="space-y-6">
                  {/* Status header */}
                  <div className="bg-slate-950/40 p-4 border border-[#1a1a24] rounded-xl flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">Impacto Provedor de FPS</h3>
                      <p className="text-xs text-slate-500">Estimativa de gargalo ou suspensão de ciclo infinito.</p>
                    </div>
                    <span className={`px-3 py-1 rounded text-xs uppercase font-mono tracking-wider font-semibold border ${
                      profilerOutput.fpsImpact === "critical" || profilerOutput.fpsImpact === "high"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    }`}>
                      Impacto {profilerOutput.fpsImpact}
                    </span>
                  </div>

                  {/* Issues block */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5" /> Analises de Loops & Threads
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5">
                      {profilerOutput.issues.length === 0 ? (
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 rounded-xl text-xs">
                          Nenhum vazamento ou loop infinito sem rendimento detectado! Otimização perfeita.
                        </div>
                      ) : (
                        profilerOutput.issues.map((is, i) => (
                          <div key={i} className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg flex items-center justify-between text-xs font-medium">
                            <div className="space-y-1">
                              <span className="font-mono text-slate-300 font-semibold">{is.type}</span>
                              <p className="text-[11px] text-slate-500 leading-relaxed">{is.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              {is.line && <span className="text-[10px] font-mono bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">L{is.line}</span>}
                              <span className={`text-[10px] text-slate-400 font-semibold uppercase px-1.5 py-0.5 rounded ${
                                is.severity === "critical" ? "bg-rose-500/20 text-rose-400" : "bg-yellow-500/20 text-yellow-500"
                              }`}>
                                {is.severity}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Optimized code */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Estrutura de Renderização Otimizada</h4>
                      <button 
                        onClick={() => handleCopyCode(profilerOutput.optimizedCode)}
                        className="py-1 px-2.5 rounded hover:bg-slate-900 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer transition-all border border-slate-900"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copiado!" : "Copiar Otimizações"}
                      </button>
                    </div>
                    <pre className="p-4 bg-[#0d0d14] rounded-xl border border-slate-900 overflow-x-auto text-xs font-mono text-cyan-200">
                      <code>{profilerOutput.optimizedCode}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* 5. GUI BUILDER OUTPUT */}
              {activeTool === "guibuilder" && guiOutput && (
                <div className="space-y-5">
                  <div className="bg-[#0b0b12] border border-[#1a1a24] p-4 rounded-xl">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Live Interactive CSS Setup layout:</h3>
                    {/* Visual Preview */}
                    <div dangerouslySetInnerHTML={{ __html: guiOutput.preview }} />
                  </div>

                  {/* Lua Script code */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Código de Execução Lua</h4>
                      <button 
                        onClick={() => handleCopyCode(guiOutput.luaCode)}
                        className="py-1 px-2.5 rounded hover:bg-slate-900 flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer transition-all border border-slate-900"
                      >
                        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copied ? "Copiar Script" : "Copiar Script"}
                      </button>
                    </div>
                    <pre className="p-4 bg-[#0d0d14] rounded-xl border border-slate-900 overflow-x-auto text-xs font-mono text-cyan-200">
                      <code>{guiOutput.luaCode}</code>
                    </pre>
                  </div>

                  {/* Structure diagram representation */}
                  <div className="bg-[#09090e] p-4 rounded-xl border border-[#1a1a24] text-[11px] font-mono leading-relaxed text-slate-500">
                    <strong className="text-slate-300 font-sans text-xs block mb-1">Hierarquia de Objetos Roblox:</strong>
                    {guiOutput.guiJson}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
