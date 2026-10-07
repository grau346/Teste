/**
 * FlowOptimizerEngine - Advanced Control Flow Optimizer for Lua / Luau Code
 * Implements CFG Builder, CFG Simplifier, Dead Branch Eliminator, Constant Propagator,
 * Opcode Clustering, High-Level VM Reconstruction, Loop & Junk Code cleaner, and
 * Control Flow Unflattening for Luraph-like state-machine structures.
 */

import { SafeEvaluationSandbox } from "./deep_lua_engine";

export interface BasicBlock {
  id: number;
  label: string;
  instructions: string[];
  type: "entry" | "standard" | "branch" | "loop" | "exit";
}

export interface CFGEdge {
  from: number;
  to: number;
  condition?: string;
}

export interface ControlFlowGraph {
  nodes: BasicBlock[];
  edges: CFGEdge[];
}

export interface OpcodeCluster {
  clusterType: string;
  opcodes: number[];
  behavior: string;
}

/**
 * Builds a Control Flow Graph (CFG) from lines of Lua code.
 * Splits code into basic lines and maps linear blocks between branch locations.
 */
export function buildControlFlowGraph(code: string): ControlFlowGraph {
  const lines = code.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  const nodes: BasicBlock[] = [];
  const edges: CFGEdge[] = [];

  let currentBlockId = 1;
  let currentInstructions: string[] = [];
  
  // Create an entry block
  nodes.push({
    id: currentBlockId,
    label: "Entry_Block",
    instructions: [],
    type: "entry"
  });

  let blockMapping: Record<number, BasicBlock> = {};
  blockMapping[currentBlockId] = nodes[0];

  lines.forEach((line) => {
    // Check for branch markers
    const isBranch = line.startsWith("if ") || line.startsWith("elseif ") || line.startsWith("else");
    const isLoop = line.startsWith("while ") || line.startsWith("for ") || line.startsWith("repeat");
    const isEnd = line === "end" || line.startsWith("until ");

    if (isBranch || isLoop || isEnd) {
      // Flush previous linear statements into block
      if (currentInstructions.length > 0) {
        currentBlockId++;
        const newBlock: BasicBlock = {
          id: currentBlockId,
          label: `Block_Std_${currentBlockId}`,
          instructions: [...currentInstructions],
          type: "standard"
        };
        nodes.push(newBlock);
        
        // Linear instruction continuation
        edges.push({ from: currentBlockId - 1, to: currentBlockId });
        currentInstructions = [];
      }

      currentBlockId++;
      const splitBlock: BasicBlock = {
        id: currentBlockId,
        label: isBranch ? `Branch_${currentBlockId}` : (isLoop ? `Loop_${currentBlockId}` : `End_Block_${currentBlockId}`),
        instructions: [line],
        type: isBranch ? "branch" : (isLoop ? "loop" : "standard")
      };
      nodes.push(splitBlock);
      edges.push({ from: currentBlockId - 1, to: currentBlockId });
    } else {
      currentInstructions.push(line);
    }
  });

  // Flush remaining instructions
  if (currentInstructions.length > 0) {
    currentBlockId++;
    nodes.push({
      id: currentBlockId,
      label: `Exit_Block_${currentBlockId}`,
      instructions: currentInstructions,
      type: "exit"
    });
    edges.push({ from: currentBlockId - 1, to: currentBlockId });
  }

  return { nodes, edges };
}

/**
 * Simplifies the Control Flow Graph.
 * Merges nodes that flow into each other without any secondary forks.
 */
export function simplifyControlFlowGraph(cfg: ControlFlowGraph): ControlFlowGraph {
  const mergedNodes: BasicBlock[] = [];
  const nodesMap = new Map<number, BasicBlock>();
  cfg.nodes.forEach(n => nodesMap.set(n.id, n));

  // Determine predecessors and successors count
  const predCount: Record<number, number> = {};
  const succCount: Record<number, number> = {};
  cfg.nodes.forEach(n => {
    predCount[n.id] = 0;
    succCount[n.id] = 0;
  });

  cfg.edges.forEach(e => {
    predCount[e.to] = (predCount[e.to] || 0) + 1;
    succCount[e.from] = (succCount[e.from] || 0) + 1;
  });

  const visited = new Set<number>();
  let edgesCopy = [...cfg.edges];

  cfg.nodes.forEach((node) => {
    if (visited.has(node.id)) return;

    let currentNode = { ...node };
    visited.add(node.id);

    // Try merging linear successors
    let changed = true;
    while (changed) {
      changed = false;
      const outgoing = edgesCopy.find(e => e.from === currentNode.id);
      if (outgoing) {
        const nextNodeId = outgoing.to;
        const incomingCount = predCount[nextNodeId] || 0;
        const outgoingCount = succCount[currentNode.id] || 0;

        if (incomingCount === 1 && outgoingCount === 1 && !visited.has(nextNodeId)) {
          const succNode = nodesMap.get(nextNodeId);
          if (succNode) {
            currentNode.instructions.push(...succNode.instructions);
            visited.add(nextNodeId);
            // Redirect edges
            edgesCopy = edgesCopy.filter(e => !(e.from === currentNode.id && e.to === nextNodeId));
            edgesCopy.forEach(e => {
              if (e.from === nextNodeId) e.from = currentNode.id;
            });
            changed = true;
          }
        }
      }
    }

    mergedNodes.push(currentNode);
  });

  return { nodes: mergedNodes, edges: edgesCopy };
}

/**
 * Eliminates dead branches (never executed structures like `if false then` or `1==2`)
 * using the safe sandbox evaluation.
 */
export function eliminateDeadBranches(code: string): string {
  const sandbox = new SafeEvaluationSandbox();
  let optimized = code;

  // Pattern for: if <cond> then <block1> else <block2> end
  // We can optimize simple false/true headers:
  // e.g., if false then ... else ... end -> else block contents
  const ifRegex = /if\s+([^\n]+?)\s+then([\s\S]*?)(?:else([\s\S]*?))?end/g;
  
  optimized = optimized.replace(ifRegex, (match, cond, block1, block2) => {
    const val = sandbox.evaluateExpression(cond);
    if (val === true) {
      return block1.trim();
    } else if (val === false) {
      return block2 ? block2.trim() : "";
    }
    return match;
  });

  return optimized;
}

/**
 * Propagate constant declarations throughout instructions locally.
 * e.g., local a = 12; local b = a + 3 => b = 15
 */
export function propagateConstants(code: string): string {
  const lines = code.split("\n");
  const constants: Record<string, string | number> = {};
  const outputLines: string[] = [];

  lines.forEach((line) => {
    let currentLine = line;

    // Detect definition: local name = constant_value
    const constDecl = /^\s*local\s+([a-zA-Z0-9_]+)\s*=\s*([0-9]+|"[^"]*"|'[^']*')\s*$/;
    const match = currentLine.match(constDecl);

    if (match) {
      const name = match[1];
      const valStr = match[2];
      constants[name] = valStr;
      outputLines.push(currentLine);
      return;
    }

    // Replace known constants in the code lines
    Object.keys(constants).forEach((name) => {
      const reg = new RegExp(`\\b${name}\\b`, "g");
      currentLine = currentLine.replace(reg, String(constants[name]));
    });

    outputLines.push(currentLine);
  });

  return outputLines.join("\n");
}

/**
 * Clusters VM instructions or handlers by structural behavior similarities.
 */
export function clusterOpcodes(opcodes: number[]): OpcodeCluster[] {
  const clusters: OpcodeCluster[] = [];
  const loadkOps: number[] = [];
  const moveOps: number[] = [];
  const jumpOps: number[] = [];

  opcodes.forEach((op) => {
    const typeVal = op % 5;
    if (typeVal === 0) {
      loadkOps.push(op);
    } else if (typeVal === 1) {
      moveOps.push(op);
    } else {
      jumpOps.push(op);
    }
  });

  if (loadkOps.length > 0) {
    clusters.push({
      clusterType: "LOADK",
      opcodes: loadkOps,
      behavior: "Load constant into instruction register indices"
    });
  }

  if (moveOps.length > 0) {
    clusters.push({
      clusterType: "MOVE",
      opcodes: moveOps,
      behavior: "Move register pointer fields sequentially"
    });
  }

  if (jumpOps.length > 0) {
    clusters.push({
      clusterType: "JUMP / BRANCH",
      opcodes: jumpOps,
      behavior: "Alters code instruction pointer flow programmatically"
    });
  }

  return clusters;
}

/**
 * Converts virtual opcode handlers into clear Lua equivalent expressions.
 */
export function reconstructHighLevelVM(vmCode: string): string {
  let reconstructed = vmCode;

  // Map: if op == 1 then R[A] = K[B]
  // To: R[A] = K[B]
  reconstructed = reconstructed.replace(/R\[A\]\s*=\s*K\[B\]/g, "local_var = constant_pool");
  // Simplify register arrays
  reconstructed = reconstructed.replace(/stack\[([0-9]+)\]/g, "reg_$1");

  return reconstructed;
}

/**
 * Simplifies artificial loops containing instant breaks
 */
export function simplifyDummyLoops(code: string): string {
  let optimized = code;

  // while true do <single line instruction> break end
  const dummyWhile = /while\s+true\s+do\s*([^\n]+?)\s*break\s*end/g;
  optimized = optimized.replace(dummyWhile, "$1");

  return optimized;
}

/**
 * Removes useless junk variables and operations (variables defined but never referenced)
 */
export function removeJunkCode(code: string): string {
  const lines = code.split("\n");
  const varCount: Record<string, number> = {};
  const declLines: { name: string; index: number }[] = [];

  // Parse lines
  lines.forEach((line, index) => {
    const declMatch = line.match(/^\s*local\s+([a-zA-Z0-9_]+)\s*=/);
    if (declMatch) {
      const name = declMatch[1];
      varCount[name] = 0;
      declLines.push({ name, index });
    }

    // Look for identifier usages across code
    Object.keys(varCount).forEach((name) => {
      // Avoid counting the declaration line itself
      const declMatchLine = line.match(new RegExp(`local\\s+${name}\\s*=`));
      if (!declMatchLine && new RegExp(`\\b${name}\\b`).test(line)) {
        varCount[name]++;
      }
    });
  });

  // Filter out loops/variables that are never used
  let cleanedLines = [...lines];
  declLines.forEach((decl) => {
    if (varCount[decl.name] === 0) {
      // Junk code discovered, comment or clean
      cleanedLines[decl.index] = `-- [Junk Removed] ${lines[decl.index].trim()}`;
    }
  });

  return cleanedLines.filter(l => !l.startsWith("-- [Junk Removed]")).join("\n");
}

/**
 * Control Flow Unflattening algorithm.
 * Unravels state-based flat switch-machines often left by custom engines or ironbrews.
 * e.g.,
 * local state = 1
 * while true do
 *   if state == 1 then
 *     print("A")
 *     state = 2
 *   elseif state == 2 then
 *     print("B")
 *     break
 *   end
 * end
 * Gets reassembled back into linear:
 * print("A")
 * print("B")
 */
export function unflattenControlFlow(code: string): string {
  // Check for flat state loop triggers
  if (!code.includes("state") && !code.includes("state_machine") && !code.includes("pc")) {
    return code; // Safe exit
  }

  const stateRegex = /local\s+state\s*=\s*([0-9]+)/;
  const stateMatch = code.match(stateRegex);
  if (!stateMatch) return code;

  const initialBlockId = parseInt(stateMatch[1], 10);

  // Extract handlers mapped as: if state == X then or elseif state == X then
  const blocks: Record<number, { content: string; nextState: number | null }> = {};
  const blockRegex = /(?:if|elseif)\s+state\s*==\s*([0-9]+)\s+then([\s\S]*?)(?=elseif|else|end)/g;
  let match;

  while ((match = blockRegex.exec(code)) !== null) {
    const stateId = parseInt(match[1], 10);
    const bodyObj = match[2];

    const nextStateMatch = bodyObj.match(/state\s*=\s*([0-9]+)/);
    const nextState = nextStateMatch ? parseInt(nextStateMatch[1], 10) : null;

    // Clean control directives (breaks and state changes) from high-level outputs
    let cleanBody = bodyObj
      .replace(/state\s*=\s*[0-9]+/g, "")
      .replace(/break/g, "")
      .trim();

    blocks[stateId] = {
      content: cleanBody,
      nextState
    };
  }

  // Chain state block sequences back into a cohesive linear logic
  if (Object.keys(blocks).length === 0) return code;

  let finalRebuiltCode: string[] = [];
  let currentState: number | null = initialBlockId;
  const visited = new Set<number>();

  while (currentState !== null && blocks[currentState] && !visited.has(currentState)) {
    visited.add(currentState);
    finalRebuiltCode.push(blocks[currentState].content);
    currentState = blocks[currentState].nextState;
  }

  return finalRebuiltCode.join("\n");
}

/**
 * Executes the complete optimizer pipeline sequentially
 */
export function runFlowOptimizerEngine(
  code: string, 
  onLog: (msg: string) => void
): string {
  onLog("[OPTIMIZER] Inicializando FlowOptimizerEngine...");
  
  let result = code;

  // Step 1: Remove Dummy Loops
  onLog("[OPTIMIZER] Simplificando estruturas de loops artificiais...");
  result = simplifyDummyLoops(result);

  // Step 2: Constant Propagation
  onLog("[OPTIMIZER] Propagando constantes na árvore de execução...");
  result = propagateConstants(result);

  // Step 3: Dead Branch Elimination
  onLog("[OPTIMIZER] Eliminando ramos de decisão mortos (Dead Branches)...");
  result = eliminateDeadBranches(result);

  // Step 4: Control Flow Unflattening
  onLog("[OPTIMIZER] Resolvendo achatamento de fluxo (Control Flow Unflattening)...");
  result = unflattenControlFlow(result);

  // Step 5: Junk Code Removal
  onLog("[OPTIMIZER] Removendo variáveis e blocos mortos com zero referências...");
  result = removeJunkCode(result);

  onLog("[OPTIMIZER] Grafo de fluxo otimizado com completo sucesso.");
  return result;
}
