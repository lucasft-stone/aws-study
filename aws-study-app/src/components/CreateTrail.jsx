import React from 'react';

export default function CreateTrail({
    handleReturnHome,
    apiError,
    newTrailTitle,
    setNewTrailTitle,
    newTrailContent,
    setNewTrailContent,
    handleCreateTrail
}) {
    return (
        <div className="w-full max-w-2xl">
            <button onClick={handleReturnHome} className="text-indigo-500 font-bold mb-4">← Voltar</button>
            <h1 className="text-3xl font-bold text-center mb-6">Criar Nova Trilha</h1>
            {apiError && (
                <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                    {apiError}
                </p>
            )}
            <input
                type="text"
                value={newTrailTitle}
                onChange={(e) => setNewTrailTitle(e.target.value)}
                placeholder="Título da Trilha (ex: Aula 5)"
                className="w-full p-3 mb-4 border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl"
            />
            <textarea
                value={newTrailContent}
                onChange={(e) => setNewTrailContent(e.target.value)}
                placeholder="Cole aqui o conteúdo da sua aula..."
                className="w-full h-60 p-4 border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl mb-4"
            />
            <button
                onClick={handleCreateTrail}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-colors"
            >
                Salvar Trilha
            </button>
        </div>
    );
}
