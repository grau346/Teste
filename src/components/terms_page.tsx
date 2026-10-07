import React, { useState } from "react";
import { Terminal, Shield, Check, FileText, AlertTriangle } from "lucide-react";

interface TermsPageProps {
  onAccept: () => void;
}

export function TermsPage({ onAccept }: TermsPageProps) {
  const [accepted, setAccepted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accepted) {
      onAccept();
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col justify-between items-center bg-[#07070a] text-gray-200 font-sans p-4 relative overflow-y-auto">
      {/* Decorative background grid and ambient lighting */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f0f16_1px,transparent_1px),linear-gradient(to_bottom,#0f0f16_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/8 right-10 w-[200px] h-[200px] bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Top logo header */}
      <header className="w-full max-w-sm flex flex-col items-center pt-8 pb-4 relative z-10">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-500 to-indigo-600 flex items-center justify-center border border-indigo-400/20 shadow-[0_0_20px_rgba(79,70,229,0.3)] mb-3">
          <Terminal className="text-white w-6 h-6 animate-pulse" />
        </div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-100 to-indigo-200 tracking-tight">
          Roblox AI Suite
        </h1>
        <p className="text-xs text-gray-400/80 mt-1 uppercase tracking-widest font-mono">
          Termos de Uso & Configuração Inicial
        </p>
      </header>

      {/* Main Interactive Dialog Card */}
      <main className="w-full max-w-md flex items-center justify-center my-6 relative z-10">
        <div className="w-full bg-[#0d0d15]/95 border border-[#1b1c2b] shadow-[0_15px_50px_-15px_rgba(0,0,0,0.8)] rounded-2xl p-6 relative backdrop-blur-md">
          {/* Section: Termos de Uso Header */}
          <div className="flex items-center gap-2 text-indigo-400 mb-3">
            <Shield className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-sm font-mono uppercase tracking-wider font-semibold">Termos de Uso</h2>
          </div>

          <div className="space-y-4 text-xs text-gray-300 leading-relaxed font-sans mb-6">
            <p className="bg-indigo-950/25 border border-indigo-500/20 p-3 rounded-xl flex gap-2.5 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                Ao utilizar esta plataforma, você concorda que as respostas geradas por IA podem conter erros e devem ser revisadas antes do uso.
              </span>
            </p>
            <p className="bg-[#10101a] border border-[#212338]/50 p-3 rounded-xl">
              É proibido utilizar o serviço para atividades ilegais ou que violem direitos de terceiros.
            </p>
            <p className="bg-[#10101a] border border-[#212338]/50 p-3 rounded-xl">
              O uso da plataforma é de responsabilidade do usuário.
            </p>
          </div>

          <div className="border-t border-[#1b1c2b]/80 my-4" />

          {/* Section: Política de Privacidade Header */}
          <div className="flex items-center gap-2 text-violet-400 mb-3">
            <FileText className="w-5 h-5 flex-shrink-0" />
            <h2 className="text-sm font-mono uppercase tracking-wider font-semibold">Política de Privacidade</h2>
          </div>

          <div className="space-y-3 text-xs text-gray-300 leading-relaxed font-sans mb-6">
            <p className="bg-[#10101a] border border-[#212338]/50 p-3 rounded-xl">
              Podemos coletar mensagens enviadas à IA e informações técnicas necessárias para o funcionamento da plataforma.
            </p>
            <p className="bg-[#10101a] border border-[#212338]/50 p-3 rounded-xl">
              Não vendemos dados dos usuários.
            </p>
            <p className="text-gray-400 italic text-[11px] leading-tight px-1">
              Ao utilizar a plataforma, você concorda com estes Termos de Uso e com esta Política de Privacidade.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div className="relative flex items-start gap-3 p-3 bg-indigo-950/20 rounded-xl border border-indigo-500/10 hover:border-indigo-500/20 transition-all">
              <div className="flex items-center h-5">
                <input
                  id="accept-checkbox"
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-600 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer"
                />
              </div>
              <label
                htmlFor="accept-checkbox"
                className="text-xs text-gray-300 cursor-pointer select-none leading-normal font-sans"
              >
                Li e aceito os Termos de Uso e a Política de Privacidade
              </label>
            </div>

            <button
              type="submit"
              disabled={!accepted}
              className={`w-full py-2.5 rounded-xl text-xs font-semibold tracking-wider uppercase font-mono transition-all duration-300 flex items-center justify-center gap-2 ${
                accepted
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-[0.98] cursor-pointer"
                  : "bg-[#181928] border border-[#22243d] text-gray-500 cursor-not-allowed"
              }`}
            >
              <Check className="w-4 h-4" />
              Liberar Acesso
            </button>
          </form>
        </div>
      </main>

      {/* Decorative footer */}
      <footer className="w-full max-w-sm text-center py-4 relative z-10">
        <p className="text-[10px] text-gray-600 font-sans tracking-wide">
          Segurança Cibernética &bull; IA de Altíssima Performance
        </p>
      </footer>
    </div>
  );
}
