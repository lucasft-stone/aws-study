import React, { useState } from 'react';

export default function CreateTrail({
    handleReturnHome,
    apiError,
    newTrailTitle,
    setNewTrailTitle,
    newTrailContent,
    setNewTrailContent,
    newTrailTopic,
    setNewTrailTopic,
    handleCreateTrail
}) {
    const [customTopicInput, setCustomTopicInput] = useState('');
    const [isCreatingCustomTopic, setIsCreatingCustomTopic] = useState(false);

    const handleTopicSelectChange = (e) => {
        const val = e.target.value;
        if (val === 'CUSTOM_NEW') {
            setIsCreatingCustomTopic(true);
            setNewTrailTopic(customTopicInput || 'Novo Tópico');
        } else {
            setIsCreatingCustomTopic(false);
            setNewTrailTopic(val);
        }
    };

    const handleCustomTopicTextChange = (e) => {
        const text = e.target.value;
        setCustomTopicInput(text);
        setNewTrailTopic(text || 'Novo Tópico');
    };

    return (
        <div className="w-full max-w-2xl animate-fade-in">
            <button onClick={handleReturnHome} className="text-indigo-500 hover:text-indigo-600 font-bold mb-4 flex items-center gap-1">
                ← Voltar para Trilhas
            </button>
            <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white text-center mb-6">
                + Criar Nova Trilha de Estudo
            </h1>
            {apiError && (
                <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg border border-red-200">
                    {apiError}
                </p>
            )}

            {/* Escolha do Tópico Pai */}
            <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    📁 Selecione o Tópico / Categoria
                </label>
                <select
                    value={isCreatingCustomTopic ? 'CUSTOM_NEW' : (newTrailTopic || 'Minhas Trilhas Personalizadas')}
                    onChange={handleTopicSelectChange}
                    className="w-full p-3 bg-white dark:bg-gray-800 border-2 border-slate-200 dark:border-gray-700 rounded-xl font-semibold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="Minhas Trilhas Personalizadas">📌 Minhas Trilhas Personalizadas</option>
                    <option value="AWS - Cloud Computing">☁️ AWS - Cloud Computing</option>
                    <option value="Desenvolvimento & Programação">💻 Desenvolvimento & Programação</option>
                    <option value="DevOps & Infraestrutura">🚀 DevOps & Infraestrutura</option>
                    <option value="CUSTOM_NEW">✨ + Criar Novo Tópico Personalizado...</option>
                </select>

                {isCreatingCustomTopic && (
                    <input
                        type="text"
                        value={customTopicInput}
                        onChange={handleCustomTopicTextChange}
                        placeholder="Digite o nome do novo tópico (ex: Python, Docker, Finanças...)"
                        className="w-full p-3 mt-2 border-2 border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 rounded-xl font-semibold text-slate-800 dark:text-white"
                        autoFocus
                    />
                )}
            </div>

            {/* Título da Trilha / Subtópico */}
            <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    📌 Título do Subtópico / Trilha
                </label>
                <input
                    type="text"
                    value={newTrailTitle}
                    onChange={(e) => setNewTrailTitle(e.target.value)}
                    placeholder="Ex: Introdução ao Docker Containers"
                    className="w-full p-3 border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            {/* Conteúdo de Referência */}
            <div className="mb-4">
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    📖 Conteúdo / Resumo da Trilha
                </label>
                <textarea
                    value={newTrailContent}
                    onChange={(e) => setNewTrailContent(e.target.value)}
                    placeholder="Cole aqui o texto, resumo ou pontos principais da sua matéria de estudo..."
                    className="w-full h-56 p-4 border-2 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-xl font-medium text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
            </div>

            <button
                onClick={handleCreateTrail}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 rounded-2xl shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
                🚀 Salvar Trilha no Tópico
            </button>
        </div>
    );
}
