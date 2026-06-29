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
    handleFinishStudyAndStartQuiz
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
            <h2 className="text-2xl font-bold mb-2">{currentTrail?.title}</h2>
            <p className="text-slate-500 mb-6 font-bold">Flashcard {currentAnkiCardIndex + 1} de {ankiCards.length}</p>
            
            <div className="w-full h-80 perspective-1000">
                <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                    <div className="absolute w-full h-full backface-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center p-6 text-center border border-slate-100 dark:border-gray-700">
                        <p className="text-2xl font-semibold px-4">{currentCard.front}</p>
                    </div>
                    <div className="absolute w-full h-full backface-hidden bg-indigo-50 dark:bg-indigo-900/80 rounded-2xl shadow-xl flex items-center justify-center p-6 text-center transform rotate-y-180 border border-indigo-100 dark:border-indigo-800">
                        <p className="text-xl px-4">{currentCard.back}</p>
                    </div>
                </div>
            </div>

            <button
                onClick={() => setIsCardFlipped(!isCardFlipped)}
                className="mt-6 w-full max-w-sm bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-colors"
            >
                {isCardFlipped ? 'Ver Pergunta' : 'Virar Cartão'}
            </button>

            <div className="flex justify-between w-full max-w-sm mt-4">
                <button
                    onClick={() => { setCurrentAnkiCardIndex(i => i - 1); setIsCardFlipped(false); }}
                    disabled={currentAnkiCardIndex === 0}
                    className="font-bold text-slate-500 hover:text-indigo-600 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                >
                    Anterior
                </button>
                <button
                    onClick={() => { setCurrentAnkiCardIndex(i => i + 1); setIsCardFlipped(false); }}
                    disabled={currentAnkiCardIndex === ankiCards.length - 1}
                    className="font-bold text-slate-500 hover:text-indigo-600 disabled:opacity-50 disabled:hover:text-slate-500 transition-colors"
                >
                    Próximo
                </button>
            </div>

            <button
                onClick={handleFinishStudyAndStartQuiz}
                className="mt-8 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-transform hover:scale-105"
            >
                Iniciar Quiz
            </button>
        </div>
    );
}
