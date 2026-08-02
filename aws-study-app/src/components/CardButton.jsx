import React from 'react';

export default function CardButton({ title, description, onClick, disabled = false, icon, onDelete, onEdit }) {
    return (
        <div className="relative group">
            <button onClick={onClick} disabled={disabled} className={`w-full mb-4 p-6 text-left bg-white dark:bg-gray-800 rounded-2xl shadow-lg transition-all duration-300 ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-1'}`}>
                <div className="flex items-center gap-5">
                    <div className="text-3xl">{icon}</div>
                    <div className="flex-grow min-w-0">
                        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 truncate">{title}</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{description}</p>
                    </div>
                </div>
            </button>
            <div className="absolute top-1/2 -right-3 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onEdit && !disabled && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                        className="text-indigo-600 hover:text-indigo-800 p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                        title="Editar & Regerar Subtópico"
                    >
                        ✏️
                    </button>
                )}
                {onDelete && !disabled && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete();
                        }}
                        className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                        title="Apagar trilha"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                )}
            </div>
        </div>
    );
}
