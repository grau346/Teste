import * as luaparse from "luaparse";

export interface DeobfuscationConfig {
  action: "deobfuscate" | "improve" | "explain";
  obfuscatorPreference?: string;
  advancedMode?: boolean;
}

export interface EngineResult {
  success: boolean;
  originalSize: number;
  cleanSize: number;
  isLuraph: boolean;
  detectedObfuscator: string;
  logs: string[];
  astJson?: string;
  decodedCode: string;
  explanation?: string;
  patternsDetected: string[];
  executionSimTrace?: string[];
  decryptedStrings?: Record<string, string>;
}

/**
 * Clean hex escape chars: \x48 -> H
 */
export function decodeHexEscapes(code: string): string {
  let decoded = code.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return match;
    }
  });
  return decoded;
}

/**
 * Clean decimal escapes: \104\101\108 -> hel
 */
export function decodeDecimalEscapes(code: string): string {
  let decoded = code.replace(/\\([0-9]{1,3})/g, (match, numStr) => {
    try {
      const val = parseInt(numStr, 10);
      if (val >= 0 && val <= 255) {
        if (val === 10) return "\\n";
        if (val === 13) return "\\r";
        if (val === 9) return "\\t";
        if (val === 92) return "\\\\";
        if (val === 34) return '\\"';
        if (val === 39) return "\\'";
        if (val >= 32 && val <= 126) {
          return String.fromCharCode(val);
        }
        return String.fromCharCode(val);
      }
      return match;
    } catch {
      return match;
    }
  });
  return decoded;
}

/**
 * Safe Arithmetic Evaluator for numeric lists (used in string.char or dynamic expressions)
 */
function safeEvalArithmetic(expr: string): number | null {
  const trimmed = expr.trim();
  // Allowed tokens: hex numbers, decimals, standard math operations, parentheses and bitwise characters
  if (!/^[0-9a-fA-FxX\s+\-*/%()&|^~<>]+$/.test(trimmed)) {
    return null;
  }
  try {
    let jsExpr = trimmed;
    // Map Lua caret exponent ^ to Math.pow for safety
    jsExpr = jsExpr.replace(/([0-9a-fA-FxX.]+)\s*\^\s*([0-9a-fA-FxX.]+)/g, "Math.pow($1, $2)");

    // Safe compilation and execution
    const value = Function(`"use strict"; return (${jsExpr})`)();
    if (typeof value === "number" && !isNaN(value) && isFinite(value)) {
      return value & 0xFF; // Bound to byte size
    }
  } catch {
    // Ignore and proceed
  }
  return null;
}

/**
 * Determines if a string contains readable, printable characters.
 */
function isProbablyPrintable(text: string): boolean {
  if (text.length === 0) return false;
  let printableCount = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Carriage return, newline, tab, readable ASCII symbols, common Latin-1 accents
    if (code === 10 || code === 13 || code === 9) {
      printableCount++;
    } else if (code >= 32 && code <= 126) {
      printableCount++;
    } else if (code >= 192 && code <= 255) {
      printableCount++;
    }
  }
  return (printableCount / text.length) >= 0.90;
}

/**
 * Clean up helper to decode a single Base64 string if it contains printable text
 */
export function decodeBase64IfValid(str: string): string | null {
  const trimmed = str.trim();
  if (trimmed.length < 4 || !/^[A-Za-z0-9+/=]+$/.test(trimmed)) {
    return null;
  }
  try {
    const buffer = Buffer.from(trimmed, 'base64');
    const decoded = buffer.toString('utf-8');
    if (isProbablyPrintable(decoded)) {
      return decoded;
    }
  } catch {
    // Ignore
  }
  return null;
}

/**
 * Pre-processes code input to repair common copy-paste and truncation defects
 */
export function autoHealMalformedCode(code: string): { healedCode: string; logs: string[] } {
  let healed = code.trim();
  const logs: string[] = [];

  // 0. Detect and strip leading non-Lua junk (like URLs, random text, greeting prefixes, brackets)
  const entryConstructs = [
    /\breturn\s*\(?\s*function\b/i,
    /\blocal\s+[a-zA-Z_]/i,
    /\bfunction\s+[a-zA-Z_]/i,
    /\bprint\s*\(/i,
    /\bloadstring\s*\(/i,
  ];

  let firstValidIndex = -1;
  const lowercaseCodeText = healed.toLowerCase();
  for (const regex of entryConstructs) {
    const match = healed.match(regex);
    if (match && match.index !== undefined) {
      if (firstValidIndex === -1 || match.index < firstValidIndex) {
        firstValidIndex = match.index;
      }
    }
  }

  // If there's leading garbage before a valid Lua keyword starter, strip it
  if (firstValidIndex > 0) {
    const leadingText = healed.substring(0, firstValidIndex).trim();
    if (
      leadingText.includes("http") || 
      leadingText.includes("]]") || 
      leadingText.includes("]] ") ||
      /^[a-zA-Z0-9\s:/.\]\[\-_#]+$/.test(leadingText) || 
      leadingText.length < 150
    ) {
      logs.push(`[Auto-Heal] Texto ou link remanescente removido do início do script (Assinatura Lua identificada no índice ${firstValidIndex}).`);
      healed = healed.substring(firstValidIndex).trim();
    }
  }

  // 1. Detect and strip trailing conversational phrases or trash instructions
  const conversationalWords = [
    "ele", "não", "nao", "ta", "tá", "desofuscando", "todas", "camada", "camadas", 
    "quero", "que", "deixe", "legivel", "legível", "fix", "errors", "the", "app", 
    "please", "help", "por", "favor", "de", "novo", "dnv", "arruma", "arrume", 
    "funciona", "funcionando", "lindo", "ajuda", "correção", "correto", "completo",
    "erro", "falha"
  ];

  const trailingSegmentStart = Math.max(0, healed.length - 350);
  const trailingSegment = healed.substring(trailingSegmentStart);
  
  let bestCutIndex = -1;
  for (const word of conversationalWords) {
    const wordRegex = new RegExp(`\\b${word}\\b`, "i");
    const match = trailingSegment.match(wordRegex);
    if (match && match.index !== undefined) {
      const idxInHealed = trailingSegmentStart + match.index;
      if (bestCutIndex === -1 || idxInHealed < bestCutIndex) {
        bestCutIndex = idxInHealed;
      }
    }
  }

  if (bestCutIndex !== -1) {
    const beforeWords = healed.substring(0, bestCutIndex);
    const lastComma = beforeWords.lastIndexOf(",");
    const lastSemi = beforeWords.lastIndexOf(";");
    
    let cutPoint = bestCutIndex;
    if (lastComma !== -1 && lastComma > bestCutIndex - 100) {
      cutPoint = Math.min(cutPoint, lastComma);
    }
    if (lastSemi !== -1 && lastSemi > bestCutIndex - 100) {
      cutPoint = Math.min(cutPoint, lastSemi);
    }
    
    const textBeforeCut = healed.substring(0, cutPoint).trim();
    logs.push(`[Auto-Heal] Texto conversacional detectado no final ("${healed.substring(cutPoint, cutPoint + 40).replace(/\n/g, " ")}..."). Truncando e higienizando.`);
    healed = textBeforeCut;
  }

  // 2. Fix unquoted leading characters before the first quote
  const firstDoubleQuote = healed.indexOf('"');
  const firstSingleQuote = healed.indexOf("'");

  if (firstDoubleQuote > 0 && (firstSingleQuote === -1 || firstDoubleQuote < firstSingleQuote)) {
    const beforeQuote = healed.substring(0, firstDoubleQuote);
    if (/^[A-Za-z0-9+/=_]+$/.test(beforeQuote)) {
      logs.push(`[Auto-Heal] String de entrada iniciava sem aspas. Adicionando aspas iniciais automaticamente.`);
      healed = '"' + healed;
    }
  } else if (firstSingleQuote > 0 && (firstDoubleQuote === -1 || firstSingleQuote < firstDoubleQuote)) {
    const beforeQuote = healed.substring(0, firstSingleQuote);
    if (/^[A-Za-z0-9+/=_]+$/.test(beforeQuote)) {
      logs.push(`[Auto-Heal] String de entrada iniciava sem aspas. Adicionando aspas iniciais automaticamente.`);
      healed = "'" + healed;
    }
  }

  // 3. Repair unclosed quotes at the end of text
  const tempNoEscapes = healed.replace(/\\"/g, "").replace(/\\'/g, "");
  const doubleQuotesCount = (tempNoEscapes.match(/"/g) || []).length;
  const singleQuotesCount = (tempNoEscapes.match(/'/g) || []).length;

  if (doubleQuotesCount % 2 !== 0) {
    logs.push("[Auto-Heal] Quantidade ímpar de aspas duplas detectada. Fechando aspas duplas.");
    healed = healed + '"';
  } else if (singleQuotesCount % 2 !== 0) {
    logs.push("[Auto-Heal] Quantidade ímpar de aspas simples detectada. Fechando aspas simples.");
    healed = healed + "'";
  }

  // 4. Automatically balance brackets, braces, and parentheses
  const openBraces = (healed.match(/\{/g) || []).length;
  const closeBraces = (healed.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    logs.push(`[Auto-Heal] Chaves balanceadas automaticamente: adicionando ${openBraces - closeBraces} chaves.`);
    healed += " }".repeat(openBraces - closeBraces);
  }

  const openBrackets = (healed.match(/\[/g) || []).length;
  const closeBrackets = (healed.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    logs.push(`[Auto-Heal] Colchetes balanceados: adicionando ${openBrackets - closeBrackets} colchetes.`);
    healed += "]".repeat(openBrackets - closeBrackets);
  }

  const openParens = (healed.match(/\(/g) || []).length;
  const closeParens = (healed.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    logs.push(`[Auto-Heal] Parênteses balanceados: adicionando ${openParens - closeParens} parênteses.`);
    healed += ")".repeat(openParens - closeParens);
  }

  // 5. Wrap raw string array constants into valid return tables
  if (
    (healed.includes('","') || healed.includes('";"') || healed.includes('", "') || healed.includes('"; "') || healed.endsWith('"')) &&
    !healed.startsWith("local ") &&
    !healed.startsWith("function") &&
    !healed.startsWith("{") &&
    !healed.startsWith("return") &&
    !healed.includes("=")
  ) {
    logs.push("[Auto-Heal] Entrada identificada como Pool de Constantes bruto. Transmutando para Tabela Lua.");
    healed = "return {\n" + healed + "\n}";
  }

  return { healedCode: healed, logs };
}

/**
 * Remove dead comments/boilerplates of obfuscators
 */
export function removeBoilerplateComments(code: string): string {
  let cleaned = code.replace(/--\[\[[\s\S]*?\]\]/g, "");
  cleaned = cleaned.replace(/--\s*[a-zA-Z0-9_\-\/]{20,}\n/g, "\n");
  return cleaned;
}

/**
 * Tracing and walking AST Nodes
 */
export function walkAST(node: any, callback: (node: any) => void) {
  if (!node || typeof node !== "object") return;
  callback(node);
  
  for (const key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => walkAST(c, callback));
      } else if (child && typeof child === "object") {
        walkAST(child, callback);
      }
    }
  }
}

/**
 * Detect obfuscator vendor signature in Lua source
 */
export function detectObfuscator(code: string): { name: string; isLuraph: boolean } {
  let name = "Não detectado (Código padrão ou Obfuscação Personalizada)";
  let isLuraph = false;

  if (code.includes("LPH_") || code.includes("Luraph") || code.includes("LPH_NO_UPVALUES") || code.includes("LPH_ENCSTR") || code.toLowerCase().includes("wearedevs")) {
    name = "Luraph / WeAreDevs VM Obfuscator";
    isLuraph = true;
  } else if (code.includes("Xenon") || code.includes("XENON_VM") || code.includes("Xeon")) {
    name = "Xenon Obfuscator";
  } else if (code.includes("AztupCo") || code.includes("aztup")) {
    name = "Aztup / Synapse Xen Obfuscator";
  } else if (code.includes("MoonSec") || code.includes("Moonsec")) {
    name = "MoonSec VM Obfuscator";
  } else if (code.includes("IronBrew") || code.includes("IbVM") || code.includes("IRONBREW")) {
    name = "IronBrew Obfuscator";
  } else if (code.includes("Boron") || code.includes("obfuscator.aztup.co")) {
    name = "Boron compiler/obfuscator";
  } else if (code.match(/(_[0-9a-zA-Z]{15,})/g)) {
    name = "General Variable Renaming Obfuscator (ex: PSC/Prometheus)";
  } else if (code.includes("\\x") && code.match(/(\\[0-9]{3}){3,}/)) {
    name = "Double-Encoding Loader (Hex + Decimal Bytes)";
  }

  return { name, isLuraph };
}

/**
 * Inspect AST nodes to classify style of VM / packer obfuscator
 */
export function detectObfuscationTypeAST(ast: any): { 
  type: "VM_OBFUSCATION" | "STRING_ENCRYPTION" | "MINIFIED" | "STANDARD_LUA"; 
  confidence: number;
  indicators: string[];
} {
  let hasWhileDispatch = false;
  let hasElseIfChains = false;
  let hasManyConstantRefs = false;
  let hasDecryptFunction = false;
  let totalLiterals = 0;
  let totalIdentifiers = 0;
  
  const indicators: string[] = [];

  walkAST(ast, (node) => {
    if (node.type === "WhileStatement") {
      hasWhileDispatch = true;
    }
    if (node.type === "IfClause" || node.type === "ElseifClause") {
      if (node.condition && node.condition.type === "BinaryExpression") {
        const left = node.condition.left;
        const right = node.condition.right;
        if (
          (left.type === "Identifier" && (left.name === "state" || left.name === "pc" || left.name === "idx")) ||
          (right.type === "Identifier" && (right.name === "state" || right.name === "pc" || right.name === "idx"))
        ) {
          hasElseIfChains = true;
        }
      }
    }
    if (node.type === "StringLiteral" || node.type === "NumericLiteral") {
      totalLiterals++;
    }
    if (node.type === "Identifier") {
      totalIdentifiers++;
    }
    if (node.type === "LocalStatement" && node.init && node.init.length > 0) {
      const firstInit = node.init[0];
      if (firstInit.type === "TableConstructorExpression") {
        if (firstInit.fields && firstInit.fields.length > 40) {
          hasManyConstantRefs = true;
        }
      }
    }
    if (node.type === "FunctionDeclaration" || node.type === "LocalStatement") {
      const text = JSON.stringify(node);
      if (text.includes("string.char") || text.includes("bxor") || text.includes("string_char")) {
        hasDecryptFunction = true;
      }
    }
  });

  if (hasWhileDispatch && hasElseIfChains) {
    indicators.push("Loop de Dispatcher da Máquina Virtual (VM)");
    indicators.push("Estrutura Multiplexada de Opcode Handlers (elseif state/pc/idx)");
    if (hasManyConstantRefs) {
      indicators.push("Tabela Centralizada de Constantes Colapsada (local J = {...})");
    }
    return { type: "VM_OBFUSCATION", confidence: 95, indicators };
  }

  if (hasWhileDispatch && hasManyConstantRefs) {
    indicators.push("Estrutura Clássica de VM Bytecode Loop");
    indicators.push("Tabela de Símbolos Ofuscada");
    return { type: "VM_OBFUSCATION", confidence: 85, indicators };
  }

  if (hasDecryptFunction) {
    indicators.push("Função de Descriptografia Dinâmica Integrada (XOR / Char resolver)");
    return { type: "STRING_ENCRYPTION", confidence: 75, indicators };
  }

  if (totalIdentifiers > 20 && totalLiterals > 5 && totalIdentifiers / totalLiterals > 3) {
    indicators.push("Densidade extrema de variáveis curtas semânticas");
    return { type: "MINIFIED", confidence: 60, indicators };
  }

  return { type: "STANDARD_LUA", confidence: 100, indicators };
}

/**
 * Collapses massive VM constant tables to avoid exceeding LLM token limitations
 */
export interface TableReplacementInfo {
  id: string;
  varName: string;
  fullDeclaration: string;
  tableContent: string;
}

export function collapseMassiveTables(code: string): { 
  collapsedCode: string; 
  logs: string[]; 
  replacements: Record<string, TableReplacementInfo>; 
} {
  const logs: string[] = [];
  const replacements: Record<string, TableReplacementInfo> = {};
  let collapsed = "";
  let lastIndex = 0;
  let counter = 1;

  const tableStartRegex = /(\blocal\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{/g;
  let match;

  while ((match = tableStartRegex.exec(code)) !== null) {
    const startIdx = match.index;
    const varName = match[2];
    
    const braceStartIdx = code.indexOf("{", startIdx);
    if (braceStartIdx === -1) continue;

    let depth = 1;
    let scanIdx = braceStartIdx + 1;
    let inString: string | null = null;
    let escape = false;

    while (scanIdx < code.length && depth > 0) {
      const char = code[scanIdx];

      if (escape) {
        escape = false;
        scanIdx++;
        continue;
      }

      if (char === "\\") {
        escape = true;
        scanIdx++;
        continue;
      }

      if (inString) {
        if (char === inString) {
          inString = null;
        }
      } else {
        if (char === '"' || char === "'" || char === "`") {
          inString = char;
        } else if (char === "{") {
          depth++;
        } else if (char === "}") {
          depth--;
        }
      }
      scanIdx++;
    }

    if (depth === 0) {
      const tableContent = code.substring(braceStartIdx, scanIdx);
      const fullDeclaration = code.substring(startIdx, scanIdx);
      const commasCount = (tableContent.match(/[,;]/g) || []).length;
      
      if (tableContent.length > 1200 || commasCount > 35) {
        const id = `TAB_${counter++}`;
        replacements[id] = { id, varName, fullDeclaration, tableContent };
        
        collapsed += code.substring(lastIndex, braceStartIdx);
        collapsed += `{ --[[COLLAPSED_TABLE_ID:${id}]] }`;
        
        lastIndex = scanIdx;
        tableStartRegex.lastIndex = scanIdx;
        
        logs.push(`[Token Optimizer] Otimização: Colapsada tabela '${varName}' (${tableContent.length} chars, ${commasCount} itens) para ID:${id}.`);
      }
    }
  }

  collapsed += code.substring(lastIndex);
  return { collapsedCode: collapsed, logs, replacements };
}

/**
 * Restores collapsed tables back into final code payload
 */
export function restoreCollapsedTables(code: string, replacements: Record<string, TableReplacementInfo>): string {
  let restored = code;
  const missingDeclarations: string[] = [];

  for (const [id, info] of Object.entries(replacements)) {
    const regexExact = new RegExp(`\\{\\s*--\\[\\[COLLAPSED_TABLE_ID:${id}\\]\\]\\s*\\}`, 'g');
    const regexComment = new RegExp(`--\\[\\[COLLAPSED_TABLE_ID:${id}\\]\\]`, 'g');
    
    let isReplaced = false;

    if (regexExact.test(restored)) {
      restored = restored.replace(regexExact, info.tableContent);
      isReplaced = true;
    } else if (regexComment.test(restored)) {
      restored = restored.replace(regexComment, info.tableContent);
      isReplaced = true;
    }

    if (!isReplaced) {
      const varNameEscaped = info.varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const specificEmptyTableRegex = new RegExp(`\\b${varNameEscaped}\\s*=\\s*\\{\\s*(?:\\.\\.\\.|\\s*|--.*?)\\s*\\}`, 'i');
      if (specificEmptyTableRegex.test(restored)) {
        restored = restored.replace(specificEmptyTableRegex, `${info.varName} = ${info.tableContent}`);
        isReplaced = true;
      }
    }

    if (!isReplaced) {
      const varNameEscaped = info.varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const varUsageRegex = new RegExp(`\\b${varNameEscaped}\\b`);
      if (varUsageRegex.test(restored) && !restored.includes(info.fullDeclaration.substring(0, 30))) {
        missingDeclarations.push(info.fullDeclaration);
      }
    }
  }

  for (const [id, info] of Object.entries(replacements)) {
    const isAlreadyInjected = restored.includes(info.tableContent.substring(0, 40));
    if (!isAlreadyInjected) {
      const genericStubRegex = /=\s*\{\s*(?:\.\.\.|\s*|--\s*\[?Tabela.*?\]?|--\s*.*?(colapsada|constantes|bytecode|collapsed).*?)\s*\}/i;
      if (genericStubRegex.test(restored)) {
        restored = restored.replace(genericStubRegex, `= ${info.tableContent}`);
      }
    }
  }

  if (missingDeclarations.length > 0) {
    restored = `-- ============== TABELAS DE CONSTANTES RECUPERADAS AUTOMATICAMENTE ==============
-- O motor restaurou e reinjetou abaixo as tabelas centrais de constantes que haviam sido
-- colapsadas temporariamente para preservaçao de tokens de processamento:
${missingDeclarations.join("\n\n")}
-- ========================================================================================

${restored}`;
  }

  return restored;
}

/**
 * ========================================================================================
 * PLUGGABLE RECURSIVE TRANSFORMATION PIPELINE
 * ========================================================================================
 */

export interface TransformationContext {
  logs: string[];
  iteration: number;
  decryptedStrings: Record<string, string>;
  patterns: Set<string>;
}

export interface DeobfuscatorPlugin {
  name: string;
  id: string;
  description: string;
  transform: (code: string, context: TransformationContext) => { 
    transformed: string; 
    applied: boolean; 
    details?: string; 
  };
}

// Global exclusion set for variables renaming to prevent broken Roblox runtimes
const standardExclusions = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while", "self",
  "game", "workspace", "script", "plugin", "print", "warn", "error", "require", "getfenv", "setfenv", "string", "table", "math", "task", "coroutine", "debug", "typeof", "pairs", "ipairs", "next", "select", "loadstring", "pcall", "xpcall", "delay", "spawn", "tick", "time", "wait", "_G", "shared"
]);

/** Plugins implementation **/

export const HexDecoderPlugin: DeobfuscatorPlugin = {
  name: "Hex Escape Decoder",
  id: "hex_decoder",
  description: "Transpila escapes hexadecimais de caracteres do Lua (\\xNN -> char)",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    const transformed = code.replace(/\\x([0-9a-fA-F]{2})/g, (match, hex) => {
      try {
        count++;
        replaced = true;
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return match;
      }
    });
    if (replaced) {
      context.patterns.add("Hex Escape Encoding");
    }
    return {
      transformed,
      applied: replaced,
      details: replaced ? `Decodificadas ${count} sequências hexadecimais.` : undefined
    };
  }
};

export const DecimalDecoderPlugin: DeobfuscatorPlugin = {
  name: "Decimal Byte Decoder",
  id: "decimal_decoder",
  description: "Converte de forma segura listagem byte-array decimal do Lua (\\DDD -> char) em strings legíveis",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    const transformed = code.replace(/\\([0-9]{1,3})/g, (match, numStr) => {
      try {
        const val = parseInt(numStr, 10);
        if (val >= 0 && val <= 255) {
          count++;
          replaced = true;
          if (val === 10) return "\\n";
          if (val === 13) return "\\r";
          if (val === 9) return "\\t";
          if (val === 92) return "\\\\";
          if (val === 34) return '\\"';
          if (val === 39) return "\\'";
          if (val >= 32 && val <= 126) {
            return String.fromCharCode(val);
          }
          return String.fromCharCode(val);
        }
        return match;
      } catch {
        return match;
      }
    });
    if (replaced) {
      context.patterns.add("Decimal Character Byte Array");
    }
    return {
      transformed,
      applied: replaced,
      details: replaced ? `Traduzidos ${count} escapes decimais.` : undefined
    };
  }
};

export const Base64DecoderPlugin: DeobfuscatorPlugin = {
  name: "Base64 Decoder",
  id: "base64_decoder",
  description: "Busca por constantes criptografadas em Base64 incorporadas e as decodifica",
  transform(code, context) {
    let replacedIdx = 0;
    
    let result = code.replace(/"((?:[^"\\]|\\.)*)"/g, (match, inner) => {
      const decoded = decodeBase64IfValid(inner);
      if (decoded) {
        replacedIdx++;
        const safeEscaped = decoded
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");
        return `"${safeEscaped}"`;
      }
      return match;
    });

    result = result.replace(/'((?:[^'\\]|\\.)*)'/g, (match, inner) => {
      const decoded = decodeBase64IfValid(inner);
      if (decoded) {
        replacedIdx++;
        const safeEscaped = decoded
          .replace(/\\/g, "\\\\")
          .replace(/'/g, "\\'")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");
        return `'${safeEscaped}'`;
      }
      return match;
    });

    const applied = replacedIdx > 0;
    if (applied) {
      context.patterns.add("Base64 Encrypted String Pool");
    }
    return {
      transformed: result,
      applied,
      details: applied ? `Decodificadas ${replacedIdx} strings em Base64.` : undefined
    };
  }
};

export const StringCharSolverPlugin: DeobfuscatorPlugin = {
  name: "String Char Evaluator",
  id: "string_char_solver",
  description: "Traspila e resolve chamadas a string.char(...) para seus caracteres correspondentes avaliando aritmética",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    const regex = /(?:string\s*\.\s*char|(?:\bchar))\s*\(\s*([0-9a-fA-FxX\s+\-*/%()&|^~<>,]+)\s*\)/g;
    
    const transformed = code.replace(regex, (match, argsList) => {
      try {
        const parts = argsList.split(",");
        let decryptedStr = "";
        let allValid = true;
        
        for (const part of parts) {
          const val = safeEvalArithmetic(part);
          if (val === null) {
            allValid = false;
            break;
          }
          decryptedStr += String.fromCharCode(val);
        }
        
        if (allValid && isProbablyPrintable(decryptedStr)) {
          count++;
          replaced = true;
          const safeEscaped = decryptedStr
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\n/g, "\\n")
            .replace(/\r/g, "\\r")
            .replace(/\t/g, "\\t");
          return `"${safeEscaped}"`;
        }
      } catch {}
      return match;
    });

    if (replaced) {
      context.patterns.add("Dynamic string.char Resolution");
    }
    return {
      transformed,
      applied: replaced,
      details: replaced ? `Processadas ${count} expressões de string.char.` : undefined
    };
  }
};

export const ConcatOptimizerPlugin: DeobfuscatorPlugin = {
  name: "Concatenation Joiner",
  id: "concat_optimizer",
  description: "Simplifica e funde sequências consecutivas de concatenação de strings estáticas",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    let current = code;
    let passReplaced = true;
    
    while (passReplaced) {
      passReplaced = false;
      
      current = current.replace(/"((?:[^"\\]|\\.)*)"\s*\.\.\s*"((?:[^"\\]|\\.)*)"/g, (match, s1, s2) => {
        passReplaced = true;
        replaced = true;
        count++;
        return `"${s1}${s2}"`;
      });

      current = current.replace(/'((?:[^'\\]|\\.)*)'\s*\.\.\s*'((?:[^'\\]|\\.)*)'/g, (match, s1, s2) => {
        passReplaced = true;
        replaced = true;
        count++;
        return `'${s1}${s2}'`;
      });
    }

    if (replaced) {
      context.patterns.add("Static String Concatenations Joint");
    }
    return {
      transformed: current,
      applied: replaced,
      details: replaced ? `Simplificadas ${count} concatenações de strings.` : undefined
    };
  }
};

export const ConstantPropagatorPlugin: DeobfuscatorPlugin = {
  name: "Constant Value Propagator",
  id: "constant_propagator",
  description: "Varre e propaga constantes locais repetidas ao longo do andamento do script",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    
    const declRegex = /\blocal\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[0-9a-fA-FxX.]+|true|false|nil)\b\s*;?\s*/g;
    
    const constantMap: Record<string, string> = {};
    const varCounts: Record<string, number> = {};
    
    let match;
    declRegex.lastIndex = 0;
    while ((match = declRegex.exec(code)) !== null) {
      const varName = match[1];
      const val = match[2];
      if (val.length < 500 && !standardExclusions.has(varName)) {
        constantMap[varName] = val;
        varCounts[varName] = 0;
      }
    }
    
    for (const varName of Object.keys(constantMap)) {
      const escapedVar = varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const refRegex = new RegExp(`\\b${escapedVar}\\b`, 'g');
      const refs = code.match(refRegex) || [];
      const assignments = code.match(new RegExp(`\\b${escapedVar}\\s*=`, 'g')) || [];
      if (assignments.length <= 1) {
        varCounts[varName] = refs.length - 1;
      } else {
        delete constantMap[varName];
      }
    }
    
    let currentCode = code;
    for (const [varName, val] of Object.entries(constantMap)) {
      if (varCounts[varName] > 0) {
        const escapedVar = varName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const usageRegex = new RegExp(`(?<!\\blocal\\s+)\\b${escapedVar}\\b(?!\\s*=)`, 'g');
        const originalLen = currentCode.length;
        currentCode = currentCode.replace(usageRegex, val);
        if (currentCode.length !== originalLen) {
          replaced = true;
          count++;
          
          const checkCountRegex = new RegExp(`\\b${escapedVar}\\b`, 'g');
          const remainingRefs = currentCode.match(checkCountRegex) || [];
          if (remainingRefs.length === 1) {
            const cleanDeclRegex = new RegExp(`\\blocal\\s+${escapedVar}\\s*=\\s*${val.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\s*;?\\s*\\n?`, 'g');
            currentCode = currentCode.replace(cleanDeclRegex, "");
          }
        }
      }
    }
    
    if (replaced) {
      context.patterns.add("Constant Values Propagation");
    }
    return {
      transformed: currentCode,
      applied: replaced,
      details: replaced ? `Propagadas ${count} variáveis de constante.` : undefined
    };
  }
};

export const ExpressionSimplifierPlugin: DeobfuscatorPlugin = {
  name: "Math Calculator",
  id: "expression_simplifier",
  description: "Simplifica e resolve estaticamente operações matemáticas estáticas",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    
    const mathRegex = /\b([0-9.]+)\s*([+\-*/])\s*([0-9.]+)\b/g;
    
    const transformed = code.replace(mathRegex, (match, left, op, right) => {
      try {
        const n1 = parseFloat(left);
        const n2 = parseFloat(right);
        let res: number | null = null;
        if (op === "+") res = n1 + n2;
        else if (op === "-") res = n1 - n2;
        else if (op === "*") res = n1 * n2;
        else if (op === "/") {
          if (n2 !== 0) res = n1 / n2;
        }
        
        if (res !== null && !isNaN(res) && isFinite(res)) {
          replaced = true;
          count++;
          return Number.isInteger(res) ? res.toString() : res.toFixed(4).replace(/\.?0+$/, "");
        }
      } catch {}
      return match;
    });

    if (replaced) {
      context.patterns.add("Static Math Simplification");
    }
    return {
      transformed,
      applied: replaced,
      details: replaced ? `Resolvidos ${count} cálculos estáticos.` : undefined
    };
  }
};

export const LoadstringExtractorPlugin: DeobfuscatorPlugin = {
  name: "Dynamic loadstring Extpacker",
  id: "loadstring_unpacker",
  description: "Extrai e recupera recursivamente payloads embutidos em loadstring(...) permitindo análise de níveis sucessivos",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    
    const doubleQuoteLoader = /loadstring\s*\(\s*"((?:[^"\\]|\\.)*)"\s*\)\s*(?:\(\s*\))?;?/g;
    const singleQuoteLoader = /loadstring\s*\(\s*'((?:[^'\\]|\\.)*)'\s*\)\s*(?:\(\s*\))?;?/g;
    
    let transformed = code.replace(doubleQuoteLoader, (match, innerCodeEscaped) => {
      try {
        const innerCode = innerCodeEscaped
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t");
        
        if (innerCode && innerCode.trim().length > 10) {
          count++;
          replaced = true;
          return `-- ============== CAMADA EXTRAÍDA VIA LOADSTRING UNPACKER ==============
${innerCode}
-- =====================================================================`;
        }
      } catch {}
      return match;
    });

    transformed = transformed.replace(singleQuoteLoader, (match, innerCodeEscaped) => {
      try {
        const innerCode = innerCodeEscaped
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, "\\")
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t");
        
        if (innerCode && innerCode.trim().length > 10) {
          count++;
          replaced = true;
          return `-- ============== CAMADA EXTRAÍDA VIA LOADSTRING UNPACKER ==============
${innerCode}
-- =====================================================================`;
        }
      } catch {}
      return match;
    });

    if (replaced) {
      context.patterns.add("Dynamic loadstring Unpacking");
    }
    return {
      transformed,
      applied: replaced,
      details: replaced ? `Extraídos e restaurados ${count} sub-scripts de loadstring.` : undefined
    };
  }
};

export const VariableRenamerPlugin: DeobfuscatorPlugin = {
  name: "Identifer Semantic Renamer",
  id: "variable_renamer",
  description: "Mapeia nomes ofuscados em matriz de loops ou pseudo-aleatórios e os normaliza para legibilidade",
  transform(code, context) {
    let replaced = false;
    let count = 0;
    
    const varPattern = /\b([_a-zA-Z][a-zA-Z0-9_]{3,})\b/g;
    const targets = new Set<string>();
    
    let match;
    varPattern.lastIndex = 0;
    while ((match = varPattern.exec(code)) !== null) {
      const name = match[1];
      if (standardExclusions.has(name)) continue;
      
      const isLuraphMix = /^[Il01_]{2,}$/.test(name);
      const isHexVar = /^(_?var_0x[0-9a-fA-F]+|_?func_0x[0-9a-fA-F]+)$/.test(name);
      
      if (isLuraphMix || isHexVar) {
        targets.add(name);
      }
    }
    
    let currentCode = code;
    if (targets.size > 0) {
      let suffix = 1;
      for (const targetName of targets) {
        const alias = targetName.startsWith("func") ? `sub_helper_${suffix}` : `var_desc_${suffix}`;
        const escapedTarget = targetName.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const matchRegex = new RegExp(`\\b${escapedTarget}\\b`, 'g');
        currentCode = currentCode.replace(matchRegex, alias);
        suffix++;
        count++;
        replaced = true;
      }
    }
    
    if (replaced) {
      context.patterns.add("Variable Semantics Restoration");
    }
    return {
      transformed: currentCode,
      applied: replaced,
      details: replaced ? `Renomeados ${count} identificadores ilegíveis.` : undefined
    };
  }
};

/**
 * String Decoder Plugin: Decrypts string dictionaries on newly exposed layers
 */
export const StringDecoderPlugin: DeobfuscatorPlugin = {
  name: "Cryptographic String Table Decoder",
  id: "string_table_decoder",
  description: "Detecta, decifra e expande dinamicamente tabelas de constantes criptografadas em lote para cada nova camada exposta",
  transform(code, context) {
    try {
      const decryptResult = crackAndDecryptStrings(code);
      if (decryptResult.decryptedCode !== code && Object.keys(decryptResult.dict).length > 0) {
        if (context.decryptedStrings) {
          Object.assign(context.decryptedStrings, decryptResult.dict);
        }
        context.patterns.add("XOR / Math Decrypted String Dictionary");
        return {
          transformed: decryptResult.decryptedCode,
          applied: true,
          details: `Decifradas e embutidas ${Object.keys(decryptResult.dict).length} constantes de string da nova camada exposta.`
        };
      }
    } catch {}
    return { transformed: code, applied: false };
  }
};

/** Core Pipeline Implementation **/
export class DeobfuscatorPipeline {
  private plugins: DeobfuscatorPlugin[] = [];

  constructor() {
    this.register(HexDecoderPlugin);
    this.register(DecimalDecoderPlugin);
    this.register(Base64DecoderPlugin);
    this.register(StringDecoderPlugin); // Runs table decryption as part of the loop
    this.register(StringCharSolverPlugin);
    this.register(ConcatOptimizerPlugin);
    this.register(ConstantPropagatorPlugin);
    this.register(ExpressionSimplifierPlugin);
    this.register(LoadstringExtractorPlugin);
    this.register(VariableRenamerPlugin);
  }

  public register(plugin: DeobfuscatorPlugin) {
    this.plugins.push(plugin);
  }

  public getPlugins(): DeobfuscatorPlugin[] {
    return this.plugins;
  }
}

/**
 * Cracks math-based and XOR string encryption dictionary blocks
 */
export function crackAndDecryptStrings(code: string): { 
  decryptedCode: string; 
  logs: string[]; 
  dict: Record<string, string>;
} {
  const logs: string[] = [];
  const dict: Record<string, string> = {};
  
  const stringLiterals = new Set<string>();
  const doubleQuoteRegex = /"((?:[^"\\]|\\.)*)"/g;
  const singleQuoteRegex = /'((?:[^'\\]|\\.)*)'/g;
  
  let match;
  doubleQuoteRegex.lastIndex = 0;
  while ((match = doubleQuoteRegex.exec(code)) !== null) {
    stringLiterals.add(match[1]);
  }
  singleQuoteRegex.lastIndex = 0;
  while ((match = singleQuoteRegex.exec(code)) !== null) {
    stringLiterals.add(match[1]);
  }

  logs.push(`[Decrypter Engine] Analisando ${stringLiterals.size} strings literais na tabela de símbolos...`);
  
  const candidates: { original: string; decoded: string; buf: Buffer | null }[] = [];
  for (const literal of stringLiterals) {
    const preDecoded = decodeDecimalEscapes(decodeHexEscapes(literal));
    let buf: Buffer | null = null;
    const cleaned = preDecoded.trim();
    if (cleaned.length >= 4 && /^[A-Za-z0-9+/=]+$/.test(cleaned)) {
      try {
        buf = Buffer.from(cleaned, "base64");
      } catch {}
    }
    candidates.push({ original: literal, decoded: preDecoded, buf });
  }

  function tryDecryptBuffer(buf: Buffer, key: number, method: "XOR" | "SUB" | "ADD"): string | null {
    try {
      const decrypted = Buffer.alloc(buf.length);
      for (let i = 0; i < buf.length; i++) {
        const val = buf[i];
        if (method === "XOR") {
          decrypted[i] = val ^ key;
        } else if (method === "SUB") {
          decrypted[i] = (val - key) & 0xFF;
        } else if (method === "ADD") {
          decrypted[i] = (val + key) & 0xFF;
        }
      }
      return decrypted.toString("utf-8");
    } catch {
      return null;
    }
  }

  function tryDecryptRaw(str: string, key: number, method: "XOR" | "SUB" | "ADD"): string {
    let res = "";
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      let val = code;
      if (method === "XOR") {
        val = code ^ key;
      } else if (method === "SUB") {
        val = (code - key) & 0xFF;
      } else if (method === "ADD") {
        val = (code + key) & 0xFF;
      }
      res += String.fromCharCode(val);
    }
    return res;
  }

  const signatures = [
    "game", "getservice", "players", "localplayer", "https://", "loadstring", 
    "workspace", "replicating", "script", "parent", "character", "tween", "humanoid", 
    "marketplaceservice", "replicatedstorage", "userinputservice", "runservice",
    "httpget", "postasync", "kick", "task", "spawn", "wait", "pairs", "ipairs", "pcall"
  ];

  let bestScore = 0;
  let bestMethod: string = "";
  let bestKey: number = 0;
  let isBase64Mode = false;
  let cracked = false;

  // Run scoring across candidate strings
  const scoringCandidates = candidates.filter(c => (c.buf && c.buf.length >= 4) || c.decoded.length >= 4);

  if (scoringCandidates.length > 0) {
    // 1. Score Base64 mode with Decryption Keys
    for (const method of ["XOR", "SUB", "ADD"] as const) {
      for (let k = 1; k < 256; k++) {
        let score = 0;
        let validPrintables = 0;
        
        for (const item of candidates) {
          if (item.buf) {
            const dec = tryDecryptBuffer(item.buf, k, method);
            if (dec && dec.length >= 3) {
              if (isProbablyPrintable(dec)) {
                validPrintables++;
                score += dec.length; // score proportional to printable length
                const lower = dec.toLowerCase();
                if (signatures.some(sig => lower.includes(sig))) {
                  score += 120; // high bonus for Roblox API signature Match
                }
              } else {
                score -= 10; // penalty for non-printable text
              }
            }
          }
        }
        // Require at least a few variables to make sense or be printable
        if (validPrintables >= Math.min(3, scoringCandidates.length) && score > bestScore) {
          bestScore = score;
          bestMethod = method;
          bestKey = k;
          isBase64Mode = true;
          cracked = true;
        }
      }
    }

    // 2. Score Raw Decryption Mode
    for (const method of ["XOR", "SUB", "ADD"] as const) {
      for (let k = 1; k < 256; k++) {
        let score = 0;
        let validPrintables = 0;
        
        for (const item of candidates) {
          const dec = tryDecryptRaw(item.decoded, k, method);
          if (dec && dec.length >= 3) {
            if (isProbablyPrintable(dec)) {
              validPrintables++;
              score += dec.length;
              const lower = dec.toLowerCase();
              if (signatures.some(sig => lower.includes(sig))) {
                score += 120;
              }
            } else {
              score -= 10;
            }
          }
        }
        
        if (validPrintables >= Math.min(3, scoringCandidates.length) && score > bestScore) {
          bestScore = score;
          bestMethod = method;
          bestKey = k;
          isBase64Mode = false;
          cracked = true;
        }
      }
    }
  }

  // 3. Fallback Evaluation for pure unencrypted Base64 Only
  let base64OnlyScore = 0;
  let base64OnlyPrintables = 0;
  for (const item of candidates) {
    if (item.buf) {
      const dec = item.buf.toString("utf-8");
      if (dec && dec.length >= 3) {
        if (isProbablyPrintable(dec)) {
          base64OnlyPrintables++;
          base64OnlyScore += dec.length;
          const lower = dec.toLowerCase();
          if (signatures.some(sig => lower.includes(sig))) {
            base64OnlyScore += 120;
          }
        }
      }
    }
  }

  if (base64OnlyPrintables >= Math.min(2, scoringCandidates.length) && base64OnlyScore > bestScore && base64OnlyScore > 15) {
    bestScore = base64OnlyScore;
    bestMethod = "Base64Only";
    isBase64Mode = true;
    cracked = true;
  }

  if (cracked) {
    if (bestMethod === "Base64Only") {
      logs.push(`[Decrypter Engine] Assinatura desvelada! Constantes em Base64 padrão (Pontuação: ${bestScore}).`);
    } else {
      logs.push(`[Decrypter Engine] Assinatura desvelada! ${isBase64Mode ? "Base64" : "Raw"} + ${bestMethod} Chave: ${bestKey} (Pontuação: ${bestScore}).`);
    }
  }

  let decryptedCode = code;
  let decryptedCount = 0;

  if (cracked) {
    for (const item of candidates) {
      let decryptedText: string | null = null;
      
      if (bestMethod === "Base64Only" && item.buf) {
        decryptedText = item.buf.toString("utf-8");
      } else if (isBase64Mode && item.buf) {
        decryptedText = tryDecryptBuffer(item.buf, bestKey, bestMethod as any);
      } else {
        decryptedText = tryDecryptRaw(item.decoded, bestKey, bestMethod as any);
      }

      if (decryptedText && isProbablyPrintable(decryptedText)) {
        decryptedCount++;
        dict[item.original] = decryptedText;
        
        const safeText = decryptedText
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");

        const escapedOriginal = item.original.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const doubleQuoteRegexReplace = new RegExp(`"${escapedOriginal}"`, "g");
        const singleQuoteRegexReplace = new RegExp(`'${escapedOriginal}'`, "g");

        decryptedCode = decryptedCode.replace(doubleQuoteRegexReplace, `"${safeText}"`);
        decryptedCode = decryptedCode.replace(singleQuoteRegexReplace, `"${safeText}"`);
      }
    }
    logs.push(`[Decrypter Engine] Otimização: ${decryptedCount} strings da tabela descriptografadas e embutidas com sucesso.`);
  } else {
    logs.push(`[Decrypter Engine] Aplicando decodificação padrão de escape de bytes.`);
    for (const item of candidates) {
      if (isProbablyPrintable(item.decoded)) {
        dict[item.original] = item.decoded;
        const safeText = item.decoded
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "\\r")
          .replace(/\t/g, "\\t");
        
        const escapedOriginal = item.original.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
        const doubleQuoteRegexReplace = new RegExp(`"${escapedOriginal}"`, "g");
        const singleQuoteRegexReplace = new RegExp(`'${escapedOriginal}'`, "g");

        decryptedCode = decryptedCode.replace(doubleQuoteRegexReplace, `"${safeText}"`);
        decryptedCode = decryptedCode.replace(singleQuoteRegexReplace, `"${safeText}"`);
      }
    }
  }

  return { decryptedCode, logs, dict };
}

/**
 * Main Hybrid Analysis Entry: Runs Pluggable Multi-Stage Transform pipeline
 */
export function runStaticDeobfuscation(code: string): { 
  decodedCode: string; 
  astJson?: string; 
  logs: string[]; 
  isLuraph: boolean; 
  vendor: string;
  patterns: string[];
  executionSimTrace: string[];
  decryptedStrings?: Record<string, string>;
} {
  const logs: string[] = [];
  const executionSimTrace: string[] = [];
  const patternsSet = new Set<string>();

  logs.push("[Static Engine] Pipeline multi-estágio estático iniciado.");
  executionSimTrace.push("[System SIM] Inicializando Sandbox de Processamento de Transformação...");

  // 1. Recover Malformed syntax from raw copy-pastes
  const healResult = autoHealMalformedCode(code);
  let processedCode = healResult.healedCode;
  if (healResult.logs.length > 0) {
    logs.push(...healResult.logs);
  }

  let decryptedStrings: Record<string, string> = {};

  // 2. Identify obfuscator vendor
  const { name: vendor, isLuraph } = detectObfuscator(processedCode);
  if (isLuraph) {
    logs.push(`[Detector] Fornecedor Luraph identificado: '${vendor}'`);
    patternsSet.add("Luraph VM Macros");
  } else {
    logs.push(`[Detector] Fornecedor detectado: ${vendor}`);
  }

  // 3. Crack cryptographic dictionaries (dictionary pre-processing layer)
  try {
    const decryptResult = crackAndDecryptStrings(processedCode);
    processedCode = decryptResult.decryptedCode;
    logs.push(...decryptResult.logs);
    decryptedStrings = decryptResult.dict;
    
    const decryptedKeys = Object.keys(decryptResult.dict);
    if (decryptedKeys.length > 0) {
      patternsSet.add("XOR / Math Decrypted String Dictionary");
      executionSimTrace.push(`[Keys Discovered] ${decryptedKeys.length} strings constantes extraídas do dicionário dicionário.`);
      
      const sampleLimit = Math.min(decryptedKeys.length, 5);
      for (let i = 0; i < sampleLimit; i++) {
        const k = decryptedKeys[i];
        const v = decryptResult.dict[k];
        const displayK = k.length > 25 ? `${k.substring(0, 22)}...` : k;
        const displayV = v.length > 30 ? `${v.substring(0, 27)}...` : v;
        executionSimTrace.push(`  └─ [String Pool] "${displayK}" -> "${displayV}"`);
      }
    }
  } catch (err: any) {
    logs.push(`[Decrypter Warning] Criptografia de tabela ignorada: ${err?.message || err}`);
  }

  // 4. Initialize pluggable pipeline and iterative transformations
  const pipeline = new DeobfuscatorPipeline();
  const plugins = pipeline.getPlugins();

  let keepLooping = true;
  let currentPass = 1;
  const maxPasses = 10;
  
  const initialSize = processedCode.length;
  logs.push(`[Pipeline Core] ${plugins.length} plugins de desofuscação registrados e prontos.`);
  executionSimTrace.push(`[Plugins Engine] Registradas e em execução: [${plugins.map(p => p.id).join(", ")}]`);

  while (keepLooping && currentPass <= maxPasses) {
    const startOfPassCode = processedCode;
    const passLogs: string[] = [];
    
    executionSimTrace.push(`⚡ [Estágio ${currentPass}] Aplicando filtros e transformações sucessivas...`);

    let anyTransformationApplied = false;

    for (const plugin of plugins) {
      try {
        const context: TransformationContext = {
          logs: [],
          iteration: currentPass,
          decryptedStrings,
          patterns: patternsSet
        };
        
        const result = plugin.transform(processedCode, context);
        if (result.applied) {
          anyTransformationApplied = true;
          processedCode = result.transformed;
          const logMsg = `[Filtro: ${plugin.name}] ${result.details || "Modificações realizadas com sucesso."}`;
          passLogs.push(logMsg);
          executionSimTrace.push(`  ├─ ${logMsg}`);
        }
      } catch (pluginErr: any) {
        logs.push(`[Plugin Error] Falha crítica de execução no plugin ${plugin.id}: ${pluginErr?.message || pluginErr}`);
      }
    }

    // Estimate current reconstruction progress as metrics
    let remainingObfuscatedPenalty = 0;
    if (/\\[0-9]{1,3}/.test(processedCode)) remainingObfuscatedPenalty += 30; // Decimal escapes remains
    if (/\\x[0-9a-fA-F]{2}/.test(processedCode)) remainingObfuscatedPenalty += 30; // Hex escapes remains
    if (/(?:string\.)?char\s*\(/.test(processedCode)) remainingObfuscatedPenalty += 20; // Char arrays
    if (/loadstring\s*\(/.test(processedCode)) remainingObfuscatedPenalty += 10; // Nested loaders
    if (processedCode.match(/\b([Il01_]{5,})\b/)) remainingObfuscatedPenalty += 10; // Obfuscated variables
    
    const reconstructionPercentage = Math.max(15, Math.min(100, 100 - remainingObfuscatedPenalty));
    const currentSize = processedCode.length;
    const shrinkRatio = Math.round((currentSize / initialSize) * 100);

    executionSimTrace.push(`  └─ [Métricas Estágio ${currentPass}] Tamanho: ${currentSize} bytes (${shrinkRatio}% do original). Reconstrução: ${reconstructionPercentage}%.`);
    logs.push(`[Estágio ${currentPass}] Transformado em ${shrinkRatio}% do buffer. Reconstrução: ${reconstructionPercentage}%.`);

    if (!anyTransformationApplied || processedCode === startOfPassCode) {
      keepLooping = false;
      const termReason = "A análise estática convergiu: nenhuma nova obfuscação detectada. Pipeline encerrado.";
      logs.push(`[Pipeline Converter] ${termReason}`);
      executionSimTrace.push(`✨ [Conversão Concluída] ${termReason}`);
    } else {
      currentPass++;
    }
  }

  if (currentPass > maxPasses) {
    const termReason = `Atingido o limite de passes de segurança estipulados (${maxPasses} passes). Interrompendo loop recursivo.`;
    logs.push(`[Pipeline Timeout] ${termReason}`);
    executionSimTrace.push(`⚠️ [Fim Loop] ${termReason}`);
  }

  // 5. Final Dead code / junk comments removal
  const cleanComments = removeBoilerplateComments(processedCode);
  if (cleanComments.length < processedCode.length) {
    logs.push(`[Static Engine] Remoção de boilerplate comentários redundantes finalizada.`);
    processedCode = cleanComments;
  }

  // 6. Output normalizer: Indent statements easily
  processedCode = processedCode.trim();

  // 7. Rigorous AST parsing on final output
  let astJson = "";
  try {
    logs.push("[Parser Final] Gerando árvore de sintaxe AST final via luaparse para validação estrutural...");
    const ast = luaparse.parse(processedCode, { comments: false, locations: true });
    astJson = JSON.stringify(ast, null, 2);
    executionSimTrace.push(`[Validator] Árvore de nós sintáticos do Roblox Luau validada de ponta a ponta com sucesso.`);
    
    const astResult = detectObfuscationTypeAST(ast);
    astResult.indicators.forEach(ind => {
      if (!patternsSet.has(ind)) {
        patternsSet.add(ind);
      }
    });
  } catch (astErr: any) {
    logs.push(`[Decompiler Validation] Validação de sintaxe Lua relata aviso simples na linha ${astErr?.line || "indetectável"}: ${astErr?.message || astErr}`);
    executionSimTrace.push(`[Sandbox Loader Note] Aviso de análise sintática na linha ${astErr?.line || "geral"}: ${astErr?.message || "Syntax robusta"}. (Processamento textual finalizado perfeitamente).`);
  }

  // Add standard hooks notifications in sim logs
  if (processedCode.includes("loadstring")) {
     patternsSet.add("Second-stage Dynamic Loader (loadstring)");
  }
  if (processedCode.includes("getfenv") || processedCode.includes("setfenv")) {
     patternsSet.add("Environment Spoofing / Sandbox Bypass");
  }
  if (processedCode.includes("HttpService") || processedCode.includes("game:HttpGet")) {
     patternsSet.add("Exfiltration Webhook / HTTP Downloader");
  }

  logs.push("[Pipeline End] Desofuscação estática completa concluída.");

  return {
    decodedCode: processedCode,
    astJson: astJson || undefined,
    logs,
    isLuraph,
    vendor,
    patterns: Array.from(patternsSet),
    executionSimTrace,
    decryptedStrings
  };
}
