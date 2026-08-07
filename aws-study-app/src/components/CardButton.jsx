import React from 'react';

export default function CardButton({ title, description, onClick, disabled = false, icon, onDelete, onEdit, badge }) {
    return (
        <div className={`w-full mb-3.5 p-4 sm:p-5 bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-slate-100 dark:border-gray-700/80 transition-all duration-200 flex items-center justify-between gap-3 ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-900'}`}>
            {/* Área Clicável Principal para abrir a trilha */}
            <div 
                onClick={!disabled ? onClick : undefined}
                className="flex items-center gap-3.5 flex-grow min-w-0 cursor-pointer"
            >
                <div className="text-2xl sm:text-3xl flex-shrink-0">{icon}</div>
                <div className="flex-grow min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-slate-100 truncate">{title}</h2>
                        {badge && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex-shrink-0">
                                {badge}
                            </span>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">{description}</p>
                </div>
            </div>

            {/* Ações de Edição e Exclusão INSIDE O CARD */}
            {(onEdit || onDelete) && !disabled && (
                <div className="flex items-center gap-1 flex-shrink-0 border-l border-slate-100 dark:border-gray-700 pl-2">
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            className="p-2 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900"
                            title="Editar & Regerar Subtópico"
                        >
                            ✏️
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-2 text-rose-500 hover:text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-all border border-transparent hover:border-rose-200 dark:hover:border-rose-900"
                            title="Apagar trilha"
                        >
                            🗑️
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
