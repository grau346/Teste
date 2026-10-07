import React, { useState } from "react";
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Settings as SettingsIcon, 
  TerminalSquare, 
  X,
  Wand2,
  BarChart2,
  Cpu,
  LogOut
} from "lucide-react";
import { Conversation, ConversationStats } from "../types.js";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onNewChat: () => void;
  onDeleteConversation: (id: number) => void;
  stats: ConversationStats | null;
  currentTab: "chat" | "toolbox" | "deobfuscator" | "settings";
  onChangeTab: (tab: "chat" | "toolbox" | "deobfuscator" | "settings") => void;
  onLogout: () => void;
}

export function Sidebar({
  isOpen = true,
  onClose,
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  stats,
  currentTab,
  onChangeTab,
  onLogout,
}: SidebarProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          id="sidebar-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        id="sidebar-panel"
        className={`fixed md:relative z-40 md:z-auto top-0 left-0 h-full w-72 md:w-64 bg-[#0a0a0f] border-r border-[#1a1a24] flex flex-col text-slate-100 transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#1a1a24] flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold tracking-tight text-violet-400">
            <TerminalSquare className="w-5 h-5 text-gradient animate-pulse-glow" />
            <span className="text-base uppercase tracking-wider text-white">RobloxAI</span>
          </div>
          <button
            id="close-sidebar-btn"
            className="p-1 md:hidden text-slate-400 hover:text-white rounded-md hover:bg-slate-800/50 transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Quick Tool Selector */}
        <div className="p-3 border-b border-[#1a1a24] flex flex-col gap-1.5 shrink-0">
          <button
            id="new-chat-btn"
            onClick={onNewChat}
            className="w-full h-10 px-4 flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium text-sm rounded-lg transition-all shadow-md active:scale-95 duration-100"
          >
            <Plus className="w-4 h-4" />
            Novo Agente Chat
          </button>

          <button
            id="tab-toolbox-btn"
            onClick={() => {
              onChangeTab("toolbox");
              onClose();
            }}
            className={`w-full h-10 px-3 py-2 flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === "toolbox"
                ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-100"
            }`}
          >
            <Wand2 className="w-4 h-4" />
            Roblox Executor Tools
          </button>

          <button
            id="tab-deobfuscator-btn"
            onClick={() => {
              onChangeTab("deobfuscator");
              onClose();
            }}
            className={`w-full h-10 px-3 py-2 flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentTab === "deobfuscator"
                ? "bg-violet-500/10 border border-violet-500/30 text-violet-400 hover:bg-violet-500/20"
                : "text-slate-400 hover:bg-slate-900/60 hover:text-slate-100"
            }`}
          >
            <Cpu className="w-4 h-4 text-violet-400" />
            Desofuscador Avançado
          </button>
        </div>

        {/* Conversation List Title */}
        <div className="px-4 pt-3 pb-1 flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-widest shrink-0">
          <span>Sessões Recentes</span>
          <span className="bg-slate-900 px-1.5 py-0.5 rounded-sm text-[10px] text-slate-400">
            {conversations.length}
          </span>
        </div>

        {/* Scrollable list of Chats */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500 italic">
              Nenhuma sessão ativa
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = currentTab === "chat" && activeConversationId === conv.id;
              return (
                <div
                  key={conv.id}
                  id={`chat-item-${conv.id}`}
                  className={`group flex items-center justify-between rounded-lg transition-all duration-150 ${
                    isActive
                      ? "bg-violet-600/10 border border-violet-500/30 text-violet-300"
                      : "text-slate-400 hover:bg-slate-900/40 hover:text-slate-200 border border-transparent"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectConversation(conv.id);
                      onChangeTab("chat");
                      onClose();
                    }}
                    className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium truncate"
                  >
                    <MessageSquare
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isActive ? "text-violet-400" : "text-slate-500 group-hover:text-slate-400"
                      }`}
                    />
                    <span className="truncate pr-1">{conv.title}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirmDeleteId !== conv.id) {
                        setConfirmDeleteId(conv.id);
                        setTimeout(() => setConfirmDeleteId(null), 3000);
                      } else {
                        onDeleteConversation(conv.id);
                        setConfirmDeleteId(null);
                      }
                    }}
                    className={`p-1 mr-1 rounded-md transition-all cursor-pointer ${
                      confirmDeleteId === conv.id
                        ? "text-rose-500 bg-rose-500/15 scale-110 opacity-100 ring-1 ring-rose-500/30"
                        : "text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover:opacity-100"
                    }`}
                    title={confirmDeleteId === conv.id ? "Clique novamente para confirmar exclusão" : "Excluir Chat"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Stats Summary Panel */}
        {stats && (
          <div className="p-3 border-t border-[#1a1a24] bg-slate-950/20 text-[11px] text-slate-400 flex flex-col gap-2.5 shrink-0">
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-900">
                <div className="font-semibold text-slate-200 text-xs">{stats.totalConversations}</div>
                <div className="text-[10px] text-slate-500">Chats</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-900">
                <div className="font-semibold text-slate-200 text-xs">{stats.totalMessages}</div>
                <div className="text-[10px] text-slate-500">Msgs</div>
              </div>
              <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-900">
                <div className="font-semibold text-slate-200 text-xs">{stats.totalScripts}</div>
                <div className="text-[10px] text-slate-500">Scripts</div>
              </div>
            </div>

            {/* Navigation item: Settings config */}
            <button
              id="settings-tab-btn"
              onClick={() => {
                onChangeTab("settings");
                onClose();
              }}
              className={`w-full py-2 px-3 rounded-lg flex items-center gap-2 transition-all ${
                currentTab === "settings"
                  ? "bg-violet-600/10 border border-violet-500/20 text-violet-400"
                  : "text-slate-400 hover:bg-slate-900/50 hover:text-white"
              } text-xs font-semibold`}
            >
              <SettingsIcon className="w-3.5 h-3.5 shrink-0" />
              <span>Configurar Executor</span>
            </button>

            {/* Log Out button for Active Key */}
            <button
              id="logout-session-btn"
              onClick={() => {
                if (!confirmLogout) {
                  setConfirmLogout(true);
                  setTimeout(() => setConfirmLogout(false), 4000);
                } else {
                  onLogout();
                  setConfirmLogout(false);
                }
              }}
              className={`w-full py-2 px-3 rounded-lg flex items-center justify-between transition-all text-xs font-semibold cursor-pointer ${
                confirmLogout 
                  ? "bg-rose-600/20 text-rose-300 border border-rose-500/30 animate-pulse" 
                  : "text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
              }`}
              title={confirmLogout ? "Clique novamente para confirmar" : "Sair da Licença"}
            >
              <div className="flex items-center gap-2">
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>{confirmLogout ? "Confirmar Saída?" : "Sair da Licença"}</span>
              </div>
              {confirmLogout && (
                <span className="text-[10px] font-mono bg-rose-500/30 px-1.5 py-0.5 rounded text-white animate-bounce shrink-0">
                  SAIR
                </span>
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
