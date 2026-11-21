import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchGeneratedStudyContent } from '../services/geminiService';
import { updateProgressCache, fetchStudyLevelProgress, ENABLE_FIREBASE_AUTH, recordSchoolQuizAnswer, recordSchoolScore, fetchSchoolTrailById } from '../services/firebaseService';

const XP_PER_CORRECT_ANSWER = 25;

/**
 * Normaliza o gabarito de uma questão para o TEXTO EXATO de uma das opções.
 * IAs podem retornar "A", "A)", "A. texto", variações de maiúsculas/espaços etc.
 */
export const resolveCorrectAnswer = (q) => {
    if (!q) return '';
    const options = Array.isArray(q.options) ? q.options : [];
    const ca = String(q.correctAnswer || '').trim();
    if (!ca) return options[0] || '';

    // Match exato
    if (options.includes(ca)) return ca;

    // Match case-insensitive / espaços
    const lowerCa = ca.toLowerCase();
    const ci = options.find(o => String(o).trim().toLowerCase() === lowerCa);
    if (ci) return ci;

    // Match por letra de alternativa: "A", "A)", "A.", "A -", "Alternativa A"
    const m = ca.match(/^(?:alternativa\s+|opção\s+|opcao\s+)?([A-Ea-e])\s*[).:\-–]?/);
    if (m && ca.length <= 15) {
        const idx = m[1].toUpperCase().charCodeAt(0) - 65;
        if (options[idx]) return options[idx];
    }

    // Match por prefixo da opção (ex: correctAnswer contém o texto parcial)
    const partial = options.find(o => lowerCa.length > 3 && (String(o).toLowerCase().startsWith(lowerCa) || lowerCa.startsWith(String(o).trim().toLowerCase())));
    if (partial) return partial;

    return ca;
};

/**
 * Normaliza um array de questões garantindo que correctAnswer seja idêntico a uma das opções.
 */
export const normalizeQuizQuestions = (questions) => {
    if (!Array.isArray(questions)) return [];
    return questions.map(q => ({ ...q, correctAnswer: resolveCorrectAnswer(q) }));
};
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

const getSavedLocalSession = () => {
    try {
        const raw = localStorage.getItem('aws_study_active_session');
        if (raw) return JSON.parse(raw);
    } catch {
        return null;
    }
    return null;
};

export function useStudySession({ user, userData, updateUserData, isRoot }) {
    const savedLocalSession = getSavedLocalSession();

    // Lê parâmetros da URL e da sessão salva síncronamente no milissegundo 0
    const urlParams = new URLSearchParams(window.location.search);
    const initialUrlState = urlParams.get('state');
    const initialUrlTrailId = urlParams.get('trail');

    const targetState = (initialUrlState && initialUrlState !== 'home' && initialUrlState !== 'login')
        ? initialUrlState
        : (savedLocalSession?.appState && savedLocalSession.appState !== 'home' && savedLocalSession.appState !== 'login')
            ? savedLocalSession.appState
            : 'home';

    const [appState, setAppState] = useState(ENABLE_FIREBASE_AUTH && !user ? 'login' : targetState);
    const [currentTrail, setCurrentTrail] = useState(() => savedLocalSession?.currentTrail || (initialUrlTrailId ? { id: initialUrlTrailId, title: 'Trilha Atual' } : null));
    const [studyContent, setStudyContent] = useState(() => savedLocalSession?.studyContent || '');
    const [quizQuestions, setQuizQuestions] = useState(() => savedLocalSession?.quizQuestions || []);
    const [ankiCards, setAnkiCards] = useState(() => savedLocalSession?.ankiCards || []);
    const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');

    useEffect(() => {
        if (ENABLE_FIREBASE_AUTH) {
            if (!user) {
                setAppState('login');
            } else {
                setAppState(prev => (prev === 'login' ? targetState : prev));
            }
        }
    }, [user, targetState]);

    // Persiste a sessão ativa sincronizada em localStorage
    useEffect(() => {
        if (appState && appState !== 'login' && appState !== 'home') {
            localStorage.setItem('aws_study_active_session', JSON.stringify({
                appState,
                currentTrail,
                studyContent,
                quizQuestions,
                ankiCards
            }));
        }
    }, [appState, currentTrail, studyContent, quizQuestions, ankiCards]);

    const sessionRestoredRef = useRef(false);

    // Restaura o estado da navegação e o conteúdo em cache a partir da URL ao recarregar a página (F5)
    useEffect(() => {
        if (sessionRestoredRef.current) return;

        const restoreSessionFromUrl = async () => {
            if (sessionRestoredRef.current) return;
            sessionRestoredRef.current = true;

            const currentUrlParams = new URLSearchParams(window.location.search);
            const savedState = currentUrlParams.get('state') || targetState;
            const savedTrailId = currentUrlParams.get('trail') || currentTrail?.id;

            if (!savedState || savedState === 'home' || savedState === 'login') return;

            // Se o conteúdo do estudo já está populado, preserva a sessão
            if (studyContent && currentTrail?.id === savedTrailId) {
                return;
            }

            if (savedTrailId && user?.uid) {
                try {
                    let loadedTrail = null;
                    if (savedTrailId.startsWith('level-')) {
                        const cachedData = await fetchStudyLevelProgress(user.uid, savedTrailId);
                        if (cachedData) {
                            loadedTrail = { id: savedTrailId, ...cachedData };
                        }
                    } else {
                        const { fetchUserCustomTrails } = await import('../services/firebaseService');
                        const customTrails = await fetchUserCustomTrails(user.uid);
                        const found = customTrails.find(t => t.id === savedTrailId);
                        if (found) {
                            loadedTrail = found;
                        }
                    }

                    if (loadedTrail) {
                        setCurrentTrail(loadedTrail);
                        if (loadedTrail.cachedStudy) setStudyContent(loadedTrail.cachedStudy);
                        if (loadedTrail.cachedQuiz) setQuizQuestions(loadedTrail.cachedQuiz);
                        if (loadedTrail.cachedAnki) setAnkiCards(loadedTrail.cachedAnki);
                    }
                } catch (err) {
                    console.warn("Erro ao restaurar cache da URL:", err);
                }
            }
        };

        restoreSessionFromUrl();
    }, [user, targetState, currentTrail?.id]);

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
        // [MULTI-TENANT] Matérias de colégio: busca a versão MAIS RECENTE do Firestore
        // para refletir imediatamente o que o professor publicou/regenerou.
        if (trail.isSchoolTrail && trail.schoolId) {
            const freshSubject = await fetchSchoolTrailById(trail.schoolId, trail.id);
            const merged = freshSubject ? { ...trail, ...freshSubject } : trail;
            setCurrentTrail(merged);
            if (merged.cachedStudy || merged.content) {
                setStudyContent(merged.cachedStudy || merged.content);
            }
            setAppState('trail_options');
            return;
        }
        if (user?.uid && trail.id.startsWith('level-')) {
            const cachedData = await fetchStudyLevelProgress(user.uid, trail.id);
            if (cachedData) {
                const fullTrail = { ...trail, ...cachedData };
                setCurrentTrail(fullTrail);
                if (cachedData.cachedStudy) {
                    setStudyContent(cachedData.cachedStudy);
                }
            } else {
                setCurrentTrail(trail);
            }
        } else {
            setCurrentTrail(trail);
            if (trail.cachedStudy || trail.content) {
                setStudyContent(trail.cachedStudy || trail.content);
            }
        }
        setAppState('trail_options');
    };

    const generateContent = async (trail, type, forceRefresh = false) => {
        // [MULTI-TENANT] Alunos NÃO podem gerar nem regerar conteúdo de matérias de colégio.
        // Eles apenas consomem o que o professor/admin publicou previamente.
        if (trail?.isSchoolTrail && !isRoot) {
            const key = type === 'study' ? 'cachedStudy' : type === 'quiz' ? 'cachedQuiz' : 'cachedAnki';
            // Para matéria de colégio, SÓ conta o que o professor publicou (cachedStudy gerado),
            // nunca o campo 'content' bruto de descrição da matéria.
            const raw = trail?.[key];
            const hasContent = Array.isArray(raw) ? raw.length > 0 : (typeof raw === 'string' ? raw.trim().length > 0 : !!raw);
            if (!hasContent || forceRefresh) {
                setSessionError('🏫 O professor ainda não gerou/publicou este conteúdo. Avise-o para liberar o material!');
                setAppState('trail_options');
                return;
            }
        }

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

        const cacheKey = type === 'study' ? 'cachedStudy' : type === 'quiz' ? 'cachedQuiz' : 'cachedAnki';

        // Reusa o material existente se disponível sem chamar a IA caso não seja refresh forçado
        let rawExisting = type === 'study' ? (trail?.cachedStudy || trail?.content || (currentTrail?.id === trail?.id ? studyContent : null)) : trail?.[cacheKey];
        // Normaliza gabaritos de quizzes vindos do cache (garante match exato com as opções)
        if (type === 'quiz' && Array.isArray(rawExisting)) rawExisting = normalizeQuizQuestions(rawExisting);
        // Arrays/strings vazias NÃO contam como conteúdo existente (evita telas de loading infinito)
        const existingContent = Array.isArray(rawExisting)
            ? (rawExisting.length > 0 ? rawExisting : null)
            : (typeof rawExisting === 'string' ? (rawExisting.trim().length > 0 ? rawExisting : null) : rawExisting);

        if (existingContent && !forceRefresh) {
            if (type === 'study') setStudyContent(existingContent);
            else if (type === 'quiz') setQuizQuestions(existingContent);
            else if (type === 'anki') setAnkiCards(existingContent);

            resetQuizState();
            resetAnkiState();
            setAppState(type === 'study' ? 'studying_material' : type === 'quiz' ? 'quiz' : 'studying_anki');
            return;
        }

        // [MULTI-TENANT] Segurança extra: se for matéria de colégio sem conteúdo válido e o usuário não é admin,
        // nunca cair na geração por IA (já tratado acima, mas reforça contra estados inconsistentes)
        if (trail?.isSchoolTrail && !isRoot) {
            setSessionError('🏫 O professor ainda não gerou/publicou este conteúdo. Avise-o para liberar o material!');
            setAppState('trail_options');
            return;
        }

        setAppState('loading');
        setSessionError('');

        try {
            const parsedData = await fetchGeneratedStudyContent(trail, type, selectedModel, isRoot);

            const schoolId = trail?.schoolId || null;
            if (type === 'study' && parsedData.studyMaterial) {
                setStudyContent(parsedData.studyMaterial);
                if (user?.uid) await updateProgressCache(user.uid, trail.id, cacheKey, parsedData.studyMaterial, false, schoolId);
                setAppState('studying_material');
            } else if (type === 'quiz' && parsedData.questions) {
                const normalizedQuestions = normalizeQuizQuestions(parsedData.questions);
                setQuizQuestions(normalizedQuestions);
                if (user?.uid) await updateProgressCache(user.uid, trail.id, cacheKey, normalizedQuestions, false, schoolId);
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
                if (user?.uid) await updateProgressCache(user.uid, trail.id, cacheKey, enrichedCards, false, schoolId);
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
                    const schoolId = trail?.schoolId || null;
                    await updateProgressCache(user.uid, trail.id, 'cachedStudy', newFullText, false, schoolId);
                    await updateProgressCache(user.uid, trail.id, 'cachedQuiz', null, false, schoolId);
                    await updateProgressCache(user.uid, trail.id, 'cachedAnki', null, false, schoolId);
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
        const correct = selectedAnswer === resolveCorrectAnswer(currentQ);
        setIsAnswered(true);
        setIsCorrect(correct);
        setBotStatus(correct ? 'correct' : 'incorrect');

        const isSchoolContext = currentTrail?.isSchoolTrail === true && !!currentTrail?.schoolId;

        if (correct) {
            const newXp = (userData?.xp || 0) + XP_PER_CORRECT_ANSWER;
            setLastQuizXp(prev => prev + XP_PER_CORRECT_ANSWER);
            updateUserData({ xp: newXp });

            // [MULTI-TENANT] Pontuação também conta para o placar específico do colégio
            if (isSchoolContext && user?.uid) {
                recordSchoolScore(
                    { uid: user.uid, displayName: user.displayName, email: user.email },
                    currentTrail.schoolId,
                    XP_PER_CORRECT_ANSWER
                ).catch(console.error);
            }
        } else if (!isSchoolContext) {
            // [MULTI-TENANT] Sistema de corações NÃO se aplica dentro de colégios/cursos
            const newHearts = (userData?.hearts || 0) - 1;
            updateUserData({ hearts: newHearts });
            if (newHearts <= 0) {
                setQuizFailed(true);
            }
        }

        // [MULTI-TENANT] Registra acerto/erro para o painel do professor (matérias de colégio).
        if (isSchoolContext && user?.uid) {
            recordSchoolQuizAnswer(
                { uid: user.uid, displayName: user.displayName, email: user.email },
                currentTrail.schoolId,
                currentTrail.id,
                currentTrail.title,
                correct
            ).catch(console.error);
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
            updateProgressCache(user.uid, currentTrail.id, 'cachedAnki', updatedCards, false, currentTrail.schoolId || null).catch(console.error);
        }

        // Avança para o próximo card
        setIsCardFlipped(false);
        if (currentAnkiCardIndex < ankiCards.length - 1) {
            setCurrentAnkiCardIndex(prev => prev + 1);
        }
    };

    const updateStudyContentAndCache = useCallback((newText) => {
        setStudyContent(newText);
        setCurrentTrail(prev => prev ? ({ ...prev, cachedStudy: newText }) : prev);
    }, []);

    return {
        appState,
        setAppState,
        currentTrail,
        setCurrentTrail,
        studyContent,
        setStudyContent: updateStudyContentAndCache,
        quizQuestions,
        setQuizQuestions,
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
