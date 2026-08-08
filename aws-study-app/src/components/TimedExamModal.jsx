import React, { useState, useEffect } from 'react';

export default function TimedExamModal({ questions, trailTitle, onClose, onFinish }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [flagged, setFlagged] = useState({});
    const [timeLeft, setTimeLeft] = useState(() => (questions.length || 5) * 60); // 60s per question
    const [isFinished, setIsFinished] = useState(false);

    // Countdown Timer
    useEffect(() => {
        if (isFinished) return;
        if (timeLeft <= 0) {
            handleFinishExam();
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, isFinished]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSelectOption = (opt) => {
        setUserAnswers(prev => ({ ...prev, [currentIndex]: opt }));
    };

    const handleToggleFlag = () => {
        setFlagged(prev => ({ ...prev, [currentIndex]: !prev[currentIndex] }));
    };

    const handleFinishExam = () => {
        setIsFinished(true);
    };

    // Calculation of results
    let correctCount = 0;
    questions.forEach((q, idx) => {
        if (userAnswers[idx] === q.correctAnswer) {
            correctCount++;
        }
    });

    const scorePercentage = Math.round((correctCount / questions.length) * 100);
    const isPassed = scorePercentage >= 70;

    const currentQ = questions[currentIndex] || { question: '', options: [], correctAnswer: '' };

    return (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/60">
                            ⏱️ Simulado Cronometrado de Certificação
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white mt-1 line-clamp-1">
                            {trailTitle || 'Simulado Oficial'}
                        </h2>
                    </div>

                    {!isFinished ? (
                        <div className="flex items-center gap-3">
                            <div className={`font-mono text-sm sm:text-base font-extrabold px-3.5 py-1.5 rounded-xl border ${timeLeft < 60 ? 'bg-rose-950 text-rose-300 border-rose-800 animate-pulse' : 'bg-slate-900 text-amber-400 border-slate-700'}`}>
                                ⏳ {formatTime(timeLeft)}
                            </div>
                            <button
                                onClick={handleFinishExam}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md"
                            >
                                📥 Entregar Prova
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onClose}
                            className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 font-bold px-3 py-2 rounded-xl text-xs transition-colors"
                        >
                            ✕ Sair do Simulado
                        </button>
                    )}
                </div>

                {!isFinished ? (
                    /* Conteúdo da Prova em Andamento */
                    <div className="grid grid-cols-1 md:grid-cols-4 flex-grow overflow-hidden">
                        {/* Coluna de Navegação de Questões */}
                        <div className="bg-slate-100 dark:bg-slate-950 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between overflow-y-auto">
                            <div>
                                <span className="text-xs font-extrabold uppercase text-slate-500 block mb-3">
                                    Mapa de Questões ({questions.length})
                                </span>

                                <div className="grid grid-cols-5 gap-2">
                                    {questions.map((_, idx) => {
                                        const isAns = userAnswers[idx] !== undefined;
                                        const isFlg = flagged[idx];
                                        const isCurrent = idx === currentIndex;

                                        let btnStyle = 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800';
                                        if (isCurrent) {
                                            btnStyle = 'bg-indigo-600 text-white font-extrabold ring-2 ring-indigo-400';
                                        } else if (isFlg) {
                                            btnStyle = 'bg-amber-500 text-slate-950 font-bold';
                                        } else if (isAns) {
                                            btnStyle = 'bg-blue-600 text-white font-bold';
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => setCurrentIndex(idx)}
                                                className={`p-2 rounded-xl text-xs transition-all border text-center ${btnStyle}`}
                                            >
                                                {idx + 1} {isFlg && '🚩'}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-[11px] font-semibold text-slate-500">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-blue-600"></span> Respondidas ({Object.keys(userAnswers).length})
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-amber-500"></span> Sinalizadas ({Object.keys(flagged).filter(k => flagged[k]).length})
                                </div>
                            </div>
                        </div>

                        {/* Coluna Central da Pergunta Ativa */}
                        <div className="md:col-span-3 p-6 bg-white dark:bg-slate-900 overflow-y-auto flex flex-col justify-between gap-6">
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                        Questão {currentIndex + 1} de {questions.length}
                                    </span>
                                    <button
                                        onClick={handleToggleFlag}
                                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all flex items-center gap-1 ${
                                            flagged[currentIndex]
                                                ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                        }`}
                                    >
                                        🚩 {flagged[currentIndex] ? 'Sinalizada para Revisão' : 'Sinalizar Questão'}
                                    </button>
                                </div>

                                <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-white leading-relaxed mb-6">
                                    {currentQ.question}
                                </h3>

                                <div className="space-y-3">
                                    {currentQ.options?.map((opt, idx) => {
                                        const isSelected = userAnswers[currentIndex] === opt;

                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelectOption(opt)}
                                                className={`w-full text-left p-4 rounded-2xl border-2 font-semibold text-sm transition-all flex items-center justify-between ${
                                                    isSelected
                                                        ? 'bg-indigo-50 dark:bg-indigo-950/80 border-indigo-600 text-indigo-900 dark:text-indigo-100 font-bold shadow-md'
                                                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                            >
                                                <span>{opt}</span>
                                                <span className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${isSelected ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-300'}`}>
                                                    {isSelected && '✓'}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Navegação Inferior */}
                            <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                                    disabled={currentIndex === 0}
                                    className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-30"
                                >
                                    ← Anterior
                                </button>
                                <span className="text-xs font-bold text-slate-400">
                                    {currentIndex + 1} / {questions.length}
                                </span>
                                <button
                                    onClick={() => setCurrentIndex(i => Math.min(questions.length - 1, i + 1))}
                                    disabled={currentIndex === questions.length - 1}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-30 shadow"
                                >
                                    Próxima →
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Diagnóstico Final de Desempenho */
                    <div className="p-6 overflow-y-auto flex-grow space-y-6">
                        <div className="text-center p-6 bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800">
                            <div className="text-5xl mb-2">{isPassed ? '🎉' : '📊'}</div>
                            <h3 className={`text-2xl font-extrabold ${isPassed ? 'text-emerald-500' : 'text-amber-500'}`}>
                                {isPassed ? 'Aprovado no Simulado!' : 'Resultado do Simulado'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                {isPassed ? 'Parabéns! Você alcançou o rendimento necessário para o exame real.' : 'Continue praticando para fortalecer seus pontos fracos.'}
                            </p>

                            <div className="flex justify-center items-center gap-6 mt-6">
                                <div className="text-center">
                                    <span className="text-3xl font-extrabold text-indigo-500">{scorePercentage}%</span>
                                    <span className="block text-[11px] font-bold text-slate-400 uppercase">Nota Final</span>
                                </div>
                                <div className="text-center border-l border-r border-slate-200 dark:border-slate-800 px-6">
                                    <span className="text-3xl font-extrabold text-slate-800 dark:text-white">{correctCount}/{questions.length}</span>
                                    <span className="block text-[11px] font-bold text-slate-400 uppercase">Acertos</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-3xl font-extrabold text-emerald-500">+{correctCount * 15} XP</span>
                                    <span className="block text-[11px] font-bold text-slate-400 uppercase">XP Ganho</span>
                                </div>
                            </div>
                        </div>

                        {/* Revisão Detalhada Questão a Questão */}
                        <div>
                            <h4 className="font-extrabold text-sm uppercase text-slate-400 mb-3">
                                Revisão Detalhada das Respostas
                            </h4>
                            <div className="space-y-3">
                                {questions.map((q, idx) => {
                                    const userAns = userAnswers[idx];
                                    const isCorrect = userAns === q.correctAnswer;

                                    return (
                                        <div key={idx} className={`p-4 rounded-2xl border text-left ${isCorrect ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                                            <div className="flex items-start justify-between gap-2 mb-1">
                                                <span className="font-extrabold text-xs text-slate-800 dark:text-white">
                                                    #{idx + 1} {q.question}
                                                </span>
                                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${isCorrect ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                                                    {isCorrect ? '✓ Correto' : '✕ Incorreto'}
                                                </span>
                                            </div>

                                            <div className="text-xs space-y-1 mt-2 font-medium">
                                                <p className="text-slate-600 dark:text-slate-300">
                                                    Sua resposta: <strong className={isCorrect ? 'text-emerald-500' : 'text-rose-500'}>{userAns || 'Não respondida'}</strong>
                                                </p>
                                                {!isCorrect && (
                                                    <p className="text-emerald-600 dark:text-emerald-400">
                                                        Resposta correta: <strong>{q.correctAnswer}</strong>
                                                    </p>
                                                )}
                                                {q.explanation && (
                                                    <p className="text-slate-500 dark:text-slate-400 text-[11px] italic mt-1 bg-white/50 dark:bg-slate-950/50 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                                        💡 Explicação: {q.explanation}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
