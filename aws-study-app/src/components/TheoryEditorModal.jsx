import React, { useState } from 'react';

export default function TheoryEditorModal({ trail, onClose, onSave }) {
    const [content, setContent] = useState(trail?.cachedStudy || '');
    const [activeTab, setActiveTab] = useState('edit'); // 'edit' | 'preview'
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!content.trim()) {
            alert("O conteúdo teórico não pode estar em branco!");
            return;
        }
        setIsSaving(true);
        try {
            await onSave(content);
            onClose();
        } catch (err) {
            console.error("Erro ao salvar teoria:", err);
            alert("Erro ao salvar material teórico: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const insertSnippet = (snippet) => {
        setContent(prev => prev + '\n' + snippet + '\n');
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-800/60">
                            📖 Editor Manual de Conteúdo Teórico (Admin)
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-1 line-clamp-1">
                            {trail?.title || 'Material Teórico'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isSaving ? '⚡ Salvando...' : '💾 Salvar Conteúdo'}
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                        >
                            ✕ Sair
                        </button>
                    </div>
                </div>

                {/* Toolbar & Tabs */}
                <div className="bg-slate-100 dark:bg-slate-950 px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setActiveTab('edit')}
                            className={`px-3 py-1.5 rounded-lg font-extrabold transition-colors ${activeTab === 'edit' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            ✏️ Editar Markdown
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`px-3 py-1.5 rounded-lg font-extrabold transition-colors ${activeTab === 'preview' ? 'bg-indigo-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'}`}
                        >
                            👁️ Pré-visualizar
                        </button>
                    </div>

                    {activeTab === 'edit' && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-slate-400 text-[11px] font-semibold">Atalhos:</span>
                            <button
                                onClick={() => insertSnippet('## Novo Título de Seção')}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            >
                                H2
                            </button>
                            <button
                                onClick={() => insertSnippet('**Texto em Destaque**')}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            >
                                **Negrito**
                            </button>
                            <button
                                onClick={() => insertSnippet('```json\n{\n  "exemplo": "valor"\n}\n```')}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            >
                                JSON
                            </button>
                            <button
                                onClick={() => insertSnippet('```mermaid\ngraph TD\n  A[Início] --> B[Conceito CHave]\n  B --> C[Resultado]\n```')}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            >
                                Mermaid
                            </button>
                            <button
                                onClick={() => insertSnippet('$$ E = mc^2 $$')}
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded text-slate-700 dark:text-slate-300 font-mono hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            >
                                LaTeX
                            </button>
                        </div>
                    )}
                </div>

                {/* Editor Content Area */}
                <div className="flex-grow p-4 overflow-y-auto">
                    {activeTab === 'edit' ? (
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Digite ou cole aqui o material teórico formatado em Markdown..."
                            className="w-full h-full p-4 font-mono text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-100 resize-none"
                        />
                    ) : (
                        <div className="prose dark:prose-invert max-w-none p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl min-h-full whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-200 text-sm">
                            {content || <p className="italic text-slate-400">Nenhum conteúdo para pré-visualizar.</p>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
