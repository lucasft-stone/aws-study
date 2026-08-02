import { useState, useCallback, useEffect } from 'react';
import { fetchGeneratedStudyContent } from '../services/geminiService';
import { updateProgressCache, fetchStudyLevelProgress, ENABLE_FIREBASE_AUTH } from '../services/firebaseService';

const XP_PER_CORRECT_ANSWER = 25;
const MAX_DAILY_REFRESHES = 10;
const MAX_DAILY_TRAIL_CREATIONS = 1;

/**
 * Algoritmo SuperMemo-2 (SM-2) para Repetição Espaçada dos Flashcards Anki.
 * Recebe o cartão atual e a avaliação de dificuldade do usuário (rating: 'hard', 'good', 'easy').
 */
export function calculateSM2(card, rating) {
    let repetition = card.repetition || 0;
    let interval = card.interval || 1;
    let easeFactor = card.easeFactor || 2.5;

    let q = 3; // default 'good'
    if (rating === 'hard') q = 1;
    else if (rating === 'easy') q = 5;

    if (q >= 3) {
        if (repetition === 0) {
            interval = 1;
        } else if (repetition === 1) {
            interval = 6;
        } else {
            interval = Math.round(interval * easeFactor);
        }
        repetition += 1;
    } else {
        repetition = 0;
        interval = 1;
    }

    // Atualiza o fator de facilidade (Ease Factor)
    easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + interval);

    return {
        ...card,
        repetition,
        interval,
        easeFactor: parseFloat(easeFactor.toFixed(2)),
        nextReviewDate: nextReviewDate.toISOString(),
        lastReviewedAt: new Date().toISOString()
    };
}

export function useStudySession({ user, userData, updateUserData, isRoot }) {
    const [appState, setAppState] = useState(ENABLE_FIREBASE_AUTH && !user ? 'login' : 'home');
    const [currentTrail, setCurrentTrail] = useState(null);
    const [studyContent, setStudyContent] = useState('');
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

    useEffect(() => {
        if (ENABLE_FIREBASE_AUTH) {
            if (!user) {
                setAppState('login');
            } else {
                setAppState(prev => (prev === 'login' ? 'home' : prev));
            }
        }
    }, [user]);

    // Restaura o estado da navegação a partir dos parâmetros da URL ao recarregar a página (F5)
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const savedState = urlParams.get('state');

        if (savedState && savedState !== 'home' && savedState !== 'login') {
            setAppState(savedState);
        }
    }, []);

    // Sincroniza a localização da página e a trilha atual na URL (ex: ?state=studying_material&trail=level-s3)
    useEffect(() => {
        if (!appState || appState === 'login') return;

        const url = new URL(window.location.href);
        if (appState === 'home') {
            url.searchParams.delete('state');
            url.searchParams.delete('trail');
        } else {
            url.searchParams.set('state', appState);
            if (currentTrail?.id) {
                url.searchParams.set('trail', currentTrail.id);
            } else {
                url.searchParams.delete('trail');
            }
        }
        window.history.replaceState({}, '', url.toString());
    }, [appState, currentTrail]);

    // Estados do Quiz
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const [botStatus, setBotStatus] = useState('idle');
    const [quizFailed, setQuizFailed] = useState(false);
    const [lastQuizXp, setLastQuizXp] = useState(0);

    // Estados do Anki (Flashcards)
    const [ankiCards, setAnkiCards] = useState([]);
    const [currentAnkiCardIndex, setCurrentAnkiCardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    // Erros de API
    const [sessionError, setSessionError] = useState('');

    const resetQuizState = useCallback(() => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsCorrect(null);
        setBotStatus('idle');
        setLastQuizXp(0);
        setQuizFailed(false);
    }, []);

    const resetAnkiState = useCallback(() => {
        setCurrentAnkiCardIndex(0);
        setIsCardFlipped(false);
    }, []);

    const selectTrail = async (trail) => {
        setSessionError('');
        if (user?.uid && trail.id.startsWith('level-')) {
            const cachedData = await fetchStudyLevelProgress(user.uid, trail.id);
            if (cachedData) {
                setCurrentTrail({ ...trail, ...cachedData });
            } else {
                setCurrentTrail(trail);
            }
        } else {
            setCurrentTrail(trail);
        }
        setAppState('trail_options');
    };

    const generateContent = async (trail, type, forceRefresh = false) => {
        const isUnlimitedUser = isRoot || userData?.isUnlimited === true;
        const maxRefreshesAllowed = isUnlimitedUser ? Infinity : (userData?.customMaxDailyRefreshes ?? MAX_DAILY_REFRESHES);

        if (forceRefresh) {
            const limitReached = (userData?.dailyRefreshes || 0) >= maxRefreshesAllowed;
            if (limitReached && !isUnlimitedUser) {
                setSessionError(`Você atingiu o limite de ${maxRefreshesAllowed} atualizações por dia.`);
                return;
            }
            await updateUserData({ dailyRefreshes: (userData?.dailyRefreshes || 0) + 1 });
        }

        setAppState('loading');
        setSessionError('');

        const cacheKey = type === 'study' ? 'cachedStudy' : type === 'quiz' ? 'cachedQuiz' : 'cachedAnki';

        // Usa cache se disponível e não for refresh forçado
        if (trail[cacheKey] && !forceRefresh) {
            if (type === 'study') setStudyContent(trail[cacheKey]);
            else if (type === 'quiz') setQuizQuestions(trail[cacheKey]);
            else if (type === 'anki') setAnkiCards(trail[cacheKey]);

            resetQuizState();
            resetAnkiState();
            setAppState(type === 'study' ? 'studying_material' : type === 'quiz' ? 'quiz' : 'studying_anki');
            return;
        }

        try {
            const parsedData = await fetchGeneratedStudyContent(trail, type, selectedModel, isRoot);

            if (type === 'study' && parsedData.studyMaterial) {
                setStudyContent(parsedData.studyMaterial);
                if (user?.uid) await updateProgressCache(user.uid, trail.id, cacheKey, parsedData.studyMaterial);
                setAppState('studying_material');
            } else if (type === 'quiz' && parsedData.questions) {
                setQuizQuestions(parsedData.questions);
                if (user?.uid) await updateProgressCache(user.uid, trail.id, cacheKey, parsedData.questions);
                resetQuizState();
                setAppState('quiz');
            } else if (type === 'anki' && parsedData.cards) {
                // Adiciona metadados SM-2 aos novos flashcards
                const enrichedCards = parsedData.cards.map(c => ({
                    ...c,
                    repetition: 0,
                    interval: 1,
                    easeFactor: 2.5
                }));
                setAnkiCards(enrichedCards);
                if (user?.uid) await updateProgressCache(user.uid, trail.id, cacheKey, enrichedCards);
                resetAnkiState();
                setAppState('studying_anki');
            }
        } catch (error) {
            console.error("Erro ao gerar conteúdo:", error);
            setSessionError(`Não foi possível gerar o conteúdo com a IA. ${error.message}`);
            setAppState('home');
        }
    };

    const [isExpandingStudy, setIsExpandingStudy] = useState(false);

    const expandStudyMaterial = async (trail) => {
        const isUnlimitedUser = isRoot || userData?.isUnlimited === true;
        const maxRefreshesAllowed = isUnlimitedUser ? Infinity : (userData?.customMaxDailyRefreshes ?? MAX_DAILY_REFRESHES);

        const limitReached = (userData?.dailyRefreshes || 0) >= maxRefreshesAllowed;
        if (limitReached && !isUnlimitedUser) {
            setSessionError(`Você atingiu o limite de ${maxRefreshesAllowed} atualizações/expansões por dia.`);
            return;
        }

        setSessionError('');
        setIsExpandingStudy(true);

        try {
            const payloadTrail = {
                ...trail,
                content: studyContent || trail.content || ''
            };

            const parsedData = await fetchGeneratedStudyContent(payloadTrail, 'expand_study', selectedModel, isRoot);

            if (parsedData && parsedData.studyMaterial) {
                const newFullText = `${studyContent}\n\n---\n\n${parsedData.studyMaterial}`;
                setStudyContent(newFullText);
                setCurrentTrail(prev => ({ ...prev, cachedStudy: newFullText, cachedQuiz: null, cachedAnki: null }));

                if (user?.uid) {
                    await updateProgressCache(user.uid, trail.id, 'cachedStudy', newFullText);
                    await updateProgressCache(user.uid, trail.id, 'cachedQuiz', null);
                    await updateProgressCache(user.uid, trail.id, 'cachedAnki', null);
                }

                await updateUserData({ dailyRefreshes: (userData?.dailyRefreshes || 0) + 1 });
            }
        } catch (error) {
            console.error("Erro ao expandir material de estudo:", error);
            setSessionError(`Não foi possível expandir o estudo: ${error.message}`);
        } finally {
            setIsExpandingStudy(false);
        }
    };

    const handleCheckAnswer = () => {
        if (!selectedAnswer) return;
        const currentQ = quizQuestions[currentQuestionIndex];
        const correct = selectedAnswer === currentQ.correctAnswer;
        setIsAnswered(true);
        setIsCorrect(correct);
        setBotStatus(correct ? 'correct' : 'incorrect');

        if (correct) {
            const newXp = (userData?.xp || 0) + XP_PER_CORRECT_ANSWER;
            setLastQuizXp(prev => prev + XP_PER_CORRECT_ANSWER);
            updateUserData({ xp: newXp });
        } else {
            const newHearts = (userData?.hearts || 0) - 1;
            updateUserData({ hearts: newHearts });
            if (newHearts <= 0) {
                setQuizFailed(true);
            }
        }
    };

    const handleNextQuestion = () => {
        if (quizFailed) {
            setAppState('completed');
            return;
        }
        if (currentQuestionIndex < quizQuestions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setIsAnswered(false);
            setIsCorrect(null);
            setBotStatus('idle');
        } else {
            setAppState('completed');
        }
    };

    // Atualiza um flashcard Anki baseado na resposta do usuário com Spaced Repetition (SM-2)
    const rateAnkiCard = (rating) => {
        if (ankiCards.length === 0) return;
        const currentCard = ankiCards[currentAnkiCardIndex];
        const updatedCard = calculateSM2(currentCard, rating);

        const updatedCards = [...ankiCards];
        updatedCards[currentAnkiCardIndex] = updatedCard;
        setAnkiCards(updatedCards);

        // Salva progresso dos cards no cache
        if (user?.uid && currentTrail) {
            updateProgressCache(user.uid, currentTrail.id, 'cachedAnki', updatedCards).catch(console.error);
        }

        // Avança para o próximo card
        setIsCardFlipped(false);
        if (currentAnkiCardIndex < ankiCards.length - 1) {
            setCurrentAnkiCardIndex(prev => prev + 1);
        }
    };

    return {
        appState,
        setAppState,
        currentTrail,
        setCurrentTrail,
        studyContent,
        quizQuestions,
        selectedModel,
        setSelectedModel,
        sessionError,
        setSessionError,
        selectTrail,
        generateContent,
        expandStudyMaterial,
        isExpandingStudy,
        // Quiz states
        currentQuestionIndex,
        selectedAnswer,
        setSelectedAnswer,
        isAnswered,
        isCorrect,
        botStatus,
        quizFailed,
        lastQuizXp,
        handleCheckAnswer,
        handleNextQuestion,
        resetQuizState,
        // Anki states
        ankiCards,
        currentAnkiCardIndex,
        setCurrentAnkiCardIndex,
        isCardFlipped,
        setIsCardFlipped,
        rateAnkiCard,
        resetAnkiState,
        XP_PER_CORRECT_ANSWER,
        MAX_DAILY_REFRESHES,
        MAX_DAILY_TRAIL_CREATIONS
    };
}
