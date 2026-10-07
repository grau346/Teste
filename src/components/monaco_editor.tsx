import React, { useEffect, useRef } from "react";

interface MonacoEditorProps {
  value: string;
  onChange?: (val: string) => void;
  language?: string;
  readOnly?: boolean;
  theme?: string;
  placeholder?: string;
}

export function MonacoEditor({ 
  value, 
  onChange, 
  language = "lua", 
  readOnly = false, 
  theme = "vs-dark",
  placeholder = "" 
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;
    let monacoLoaderScript: HTMLScriptElement | null = null;

    const initEditor = () => {
      if (!containerRef.current || !active) return;

      const require = (window as any).require;
      if (require) {
        require.config({ 
          paths: { 
            'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs' 
          } 
        });
        require(['vs/editor/editor.main'], function () {
          if (!active || !containerRef.current) return;

          // Clear container content before creating
          containerRef.current.innerHTML = "";

          const editor = (window as any).monaco.editor.create(containerRef.current, {
            value: value || placeholder,
            language: language,
            theme: theme,
            automaticLayout: true,
            readOnly: readOnly,
            minimap: { enabled: !readOnly }, // minimap looks better enabled on edit, simple on readOnly
            fontSize: 12,
            fontFamily: "JetBrains Mono, Fira Code, source-code-pro, Menlo, Monaco, Consolas, Courier New, monospace",
            lineNumbers: "on",
            roundedSelection: true,
            scrollBeyondLastLine: false,
            cursorBlinking: "blink",
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "all",
            padding: { top: 8, bottom: 8 },
            scrollbar: {
              vertical: "visible",
              horizontal: "visible",
              useShadows: true,
              verticalHasArrows: false,
              horizontalHasArrows: false
            }
          });

          editorRef.current = editor;

          editor.onDidChangeModelContent(() => {
            if (onChangeRef.current) {
              const currentVal = editor.getValue();
              onChangeRef.current(currentVal);
            }
          });
        });
      }
    };

    if (!(window as any).require) {
      monacoLoaderScript = document.createElement("script");
      monacoLoaderScript.src = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.36.1/min/vs/loader.min.js";
      monacoLoaderScript.async = true;
      monacoLoaderScript.onload = () => {
        initEditor();
      };
      document.body.appendChild(monacoLoaderScript);
    } else {
      initEditor();
    }

    return () => {
      active = false;
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  // Sync value from parent if it changes outside (e.g., loaded from history or cleared)
  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  // Sync readonly mode
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ readOnly: readOnly });
    }
  }, [readOnly]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full min-h-[340px] flex-1 bg-[#1e1e1e] border border-[#212338]/60 rounded-xl overflow-hidden shadow-inner flex flex-col" 
    />
  );
}
