import React, { useState } from 'react';

export default function QuizEditorModal({ trail, onClose, onSave }) {
    const [questions, setQuestions] = useState(() => {
        const initial = trail?.cachedQuiz || [];
        return initial.map((q, idx) => ({
            id: q.id || `q-${Date.now()}-${idx}`,
            question: q.question || '',
            options: Array.isArray(q.options) && q.options.length >= 4 
                ? [...q.options] 
                : [q.options?.[0] || '', q.options?.[1] || '', q.options?.[2] || '', q.options?.[3] || ''],
            correctAnswer: q.correctAnswer || q.options?.[0] || '',
            explanation: q.explanation || ''
        }));
    });

    const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // Adiciona um novo exercício em branco
    const handleAddNewQuestion = () => {
        const newQ = {
            id: `q-manual-${Date.now()}`,
            question: 'Nova pergunta de exercício...',
            options: ['Opção A', 'Opção B', 'Opção C', 'Opção D'],
            correctAnswer: 'Opção A',
            explanation: 'Explicação detalhada sobre por que esta resposta é a correta.'
        };
        setQuestions(prev => [...prev, newQ]);
        setActiveQuestionIdx(questions.length);
    };

    // Atualiza a pergunta ativa
    const handleUpdateActiveQuestion = (field, val) => {
        setQuestions(prev => prev.map((q, idx) => {
            if (idx !== activeQuestionIdx) return q;
            return { ...q, [field]: val };
        }));
    };

    // Atualiza uma das 4 opções de resposta
    const handleUpdateOption = (optIdx, val) => {
        setQuestions(prev => prev.map((q, idx) => {
            if (idx !== activeQuestionIdx) return q;
            const newOpts = [...q.options];
            const oldVal = newOpts[optIdx];
            newOpts[optIdx] = val;
            
            // Se a resposta correta era a opção antiga, atualiza para o novo texto
            const newCorrect = q.correctAnswer === oldVal ? val : q.correctAnswer;
            return { ...q, options: newOpts, correctAnswer: newCorrect };
        }));
    };

    // Exclui uma pergunta
    const handleDeleteQuestion = (idxToDelete) => {
        if (questions.length <= 1) {
            alert("A trilha deve conter ao menos 1 exercício!");
            return;
        }
        setQuestions(prev => prev.filter((_, idx) => idx !== idxToDelete));
        setActiveQuestionIdx(prev => Math.max(0, prev - 1));
    };

    // Salvar todas as alterações
    const handleSaveAll = async () => {
        // Validação básica
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            if (!q.question.trim()) {
                alert(`A pergunta do Exercício #${i + 1} está em branco!`);
                setActiveQuestionIdx(i);
                return;
            }
            if (q.options.some(opt => !opt.trim())) {
                alert(`Preencha todas as 4 opções do Exercício #${i + 1}!`);
                setActiveQuestionIdx(i);
                return;
            }
            if (!q.correctAnswer || !q.options.includes(q.correctAnswer)) {
                alert(`Selecione uma resposta correta válida para o Exercício #${i + 1}!`);
                setActiveQuestionIdx(i);
                return;
            }
        }

        setIsSaving(true);
        try {
            await onSave(questions);
            onClose();
        } catch (err) {
            console.error("Erro ao salvar exercícios:", err);
            alert("Erro ao salvar exercícios: " + err.message);
        } finally {
            setIsSaving(false);
        }
    };

    const currentQ = questions[activeQuestionIdx] || {
        question: '',
        options: ['', '', '', ''],
        correctAnswer: '',
        explanation: ''
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/60">
                            👑 Editor Manual de Exercícios (Admin)
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-1 line-clamp-1">
                            {trail?.title || 'Exercícios da Trilha'}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSaveAll}
                            disabled={isSaving}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
                        >
                            {isSaving ? '⚡ Salvando...' : '💾 Salvar Todos os Exercícios'}
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
                    {/* Coluna Esquerda: Lista de Questões */}
                    <div className="bg-slate-100 dark:bg-slate-950 p-3 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto custom-scrollbar">
                        <div>
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
                                <span className="text-xs font-extrabold uppercase text-slate-500">
                                    Exercícios ({questions.length})
                                </span>
                                <button
                                    onClick={handleAddNewQuestion}
                                    className="text-[11px] font-extrabold bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg transition-all shadow"
                                >
                                    + Criar Novo
                                </button>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                {questions.map((q, idx) => {
                                    const isActive = idx === activeQuestionIdx;
                                    return (
                                        <button
                                            key={q.id || idx}
                                            onClick={() => setActiveQuestionIdx(idx)}
                                            className={`w-full text-left p-3 rounded-xl transition-all border ${
                                                isActive
                                                    ? 'bg-amber-500 text-slate-950 font-extrabold border-amber-600 shadow-md'
                                                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="font-extrabold uppercase tracking-wider text-[10px]">
                                                    Exercício #{idx + 1}
                                                </span>
                                            </div>
                                            <p className="text-xs line-clamp-2 leading-snug">
                                                {q.question || 'Sem enunciado'}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <button
                            onClick={handleAddNewQuestion}
                            className="w-full mt-4 bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800 font-extrabold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1"
                        >
                            ➕ Criar Novo Exercício
                        </button>
                    </div>

                    {/* Coluna Direita (2 colunas no MD): Formulário de Edição do Exercício Selecionado */}
                    <div className="md:col-span-2 p-4 sm:p-6 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto custom-scrollbar gap-4">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-sm font-extrabold uppercase text-amber-500 flex items-center gap-2">
                                ✏️ Editando Exercício #{activeQuestionIdx + 1}
                            </h3>
                            <button
                                onClick={() => handleDeleteQuestion(activeQuestionIdx)}
                                className="text-xs font-bold text-rose-500 hover:text-rose-400 bg-rose-950/40 border border-rose-800/60 px-3 py-1 rounded-lg transition-all"
                            >
                                🗑️ Excluir Este Exercício
                            </button>
                        </div>

                        {/* Enunciado da Pergunta */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                                Pergunta / Enunciado do Exercício *
                            </label>
                            <textarea
                                rows="3"
                                value={currentQ.question}
                                onChange={(e) => handleUpdateActiveQuestion('question', e.target.value)}
                                placeholder="Digite o texto da pergunta ou problema..."
                                className="w-full p-3 bg-slate-50 dark:bg-slate-950 font-sans text-sm font-bold text-slate-800 dark:text-white rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500 resize-y leading-relaxed"
                            />
                        </div>

                        {/* As 4 Alternativas de Múltipla Escolha */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-400 mb-2">
                                4 Alternativas de Múltipla Escolha (Selecione o botão radial da Resposta Correta) *
                            </label>
                            
                            <div className="flex flex-col gap-2.5">
                                {currentQ.options.map((opt, optIdx) => {
                                    const letters = ['A', 'B', 'C', 'D'];
                                    const isCorrect = currentQ.correctAnswer === opt && opt.trim() !== '';

                                    return (
                                        <div
                                            key={optIdx}
                                            className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all ${
                                                isCorrect
                                                    ? 'bg-emerald-950/40 border-emerald-500/80'
                                                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name={`correct-opt-${activeQuestionIdx}`}
                                                checked={isCorrect}
                                                onChange={() => handleUpdateActiveQuestion('correctAnswer', opt)}
                                                className="w-4 h-4 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                                                title="Marcar como resposta correta"
                                            />

                                            <span className={`w-6 h-6 rounded-lg text-xs font-extrabold flex items-center justify-center flex-shrink-0 ${
                                                isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                            }`}>
                                                {letters[optIdx]}
                                            </span>

                                            <input
                                                type="text"
                                                value={opt}
                                                onChange={(e) => handleUpdateOption(optIdx, e.target.value)}
                                                placeholder={`Texto da Alternativa ${letters[optIdx]}...`}
                                                className="flex-grow bg-transparent text-sm font-bold text-slate-800 dark:text-white focus:outline-none"
                                            />

                                            {isCorrect && (
                                                <span className="text-[10px] font-extrabold uppercase text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded-full border border-emerald-800 flex-shrink-0">
                                                    ✔ Resposta Correta
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Explicação Didática */}
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                                Explicação Didática (Exibida ao Aluno após responder)
                            </label>
                            <textarea
                                rows="3"
                                value={currentQ.explanation}
                                onChange={(e) => handleUpdateActiveQuestion('explanation', e.target.value)}
                                placeholder="Explique passo a passo o raciocínio ou fórmula utilizada para chegar na resposta..."
                                className="w-full p-3 bg-slate-50 dark:bg-slate-950 font-sans text-xs text-slate-700 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-amber-500 resize-y leading-relaxed"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
