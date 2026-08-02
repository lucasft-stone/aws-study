import React from 'react';
import { marked } from 'marked';
import { checkIsAdmin } from '../services/firebaseService';

export default function StudyMaterial({
    currentTrail,
    userData,
    user,
    studyContent,
    generateContent,
    setAppState,
    handleFinishStudyAndStartQuiz,
    MAX_DAILY_REFRESHES
}) {
    const isRoot = checkIsAdmin(user);
    const refreshLimitReached = userData.dailyRefreshes >= MAX_DAILY_REFRESHES && !isRoot;
    
    // Garante que quebras de linha escapadas sejam tratadas e configura o marked
    const formattedContent = marked.parse(studyContent.replace(/\\n/g, '\n'), { breaks: true, gfm: true });

    return (
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 flex flex-col h-[85vh]">
            <div className="flex justify-between items-center mb-6 flex-shrink-0">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{currentTrail?.title}</h1>
                <button
                    onClick={() => generateContent(currentTrail, 'study', true)}
                    disabled={refreshLimitReached}
                    title={refreshLimitReached ? 'Limite de atualizações diárias atingido' : 'Gerar novo material de estudo'}
                    className="text-slate-400 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                </button>
            </div>
            <div
                className="markdown-content flex-grow overflow-y-auto pr-4 custom-scrollbar"
                dangerouslySetInnerHTML={{ __html: formattedContent }}
            />
            <div className="mt-6 flex justify-between items-center flex-shrink-0 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                    onClick={() => setAppState('trail_options')}
                    className="text-indigo-500 font-bold hover:text-indigo-700 transition-colors"
                >
                    ← Voltar
                </button>
                <button
                    onClick={handleFinishStudyAndStartQuiz}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-transform hover:scale-105"
                >
                    {userData.hearts <= 0 ? "Concluir Estudo e Restaurar Corações!" : "Concluir Estudo e Iniciar Quiz"}
                </button>
            </div>
        </div>
    );
}
