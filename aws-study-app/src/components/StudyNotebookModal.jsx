import React, { useState, useEffect } from 'react';

export default function StudyNotebookModal({ trailId, trailTitle, onClose }) {
    const storageKey = `study_notebook_${trailId || 'general'}`;
    const [notes, setNotes] = useState(() => {
        return localStorage.getItem(storageKey) || '';
    });

    const [savedToast, setSavedToast] = useState(false);

    useEffect(() => {
        localStorage.setItem(storageKey, notes);
        setSavedToast(true);
        const timer = setTimeout(() => setSavedToast(false), 1500);
        return () => clearTimeout(timer);
    }, [notes, storageKey]);

    const handleCopyNotes = () => {
        navigator.clipboard.writeText(notes).then(() => {
            alert("Anotações copiadas para a área de transferência!");
        });
    };

    const handleDownloadNotes = () => {
        const blob = new Blob([notes], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anotacoes_${(trailTitle || 'geral').toLowerCase().replace(/[^a-z0-9]/g, '_')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleClearNotes = () => {
        if (window.confirm("Deseja realmente apagar todas as anotações deste caderno?")) {
            setNotes('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/60">
                            📓 Meu Caderno de Anotações
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-1 line-clamp-1">
                            {trailTitle || 'Anotações Gerais de Estudo'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        {savedToast && (
                            <span className="text-[11px] font-extrabold text-emerald-500 bg-emerald-950/60 px-2 py-1 rounded-lg border border-emerald-800 animate-pulse">
                                💾 Salvo
                            </span>
                        )}
                        <button
                            onClick={onClose}
                            className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                        >
                            ✕ Sair
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="bg-slate-100 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs flex-wrap">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                        Escreva seus insights, resumos e fórmulas em Markdown:
                    </span>
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleCopyNotes}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-lg font-bold text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors"
                        >
                            📋 Copiar
                        </button>
                        <button
                            onClick={handleDownloadNotes}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg font-extrabold transition-colors shadow-sm"
                        >
                            📥 Baixar .MD
                        </button>
                        <button
                            onClick={handleClearNotes}
                            className="bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-2 py-1 rounded-lg font-bold hover:bg-rose-200 transition-colors"
                        >
                            🗑️ Limpar
                        </button>
                    </div>
                </div>

                {/* Textarea */}
                <div className="flex-grow p-4 overflow-y-auto">
                    <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Digite aqui suas anotações pessoais de estudo. Suas notas são salvas automaticamente..."
                        className="w-full h-full p-4 font-mono text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 resize-none leading-relaxed"
                    />
                </div>
            </div>
        </div>
    );
}
