import React, { useState, useEffect } from 'react';

// Componentes da Interface
import StudyBot from './components/StudyBot';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import Home from './components/Home';
import CreateTrail from './components/CreateTrail';
import TrailOptions from './components/TrailOptions';
import StudyMaterial from './components/StudyMaterial';
import StudyAnki from './components/StudyAnki';
import Quiz from './components/Quiz';
import Completed from './components/Completed';
import AdminPanel from './components/AdminPanel';

// Services e Custom Hooks Refatorados
import { GEMINI_MODELS } from './services/geminiService';
import { 
    ENABLE_FIREBASE_AUTH, 
    HIDE_EXISTING_TRAILS, 
    ROOT_USER_UID,
    checkIsAdmin,
    updateProgressCache,
    updateGlobalTrail
} from './services/firebaseService';
import { useAuthAndData } from './hooks/useAuthAndData';
import { useStudySession } from './hooks/useStudySession';
import { useThemeManager } from './hooks/useThemeManager';

// Trilha Oficial de Módulos AWS
const studyLevels = [
    { id: 'level-1', title: 'Fundamentos de IAM', content: 'Estudo sobre AWS IAM: Usuários, Grupos, Roles e Políticas de permissão.', xpRequired: 0, icon: '👤' },
    { id: 'level-2', title: 'Armazenamento com S3', content: 'Estudo sobre AWS S3: Buckets, Classes de Armazenamento e Políticas de Ciclo de Vida.', xpRequired: 100, icon: '🗃️' },
    { id: 'level-3', title: 'Computação com EC2', content: 'Estudo sobre AWS EC2: Instâncias, AMIs e Grupos de Segurança.', xpRequired: 250, icon: '💻' },
    { id: 'level-4', title: 'Redes com VPC', content: 'Estudo sobre AWS VPC: Subnets, Tabelas de Rota e Gateways NAT.', xpRequired: 500, icon: '🌐' },
    { id: 'level-5', title: 'Bancos de Dados com RDS', content: 'Estudo sobre AWS RDS: Instâncias de Banco de Dados, Multi-AZ e Read Replicas.', xpRequired: 750, icon: '🗄️' },
    { id: 'level-6', title: 'Serverless com Lambda', content: 'Estudo sobre AWS Lambda: Funções, Gatilhos e Integração com API Gateway.', xpRequired: 1000, icon: '⚡' },
    { id: 'level-7', title: 'Infraestrutura como Código com CloudFormation', content: 'Estudo sobre AWS CloudFormation: Stacks, Templates e Change Sets.', xpRequired: 1250, icon: '🏗️' },
    { id: 'level-8', title: 'Monitoramento com CloudWatch', content: 'Estudo sobre AWS CloudWatch: Métricas, Alarmes e Logs.', xpRequired: 1500, icon: '📊' },
];

export default function App() {
    const { themeMode, toggleTheme } = useThemeManager();

    const {
        user,
        userData,
        customTrails,
        authLoading,
        authError,
        updateUserData,
        signIn,
        signOut,
        addTrail,
        editTrail,
        removeTrail,
        removeTopic,
        clearCache,
        reloadTrails,
        MAX_HEARTS
    } = useAuthAndData();

    const handleDeleteTopic = async (topic) => {
        if (!topic || !topic.items) return;
        if (window.confirm(`Tem certeza que deseja excluir o tópico "${topic.title}" e todos os seus ${topic.items.length} subtópicos de estudo?`)) {
            await removeTopic(topic.title, topic.items);
        }
    };

    const isRoot = checkIsAdmin(user);

    const {
        appState,
        setAppState,
        currentTrail,
        studyContent,
        setStudyContent,
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
        XP_PER_CORRECT_ANSWER,
        MAX_DAILY_REFRESHES,
        MAX_DAILY_TRAIL_CREATIONS
    } = useStudySession({ user, userData, updateUserData, isRoot });

    // Formulário de Criação / Edição de Trilha
    const [newTrailTitle, setNewTrailTitle] = useState('');
    const [newTrailContent, setNewTrailContent] = useState('');
    const [newTrailTopic, setNewTrailTopic] = useState('Minhas Trilhas Personalizadas');
    const [editingTrail, setEditingTrail] = useState(null);

    const handleOpenEditTrail = (trail) => {
        setEditingTrail(trail);
        setNewTrailTitle(trail.title || '');
        setNewTrailContent(trail.content || trail.cachedStudy || '');
        setNewTrailTopic(trail.topic || 'Minhas Trilhas Personalizadas');
        setAppState('create_trail');
    };

    const handleCreateTrailSubmit = async () => {
        if (!newTrailTitle || !newTrailTitle.trim()) {
            setSessionError("Por favor, preencha o título da trilha.");
            return;
        }

        setSessionError('');
        try {
            const contentToSave = (newTrailContent && newTrailContent.trim())
                ? newTrailContent.trim()
                : 'Material de Estudo sobre ' + newTrailTitle.trim();

            if (editingTrail) {
                // Modo Edição & Regeração
                if (editingTrail.isGlobal) {
                    await updateGlobalTrail(editingTrail.id, {
                        title: newTrailTitle.trim(),
                        topic: newTrailTopic || 'Matemática',
                        content: contentToSave,
                        cachedStudy: contentToSave,
                        updatedAt: new Date()
                    });
                } else {
                    await editTrail(editingTrail.id, newTrailTitle.trim(), contentToSave, newTrailTopic || 'Minhas Trilhas Personalizadas');
                }
                setEditingTrail(null);
            } else {
                // Modo Criação
                const isUnlimitedUser = isRoot || userData?.isUnlimited === true;
                const maxTrailsAllowed = isUnlimitedUser ? Infinity : (userData?.customMaxDailyTrailCreations ?? MAX_DAILY_TRAIL_CREATIONS);

                const limitReached = (userData?.dailyTrailCreations || 0) >= maxTrailsAllowed;
                if (limitReached && !isUnlimitedUser) {
                    setSessionError(`Você atingiu o limite de ${maxTrailsAllowed} nova(s) trilha(s) por dia.`);
                    return;
                }

                await addTrail(newTrailTitle.trim(), contentToSave, newTrailTopic || 'Minhas Trilhas Personalizadas');
            }

            setNewTrailTitle('');
            setNewTrailContent('');
            setNewTrailTopic('Minhas Trilhas Personalizadas');
            if (reloadTrails) await reloadTrails();
            setAppState('home');
        } catch (err) {
            console.error("Erro ao salvar trilha:", err);
            setSessionError("Erro ao salvar trilha: " + err.message);
            alert("Erro ao salvar trilha: " + err.message);
        }
    };

    const handleDeleteTrailClick = async (trailId) => {
        if (confirm("Tem certeza que deseja apagar esta trilha?")) {
            await removeTrail(trailId);
        }
    };

    const handleClearCacheClick = async () => {
        if (confirm("Tem certeza que deseja apagar todo o cache de materiais de estudo? Isso não afetará seu XP ou trilhas customizadas.")) {
            await clearCache();
            setSessionError("Cache de materiais de estudo limpo com sucesso!");
            setTimeout(() => setSessionError(''), 3000);
        }
    };

    const handleFinishStudyAndStartQuiz = () => {
        const userMaxHearts = userData?.customMaxHearts ?? MAX_HEARTS;
        if ((userData?.hearts || 0) <= 0) {
            updateUserData({ hearts: userMaxHearts });
        }
        generateContent(currentTrail, 'quiz');
    };

    useEffect(() => {
        if (window.location.pathname === '/admin') {
            setAppState('admin');
        }
    }, [setAppState]);

    const handleReturnHome = () => {
        if (window.location.pathname === '/admin') {
            window.history.pushState({}, '', '/');
        }
        setAppState('home');
        setSessionError('');
        resetQuizState();
    };

    if (authLoading) {
        return <LoadingScreen text="Inicializando o StudyBot..." />;
    }

    if (userData?.isBlocked && appState !== 'admin') {
        return (
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center border border-red-200 dark:border-red-900/50">
                <div className="text-5xl mb-4">🔒</div>
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Conta Suspensa</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                    Sua conta de usuário foi temporariamente bloqueada pelo administrador do sistema.
                </p>
                <button
                    onClick={signOut}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl transition-colors text-sm"
                >
                    Sair da Conta
                </button>
            </div>
        );
    }

    const currentError = sessionError || authError;

    const handleUpdateStudyContent = async (newText) => {
        setStudyContent(newText);
        if (currentTrail) {
            if (currentTrail.isGlobal) {
                await updateGlobalTrail(currentTrail.id, { cachedStudy: newText, updatedAt: new Date() });
            } else {
                const isCustom = !currentTrail.id?.startsWith('level-');
                if (isCustom && editTrail) {
                    await editTrail(currentTrail.id, currentTrail.title, newText, currentTrail.topic);
                } else if (user?.uid) {
                    await updateProgressCache(user.uid, currentTrail.id, 'cachedStudy', newText, currentTrail.isGlobal);
                }
            }
            if (reloadTrails) await reloadTrails();
        }
    };

    const renderContent = () => {
        if (!userData && ENABLE_FIREBASE_AUTH && appState !== 'login' && appState !== 'admin') {
            return <LoadingScreen text="Carregando dados do usuário..." />;
        }

        switch (appState) {
            case 'admin':
                return <AdminPanel user={user} handleReturnHome={handleReturnHome} reloadTrails={reloadTrails} />;

            case 'loading':
                return <LoadingScreen text="Gerando conteúdo com IA..." />;

            case 'login':
                return <Login signInWithGoogle={signIn} apiError={currentError} />;

            case 'home':
                return (
                    <Home
                        user={user}
                        userData={userData}
                        customTrails={customTrails}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                        geminiModels={GEMINI_MODELS}
                        studyLevels={studyLevels}
                        handleSelectTrail={selectTrail}
                        handleEditTrail={handleOpenEditTrail}
                        handleDeleteTrail={handleDeleteTrailClick}
                        handleDeleteTopic={handleDeleteTopic}
                        handleClearCache={handleClearCacheClick}
                        signOutUser={signOut}
                        setAppState={setAppState}
                        apiError={currentError}
                        themeMode={themeMode}
                        toggleTheme={toggleTheme}
                        ENABLE_FIREBASE_AUTH={ENABLE_FIREBASE_AUTH}
                        HIDE_EXISTING_TRAILS={HIDE_EXISTING_TRAILS}
                        ROOT_USER_UID={ROOT_USER_UID}
                        MAX_DAILY_TRAIL_CREATIONS={MAX_DAILY_TRAIL_CREATIONS}
                    />
                );

            case 'create_trail':
                return (
                    <CreateTrail
                        handleReturnHome={() => {
                            setEditingTrail(null);
                            handleReturnHome();
                        }}
                        apiError={currentError}
                        newTrailTitle={newTrailTitle}
                        setNewTrailTitle={setNewTrailTitle}
                        newTrailContent={newTrailContent}
                        setNewTrailContent={setNewTrailContent}
                        newTrailTopic={newTrailTopic}
                        setNewTrailTopic={setNewTrailTopic}
                        isEditing={!!editingTrail}
                        handleCreateTrail={handleCreateTrailSubmit}
                    />
                );

            case 'trail_options':
                return (
                    <TrailOptions
                        currentTrail={currentTrail}
                        userData={userData}
                        generateContent={generateContent}
                        handleReturnHome={handleReturnHome}
                        handleEditTrail={handleOpenEditTrail}
                    />
                );

            case 'studying_material':
                return (
                    <StudyMaterial
                        currentTrail={currentTrail}
                        userData={userData}
                        user={user}
                        studyContent={studyContent}
                        generateContent={generateContent}
                        expandStudyMaterial={expandStudyMaterial}
                        isExpandingStudy={isExpandingStudy}
                        setAppState={setAppState}
                        handleFinishStudyAndStartQuiz={handleFinishStudyAndStartQuiz}
                        ROOT_USER_UID={ROOT_USER_UID}
                        MAX_DAILY_REFRESHES={MAX_DAILY_REFRESHES}
                        updateStudyContent={handleUpdateStudyContent}
                    />
                );

            case 'studying_anki':
                return (
                    <StudyAnki
                        ankiCards={ankiCards}
                        currentAnkiCardIndex={currentAnkiCardIndex}
                        setCurrentAnkiCardIndex={setCurrentAnkiCardIndex}
                        isCardFlipped={isCardFlipped}
                        setIsCardFlipped={setIsCardFlipped}
                        currentTrail={currentTrail}
                        setAppState={setAppState}
                        handleFinishStudyAndStartQuiz={handleFinishStudyAndStartQuiz}
                        rateAnkiCard={rateAnkiCard}
                    />
                );

            case 'quiz':
                return (
                    <Quiz
                        quizQuestions={quizQuestions}
                        currentQuestionIndex={currentQuestionIndex}
                        userData={userData}
                        user={user}
                        currentTrail={currentTrail}
                        botStatus={botStatus}
                        selectedAnswer={selectedAnswer}
                        isAnswered={isAnswered}
                        isCorrect={isCorrect}
                        handleSelectAnswer={(opt) => !isAnswered && setSelectedAnswer(opt)}
                        handleCheckAnswer={handleCheckAnswer}
                        handleNextQuestion={handleNextQuestion}
                        handleReturnHome={handleReturnHome}
                        XP_PER_CORRECT_ANSWER={XP_PER_CORRECT_ANSWER}
                        onSaveQuestions={async (newQuestions) => {
                            if (!currentTrail) return;
                            if (currentTrail.isGlobal) {
                                await updateGlobalTrail(currentTrail.id, { cachedQuiz: newQuestions });
                            } else {
                                await updateProgressCache(user?.uid, currentTrail.id, { cachedQuiz: newQuestions });
                            }
                            setQuizQuestions(newQuestions);
                            if (reloadTrails) reloadTrails();
                        }}
                    />
                );

            case 'completed':
                return (
                    <Completed
                        quizFailed={quizFailed}
                        currentTrail={currentTrail}
                        handleReturnHome={handleReturnHome}
                    />
                );

            default:
                return (
                    <div className="text-center p-8">
                        <h2 className="text-xl font-bold mb-4">Estado desconhecido</h2>
                        <button
                            onClick={handleReturnHome}
                            className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-xl"
                        >
                            Voltar para a Home
                        </button>
                    </div>
                );
        }
    };

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-slate-50 dark:bg-gray-900 text-slate-800 dark:text-slate-100 flex flex-col items-center justify-center p-4">
                {renderContent()}
            </div>
        </ErrorBoundary>
    );
}
