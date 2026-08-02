import React from 'react';
import LoadingScreen from './LoadingScreen';

export default function StudyAnki({
    ankiCards,
    currentAnkiCardIndex,
    setCurrentAnkiCardIndex,
    isCardFlipped,
    setIsCardFlipped,
    currentTrail,
    setAppState,
    handleFinishStudyAndStartQuiz,
    rateAnkiCard
}) {
    if (!ankiCards || ankiCards.length === 0) {
        return <LoadingScreen text="Gerando flashcards..." />;
    }

    const currentCard = ankiCards[currentAnkiCardIndex];

    return (
        <div className="w-full max-w-2xl flex flex-col items-center">
            <button
                onClick={() => setAppState('trail_options')}
                className="text-indigo-500 font-bold self-start mb-4 hover:text-indigo-700 transition-colors"
            >
                ← Voltar
            </button>
            
            <div className="flex items-center justify-between w-full mb-2">
                <h2 className="text-2xl font-bold">{currentTrail?.title}</h2>
                <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full">
                    Repetição Espaçada (Anki SM-2)
                </span>
            </div>

            <p className="text-slate-500 mb-6 font-bold self-start">
                Flashcard {currentAnkiCardIndex + 1} de {ankiCards.length}
            </p>
            
            <div className="w-full h-80 perspective-1000" style={{ perspective: '1000px' }}>
                <div 
                    className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isCardFlipped ? 'rotate-y-180' : ''}`}
                    style={{ transformStyle: 'preserve-3d', WebkitTransformStyle: 'preserve-3d' }}
                >
                    {/* LADO DA PERGUNTA (Frente) */}
                    <div 
                        className="absolute w-full h-full backface-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col items-center justify-center p-6 text-center border border-slate-100 dark:border-gray-700"
                        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                    >
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Pergunta</p>
                        <p className="text-2xl font-semibold px-4">{currentCard.front}</p>
                    </div>

                    {/* LADO DA RESPOSTA (Verso) */}
                    <div 
                        className="absolute w-full h-full backface-hidden bg-indigo-50 dark:bg-indigo-950/90 rounded-2xl shadow-xl flex flex-col items-center justify-center p-6 text-center rotate-y-180 border border-indigo-100 dark:border-indigo-800"
                        style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', WebkitTransform: 'rotateY(180deg)' }}
                    >
                        <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Resposta</p>
                        <p className="text-xl px-4 font-medium leading-relaxed">{currentCard.back}</p>
                        {currentCard.interval && (
                            <div className="mt-4 text-xs text-indigo-400 font-semibold">
                                Intervalo atual: {currentCard.interval} dia(s) | Facilidade: {currentCard.easeFactor}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Controles de Virada / Avaliação de Spaced Repetition */}
            {!isCardFlipped ? (
                <button
                    onClick={() => setIsCardFlipped(true)}
                    className="mt-6 w-full max-w-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-colors"
                >
                    Virar Cartão
                </button>
            ) : (
                <div className="mt-6 w-full max-w-md flex flex-col items-center">
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-300 mb-3">Como foi sua memorização?</p>
                    <div className="grid grid-cols-3 gap-3 w-full">
                        <button
                            onClick={() => rateAnkiCard ? rateAnkiCard('hard') : setIsCardFlipped(false)}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-2 rounded-xl text-sm transition-transform active:scale-95 shadow"
                        >
                            🔴 Errei / Difícil
                            <span className="block text-[10px] opacity-80 mt-0.5">Revisar 1 dia</span>
                        </button>
                        <button
                            onClick={() => rateAnkiCard ? rateAnkiCard('good') : setIsCardFlipped(false)}
                            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-2 rounded-xl text-sm transition-transform active:scale-95 shadow"
                        >
                            🟡 Bom
                            <span className="block text-[10px] opacity-80 mt-0.5">Revisar em breve</span>
                        </button>
                        <button
                            onClick={() => rateAnkiCard ? rateAnkiCard('easy') : setIsCardFlipped(false)}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-2 rounded-xl text-sm transition-transform active:scale-95 shadow"
                        >
                            🟢 Fácil
                            <span className="block text-[10px] opacity-80 mt-0.5">Aumentar intervalo</span>
                        </button>
                    </div>
                </div>
            )}

            <div className="flex justify-between w-full max-w-md mt-6">
                <button
                    onClick={() => { setCurrentAnkiCardIndex(i => Math.max(0, i - 1)); setIsCardFlipped(false); }}
                    disabled={currentAnkiCardIndex === 0}
                    className="font-bold text-slate-500 hover:text-indigo-600 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                >
                    ← Anterior
                </button>
                <button
                    onClick={() => { setCurrentAnkiCardIndex(i => Math.min(ankiCards.length - 1, i + 1)); setIsCardFlipped(false); }}
                    disabled={currentAnkiCardIndex === ankiCards.length - 1}
                    className="font-bold text-slate-500 hover:text-indigo-600 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                >
                    Próximo →
                </button>
            </div>

            <button
                onClick={handleFinishStudyAndStartQuiz}
                className="mt-8 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-transform hover:scale-105"
            >
                Testar Conhecimentos no Quiz
            </button>
        </div>
    );
}
