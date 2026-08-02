import React, { useState, useEffect } from 'react';
import StudyBot from './StudyBot';

const TIPS = [
    "💡 A IA está formatando equações matemáticas com notação KaTeX para melhor leitura.",
    "📊 Gerando diagramas de fluxo Mermaid e gráficos visuais dinâmicos...",
    "🧠 Elaborando exercícios desafiadores com explicações didáticas passo a passo...",
    "⚡ Estruturando cartões Anki para memorização espaçada e revisão inteligente..."
];

export default function LoadingScreen({ text, subtext }) {
    const [tipIdx, setTipIdx] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTipIdx(prev => (prev + 1) % TIPS.length);
        }, 3500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md p-6 text-center animate-fade-in text-white">
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-2xl animate-pulse" />
                <StudyBot status="loading" />
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 text-xs font-extrabold mb-3 animate-pulse">
                <span>🤖 IA em Ação • Por favor aguarde...</span>
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold text-white max-w-lg leading-tight">
                {text || "Gerando Conteúdo com Inteligência Artificial..."}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-md mt-2 font-medium">
                {subtext || "O processamento pode levar de 5 a 15 segundos dependendo do tamanho da matéria. Por favor, mantenha a tela aberta."}
            </p>

            {/* Barra de Progresso Animada */}
            <div className="w-full max-w-xs bg-slate-800 rounded-full h-2.5 mt-6 overflow-hidden border border-slate-700/80">
                <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 h-2.5 rounded-full animate-pulse w-full" />
            </div>

            {/* Dica Rotativa */}
            <div className="mt-6 p-4 bg-slate-900/90 rounded-2xl border border-slate-800 max-w-md shadow-xl transition-all">
                <p className="text-xs text-slate-300 font-semibold leading-relaxed" key={tipIdx}>
                    {TIPS[tipIdx]}
                </p>
            </div>
        </div>
    );
}
