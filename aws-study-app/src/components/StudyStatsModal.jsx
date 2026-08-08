import React from 'react';

export default function StudyStatsModal({ userData, customTrails, onClose }) {
    const xp = userData?.xp || 0;
    
    // Cálculo do Nível do Aluno
    // Level 1: 0 - 99 XP
    // Level 2: 100 - 249 XP
    // Level 3: 250 - 499 XP
    // Level 4: 500 - 999 XP
    // Level 5: 1000+ XP
    const getLevelInfo = (currentXp) => {
        if (currentXp < 100) {
            return { level: 1, title: '🌱 Aprendiz do Conhecimento', nextXp: 100, currentLevelBase: 0 };
        } else if (currentXp < 250) {
            return { level: 2, title: '🚀 Explorador de Estudos', nextXp: 250, currentLevelBase: 100 };
        } else if (currentXp < 500) {
            return { level: 3, title: '⚡ Mestre Prático', nextXp: 500, currentLevelBase: 250 };
        } else if (currentXp < 1000) {
            return { level: 4, title: '🎓 Especialista Certificado', nextXp: 1000, currentLevelBase: 500 };
        } else {
            return { level: 5, title: '👑 Lenda Suprema do Conhecimento', nextXp: currentXp + 500, currentLevelBase: 1000 };
        }
    };

    const levelInfo = getLevelInfo(xp);
    const xpInLevel = xp - levelInfo.currentLevelBase;
    const levelSpan = levelInfo.nextXp - levelInfo.currentLevelBase;
    const progressPercent = Math.min(100, Math.round((xpInLevel / levelSpan) * 100));

    const totalTrails = customTrails ? customTrails.length : 0;

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-5 border border-slate-100 dark:border-gray-700">
                {/* Header */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-gray-700">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-500 bg-indigo-100 dark:bg-indigo-950/80 px-2.5 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-800">
                            📊 Estatísticas Pessoais do Aluno
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">
                            Perfil & Nível de Progresso
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Level Card */}
                <div className="p-5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl text-white shadow-lg text-center relative overflow-hidden">
                    <div className="text-4xl mb-1">
                        {levelInfo.level === 1 ? '🌱' : levelInfo.level === 2 ? '🚀' : levelInfo.level === 3 ? '⚡' : levelInfo.level === 4 ? '🎓' : '👑'}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-200 block">
                        Nível {levelInfo.level}
                    </span>
                    <h3 className="text-lg font-extrabold text-white mt-0.5">
                        {levelInfo.title}
                    </h3>
                    <p className="text-2xl font-black mt-2 text-amber-300">
                        {xp} XP Acumulados
                    </p>

                    {/* Progress to next level */}
                    <div className="mt-4 pt-3 border-t border-indigo-400/40 text-left">
                        <div className="flex justify-between items-center text-xs font-bold mb-1.5 text-indigo-100">
                            <span>Próximo Nível ({levelInfo.level + 1})</span>
                            <span>{xp}/{levelInfo.nextXp} XP</span>
                        </div>
                        <div className="w-full bg-indigo-950/80 rounded-full h-3 overflow-hidden p-0.5 border border-indigo-400/30">
                            <div
                                className="bg-amber-400 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Grid de Métricas Secundárias */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 text-center">
                        <span className="text-2xl">❤️</span>
                        <span className="block text-xl font-extrabold text-slate-800 dark:text-white mt-1">
                            {userData?.hearts ?? 5} / {userData?.customMaxHearts || 5}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Energia Atual</span>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 text-center">
                        <span className="text-2xl">🗺️</span>
                        <span className="block text-xl font-extrabold text-slate-800 dark:text-white mt-1">
                            {totalTrails}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Trilhas Criadas</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
