import React from 'react';
import { ACHIEVEMENTS, getUnlockedAchievements } from '../utils/achievementsHelper';

export default function AchievementsModal({ userData, customTrails, onClose }) {
    const unlocked = getUnlockedAchievements(userData, customTrails);
    const unlockedIds = new Set(unlocked.map(b => b.id));
    const progressPercent = Math.round((unlocked.length / ACHIEVEMENTS.length) * 100);

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4 border border-slate-100 dark:border-gray-700 max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-gray-700 flex-shrink-0">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-500 bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                            🏆 Sistema de Conquistas & Badges
                        </span>
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mt-1">
                            Galeria de Conquistas ({unlocked.length}/{ACHIEVEMENTS.length})
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
                    >
                        ✕
                    </button>
                </div>

                {/* Progress Bar */}
                <div className="bg-slate-100 dark:bg-gray-900 p-4 rounded-2xl border border-slate-200 dark:border-gray-700 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-extrabold">
                        <span className="text-slate-700 dark:text-slate-300">Progresso Geral</span>
                        <span className="text-indigo-600 dark:text-indigo-400">{progressPercent}% Concluído</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                            className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>

                {/* Grid of Achievements */}
                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-grow pr-1">
                    {ACHIEVEMENTS.map((badge) => {
                        const isUnlocked = unlockedIds.has(badge.id);

                        return (
                            <div
                                key={badge.id}
                                className={`p-4 rounded-2xl border flex items-center gap-3.5 transition-all ${
                                    isUnlocked
                                        ? 'bg-gradient-to-r from-amber-500/10 to-indigo-500/10 border-amber-400/40 dark:border-amber-600/40 shadow-sm'
                                        : 'bg-slate-50 dark:bg-gray-900/60 border-slate-200 dark:border-gray-800 opacity-60'
                                }`}
                            >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0 ${
                                    isUnlocked ? 'bg-amber-100 dark:bg-amber-900/60 shadow-md scale-105' : 'bg-slate-200 dark:bg-gray-800 grayscale'
                                }`}>
                                    {badge.icon}
                                </div>

                                <div className="flex-grow">
                                    <div className="flex items-center gap-2">
                                        <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">
                                            {badge.title}
                                        </h4>
                                        {isUnlocked ? (
                                            <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-300">
                                                ✅ Desbloqueado
                                            </span>
                                        ) : (
                                            <span className="bg-slate-200 text-slate-600 dark:bg-gray-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                                                🔒 Bloqueado
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        {badge.description}
                                    </p>
                                </div>

                                <div className="text-right flex-shrink-0">
                                    <span className="text-xs font-extrabold text-amber-500">
                                        +{badge.xpReward} XP
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
