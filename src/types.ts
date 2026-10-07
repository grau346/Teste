export type ExecutorType = "Synapse X" | "KRNL" | "Fluxus" | "Delta" | "Hydrogen" | "Custom";
export type PlatformType = "PC" | "Mobile" | "Console";
export type ObfuscationType = "None" | "Light" | "Heavy";
export type UiLibPreferenceType = "None" | "Rayfield" | "Fluent" | "Orion" | "Custom";

export interface Settings {
  executor: ExecutorType;
  platform: PlatformType;
  obfuscation: ObfuscationType;
  robloxVersion: string;
  scriptStyle: string;
  defaultMode: string;
  uiLibPreference: UiLibPreferenceType;
  systemPromptExtra: string;
  customApiKeys?: string;
}

export interface Conversation {
  id: number;
  title: string;
  userKey?: string | null;
  mode?: string | null;
  executor?: string | null;
  gameTarget?: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface Message {
  id: number;
  conversationId: number;
  role: "user" | "assistant";
  content: string;
  fileUrl?: string | null;
  fileName?: string | null;
  fileData?: string | null; // Raw base64 data if uploaded
  createdAt: string;
}

export interface ConversationStats {
  totalConversations: number;
  totalMessages: number;
  totalScripts: number;
  recentConversations: Conversation[];
}

export interface ExtractedScript {
  index: number;
  code: string;
  language: string;
  messageId: number;
}

// Tool analysis interface definitions
export interface AnalysisResponse {
  issues: string[];
  optimizations: string[];
  score: number;
  fixedCode: string;
  explanation: string;
}

export interface RemoteResponse {
  remotes: {
    name: string;
    type: string;
    path: string;
    args: string[];
    bypassSuggestion: string;
  }[];
  suggestions: string[];
}

export interface ErrorDiagnosticResponse {
  rootCause: string;
  fixedCode: string;
  explanation: string;
  line: number | null;
}

export interface ProfilerResponse {
  issues: {
    type: string;
    description: string;
    line: number | null;
    severity: "critical" | "high" | "medium" | "low";
  }[];
  optimizedCode: string;
  fpsImpact: "critical" | "high" | "medium" | "low";
  warnings: string[];
}

export interface GuiResponse {
  guiJson: string;
  luaCode: string;
  preview: string;
}

export interface KeyUsageLog {
  id: string;
  keyId: string;
  promptLength: number;
  responseLength: number;
  endpoint: string;
  timestamp: string;
  status: string; // 'Success', 'Blocked (Rate Limit)', 'Blocked (Security Attack)'
}

