import fs from "fs";
import path from "path";
import { Conversation, Message, Settings, KeyUsageLog } from "./types.js";

const DB_FILE = path.join(process.cwd(), "server_db.json");

interface DbSchema {
  conversations: Conversation[];
  messages: Message[];
  settings: Settings;
  usageLogs?: KeyUsageLog[];
}

const DEFAULT_SETTINGS: Settings = {
  executor: "Custom",
  platform: "PC",
  obfuscation: "None",
  robloxVersion: "Latest",
  scriptStyle: "Clean",
  defaultMode: "Chat",
  uiLibPreference: "None",
  systemPromptExtra: "",
  customApiKeys: ""
};

function readDb(): DbSchema {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const initialDb: DbSchema = {
        conversations: [],
        messages: [],
        settings: DEFAULT_SETTINGS,
        usageLogs: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(initialDb, null, 2), "utf-8");
      return initialDb;
    }
    const content = fs.readFileSync(DB_FILE, "utf-8");
    const parsed = JSON.parse(content);
    // Backward compatibility & integrity checks
    if (!parsed.conversations) parsed.conversations = [];
    if (!parsed.messages) parsed.messages = [];
    if (!parsed.settings) parsed.settings = DEFAULT_SETTINGS;
    if (!parsed.usageLogs) parsed.usageLogs = [];
    return parsed;
  } catch (error) {
    console.error("Error reading database file, returning default schema", error);
    return {
      conversations: [],
      messages: [],
      settings: DEFAULT_SETTINGS
    };
  }
}

function writeDb(data: DbSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

export const db = {
  getSettings(): Settings {
    return readDb().settings;
  },

  saveSettings(settings: Settings): Settings {
    const data = readDb();
    data.settings = { ...data.settings, ...settings };
    writeDb(data);
    return data.settings;
  },

  listConversations(userKey?: string): Conversation[] {
    const data = readDb();
    // Sort conversations by updated date descending
    return data.conversations
      .filter(conv => {
        if (!userKey) return true;
        return conv.userKey === userKey;
      })
      .map(conv => {
        const msgCount = data.messages.filter(m => m.conversationId === conv.id).length;
        return { ...conv, messageCount: msgCount };
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },

  getConversation(id: number, userKey?: string): Conversation | null {
    const conversations = this.listConversations(userKey);
    const found = conversations.find(c => c.id === id);
    return found || null;
  },

  createConversation(title: string, userKey?: string | null, mode?: string, executor?: string, gameTarget?: string): Conversation {
    const data = readDb();
    const nextId = data.conversations.reduce((max, c) => (c.id > max ? c.id : max), 0) + 1;
    const now = new Date().toISOString();
    const newConv: Conversation = {
      id: nextId,
      title: title || "Nova Conversa",
      userKey: userKey || null,
      mode: mode || "Chat",
      executor: executor || null,
      gameTarget: gameTarget || null,
      createdAt: now,
      updatedAt: now,
      messageCount: 0
    };
    data.conversations.push(newConv);
    writeDb(data);
    return newConv;
  },

  updateConversation(id: number, updates: Partial<Conversation>): Conversation | null {
    const data = readDb();
    const index = data.conversations.findIndex(c => c.id === id);
    if (index === -1) return null;
    const now = new Date().toISOString();
    data.conversations[index] = {
      ...data.conversations[index],
      ...updates,
      updatedAt: now
    };
    writeDb(data);
    return data.conversations[index];
  },

  deleteConversation(id: number): boolean {
    const data = readDb();
    const originalLength = data.conversations.length;
    data.conversations = data.conversations.filter(c => c.id !== id);
    data.messages = data.messages.filter(m => m.conversationId !== id);
    writeDb(data);
    return data.conversations.length < originalLength;
  },

  deleteMessage(messageId: number): boolean {
    const data = readDb();
    const originalLength = data.messages.length;
    data.messages = data.messages.filter(m => m.id !== messageId);
    writeDb(data);
    return data.messages.length < originalLength;
  },

  updateMessage(messageId: number, newContent: string): Message | null {
    const data = readDb();
    const index = data.messages.findIndex(m => m.id === messageId);
    if (index === -1) return null;
    data.messages[index].content = newContent;
    writeDb(data);
    return data.messages[index];
  },

  listMessages(conversationId: number): Message[] {
    const data = readDb();
    return data.messages
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  createMessage(conversationId: number, role: "user" | "assistant", content: string, fileUrl?: string | null, fileName?: string | null, fileData?: string | null): Message {
    const data = readDb();
    const nextId = data.messages.reduce((max, m) => (m.id > max ? m.id : max), 0) + 1;
    const now = new Date().toISOString();
    
    const newMsg: Message = {
      id: nextId,
      conversationId,
      role,
      content,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileData: fileData || null,
      createdAt: now
    };
    
    data.messages.push(newMsg);
    
    // Also update conversation updatedAt timestamp
    const convIndex = data.conversations.findIndex(c => c.id === conversationId);
    if (convIndex !== -1) {
      data.conversations[convIndex].updatedAt = now;
    }
    
    writeDb(data);
    return newMsg;
  },

  getStats(userKey?: string): { totalConversations: number; totalMessages: number; totalScripts: number } {
    const data = readDb();
    
    const userConversations = data.conversations.filter(c => {
      if (!userKey) return true;
      return c.userKey === userKey;
    });
    const userConvIds = new Set(userConversations.map(c => c.id));
    const userMessages = data.messages.filter(m => userConvIds.has(m.conversationId));
    
    // Count Lua scripts within assistant messages using standard regex pattern for Lua code blocks
    let totalScripts = 0;
    const luaBlockRegex = /```(?:lua|luau)/gi;
    
    userMessages.forEach(msg => {
      if (msg.role === "assistant") {
        const matches = msg.content.match(luaBlockRegex);
        if (matches) {
          totalScripts += matches.length;
        }
      }
    });

    return {
      totalConversations: userConversations.length,
      totalMessages: userMessages.length,
      totalScripts
    };
  },

  logUsage(keyId: string, promptLength: number, responseLength: number, endpoint: string, status?: string): KeyUsageLog {
    const data = readDb();
    if (!data.usageLogs) data.usageLogs = [];
    const id = "TX" + Math.random().toString(36).substring(2, 8).toUpperCase();
    const now = new Date().toISOString();
    const newLog: KeyUsageLog = {
      id,
      keyId: keyId || "unknown",
      promptLength,
      responseLength,
      endpoint,
      timestamp: now,
      status: status || "Success"
    };
    data.usageLogs.push(newLog);
    // Keep last 1000 logs to prevent server_db.json bloated growth
    if (data.usageLogs.length > 1000) {
      data.usageLogs = data.usageLogs.slice(-1000);
    }
    writeDb(data);
    return newLog;
  },

  getUsageLogs(): KeyUsageLog[] {
    const data = readDb();
    return data.usageLogs || [];
  }
};
