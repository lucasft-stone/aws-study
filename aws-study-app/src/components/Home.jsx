import React, { useState } from 'react';
import StudyBot from './StudyBot';
import CardButton from './CardButton';
import PWAInstallPrompt from './PWAInstallPrompt';
import { checkIsAdmin } from '../services/firebaseService';
import { resolveTopicIcon, getHideAwsTopicSetting } from '../utils/topicHelpers';

export default function Home({
    user,
    userData,
    customTrails,
    selectedModel,
    setSelectedModel,
    geminiModels,
    studyLevels,
    handleSelectTrail,
    handleEditTrail,
    handleDeleteTrail,
    handleDeleteTopic,
    handleClearCache,
    signOutUser,
    setAppState,
    apiError,
    themeMode,
    toggleTheme,
    ENABLE_FIREBASE_AUTH,
    HIDE_EXISTING_TRAILS,
    MAX_DAILY_TRAIL_CREATIONS
}) {
    const isRoot = checkIsAdmin(user);
    const creationLimitReached = (userData.dailyTrailCreations || 0) >= MAX_DAILY_TRAIL_CREATIONS && !isRoot;

    // Estado para controlar se o usuário está dentro de um tópico específico
    const [selectedTopicId, setSelectedTopicId] = useState(null);

    // 1. Tópico Oficial AWS (Exemplo Completo)
    const officialTopic = {
        id: 'topic-aws',
        title: 'AWS - Cloud Computing',
        icon: '☁️',
        description: 'Trilha oficial completa de certificação e arquitetura AWS (8 Módulos)',
        badge: 'Oficial AWS',
        items: studyLevels
    };

    // 2. Agrupamento dinâmico de TODAS as Trilhas (Globais e Personalizadas) pelo Tópico desejado pelo usuário/admin
    const customTopicsMap = {};
    customTrails.forEach(trail => {
        const topicName = trail.topic || 'Minhas Trilhas Personalizadas';
        if (!customTopicsMap[topicName]) {
            customTopicsMap[topicName] = [];
        }
        customTopicsMap[topicName].push(trail);
    });

    const customTopicsList = Object.keys(customTopicsMap).map(topicName => {
        const items = customTopicsMap[topicName];
        const explicitIcon = items.find(i => i.icon)?.icon;
        const icon = resolveTopicIcon(topicName, explicitIcon);
        const hasGlobal = items.some(i => i.isGlobal);

        return {
            id: 'topic-custom-' + topicName,
            title: topicName,
            icon,
            description: `${items.length} subtópico(s) de estudo`,
            badge: hasGlobal ? '🌐 Oficial' : 'Personalizado',
            items
        };
    });

    // 3. Verifica se a Trilha Exemplo AWS deve ser ocultada (configurado pelo Admin ou flag)
    const isAwsTopicHidden = getHideAwsTopicSetting();

    // Lista de todos os tópicos disponíveis no sistema
    const allTopics = [];
    if (!isAwsTopicHidden && (!HIDE_EXISTING_TRAILS || isRoot)) {
        allTopics.push(officialTopic);
    }
    allTopics.push(...customTopicsList);

    // Tópico atualmente aberto pelo usuário
    const activeTopic = allTopics.find(t => t.id === selectedTopicId);

    return (
        <div className="w-full max-w-2xl text-center animate-fade-in">
            {/* User Info Bar Responsiva */}
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                    {user?.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || "Usuário"} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border border-slate-200" />
                    ) : (
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs sm:text-sm shadow">
                            {(user?.displayName || "U")[0].toUpperCase()}
                        </div>
                    )}
                    <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100">{user?.displayName || "Usuário"}</span>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap justify-end">
                    {toggleTheme && (
                        <button
                            onClick={toggleTheme}
                            title="Alternar Tema do App (Claro / Escuro / Sistema)"
                            className="bg-slate-100 dark:bg-gray-700/70 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 font-extrabold text-[11px] sm:text-xs py-1 px-2 rounded-xl transition-all flex items-center gap-1 shadow-sm border border-slate-200 dark:border-gray-600"
                        >
                            {themeMode === 'light' ? '☀️ Claro' : themeMode === 'dark' ? '🌙 Escuro' : '💻 Sistema'}
                        </button>
                    )}
                    <span className="text-sm sm:text-lg font-extrabold text-red-500 flex items-center gap-1 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-xl border border-red-100 dark:border-red-900/40">❤️ {userData.hearts}</span>
                    {isRoot && (
                        <button 
                            onClick={() => {
                                setAppState('admin');
                                window.history.pushState({}, '', '/admin');
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] sm:text-xs font-bold py-1 px-2 rounded-xl transition-transform hover:scale-105 shadow"
                        >
                            👑 Admin
                        </button>
                    )}
                    {ENABLE_FIREBASE_AUTH && (
                        <button onClick={handleClearCache} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                            Limpar Cache
                        </button>
                    )}
                    {ENABLE_FIREBASE_AUTH && (
                        <button onClick={signOutUser} className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                            Sair
                        </button>
                    )}
                </div>
            </div>
            
            <PWAInstallPrompt />

            <StudyBot status="idle" />
            <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-1">StudyBot</h1>
            <p className="text-slate-500 dark:text-slate-300 mb-6">
                Sua pontuação total: <span className="font-extrabold text-indigo-500">{userData.xp} XP</span>
            </p>
            
            {apiError && (
                <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg border border-red-200">
                    {apiError}
                </p>
            )}

            {/* Model Selector */}
            <div className="my-4">
                <label htmlFor="model-select" className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Modelo de Inteligência Artificial
                </label>
                <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full max-w-xs mx-auto bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 text-slate-800 dark:text-white rounded-xl shadow-sm p-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                    {geminiModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                </select>
            </div>
            
            <div className="mt-6">
                {/* 1. VISÃO PRINCIPAL: LISTA DE TÓPICOS */}
                {!selectedTopicId ? (
                    <div className="space-y-4 text-left">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white">
                                📚 Trilhas por Tópico
                            </h2>
                            <span className="text-xs font-bold text-slate-400">
                                {allTopics.length} Tópico(s)
                            </span>
                        </div>

                        {allTopics.map(topic => (
                            <div
                                key={topic.id}
                                onClick={() => setSelectedTopicId(topic.id)}
                                className="p-4 sm:p-5 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/60 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 transition-all cursor-pointer transform hover:-translate-y-0.5 flex items-center justify-between gap-3 group"
                            >
                                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-grow">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-2xl sm:text-3xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        {topic.icon}
                                    </div>
                                    <div className="min-w-0 flex-grow text-left">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors truncate">
                                                {topic.title}
                                            </h3>
                                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0 ${topic.badge === 'Oficial AWS' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'}`}>
                                                {topic.badge}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                            {topic.description}
                                        </p>
                                        <p className="text-[11px] font-bold text-indigo-500 mt-0.5">
                                            {topic.items.length} subtópico(s) de estudo →
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {topic.badge === 'Personalizado' && handleDeleteTopic && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteTopic(topic);
                                            }}
                                            title="Excluir este tópico completo e todos os seus subtópicos"
                                            className="p-2 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all border border-slate-100 dark:border-gray-700"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                    <div className="text-slate-300 group-hover:text-indigo-600 font-bold text-lg sm:text-xl transition-colors">
                                        ➔
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={() => setAppState('create_trail')}
                            disabled={creationLimitReached}
                            className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-4 rounded-2xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01]"
                        >
                            + Criar Nova Trilha de Estudo
                        </button>
                        {creationLimitReached && (
                            <p className="text-xs text-amber-600 font-semibold mt-2 text-center">
                                Você atingiu o limite de criação de trilhas por hoje.
                            </p>
                        )}
                    </div>
                ) : (
                    /* 2. VISÃO INTERNA DO TÓPICO: SUBTÓPICOS E MÓDULOS */
                    <div className="text-left animate-fade-in">
                        <button
                            onClick={() => setSelectedTopicId(null)}
                            className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 hover:underline mb-3 flex items-center gap-1"
                        >
                            ← Voltar para Todos os Tópicos
                        </button>

                        <div className="p-4 mb-4 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">{activeTopic?.icon}</span>
                                <div>
                                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">
                                        {activeTopic?.title}
                                    </h2>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        {activeTopic?.description}
                                    </p>
                                </div>
                            </div>

                            {activeTopic?.badge === 'Personalizado' && handleDeleteTopic && (
                                <button
                                    onClick={() => {
                                        handleDeleteTopic(activeTopic);
                                        setSelectedTopicId(null);
                                    }}
                                    title="Excluir este tópico completo e todos os seus subtópicos"
                                    className="bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition-all shadow flex items-center gap-1.5 self-end sm:self-center"
                                >
                                    🗑️ Excluir Tópico Completo
                                </button>
                            )}
                        </div>

                        <div className="space-y-3">
                            {activeTopic?.items.map(item => {
                                const isLocked = item.xpRequired !== undefined && userData.xp < item.xpRequired;
                                const shortDescription = item.xpRequired !== undefined 
                                    ? `${item.xpRequired} XP necessários` 
                                    : (item.content ? (item.content.replace(/[\r\n]+/g, ' ').trim().substring(0, 90) + (item.content.length > 90 ? '...' : '')) : 'Subtópico de estudo');

                                return (
                                    <CardButton
                                        key={item.id}
                                        title={item.title}
                                        description={shortDescription}
                                        disabled={isLocked}
                                        onClick={() => handleSelectTrail(item)}
                                        icon={isLocked ? '🔒' : (item.icon || activeTopic.icon || '📌')}
                                        badge={item.isGlobal ? '🌐 Oficial' : undefined}
                                        onEdit={activeTopic.id !== 'topic-aws' && handleEditTrail ? () => handleEditTrail(item) : undefined}
                                        onDelete={activeTopic.id !== 'topic-aws' ? () => handleDeleteTrail(item.id) : undefined}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
