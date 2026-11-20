import React from 'react';
import StudyBot from './StudyBot';
import CardButton from './CardButton';

export default function TrailOptions({
    currentTrail,
    userData,
    generateContent,
    handleReturnHome,
    handleEditTrail
}) {
    const isCustomTrail = currentTrail && !currentTrail.id?.startsWith('level-');
    const isSchoolTrail = currentTrail?.isSchoolTrail === true;

    return (
        <div className="w-full max-w-lg text-center relative pt-8 animate-fade-in">
            <button onClick={handleReturnHome} className="text-indigo-500 font-bold absolute top-0 left-0 hover:text-indigo-700 transition-colors">
                ← Voltar
            </button>
            <StudyBot status="idle" />
            <h1 className="text-3xl font-bold mb-2 text-slate-800 dark:text-white">{currentTrail?.title}</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">O que você gostaria de fazer?</p>
            {isSchoolTrail && (
                <p className="text-[11px] font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 rounded-xl px-3 py-2 mb-4">
                    🏫 Matéria do colégio — o conteúdo é publicado e gerenciado pelo seu professor.
                </p>
            )}
            <div className="space-y-4">
                <CardButton
                    title="Estudar Material"
                    description="Revise o conteúdo antes do quiz."
                    onClick={() => generateContent(currentTrail, 'study')}
                    icon={<span>📖</span>}
                />
                <CardButton
                    title="Flashcards (Anki)"
                    description="Memorize os pontos-chave."
                    onClick={() => generateContent(currentTrail, 'anki')}
                    icon={<span>🗂️</span>}
                />
                <CardButton
                    title="Ir Direto para o Quiz"
                    description={`${userData.hearts} corações restantes.`}
                    onClick={() => generateContent(currentTrail, 'quiz')}
                    disabled={userData.hearts <= 0}
                    icon={<span>🧠</span>}
                />

                {isCustomTrail && !isSchoolTrail && handleEditTrail && (
                    <button
                        onClick={() => handleEditTrail(currentTrail)}
                        className="w-full mt-4 p-4 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold rounded-2xl border border-indigo-200 dark:border-indigo-800 transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                    >
                        <span>✏️ Editar Conteúdo & Regerar Subtópico</span>
                    </button>
                )}
            </div>
            {userData.hearts <= 0 && (
                <p className="text-red-500 mt-4 font-bold">Você está sem corações! Estude o material para recarregá-los.</p>
            )}
        </div>
    );
}
