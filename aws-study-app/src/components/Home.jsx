import React from 'react';
import StudyBot from './StudyBot';
import CardButton from './CardButton';
import PWAInstallPrompt from './PWAInstallPrompt';
import { checkIsAdmin } from '../services/firebaseService';

export default function Home({
    user,
    userData,
    customTrails,
    selectedModel,
    setSelectedModel,
    geminiModels,
    studyLevels,
    handleSelectTrail,
    handleDeleteTrail,
    handleClearCache,
    signOutUser,
    setAppState,
    apiError,
    ENABLE_FIREBASE_AUTH,
    HIDE_EXISTING_TRAILS,
    MAX_DAILY_TRAIL_CREATIONS
}) {
    const isRoot = checkIsAdmin(user);
    const creationLimitReached = userData.dailyTrailCreations >= MAX_DAILY_TRAIL_CREATIONS && !isRoot;

    return (
        <div className="w-full max-w-2xl text-center">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    {user?.photoURL && (
                        <img src={user.photoURL} alt={user.displayName || "Usuário"} className="w-10 h-10 rounded-full" />
                    )}
                    <span className="font-bold">{user?.displayName || "Usuário"}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xl font-bold text-red-500 flex items-center gap-1">❤️ {userData.hearts}</span>
                    {isRoot && (
                        <button 
                            onClick={() => {
                                setAppState('admin');
                                window.history.pushState({}, '', '/admin');
                            }}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 px-3 rounded-xl transition-transform hover:scale-105 shadow"
                        >
                            👑 Painel Admin
                        </button>
                    )}
                    {ENABLE_FIREBASE_AUTH && (
                        <button onClick={handleClearCache} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                            Limpar Cache
                        </button>
                    )}
                    {ENABLE_FIREBASE_AUTH && (
                        <button onClick={signOutUser} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors">
                            Sair
                        </button>
                    )}
                </div>
            </div>
            
            <PWAInstallPrompt />

            <StudyBot status="idle" />
            <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-2">StudyBot</h1>
            <p className="text-slate-500 dark:text-slate-300 mb-6">
                Sua pontuação total: <span className="font-bold text-indigo-500">{userData.xp} XP</span>
            </p>
            
            {apiError && (
                <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">
                    {apiError}
                </p>
            )}

            <div className="my-4">
                <label htmlFor="model-select" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Select Gemini Model
                </label>
                <select
                    id="model-select"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full max-w-xs mx-auto bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md shadow-sm p-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                    {geminiModels.map(model => (
                        <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                </select>
            </div>
            
            <div className="space-y-6">
                {(!HIDE_EXISTING_TRAILS || isRoot) && (
                    <>
                        <div>
                            <h2 className="text-2xl font-bold text-left mb-3">Trilhas Guiadas</h2>
                            {studyLevels.map(level => (
                                <CardButton
                                    key={level.id}
                                    title={level.title}
                                    description={`${level.xpRequired} XP necessários`}
                                    disabled={userData.xp < level.xpRequired}
                                    onClick={() => handleSelectTrail(level)}
                                    icon={userData.xp < level.xpRequired ? '🔒' : level.icon}
                                />
                            ))}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-left mb-3">Minhas Trilhas</h2>
                            {customTrails.length > 0 ? (
                                customTrails.map(trail => (
                                    <CardButton
                                        key={trail.id}
                                        title={trail.title}
                                        description="Sua trilha personalizada"
                                        onClick={() => handleSelectTrail(trail)}
                                        icon={'📌'}
                                        onDelete={() => handleDeleteTrail(trail.id)}
                                    />
                                ))
                            ) : (
                                <p className="text-slate-500">Você ainda não criou nenhuma trilha.</p>
                            )}
                        </div>
                    </>
                )}
                <div>
                    <button
                        onClick={() => setAppState('create_trail')}
                        disabled={creationLimitReached}
                        className="mt-4 w-full bg-indigo-100 text-indigo-700 font-bold py-3 rounded-2xl hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        + Criar Nova Trilha de Estudo
                    </button>
                    {creationLimitReached && (
                        <p className="text-sm text-amber-600 mt-2">Você atingiu seu limite de criação de trilhas por hoje.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
