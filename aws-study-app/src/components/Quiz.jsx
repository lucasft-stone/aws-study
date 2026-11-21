import React, { useState } from 'react';
import LoadingScreen from './LoadingScreen';
import StudyBot from './StudyBot';
import QuizEditorModal from './QuizEditorModal';
import TimedExamModal from './TimedExamModal';
import { checkIsAdmin } from '../services/firebaseService';
import { resolveCorrectAnswer } from '../hooks/useStudySession';

export default function Quiz({
    quizQuestions,
    currentQuestionIndex,
    userData,
    user,
    currentTrail,
    botStatus,
    selectedAnswer,
    isAnswered,
    isCorrect,
    handleSelectAnswer,
    handleCheckAnswer,
    handleNextQuestion,
    handleReturnHome,
    XP_PER_CORRECT_ANSWER,
    onSaveQuestions,
    onTimedExamFinish
}) {
    const [isEditingQuiz, setIsEditingQuiz] = useState(false);
    const [showTimedExam, setShowTimedExam] = useState(false);
    const isAdmin = checkIsAdmin(user);

    if (!quizQuestions || quizQuestions.length === 0) {
        return <LoadingScreen text="Gerando quiz..." />;
    }

    const currentQuestion = quizQuestions[currentQuestionIndex];
    const correctOptionText = resolveCorrectAnswer(currentQuestion);
    const progressPercentage = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;

    return (
        <div className="w-full max-w-2xl px-4 flex flex-col justify-between min-h-[90vh] relative">
            <header className="pt-4 flex items-center gap-4 flex-shrink-0">
                <button
                    onClick={handleReturnHome}
                    className="text-2xl text-slate-500 hover:text-slate-800 transition-colors"
                >
                    ✕
                </button>
                <div className="flex-grow bg-slate-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                    <div
                        className="bg-green-500 h-4 rounded-full transition-all duration-500"
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
                
                <button
                    onClick={() => setShowTimedExam(true)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow flex-shrink-0"
                    title="Iniciar prova com cronômetro e mapa de revisão"
                >
                    ⏱️ Modo Simulado
                </button>

                {isAdmin && (
                    <button
                        onClick={() => setIsEditingQuiz(true)}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow flex-shrink-0"
                        title="Editar perguntas, respostas e criar questões manualmente (Admin)"
                    >
                        ✏️ Exercícios (Admin)
                    </button>
                )}

                <div className="text-xl font-bold text-red-500 flex items-center gap-1 flex-shrink-0">
                    ❤️ {userData?.hearts}
                </div>
            </header>
            
            <main className="flex-grow flex flex-col items-center justify-center animate-fade-in py-6" key={currentQuestionIndex}>
                <StudyBot status={botStatus} />
                <h2 className="text-2xl font-bold text-center mb-8 text-slate-800 dark:text-white">
                    {currentQuestion.question}
                </h2>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">
                    {currentQuestion.options.map((option, index) => {
                        const isSelected = selectedAnswer === option;
                        let buttonClass = "border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700/50 text-slate-800 dark:text-slate-100";
                        if (isAnswered) {
                            if (option === correctOptionText) {
                                buttonClass = "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-600 dark:text-white";
                            } else if (isSelected) {
                                buttonClass = "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-600 dark:text-white";
                            } else {
                                buttonClass = "opacity-50 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-800 dark:text-slate-100";
                            }
                        } else if (isSelected) {
                            buttonClass = "bg-indigo-100 border-indigo-300 dark:bg-indigo-900/50 dark:border-indigo-600 text-indigo-900 dark:text-indigo-100";
                        }
                        return (
                            <button
                                key={index}
                                onClick={() => handleSelectAnswer(option)}
                                disabled={isAnswered}
                                className={`p-4 border-2 rounded-2xl text-left font-bold transition-all duration-200 ${buttonClass}`}
                            >
                                {option}
                            </button>
                        );
                    })}
                </div>
            </main>
            
            <footer className="h-44 flex-shrink-0">
                {!isAnswered ? (
                    <div className="flex items-end h-full pb-4">
                        <button
                            onClick={handleCheckAnswer}
                            disabled={!selectedAnswer}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all hover:scale-105 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:scale-100 disabled:cursor-not-allowed"
                        >
                            Verificar
                        </button>
                    </div>
                ) : (
                    <div className={`relative p-6 rounded-t-3xl animate-slide-in-bottom ${isCorrect ? 'bg-green-100 dark:bg-green-900/70' : 'bg-red-100 dark:bg-red-900/70'}`}>
                        {isCorrect && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-green-500 font-extrabold text-xl animate-xp-gain">
                                +{XP_PER_CORRECT_ANSWER} XP
                            </div>
                        )}
                        <div className="flex justify-between items-center gap-4">
                            <div>
                                <h3 className={`font-bold text-xl ${isCorrect ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>
                                    {isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}
                                </h3>
                                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-h-20 overflow-y-auto">
                                    {currentQuestion.explanation}
                                </p>
                            </div>
                            <button
                                onClick={handleNextQuestion}
                                className={`font-bold py-3 px-8 rounded-2xl shadow-md transition-transform transform hover:scale-105 flex-shrink-0 ${isCorrect ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}
                            >
                                Próximo
                            </button>
                        </div>
                    </div>
                )}
            </footer>

            {/* Modal de Edição de Exercícios para Admin */}
            {isEditingQuiz && (
                <QuizEditorModal
                    trail={{ ...currentTrail, cachedQuiz: quizQuestions }}
                    onClose={() => setIsEditingQuiz(false)}
                    onSave={async (newQuestions) => {
                        if (onSaveQuestions) await onSaveQuestions(newQuestions);
                    }}
                />
            )}

            {/* Modal de Simulado Cronometrado */}
            {showTimedExam && (
                <TimedExamModal
                    questions={quizQuestions}
                    trailTitle={currentTrail?.title}
                    onClose={() => setShowTimedExam(false)}
                    onFinish={onTimedExamFinish}
                />
            )}
        </div>
    );
}
