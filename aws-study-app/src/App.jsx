import React, { useState } from 'react';

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

// Services e Custom Hooks Refatorados
import { GEMINI_MODELS } from './services/geminiService';
import { 
    ENABLE_FIREBASE_AUTH, 
    HIDE_EXISTING_TRAILS, 
    ROOT_USER_UID 
} from './services/firebaseService';
import { useAuthAndData } from './hooks/useAuthAndData';
import { useStudySession } from './hooks/useStudySession';

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
        removeTrail,
        clearCache,
        MAX_HEARTS
    } = useAuthAndData();

    const isRoot = user?.uid === ROOT_USER_UID;

    const {
        appState,
        setAppState,
        currentTrail,
        studyContent,
        quizQuestions,
        selectedModel,
        setSelectedModel,
        sessionError,
        setSessionError,
        selectTrail,
        generateContent,
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

    // Formulário de Criação de Trilha
    const [newTrailTitle, setNewTrailTitle] = useState('');
    const [newTrailContent, setNewTrailContent] = useState('');

    const handleCreateTrailSubmit = async () => {
        if (!newTrailTitle || !newTrailContent) {
            setSessionError("Por favor, preencha o título e o conteúdo da trilha.");
            return;
        }

        const limitReached = (userData?.dailyTrailCreations || 0) >= MAX_DAILY_TRAIL_CREATIONS;
        if (limitReached && !isRoot) {
            setSessionError(`Você atingiu o limite de ${MAX_DAILY_TRAIL_CREATIONS} nova trilha por dia.`);
            return;
        }

        setAppState('loading');
        setSessionError('');
        try {
            await addTrail(newTrailTitle, newTrailContent);
            setNewTrailTitle('');
            setNewTrailContent('');
            setAppState('home');
        } catch (err) {
            setSessionError("Erro ao criar trilha: " + err.message);
            setAppState('create_trail');
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
        if ((userData?.hearts || 0) <= 0) {
            updateUserData({ hearts: MAX_HEARTS });
        }
        generateContent(currentTrail, 'quiz');
    };

    const handleReturnHome = () => {
        setAppState('home');
        setSessionError('');
        resetQuizState();
    };

    if (authLoading) {
        return <LoadingScreen text="Inicializando o StudyBot..." />;
    }

    const currentError = sessionError || authError;

    const renderContent = () => {
        if (!userData && ENABLE_FIREBASE_AUTH && appState !== 'login') {
            return <LoadingScreen text="Carregando dados do usuário..." />;
        }

        switch (appState) {
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
                        handleDeleteTrail={handleDeleteTrailClick}
                        handleClearCache={handleClearCacheClick}
                        signOutUser={signOut}
                        setAppState={setAppState}
                        apiError={currentError}
                        ENABLE_FIREBASE_AUTH={ENABLE_FIREBASE_AUTH}
                        HIDE_EXISTING_TRAILS={HIDE_EXISTING_TRAILS}
                        ROOT_USER_UID={ROOT_USER_UID}
                        MAX_DAILY_TRAIL_CREATIONS={MAX_DAILY_TRAIL_CREATIONS}
                    />
                );

            case 'create_trail':
                return (
                    <CreateTrail
                        handleReturnHome={handleReturnHome}
                        apiError={currentError}
                        newTrailTitle={newTrailTitle}
                        setNewTrailTitle={setNewTrailTitle}
                        newTrailContent={newTrailContent}
                        setNewTrailContent={setNewTrailContent}
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
                        setAppState={setAppState}
                        handleFinishStudyAndStartQuiz={handleFinishStudyAndStartQuiz}
                        ROOT_USER_UID={ROOT_USER_UID}
                        MAX_DAILY_REFRESHES={MAX_DAILY_REFRESHES}
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
                        botStatus={botStatus}
                        selectedAnswer={selectedAnswer}
                        isAnswered={isAnswered}
                        isCorrect={isCorrect}
                        handleSelectAnswer={(opt) => !isAnswered && setSelectedAnswer(opt)}
                        handleCheckAnswer={handleCheckAnswer}
                        handleNextQuestion={handleNextQuestion}
                        handleReturnHome={handleReturnHome}
                        XP_PER_CORRECT_ANSWER={XP_PER_CORRECT_ANSWER}
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
