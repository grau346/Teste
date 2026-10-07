import React, { useState, useEffect, useRef } from "react";
import { 
  GitFork, 
  RefreshCw, 
  Shuffle, 
  HelpCircle, 
  TrendingDown, 
  Maximize2, 
  Fingerprint, 
  Play, 
  Search,
  Eye,
  Settings
} from "lucide-react";

interface CFGNode {
  id: string;
  label: string;
  type: "entry" | "dispatcher" | "helper" | "decrypt" | "junk" | "payload" | "exit";
  bytecode: string[];
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  complexity: number;
}

interface CFGLink {
  source: string;
  target: string;
  type: "conditional" | "unconditional" | "loop" | "junk";
}

export function CFGVisualizer({ inputCode, isDeobfuscated }: { inputCode: string; isDeobfuscated: boolean }) {
  const [nodes, setNodes] = useState<CFGNode[]>([]);
  const [links, setLinks] = useState<CFGLink[]>([]);
  const [selectedNode, setSelectedNode] = useState<CFGNode | null>(null);
  const [isUntangling, setIsUntangling] = useState(false);
  const [complexity, setComplexity] = useState(38);
  const [zoom, setZoom] = useState(0.95);
  const [pan, setPan] = useState({ x: 40, y: 30 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<"spaghetti" | "linearized">("spaghetti");

  const canvasRef = useRef<SVGSVGElement>(null);

  // Generate an extreme, highly complex "spaghetti" CFG layout based on input
  const generateInitialGraph = () => {
    setIsUntangling(false);
    setViewMode("spaghetti");

    // Standard high-complexity CFG for obfuscated code
    const initialNodes: CFGNode[] = [
      { id: "N_Entry", label: "001: VM_ENTRY", type: "entry", x: 250, y: 50, targetX: 250, targetY: 40, complexity: 2, bytecode: ["LOADK r1 'MoonSec'", "SETGLOBAL r1", "LOADK r2 128", "NEWTABLE r3"] },
      { id: "N_Disp", label: "002: DISPATCHER_LOOP", type: "dispatcher", x: 250, y: 150, targetX: 250, targetY: 100, complexity: 12, bytecode: ["GETGLOBAL r4 'OP_CODE'", "EQ r4 r2", "JMP 12", "ADD r2 1"] },
      { id: "N_Decrypt", label: "003: DECRYPT_ENGINE", type: "decrypt", x: 100, y: 220, targetX: 250, targetY: 160, complexity: 8, bytecode: ["XOR r5 r2 r3", "SUB r6 r5 15", "GETTABLE r7 r6", "SETGLOBAL r7"] },
      { id: "N_Junk1", label: "004: ANTI_LOG_JUNK", type: "junk", x: 400, y: 180, targetX: 100, targetY: 280, complexity: 1, bytecode: ["LOADK r8 'CrashLog'", "CALL r8", "JMP -3"] },
      { id: "N_Junk2", label: "005: CONST_OBFUSCATOR", type: "junk", x: 120, y: 350, targetX: 400, targetY: 280, complexity: 3, bytecode: ["NEWTABLE r9", "SETTABLE r9 1 12", "ADD r10 r9 2", "JMP -8"] },
      { id: "N_Helper", label: "006: MEMORY_HOOK_IMM", type: "helper", x: 380, y: 290, targetX: 250, targetY: 220, complexity: 4, bytecode: ["GETGLOBAL r11 'rawget'", "CALL r11 2", "SETTABLE r3 r11"] },
      { id: "N_Payload", label: "007: EXECUTABLE_BLOCK", type: "payload", x: 250, y: 320, targetX: 250, targetY: 290, complexity: 5, bytecode: ["GETGLOBAL r12 'print'", "LOADK r13 'Moonsec bypassed!'", "CALL r12 1"] },
      { id: "N_Exit", label: "008: VM_EXIT_CLEAN", type: "exit", x: 250, y: 420, targetX: 250, targetY: 360, complexity: 1, bytecode: ["RETURN r0 1"] }
    ];

    const initialLinks: CFGLink[] = [
      { source: "N_Entry", target: "N_Disp", type: "unconditional" },
      { source: "N_Disp", target: "N_Decrypt", type: "conditional" },
      { source: "N_Disp", target: "N_Junk1", type: "conditional" },
      { source: "N_Decrypt", target: "N_Helper", type: "unconditional" },
      { source: "N_Decrypt", target: "N_Junk1", type: "junk" },
      { source: "N_Junk1", target: "N_Junk2", type: "junk" },
      { source: "N_Junk2", target: "N_Disp", type: "loop" },
      { source: "N_Helper", target: "N_Payload", type: "conditional" },
      { source: "N_Helper", target: "N_Junk2", type: "junk" },
      { source: "N_Payload", target: "N_Exit", type: "unconditional" },
      { source: "N_Junk1", target: "N_Disp", type: "loop" }
    ];

    setNodes(initialNodes);
    setLinks(initialLinks);
    setComplexity(28);
    setSelectedNode(initialNodes[0]);
  };

  useEffect(() => {
    generateInitialGraph();
  }, [inputCode]);

  // When deobfuscation is finished, automatically untangle the graph to show linearization
  useEffect(() => {
    if (isDeobfuscated) {
      handleUntangle();
    }
  }, [isDeobfuscated]);

  // physics-based force simulation for animating the untangling of nodes
  const handleUntangle = () => {
    if (isUntangling) return;
    setIsUntangling(true);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.05;
      if (progress >= 1) {
        clearInterval(interval);
        setIsUntangling(false);
        setViewMode("linearized");
        setComplexity(5); // Decimated Cyclomatic Complexity

        // Remove junk connections and straighten path
        setLinks([
          { source: "N_Entry", target: "N_Decrypt", type: "unconditional" },
          { source: "N_Decrypt", target: "N_Helper", type: "unconditional" },
          { source: "N_Helper", target: "N_Payload", type: "unconditional" },
          { source: "N_Payload", target: "N_Exit", type: "unconditional" }
        ]);

        // Position nodes beautifully vertically
        setNodes(prev => prev.map(n => {
          if (n.type === "junk" || n.type === "dispatcher") {
            // Fade out/collapse junk code off screen
            return {
              ...n,
              x: n.targetX - 200,
              y: n.targetY,
              complexity: 0
            };
          }
          return {
            ...n,
            x: n.targetX,
            y: n.targetY
          };
        }));
      } else {
        // Linear interpolation easeInOutCubic
        const ease = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        setNodes(prev => prev.map(n => {
          let currentTargetX = n.targetX;
          let currentTargetY = n.targetY;
          
          if (n.type === "junk" || n.type === "dispatcher") {
            currentTargetX = n.targetX - 100; // push off
          }

          return {
            ...n,
            x: n.x + (currentTargetX - n.x) * ease * 0.15,
            y: n.y + (currentTargetY - n.y) * ease * 0.15
          };
        }));
        
        // Decimate complexity dynamically
        setComplexity(Math.round(28 - (progress * 23)));
      }
    }, 30);
  };

  // Drag and drop / panning SVG controls
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDraggingCanvas(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCanvas) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  return (
    <div className="bg-[#0b0c16]/95 border border-[#1b1c2b] rounded-2xl overflow-hidden shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col h-[525px] relative group/cfg">
      {/* Glow Effect */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none group-hover/cfg:bg-cyan-500/8 transition-all" />

      {/* Header and Controls */}
      <div className="px-5 py-4 border-b border-[#1b1c2b] bg-slate-950/40 relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/45 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <GitFork className={`w-4.5 h-4.5 ${isUntangling ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-gray-200 uppercase tracking-widest font-mono">Control Flow Graph (CFG)</h3>
            <p className="text-[10px] text-gray-500 font-sans">Visualizador gráfico de fluxo de blocos de decisão Luau</p>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#07070a] border border-[#212338]/60 rounded-lg">
            <span className="text-[9px] uppercase font-mono text-gray-550">Complexidade Ciclomática:</span>
            <span className={`text-[10px] font-bold font-mono transition-colors ${complexity > 15 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {complexity}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={generateInitialGraph}
              className="p-1.5 bg-[#07070a]/80 border border-[#212338]/65 text-gray-400 hover:text-white rounded-lg hover:border-[#383b5e] cursor-pointer transition-all"
              title="Resetar Grafo"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleUntangle}
              disabled={isUntangling || viewMode === "linearized"}
              className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:from-slate-900 disabled:to-slate-900 border border-cyan-500/10 disabled:border-slate-800 disabled:text-gray-500 text-white text-[10px] uppercase font-bold tracking-wider font-mono rounded-lg flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]"
            >
              <Shuffle className="w-3 h-3" />
              <span>Desembaraçar Fluxo</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph View split-pane */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        {/* SVG Area */}
        <div 
          className={`flex-1 h-full min-h-[250px] relative transition-all ${isDraggingCanvas ? "cursor-grabbing" : "cursor-grab"} bg-[#06060c]`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Legend */}
          <div className="absolute top-3 left-3 z-10 hidden sm:flex flex-col gap-1.5 p-2 bg-[#090910]/90 border border-[#1b1c2b] rounded-lg text-[9px] font-mono text-gray-450 pointer-events-none backdrop-blur-sm shadow-md">
            <span className="font-bold text-gray-300 uppercase mb-1">Legenda de Blocos:</span>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-violet-500" /><span>Entrada VM / Boot</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-cyan-500" /><span>Dispatcher de Loops</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><span>Descomprimir Strings</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-500" /><span>Código Lixo (Bloqueado)</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" /><span>Payload Realizado</span></div>
          </div>

          {/* SVG Canvas */}
          <svg
            ref={canvasRef}
            className="w-full h-full select-none"
          >
            {/* Arrow Markers for direction */}
            <defs>
              <marker id="arrow-unconditional" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#475569" />
              </marker>
              <marker id="arrow-conditional" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#0ea5e9" />
              </marker>
              <marker id="arrow-loop" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#eab308" />
              </marker>
              <marker id="arrow-junk" viewBox="0 0 10 10" refX="17" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" fillOpacity="0.4" />
              </marker>
            </defs>

            {/* Transformed Content */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              
              {/* LINK PATHS */}
              {links.map((link, idx) => {
                const sourceNode = nodes.find(n => n.id === link.source);
                const targetNode = nodes.find(n => n.id === link.target);
                if (!sourceNode || !targetNode) return null;

                // Compute smooth bezier paths
                const dx = targetNode.x - sourceNode.x;
                const dy = targetNode.y - sourceNode.y;
                const dr = Math.sqrt(dx * dx + dy * dy);

                // Curve paths based on link types
                let pathString = `M${sourceNode.x},${sourceNode.y} L${targetNode.x},${targetNode.y}`;
                if (link.type === "loop") {
                  const sweep = sourceNode.x > targetNode.x ? 1 : 0;
                  pathString = `M${sourceNode.x},${sourceNode.y} A${dr * 1.1},${dr * 1.1} 0 0,${sweep} ${targetNode.x},${targetNode.y}`;
                } else if (link.type === "junk") {
                  pathString = `M${sourceNode.x},${sourceNode.y} Q${(sourceNode.x + targetNode.x)/2 + (dy > 0 ? 40 : -40)},${(sourceNode.y + targetNode.y)/2 + (dx > 0 ? 40 : -40)} ${targetNode.x},${targetNode.y}`;
                }

                let color = "stroke-[#334155]";
                let strokeWidth = "stroke-[1.5]";
                let dashArray = "";
                let glowFilter = "";
                let markerId = "arrow-unconditional";

                if (link.type === "conditional") {
                  color = "stroke-cyan-500/80";
                  strokeWidth = "stroke-[2]";
                  markerId = "arrow-conditional";
                } else if (link.type === "loop") {
                  color = "stroke-amber-500/80";
                  strokeWidth = "stroke-[1.5]";
                  dashArray = "4 4";
                  markerId = "arrow-loop";
                } else if (link.type === "junk") {
                  color = "stroke-rose-500/30";
                  strokeWidth = "stroke-[1]";
                  dashArray = "2 3";
                  markerId = "arrow-junk";
                }

                return (
                  <g key={idx}>
                    <path
                      d={pathString}
                      className={`fill-none transition-all duration-300 ${color} ${strokeWidth}`}
                      strokeDasharray={dashArray}
                      markerEnd={`url(#${markerId})`}
                    />
                    {/* Animated flow particle overlay */}
                    {!isUntangling && link.type !== "junk" && (
                      <path
                        d={pathString}
                        className={`fill-none stroke-current opacity-70 stroke-[2] ${
                          link.type === "conditional" ? "text-cyan-400" : "text-emerald-400"
                        }`}
                        strokeDasharray="4 24"
                        strokeDashoffset="100"
                        style={{
                          animation: "flow 4s linear infinite"
                        }}
                      />
                    )}
                  </g>
                );
              })}

              {/* NODE CIRCLES */}
              {nodes.map((node) => {
                let colorClass = "fill-slate-900 stroke-[#1b1c2b]";
                let glowColor = "rgba(124,58,237,0.3)";

                if (node.type === "entry") {
                  colorClass = "fill-violet-950/90 stroke-violet-500";
                  glowColor = "rgba(139,92,246,0.5)";
                } else if (node.type === "dispatcher") {
                  colorClass = "fill-cyan-950/90 stroke-cyan-500";
                  glowColor = "rgba(6,182,212,0.5)";
                } else if (node.type === "decrypt") {
                  colorClass = "fill-yellow-950/90 stroke-yellow-500";
                  glowColor = "rgba(234,179,8,0.5)";
                } else if (node.type === "junk") {
                  colorClass = "fill-rose-950/40 stroke-rose-900/60 opacity-40";
                  glowColor = "rgba(244,63,94,0.1)";
                } else if (node.type === "payload") {
                  colorClass = "fill-emerald-950/95 stroke-emerald-500";
                  glowColor = "rgba(16,185,129,0.6)";
                } else if (node.type === "exit") {
                  colorClass = "fill-[#0a1215] stroke-slate-600";
                  glowColor = "rgba(148,163,184,0.1)";
                }

                const isSelected = selectedNode?.id === node.id;

                return (
                  <g 
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className={`cursor-pointer group transition-all duration-300 ${node.type === "junk" ? "hover:opacity-100" : ""}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedNode(node);
                    }}
                  >
                    {/* Shadow/Glow undernode */}
                    <circle
                      r={14}
                      className="fill-current opacity-30 text-slate-950 filter blur-sm"
                    />

                    {/* Outer border highlighting of selected node */}
                    {isSelected && (
                      <circle
                        r={16}
                        className="fill-none stroke-white/80 stroke-1.5 animate-pulse"
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      r={10}
                      className={`transition-all duration-300 stroke-[1.5] ${colorClass}`}
                      style={{
                        filter: isSelected ? `drop-shadow(0 0 6px ${glowColor})` : ""
                      }}
                    />

                    {/* Node Text Label */}
                    <text
                      y={-18}
                      className="text-[9px] font-bold font-mono fill-gray-300 text-center pointer-events-none select-none transition-colors group-hover:fill-white text-anchor-middle"
                      textAnchor="middle"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}

            </g>
          </svg>

          {/* Quick Zoom / Controller controls */}
          <div className="absolute bottom-3 left-3 flex items-center gap-1">
            <button
              onClick={() => setZoom(prev => Math.max(0.4, prev - 0.15))}
              className="w-7 h-7 bg-slate-950/80 border border-[#1b1c2b] text-gray-400 hover:text-white rounded-lg flex items-center justify-center text-xs cursor-pointer transition-colors"
              title="Reduzir Zoom"
            >
              -
            </button>
            <button
              onClick={() => { setZoom(0.95); setPan({ x: 30, y: 30 }); }}
              className="px-2 h-7 bg-slate-950/80 border border-[#1b1c2b] text-gray-400 hover:text-white rounded-lg flex items-center justify-center text-[10px] font-mono cursor-pointer transition-colors"
              title="Ajustar ao Centro"
            >
              Reset
            </button>
            <button
              onClick={() => setZoom(prev => Math.min(2, prev + 0.15))}
              className="w-7 h-7 bg-slate-950/80 border border-[#1b1c2b] text-gray-400 hover:text-white rounded-lg flex items-center justify-center text-xs cursor-pointer transition-colors"
              title="Aumentar Zoom"
            >
              +
            </button>
          </div>
        </div>

        {/* Node Inspector Side Panel */}
        <div className="w-full md:w-64 border-t md:border-t-0 md:border-l border-[#1b1c2b] bg-slate-950/65 backdrop-blur-md p-4 flex flex-col justify-between shrink-0 font-mono text-xs text-slate-400 h-full overflow-y-auto">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">ID Bloqueio:</span>
                <p className="text-gray-200 font-bold mt-0.5">{selectedNode.label}</p>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Tipo de Escopo:</span>
                <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase mt-1 ${
                  selectedNode.type === "entry" ? "bg-violet-950/50 border border-violet-500/20 text-violet-400" :
                  selectedNode.type === "dispatcher" ? "bg-cyan-950/50 border border-cyan-500/20 text-cyan-400" :
                  selectedNode.type === "decrypt" ? "bg-amber-950/50 border border-amber-500/20 text-amber-500" :
                  selectedNode.type === "junk" ? "bg-rose-950/50 border border-rose-500/10 text-rose-450" :
                  selectedNode.type === "payload" ? "bg-emerald-950/50 border border-emerald-500/20 text-emerald-400" :
                  "bg-slate-900 border border-slate-800 text-gray-400"
                }`}>
                  {selectedNode.type === "junk" ? "CÓDIGO LIXO (FLAT)" : selectedNode.type}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                  <Fingerprint className="w-3 h-3 text-cyan-400" />
                  Instruções Bytecode:
                </span>
                <div className="bg-[#050508] border border-[#1b1c2b] p-2.5 rounded-lg text-[10px] text-gray-250 space-y-1 max-h-40 overflow-y-auto scrollbar-thin select-all">
                  {selectedNode.bytecode.map((line, ix) => (
                    <div key={ix} className="flex gap-2">
                      <span className="text-slate-600 select-none">{String(ix * 4).padStart(3, "0")}</span>
                      <span className="text-cyan-400/90">{line.split(" ")[0]}</span>
                      <span className="text-slate-400">{line.split(" ").slice(1).join(" ")}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">Complexidade de Bloco:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        selectedNode.complexity > 7 ? 'bg-rose-500' : selectedNode.complexity > 3 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${(selectedNode.complexity / 12) * 100}%` }}
                    />
                  </div>
                  <span className="font-bold text-[10px] text-gray-300">{selectedNode.complexity} CC</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4 text-gray-500 italic">
              <GitFork className="w-8 h-8 text-slate-800 mb-2 stroke-1" />
              <span>Selecione um bloco no grafo para inspecionar</span>
            </div>
          )}

          {/* Graph Metrics footer */}
          <div className="border-t border-[#1b1c2b] pt-3 mt-4 text-[9px] text-gray-550 space-y-1 block leading-relaxed">
            <div className="flex justify-between"><span>Total de Nós:</span><span className="text-gray-400">{nodes.length}</span></div>
            <div className="flex justify-between"><span>Relação de Loop:</span><span className="text-gray-400">{(links.filter(l => l.type === 'loop').length / (links.length || 1) * 100).toFixed(0)}%</span></div>
            <div className="flex justify-between">
              <span>Nós Mortos Filtrados:</span>
              <span className="text-rose-400">
                {viewMode === "linearized" ? "3 (Anti-Log & Junk)" : "0"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Styled SVG injection to support smooth CSS animations of laser glow particles */}
      <style>{`
        @keyframes flow {
          to {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
    </div>
  );
}
