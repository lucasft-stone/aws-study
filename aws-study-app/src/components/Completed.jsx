import React from 'react';
import StudyBot from './StudyBot';

export default function Completed({
    quizFailed,
    currentTrail,
    lastQuizXp,
    handleReturnHome
}) {
    return (
        <div className="w-full max-w-md text-center">
            <StudyBot status={quizFailed ? 'incorrect' : 'correct'} />
            <h2 className={`text-3xl font-bold mb-2 ${quizFailed ? 'text-red-500' : 'text-green-500'}`}>
                {quizFailed ? 'Oh não!' : 'Desafio Concluído!'}
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-300 mb-4 px-4">
                {quizFailed 
                    ? `Você ficou sem corações. Estude mais um pouco e tente novamente!` 
                    : `Você dominou o módulo sobre ${currentTrail?.title || "esta trilha"}!`
                }
            </p>
            {!quizFailed && (
                <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl p-4 mb-6 max-w-xs mx-auto">
                    <p className="text-lg font-bold text-indigo-800 dark:text-indigo-200">XP Ganho: +{lastQuizXp}</p>
                </div>
            )}
            <button 
                onClick={handleReturnHome} 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-2xl shadow-lg transition-all hover:scale-105"
            >
                Voltar ao Início
            </button>
        </div>
    );
}
