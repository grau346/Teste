import React, { useState, useEffect, useCallback } from "react";
import { 
  Activity, 
  Search, 
  Key, 
  RefreshCw, 
  Clock, 
  ShieldAlert, 
  Users, 
  CheckCircle, 
  Server, 
  Flame, 
  Copy, 
  Check, 
  Zap, 
  Lock
} from "lucide-react";
import { KeyUsageLog } from "../types.js";

export function UsageLogsPanel() {
  const [logs, setLogs] = useState<KeyUsageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const res = await fetch("/api/admin/usage-logs", {
        headers: {
          "x-user-key": "admin"
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error("Erro ao carregar logs de uso:", err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Poll for logs every 4 seconds for "real-time" display
  useEffect(() => {
    fetchLogs();
    
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh) {
      interval = setInterval(() => {
        setIsRefreshing(true);
        fetchLogs(true);
      }, 4000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh, fetchLogs]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filter logs based on search query (by key ID, status, or endpoint)
  const filteredLogs = logs.filter(log => {
    const q = searchQuery.toLowerCase();
    return (
      log.keyId.toLowerCase().includes(q) ||
      log.status.toLowerCase().includes(q) ||
      log.endpoint.toLowerCase().includes(q) ||
      log.id.toLowerCase().includes(q)
    );
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculations for Admin Analytics Board
  const totalQueries = logs.filter(l => l.status === "Sucesso").length;
  const totalBlockedSecurity = logs.filter(l => l.status.includes("Ataque") || l.status.includes("XSL")).length;
  const totalBlockedRate = logs.filter(l => l.status.includes("Limite") || l.status.includes("Estouro") || l.status.includes("Taxa")).length;
  const uniqueKeys = Array.from(new Set(logs.map(l => l.keyId))).length;
  
  // Estimate tokens approximation: 4 characters per token typically on average
  const totalTokensEstimated = Math.round(
    logs.reduce((acc, log) => acc + (log.promptLength + log.responseLength), 0) / 3.8
  );

  return (
    <div className="space-y-6">
      {/* Analytics Highlights / Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card: Total Requests */}
        <div className="bg-[#0c0d1b]/80 border border-emerald-500/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(16,185,129,0.03)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Consultas Sucesso</p>
            <p className="text-2xl font-bold font-sans text-emerald-400 mt-1">{totalQueries}</p>
            <p className="text-[10px] text-gray-400">Total processados na IA</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 relative z-10 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Card: Active Licenses */}
        <div className="bg-[#0b0c16]/80 border border-indigo-500/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(99,102,241,0.03)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Chaves Ativas</p>
            <p className="text-2xl font-bold font-sans text-indigo-400 mt-1">{uniqueKeys}</p>
            <p className="text-[10px] text-gray-400">Licenças individuais usadas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-950/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 relative z-10 shadow-[0_0_10px_rgba(99,102,241,0.1)]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        {/* Card: XSLT Attacks Prevented */}
        <div className="bg-[#0d0c15]/80 border border-rose-500/15 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(244,63,94,0.03)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Ataques XSL Bloqueados</p>
            <p className="text-2xl font-bold font-sans text-rose-500 mt-1">{totalBlockedSecurity}</p>
            <p className="text-[10px] text-rose-400/80 flex items-center gap-1 font-semibold">
              <ShieldAlert className="w-3 h-3 text-rose-500" />
              Prevenção XSL ativa
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-950/20 border border-rose-500/25 flex items-center justify-center text-rose-500 relative z-10 shadow-[0_0_15px_rgba(244,63,94,0.15)] animate-pulse">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        {/* Card: Bot / Spam Shield */}
        <div className="bg-[#0e0d16]/80 border border-amber-500/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(245,158,11,0.03)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Spam / Bots Throttled</p>
            <p className="text-2xl font-bold font-sans text-amber-500 mt-1">{totalBlockedRate}</p>
            <p className="text-[10px] text-gray-400">Controle de taxa e antibot</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-950/20 border border-amber-500/20 flex items-center justify-center text-amber-500 relative z-10 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        {/* Card: Estimated Tokens */}
        <div className="bg-[#0d0d18]/80 border border-cyan-500/10 rounded-2xl p-4 flex items-center justify-between shadow-[0_0_15px_rgba(6,182,212,0.03)] backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="space-y-1 relative z-10">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-mono">Tokens Estimados</p>
            <p className="text-2xl font-bold font-sans text-cyan-400 mt-1">{totalTokensEstimated.toLocaleString()}</p>
            <p className="text-[10px] text-gray-400">Consumo aproximado total</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-center justify-center text-cyan-400 relative z-10 shadow-[0_0_10px_rgba(6,182,212,0.1)]">
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table controls section */}
      <div className="bg-[#0b0c16]/95 border border-[#1b1c2b] shadow-[0_15px_40px_rgba(0,0,0,0.5)] rounded-2xl p-6 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-950/45 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Activity className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wider font-mono">Fluxo de Telemetria</h3>
              <p className="text-[11px] text-gray-500 font-sans">Visualização instantânea de transações e bloqueios de segurança</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Filtrar por Chave, Status, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-64 bg-[#07070d] border border-[#212338] rounded-xl pl-9 pr-4 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-indigo-500 transition-all font-sans"
              />
              <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* Refresh / Switch Settings buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
                  autoRefresh 
                    ? "bg-indigo-950/30 border-indigo-500/25 text-indigo-400 hover:bg-indigo-950/55" 
                    : "bg-[#07070a] border-[#212338] text-gray-500 hover:text-gray-300"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>{autoRefresh ? "Real-time: Ligado" : "Real-time: Pausado"}</span>
              </button>

              <button
                onClick={() => {
                  setIsRefreshing(true);
                  fetchLogs();
                }}
                disabled={isLoading}
                className="p-1.5 bg-[#07070a] border border-[#212338] text-gray-400 hover:text-gray-200 hover:border-[#383b5e] disabled:opacity-50 rounded-xl cursor-pointer transition-all relative flex items-center justify-center"
                title="Sincronizar Manual"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoading ? "animate-spin text-indigo-400" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Logs Feed List/Table container */}
        <div className="overflow-x-auto rounded-xl border border-[#1b1c2b]">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead>
              <tr className="bg-[#07070c]/90 border-b border-[#1b1c2b] text-[10px] uppercase text-gray-500 tracking-wider font-mono">
                <th className="py-3 px-4 font-semibold text-center w-16">Transação</th>
                <th className="py-3 px-4 font-semibold">Chave de Licença</th>
                <th className="py-3 px-4 font-semibold">Método / Recurso</th>
                <th className="py-3 px-4 font-semibold text-center w-24">Tamanho Prompt</th>
                <th className="py-3 px-4 font-semibold text-center w-24">Tamanho Resposta</th>
                <th className="py-3 px-4 font-semibold text-center w-40 font-mono">Instante</th>
                <th className="py-3 px-4 font-semibold text-center w-48 font-mono">Status da Sessão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#131424]">
              {isLoading && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-sans">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
                      <span>Sincronizando feed de telemetria em tempo real...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-sans">
                    Nenhum registro de consulta encontrado para os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isBlockedSec = log.status.includes("Ataque") || log.status.includes("XSL");
                  const isBlockedLimit = log.status.includes("Limite") || log.status.includes("Estouro") || log.status.includes("Bloqueado");
                  
                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-[#101124]/30 transition-colors ${
                        isBlockedSec ? "bg-rose-950/5" : isBlockedLimit ? "bg-amber-950/5" : ""
                      }`}
                    >
                      {/* ID Block */}
                      <td className="py-3.5 px-4 font-mono font-medium text-gray-400 text-center select-none bg-[#07070a]/10">
                        {log.id}
                      </td>

                      {/* License Key ID Display */}
                      <td className="py-3.5 px-4 font-sans text-gray-300">
                        <div className="flex items-center gap-1.5 group max-w-[200px]">
                          <Key className="w-3.5 h-3.5 text-indigo-400/80 flex-shrink-0" />
                          <span 
                            title={log.keyId} 
                            className="font-mono text-[11px] truncate cursor-pointer hover:text-indigo-400 transition-colors"
                            onClick={() => handleCopy(log.keyId, log.id)}
                          >
                            {log.keyId}
                          </span>
                          <button
                            onClick={() => handleCopy(log.keyId, log.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-300 transition-opacity flex-shrink-0 cursor-pointer"
                            title="Copiar Chave Completa"
                          >
                            {copiedId === log.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Endpoint requested */}
                      <td className="py-3.5 px-4 text-gray-400 font-mono text-[11px] font-medium max-w-[220px] truncate">
                        {log.endpoint}
                      </td>

                      {/* Prompt Char Count */}
                      <td className="py-3.5 px-4 text-center font-mono text-gray-300">
                        {log.status === "Sucesso" ? (
                          <span>{log.promptLength.toLocaleString()} <span className="text-[10px] text-gray-500">chars</span></span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>

                      {/* Reply Char Count */}
                      <td className="py-3.5 px-4 text-center font-mono text-gray-300">
                        {log.status === "Sucesso" ? (
                          <span>{log.responseLength.toLocaleString()} <span className="text-[10px] text-gray-500">chars</span></span>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>

                      {/* Time timestamp */}
                      <td className="py-3.5 px-4 text-center text-gray-500 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()} <span className="text-[10px] text-gray-600">({new Date(log.timestamp).toLocaleDateString()})</span>
                      </td>

                      {/* Status indicator badge */}
                      <td className="py-3.5 px-4">
                        <div className="flex justify-center">
                          {log.status === "Sucesso" ? (
                            <span className="inline-flex items-center gap-1.5 px-2 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider font-mono">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              Atendido
                            </span>
                          ) : isBlockedSec ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 bg-rose-950/45 border border-rose-500/25 text-rose-400 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono shadow-[0_0_10px_rgba(244,63,94,0.1)]">
                              <ShieldAlert className="w-3 h-3 text-rose-500 animate-pulse" />
                              Injeção XSL
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 bg-amber-950/40 border border-amber-500/25 text-amber-500 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider font-mono">
                              <Flame className="w-3 h-3 text-amber-500" />
                              Rate Limited
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Log footer controls / details */}
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 text-[10px] text-gray-500 font-sans">
          <span>Mostrando {filteredLogs.length} de {logs.length} transações recentes</span>
          <span className="text-right text-gray-600 mt-2 sm:mt-0 font-mono">
            Anti-Bot &bull; Anti-XML &bull; Anti-XSL Injection Actives
          </span>
        </div>
      </div>
    </div>
  );
}
