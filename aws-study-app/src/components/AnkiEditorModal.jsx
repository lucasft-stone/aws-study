import React, { useState } from 'react';

export default function AnkiEditorModal({ trail, onClose, onSave }) {
    const [cards, setCards] = useState(() => {
        const initial = trail?.cachedAnki || [];
        return initial.map((c, idx) => ({
            id: c.id || `anki-${Date.now()}-${idx}`,
            front: c.front || '',
            back: c.back || '',
            topic: c.topic || trail?.topic || 'Geral',
            difficulty: c.difficulty || 'medium'
        }));
    });

    const [activeCardIdx, setActiveCardIdx] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const handleAddNewCard = () => {
        const newCard = {
            id: `anki-manual-${Date.now()}`,
            front: 'Pergunta / Frente do Cartão...',
            back: 'Resposta / Verso do Cartão...',
            topic: trail?.topic || 'Geral',
            difficulty: 'medium'
        };
        setCards(prev => [...prev, newCard]);
        setActiveCardIdx(cards.length);
    };

    const handleUpdateActiveCard = (field, val) => {
        setCards(prev => prev.map((c, idx) => {
            if (idx !== activeCardIdx) return c;
            return { ...c, [field]: val };
        }));
    };

    const handleDeleteCard = (idxToDelete) => {
        if (cards.length <= 1) {
            alert("A trilha deve conter ao menos 1 cartão Anki!");
            return;
        }
        setCards(prev => prev.filter((_, idx) => idx !== idxToDelete));
        setActiveCardIdx(prev => Math.max(0, prev - 1));
    };

    const handleSaveAll = async () => {
        for (let i = 0; i < cards.length; i++) {
            const c = cards[i];
            if (!c.front.trim()) {
                alert(`A frente do Cartão #${i + 1} está em branco!`);
                setActiveCardIdx(i);
                return;
            }
            if (!c.back.trim()) {
                alert(`O verso do Cartão #${i + 1} está em branco!`);
                setActiveCardIdx(i);
                return;
            }
        }

        setIsSaving(true);
        try {
            await onSave(cards);
            onClose();
        } catch (err) {
            console.error("Erro ao salvar cartões Anki:", err);
            alert("Erro ao salvar cartões: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const currentCard = cards[activeCardIdx] || {
        front: '',
        back: '',
        topic: 'Geral',
        difficulty: 'medium'
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-500 bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-800/60">
                            🧠 Editor Manual de Flashcards Anki (Admin)
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-1 line-clamp-1">
                            {trail?.title || 'Flashcards Anki'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isSaving ? '⚡ Salvando...' : '💾 Salvar Todos os Cartões'}
                        </button>
                        <button
                            onClick={onClose}
                            className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                        >
                            ✕ Sair
                        </button>
                    </div>
                </div>

                {/* Body Split */}
                <div className="grid grid-cols-1 md:grid-cols-3 flex-grow overflow-hidden">
                    {/* Coluna Esquerda: Lista de Cartões */}
                    <div className="bg-slate-100 dark:bg-slate-950 p-3 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-extrabold uppercase text-slate-500">
                                    Cartões ({cards.length})
                                </span>
                                <button
                                    onClick={handleAddNewCard}
                                    className="text-[11px] font-extrabold bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1 rounded-lg transition-all shadow"
                                >
                                    + Criar Novo
                                </button>
                            </div>

                            <div className="space-y-1.5">
                                {cards.map((c, idx) => (
                                    <button
                                        key={c.id || idx}
                                        onClick={() => setActiveCardIdx(idx)}
                                        className={`w-full text-left p-2.5 rounded-xl text-xs transition-all border flex items-start justify-between gap-2 ${
                                            activeCardIdx === idx
                                                ? 'bg-purple-600 text-white border-purple-500 font-bold shadow-md'
                                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <div className="truncate flex-1">
                                            <span className="font-extrabold block">#{idx + 1}</span>
                                            <span className="truncate block opacity-90">{c.front || 'Sem Pergunta'}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Coluna Direita: Edição do Cartão Selecionado */}
                    <div className="md:col-span-2 p-5 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h3 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <span>Cartão #{activeCardIdx + 1} de {cards.length}</span>
                            </h3>
                            {cards.length > 1 && (
                                <button
                                    onClick={() => handleDeleteCard(activeCardIdx)}
                                    className="text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 font-bold px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                                >
                                    🗑️ Excluir Cartão
                                </button>
                            )}
                        </div>

                        {/* Campo: Frente */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                                Frente do Cartão (Pergunta / Conceito) *
                            </label>
                            <textarea
                                rows="3"
                                value={currentCard.front}
                                onChange={(e) => handleUpdateActiveCard('front', e.target.value)}
                                placeholder="Digite a pergunta ou conceito que aparecerá na frente..."
                                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                            />
                        </div>

                        {/* Campo: Verso */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                                Verso do Cartão (Resposta / Explicação) *
                            </label>
                            <textarea
                                rows="4"
                                value={currentCard.back}
                                onChange={(e) => handleUpdateActiveCard('back', e.target.value)}
                                placeholder="Digite a resposta detalhada que aparecerá no verso..."
                                className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                            />
                        </div>

                        {/* Tópico e Dificuldade */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                                    Tópico Específico
                                </label>
                                <input
                                    type="text"
                                    value={currentCard.topic}
                                    onChange={(e) => handleUpdateActiveCard('topic', e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                                    Dificuldade Estimada
                                </label>
                                <select
                                    value={currentCard.difficulty}
                                    onChange={(e) => handleUpdateActiveCard('difficulty', e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
                                >
                                    <option value="easy">Fácil</option>
                                    <option value="medium">Média</option>
                                    <option value="hard">Difícil</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
