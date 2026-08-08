import React, { useState, useEffect } from 'react';

const DEFAULT_CHALLENGE_QUESTIONS = [
    {
        question: "Qual serviço da AWS oferece capacidade de computação escalável em nuvem?",
        options: ["Amazon EC2", "Amazon S3", "AWS IAM", "Amazon CloudWatch"],
        correctAnswer: "Amazon EC2",
        explanation: "O Amazon EC2 (Elastic Compute Cloud) fornece servidores virtuais escaláveis na nuvem."
    },
    {
        question: "Qual o pilar do AWS Well-Architected Framework focado em proteção de dados e sistemas?",
        options: ["Eficiência de Performance", "Segurança", "Excelência Operacional", "Otimização de Custos"],
        correctAnswer: "Segurança",
        explanation: "O pilar de Segurança foca em proteger informações, sistemas e ativos com confidencialidade e integridade."
    },
    {
        question: "Qual serviço da AWS é um banco de dados relacional gerenciado que suporta MySQL e PostgreSQL?",
        options: ["Amazon DynamoDB", "Amazon RDS", "Amazon ElastiCache", "AWS Lambda"],
        correctAnswer: "Amazon RDS",
        explanation: "O Amazon RDS (Relational Database Service) facilita a configuração, operação e escalabilidade de bancos de dados relacionais."
    }
];

export default function DailyChallengeModal({ customTrails, studyLevels, onFinishChallenge, onClose }) {
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(90); // 90 segundos para o desafio
    const [isFinished, setIsFinished] = useState(false);

    useEffect(() => {
        // Coleta perguntas dos caches existentes ou usa o fallback oficial
        const pool = [];
        if (customTrails) {
            customTrails.forEach(t => {
                if (Array.isArray(t.cachedQuiz)) pool.push(...t.cachedQuiz);
            });
        }

        if (pool.length >= 3) {
            const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, 3);
            setQuestions(shuffled);
        } else {
            setQuestions(DEFAULT_CHALLENGE_QUESTIONS);
        }
    }, [customTrails]);

    useEffect(() => {
        if (isFinished) return;
        if (timeLeft <= 0) {
            setIsFinished(true);
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, isFinished]);

    const handleSelectOption = (opt) => {
        if (selectedAnswer) return;
        setSelectedAnswer(opt);
    };

    const handleNext = () => {
        const currentQ = questions[currentIndex];
        let newScore = score;
        if (selectedAnswer === currentQ.correctAnswer) {
            newScore += 1;
            setScore(newScore);
        }

        if (currentIndex + 1 < questions.length) {
            setCurrentIndex(prev => prev + 1);
            setSelectedAnswer(null);
        } else {
            setIsFinished(true);
            if (onFinishChallenge) {
                const bonusXp = newScore * 15;
                onFinishChallenge(bonusXp);
            }
        }
    };

    const currentQ = questions[currentIndex] || DEFAULT_CHALLENGE_QUESTIONS[0];

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-5 border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-200 dark:border-slate-800">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-500 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800/60">
                            ⚡ Desafio Diário Relâmpago
                        </span>
                        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white mt-1">
                            Quiz Rápido de 3 Perguntas
                        </h2>
                    </div>

                    {!isFinished && (
                        <div className="font-mono text-sm font-extrabold text-amber-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
                            ⏳ {timeLeft}s
                        </div>
                    )}
                </div>

                {!isFinished ? (
                    <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                            <span>Pergunta {currentIndex + 1} de {questions.length}</span>
                            <span className="text-emerald-500">Recompensa: +45 XP Max</span>
                        </div>

                        <h3 className="text-base font-bold text-slate-800 dark:text-white leading-relaxed">
                            {currentQ.question}
                        </h3>

                        <div className="space-y-2.5">
                            {currentQ.options?.map((opt, idx) => {
                                const isSelected = selectedAnswer === opt;
                                return (
                                    <button
                                        key={idx}
                                        onClick={() => handleSelectOption(opt)}
                                        className={`w-full p-3.5 rounded-2xl border text-left text-xs font-bold transition-all ${
                                            isSelected
                                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                                : 'bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                                        }`}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            onClick={handleNext}
                            disabled={!selectedAnswer}
                            className="mt-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3.5 rounded-2xl shadow-lg disabled:opacity-40 transition-all"
                        >
                            {currentIndex + 1 === questions.length ? '🏁 Concluir Desafio' : 'Próxima Questão →'}
                        </button>
                    </div>
                ) : (
                    <div className="text-center py-4 space-y-4">
                        <div className="text-5xl">⚡</div>
                        <h3 className="text-2xl font-extrabold text-slate-800 dark:text-white">
                            Desafio Concluído!
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Você acertou <strong className="text-emerald-500">{score} de {questions.length}</strong> questões relâmpago.
                        </p>

                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 font-extrabold text-lg">
                            🎉 +{score * 15} XP Conquistados!
                        </div>

                        <button
                            onClick={onClose}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl shadow-lg transition-colors text-sm"
                        >
                            Resgatar Recompensa & Voltar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
