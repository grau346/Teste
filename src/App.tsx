import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./components/sidebar.js";
import { ChatPage } from "./components/chat.js";
import { ToolboxPage } from "./components/toolbox.js";
import { SettingsPage } from "./components/settings.js";
import { DeobfuscatorPage } from "./components/deobfuscator.js";
import { AuthPage } from "./components/auth_page.js";
import { TermsPage } from "./components/terms_page.js";
import { Conversation, ConversationStats, Settings } from "./types.js";
import { safeFetchJson } from "./lib/api_helper.js";

export default function App() {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState<boolean>(() => {
    return localStorage.getItem("terms_accepted") === "true";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [stats, setStats] = useState<ConversationStats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [currentTab, setCurrentTab] = useState<"chat" | "toolbox" | "deobfuscator" | "settings">("chat");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Key validation state
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [isVerifyingSavedKey, setIsVerifyingSavedKey] = useState(true);
  const [activeKeyDetails, setActiveKeyDetails] = useState<{
    keyId: string;
    notes?: string;
    expiresAt: string;
    status: string;
    createdAt?: string;
  } | null>(null);

  // Fetch active key details whenever activeKey is set or changed
  useEffect(() => {
    if (!activeKey) {
      setActiveKeyDetails(null);
      return;
    }
    const fetchKeyDetails = async () => {
      try {
        const { doc, getDoc } = await import("firebase/firestore");
        const { db } = await import("./firebase.js");
        const docRef = doc(db, "access_keys", activeKey);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setActiveKeyDetails({
            keyId: activeKey,
            notes: data.notes || "Usuário Padrão",
            expiresAt: data.expiresAt || "infinite",
            status: data.status || "active",
            createdAt: data.createdAt,
          });
        }
      } catch (err) {
        console.error("Error fetching active key details:", err);
      }
    };
    fetchKeyDetails();
  }, [activeKey]);

  // Verify persistent key on startup
  useEffect(() => {
    const checkSavedKey = async () => {
      const savedKey = localStorage.getItem("user_access_key");
      if (savedKey) {
        try {
          const { doc, getDoc } = await import("firebase/firestore");
          const { db } = await import("./firebase.js");
          const docRef = doc(db, "access_keys", savedKey);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Check status and expiresAt
            if (data.status === "active" && (data.expiresAt === "infinite" || new Date(data.expiresAt) > new Date())) {
              setActiveKey(savedKey);
            } else {
              localStorage.removeItem("user_access_key");
            }
          } else {
            localStorage.removeItem("user_access_key");
          }
        } catch (err) {
          console.error("Error validating persistent key on boot:", err);
          // Fallback to offline saved key if firebase check fails due to network (to avoid blocking during temporary outages)
          setActiveKey(savedKey);
        }
      }
      setIsVerifyingSavedKey(false);
    };
    checkSavedKey();
  }, []);

  // Fetch conversations + stats
  const refreshConversationsAndStats = useCallback(async () => {
    try {
      const currentKey = activeKey || localStorage.getItem("user_access_key") || "";
      if (!currentKey) return;

      // Fetch stats which includes total numbers and recent logs
      const statsRes = await fetch("/api/conversations/stats", {
        headers: { "x-user-key": currentKey }
      });
      const statsData = await safeFetchJson(statsRes);
      setStats(statsData);

      // Fetch conversations
      const convRes = await fetch("/api/conversations", {
        headers: { "x-user-key": currentKey }
      });
      const convData = await safeFetchJson(convRes);
      setConversations(convData);

      // Restaura a conversa anterior ativa do localStorage (específica por chave) ou seleciona a mais recente automaticamente
      setActiveConversationId((prevId) => {
        // Se já houver um ID na memória que pertence a essa lista de conversas do novo usuário, mantém
        if (prevId !== null && convData.some((c: any) => c.id === prevId)) {
          return prevId;
        }
        const savedIdStr = localStorage.getItem(`roblox_ai_active_conv_id_${currentKey}`);
        if (savedIdStr) {
          const savedId = parseInt(savedIdStr, 10);
          if (convData.some((c: any) => c.id === savedId)) {
            return savedId;
          }
        }
        return convData.length > 0 ? convData[0].id : null;
      });
    } catch (error) {
      console.error("Error refreshing conversations statistics:", error);
    }
  }, [activeKey]);

  // Sync activeConversationId change to localStorage (scoped by activeKey)
  useEffect(() => {
    const currentKey = activeKey || localStorage.getItem("user_access_key");
    if (!currentKey) return;
    
    if (activeConversationId !== null) {
      localStorage.setItem(`roblox_ai_active_conv_id_${currentKey}`, activeConversationId.toString());
    } else {
      localStorage.removeItem(`roblox_ai_active_conv_id_${currentKey}`);
    }
  }, [activeConversationId, activeKey]);

  // Fetch initial profile configurations
  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await safeFetchJson(res);
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }, []);

  // Wipes state on activeKey changes to prevent any brief visual blending or leaks
  useEffect(() => {
    setConversations([]);
    setActiveConversationId(null);
  }, [activeKey]);

  useEffect(() => {
    if (activeKey) {
      refreshConversationsAndStats();
      loadSettings();
    }
  }, [refreshConversationsAndStats, loadSettings, activeKey]);

  // Handle Save profile Settings
  const handleSaveSettings = async (updatedSettings: Settings) => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedSettings)
      });
      const data = await safeFetchJson(res);
      setSettings(data);
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Create a new session chat
  const handleNewChat = useCallback(async () => {
    try {
      const currentKey = activeKey || localStorage.getItem("user_access_key") || "";
      if (!currentKey) return;
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-user-key": currentKey
        },
        body: JSON.stringify({ title: "Nova Conversa" })
      });
      const newConv = await res.json();
      setActiveConversationId(newConv.id);
      setCurrentTab("chat");
      await refreshConversationsAndStats();
    } catch (error) {
      console.error("Error creating new chat:", error);
    }
  }, [refreshConversationsAndStats, activeKey]);

  // Delete a specific session
  const handleDeleteConversation = async (id: number) => {
    try {
      const currentKey = activeKey || localStorage.getItem("user_access_key") || "";
      if (!currentKey) return;
      const res = await fetch(`/api/conversations/${id}`, { 
        method: "DELETE",
        headers: { "x-user-key": currentKey }
      });
      if (res.ok) {
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
        await refreshingStatesAndStats();
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const refreshingStatesAndStats = async () => {
    await refreshConversationsAndStats();
  };

  if (!hasAcceptedTerms) {
    return (
      <TermsPage
        onAccept={() => {
          localStorage.setItem("terms_accepted", "true");
          setHasAcceptedTerms(true);
        }}
      />
    );
  }

  if (isVerifyingSavedKey) {
    return (
      <div className="flex flex-col h-screen w-screen justify-center items-center bg-[#07070a] text-gray-200 font-sans">
        <div className="relative flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs uppercase tracking-widest font-mono text-indigo-400">Verificando Licença...</span>
          <span className="text-[10px] text-gray-500 mt-2">Segurança criptografada ativa</span>
        </div>
      </div>
    );
  }

  if (!activeKey) {
    return <AuthPage onUnlock={(key) => setActiveKey(key)} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#07070a] font-sans antialiased selection:bg-violet-600/30 selection:text-white">
      {/* Dynamic Left Sidebar drawer */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setCurrentTab("chat");
        }}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        stats={stats}
        currentTab={currentTab}
        onChangeTab={setCurrentTab}
        onLogout={() => {
          localStorage.removeItem("user_access_key");
          setActiveKey(null);
        }}
      />

      {/* Main Panel View Area switcher */}
      <main id="main-interface" className="flex-1 flex flex-col h-full min-w-0 relative">
        {currentTab === "chat" && (
          <ChatPage
            conversationId={activeConversationId}
            onSelectConversation={setActiveConversationId}
            onNewChat={handleNewChat}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            conversations={conversations}
            onRefreshConversations={refreshConversationsAndStats}
            userKey={activeKey}
          />
        )}

        {currentTab === "toolbox" && (
          <ToolboxPage onBackToChat={() => setCurrentTab("chat")} />
        )}

        {currentTab === "deobfuscator" && (
          <DeobfuscatorPage onBackToChat={() => setCurrentTab("chat")} />
        )}

        {currentTab === "settings" && settings && (
          <SettingsPage
            initialSettings={settings}
            onSave={handleSaveSettings}
            isSaving={isSavingSettings}
            activeKeyDetails={activeKeyDetails}
            stats={stats}
            onBackToChat={() => setCurrentTab("chat")}
          />
        )}
      </main>
    </div>
  );

}
