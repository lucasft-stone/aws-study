import React, { useState, useEffect } from 'react';
// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, updateDoc, deleteDoc } from 'firebase/firestore';
import { GoogleGenAI } from "@google/genai";

// Importações dos Componentes Refatorados
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

// --- CONFIGURAÇÕES DO GEMINI ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenAI({ apiKey });

// --- FLAG PARA TESTE ---
// Mude para 'true' para ativar o login real com Google e salvar no banco de dados.
// Mude para 'false' para pular o login e testar o app com dados locais.
const ENABLE_FIREBASE_AUTH = import.meta.env.VITE_ENABLE_FIREBASE_AUTH === 'true';

// --- FLAG PARA OCULTAR TRILHAS ---
// Mude para 'true' no .env para ocultar as trilhas existentes para usuários não-admin.
const HIDE_EXISTING_TRAILS = import.meta.env.VITE_HIDE_EXISTING_TRAILS === 'true';

// --- CONFIGURAÇÕES DE ADMIN E LIMITES ---
const ROOT_USER_UID = import.meta.env.VITE_ROOT_USER_UID;
const MAX_DAILY_REFRESHES = 10;
const MAX_DAILY_TRAIL_CREATIONS = 1;

// --- Configuração do Firebase ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializa o Firebase e os serviços APENAS se a flag estiver ativa
let app, auth, db;
if (ENABLE_FIREBASE_AUTH) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (error) {
        console.error("Erro ao inicializar o Firebase. Verifique suas credenciais em 'firebaseConfig'.", error);
    }
}

// --- Constantes e Trilha de Módulos ---
const XP_PER_CORRECT_ANSWER = 25;
const MAX_HEARTS = 5;
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
    const [appState, setAppState] = useState('loading');
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [customTrails, setCustomTrails] = useState([]);
    const [currentTrail, setCurrentTrail] = useState(null);
    const [studyContent, setStudyContent] = useState('');
    const [newTrailTitle, setNewTrailTitle] = useState('');
    const [newTrailContent, setNewTrailContent] = useState('');
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [apiError, setApiError] = useState('');
    const [lastQuizXp, setLastQuizXp] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const [botStatus, setBotStatus] = useState('idle');
    const [quizFailed, setQuizFailed] = useState(false);
    
    const [selectedModel, setSelectedModel] = useState('gemma-3-27b-it');

    // Estados para o modo Anki/Flashcard
    const [ankiCards, setAnkiCards] = useState([]);
    const [currentAnkiCardIndex, setCurrentAnkiCardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    const geminiModels = [
        { id: 'gemma-3-27b-it', name: 'Gemma 3.27B IT' },
        { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
    ];
    
    // --- Gerenciamento de Autenticação e Dados ---
    useEffect(() => {
        if (ENABLE_FIREBASE_AUTH && auth) {
            const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
                try {
                    if (currentUser) {
                        setUser(currentUser);
                        const userRef = doc(db, 'users', currentUser.uid);
                        let docSnap = await getDoc(userRef);
                        
                        let currentData;
                        if (docSnap.exists()) {
                            currentData = docSnap.data();
                        } else {
                            currentData = { xp: 0, hearts: MAX_HEARTS, createdAt: new Date() };
                            await setDoc(userRef, currentData);
                        }
                        
                        const updatedData = await checkAndResetDailyLimits(currentData, currentUser.uid);
                        setUserData(updatedData);
                        await fetchCustomTrails(currentUser.uid);
                        setAppState('home');
                    } else {
                        setUser(null);
                        setUserData(null);
                        setAppState('login');
                    }
                } catch (error) {
                    console.error("Erro ao carregar dados do usuário:", error);
                    setApiError("Não foi possível carregar seus dados. Tente recarregar a página.");
                    setAppState('login');
                }
            });
            return () => unsubscribe();
        } else {
            // Modo de teste sem login: ignora Firebase e usa dados mockados.
            const today = new Date().toISOString().split('T')[0];
            setUser({ displayName: "Usuário Teste", photoURL: "https://placehold.co/40x40/6366f1/FFFFFF?text=T", uid: "test-user-123" });
            setUserData({
                xp: 150, hearts: MAX_HEARTS,
                lastRefreshDate: today, dailyRefreshes: 0,
                lastTrailCreationDate: today, dailyTrailCreations: 0
            });
            setCustomTrails([{id: '1', title: 'Minha Primeira Trilha', content: 'Este é um teste de AWS IAM e Buckets S3.'}]);
            setAppState('home');
        }
    }, []);

    const checkAndResetDailyLimits = async (data, uid) => {
        const today = new Date().toISOString().split('T')[0];
        let needsUpdate = false;
        const updatedData = { ...data };

        if (updatedData.lastRefreshDate !== today) {
            updatedData.dailyRefreshes = 0;
            updatedData.lastRefreshDate = today;
            needsUpdate = true;
        }
        if (updatedData.lastTrailCreationDate !== today) {
            updatedData.dailyTrailCreations = 0;
            updatedData.lastTrailCreationDate = today;
            needsUpdate = true;
        }
        
        if (needsUpdate && ENABLE_FIREBASE_AUTH) {
            const userRef = doc(db, 'users', uid);
            await updateDoc(userRef, {
                dailyRefreshes: updatedData.dailyRefreshes,
                lastRefreshDate: updatedData.lastRefreshDate,
                dailyTrailCreations: updatedData.dailyTrailCreations,
                lastTrailCreationDate: updatedData.lastTrailCreationDate
            });
        }
        return updatedData;
    };

    const fetchCustomTrails = async (uid) => {
        if (!ENABLE_FIREBASE_AUTH || !db) return;
        const trailsQuery = query(collection(db, 'users', uid, 'customTrails'));
        const querySnapshot = await getDocs(trailsQuery);
        const trails = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomTrails(trails);
    };
    
    const signInWithGoogle = async () => {
        if (!ENABLE_FIREBASE_AUTH || !auth) return;
        const provider = new GoogleAuthProvider();
        try {
            setAppState('loading');
            await signInWithPopup(auth, provider);
            setApiError('');
        } catch (error) {
            console.error("Erro no login com Google:", error);
            setApiError("Ocorreu um erro durante o login.");
            setAppState('login');
        }
    };

    const signOutUser = async () => {
        if (!ENABLE_FIREBASE_AUTH || !auth) return;
        await signOut(auth);
    };

    const updateUserData = async (newData) => {
        const updatedData = { ...userData, ...newData };
        setUserData(updatedData);

        if (ENABLE_FIREBASE_AUTH && user) {
            const userRef = doc(db, 'users', user.uid);
            await setDoc(userRef, updatedData, { merge: true });
        }
    };
    
    const handleCreateTrail = async () => {
        if (!newTrailTitle || !newTrailContent) {
            setApiError("Por favor, preencha o título e o conteúdo da trilha.");
            return;
        }
        const isRoot = user?.uid === ROOT_USER_UID;
        const limitReached = userData.dailyTrailCreations >= MAX_DAILY_TRAIL_CREATIONS;
        if (limitReached && !isRoot) {
            setApiError(`Você atingiu o limite de ${MAX_DAILY_TRAIL_CREATIONS} nova trilha por dia.`);
            return;
        }
        setAppState('loading');
        setApiError('');
        const newTrail = { title: newTrailTitle, content: newTrailContent, createdAt: new Date() };
        if (ENABLE_FIREBASE_AUTH && user) {
            const userTrailsRef = collection(db, 'users', user.uid, 'customTrails');
            const docRef = await addDoc(userTrailsRef, newTrail);
            setCustomTrails(prev => [...prev, { ...newTrail, id: docRef.id }]);
        } else {
            setCustomTrails(prev => [...prev, {...newTrail, id: Date.now().toString()}]);
        }
        setNewTrailTitle('');
        setNewTrailContent('');
        const updatedLimits = { dailyTrailCreations: userData.dailyTrailCreations + 1 };
        updateUserData(updatedLimits);
        setAppState('home');
    };

    const handleDeleteTrail = async (trailId) => {
        const userConfirmed = confirm("Tem certeza que deseja apagar esta trilha?");
        if (userConfirmed) {
            if (ENABLE_FIREBASE_AUTH && user) {
                const trailRef = doc(db, 'users', user.uid, 'customTrails', trailId);
                await deleteDoc(trailRef);
            }
            setCustomTrails(prev => prev.filter(t => t.id !== trailId));
        }
    };

    const handleClearCache = async () => {
        if (!ENABLE_FIREBASE_AUTH || !user) return;
        const userConfirmed = confirm("Tem certeza que deseja apagar todo o cache de materiais de estudo? Isso não afetará seu XP ou trilhas customizadas.");
        if (userConfirmed) {
            const progressCollectionRef = collection(db, 'users', user.uid, 'studyLevelProgress');
            const querySnapshot = await getDocs(progressCollectionRef);
            const deletePromises = [];
            querySnapshot.forEach((doc) => {
                deletePromises.push(deleteDoc(doc.ref));
            });
            await Promise.all(deletePromises);
            setApiError("Cache de materiais de estudo foi limpo com sucesso!");
            setTimeout(() => setApiError(''), 3000);
        }
    };

    const callGeminiAPI = async (payload) => {
        const isRoot = user?.uid === ROOT_USER_UID;

        const attemptApiCall = async (model) => {
            try {
                let config = payload.generationConfig;
                if (model.includes('gemma')) {
                    config = { ...config };
                    delete config.responseMimeType;
                    delete config.responseSchema;
                }

                const response = await genAI.models.generateContent({
                    model: model,
                    contents: payload.contents,
                    config: config,
                });
                let jsonText = response.text;

                if (jsonText && typeof jsonText === 'string') {
                    jsonText = jsonText.replace(/```json\n?|```/g, '').trim();
                }

                if (!jsonText) {
                    throw new Error("A resposta da IA está vazia ou em formato inválido.");
                }
                return JSON.parse(jsonText);
            } catch (error) {
                console.error(`Falha na chamada da API Gemini com o modelo ${model}:`, error);
                throw error;
            }
        };

        if (isRoot) {
            try {
                console.log(`Usuário root detectado. Tentando usar o modelo selecionado: ${selectedModel}.`);
                return await attemptApiCall(selectedModel);
            } catch (error) {
                console.warn(`Falha ao usar o modelo ${selectedModel}. Retornando para o modelo padrão.`, error);
            }
        }

        try {
            return await attemptApiCall('gemini-3-flash-preview');
        } catch (error) {
            setApiError(`Não foi possível gerar o conteúdo. Detalhe: ${error.message}`);
            setAppState('home');
            return null;
        }
    };

    const updateTrailCache = async (trailId, cacheKey, content) => {
        if (ENABLE_FIREBASE_AUTH && user) {
            const isStudyLevel = trailId.startsWith('level-');
            const collectionName = isStudyLevel ? 'studyLevelProgress' : 'customTrails';
            const docId = trailId;

            const trailRef = doc(db, 'users', user.uid, collectionName, docId);
            await setDoc(trailRef, { [cacheKey]: content }, { merge: true });
        }

        const trailToUpdate = { ...currentTrail, [cacheKey]: content };
        setCurrentTrail(trailToUpdate);
        
        if (!trailId.startsWith('level-')) {
            setCustomTrails(prevTrails => prevTrails.map(t =>
                t.id === trailId ? trailToUpdate : t
            ));
        }
    };

    const generateContent = async (trail, type, forceRefresh = false) => {
        const isRoot = user?.uid === ROOT_USER_UID;
        if (forceRefresh) {
            const limitReached = userData.dailyRefreshes >= MAX_DAILY_REFRESHES;
            if (limitReached && !isRoot) {
                setApiError(`Você atingiu o limite de ${MAX_DAILY_REFRESHES} atualizações por dia.`);
                return;
            }
            const updatedLimits = { dailyRefreshes: userData.dailyRefreshes + 1 };
            updateUserData(updatedLimits);
        }
        
        setAppState('loading');
        setApiError('');
        
        const cacheKey = type === 'study' ? 'cachedStudy' : type === 'quiz' ? 'cachedQuiz' : 'cachedAnki';
        
        if (trail[cacheKey] && !forceRefresh) {
            if (type === 'study') setStudyContent(trail[cacheKey]);
            else if (type === 'quiz') setQuizQuestions(trail[cacheKey]);
            else if (type === 'anki') setAnkiCards(trail[cacheKey]);
            
            resetQuizState();
            resetAnkiState();
            setAppState(type === 'study' ? 'studying_material' : type === 'quiz' ? 'quiz' : 'studying_anki');
            return;
        }
        
        let prompt, responseSchema;

        switch(type) {
            case 'study':
                prompt = `Crie um material de estudo didático e engajador sobre o seguinte conteúdo, como se fosse para uma aula. Use analogias e exemplos práticos. IMPORTANTE: Formate todos os exemplos de código, JSON, políticas IAM ou scripts dentro de blocos de código Markdown (\`\`\`) e certifique-se de que estejam bem indentados. Retorne o conteúdo em formato JSON com uma única chave "studyMaterial" contendo o texto em markdown. Conteúdo: """${trail.content}"""`;
                responseSchema = { type: "OBJECT", properties: { studyMaterial: { type: "STRING" } }, required: ["studyMaterial"] };
                break;
            case 'quiz':
                prompt = `Com base no seguinte material, gere um quiz com 5 perguntas de múltipla escolha. Material: """${trail.content}"""`;
                responseSchema = { type: "OBJECT", properties: { questions: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctAnswer: { type: "STRING" }, explanation: { type: "STRING" } }, required: ["question", "options", "correctAnswer", "explanation"] } } }, required: ["questions"] };
                break;
            case 'anki':
                prompt = `Com base no seguinte material, gere um conjunto de 10 flashcards no estilo Anki (perguntas curtas e respostas diretas) para estudo. Material: """${trail.content}"""`;
                responseSchema = { type: "OBJECT", properties: { cards: { type: "ARRAY", items: { type: "OBJECT", properties: { front: { type: "STRING" }, back: { type: "STRING" } }, required: ["front", "back"] } } }, required: ["cards"] };
                break;
            default:
                return;
        }
        
        const payload = {
             contents: [{ role: "user", parts: [{ text: prompt }] }],
             generationConfig: { responseMimeType: "application/json", responseSchema }
        };
        
        const parsedData = await callGeminiAPI(payload);

        if (parsedData) {
            if (type === 'study' && parsedData.studyMaterial) {
                setStudyContent(parsedData.studyMaterial);
                await updateTrailCache(trail.id, cacheKey, parsedData.studyMaterial);
                setAppState('studying_material');
            } else if (type === 'quiz' && parsedData.questions) {
                setQuizQuestions(parsedData.questions);
                await updateTrailCache(trail.id, cacheKey, parsedData.questions);
                resetQuizState();
                setAppState('quiz');
            } else if (type === 'anki' && parsedData.cards) {
                setAnkiCards(parsedData.cards);
                await updateTrailCache(trail.id, cacheKey, parsedData.cards);
                resetAnkiState();
                setAppState('studying_anki');
            }
        }
    };

    const handleFinishStudyAndStartQuiz = () => {
        if (userData.hearts <= 0) {
            updateUserData({ hearts: MAX_HEARTS });
        }
        generateContent(currentTrail, 'quiz');
    };

    const handleSelectTrail = async (trail) => {
        if (ENABLE_FIREBASE_AUTH && user && trail.id.startsWith('level-')) {
            const progressRef = doc(db, 'users', user.uid, 'studyLevelProgress', trail.id);
            const docSnap = await getDoc(progressRef);
            if (docSnap.exists()) {
                setCurrentTrail({ ...trail, ...docSnap.data() });
            } else {
                setCurrentTrail(trail);
            }
        } else {
            setCurrentTrail(trail);
        }
        setAppState('trail_options');
    };

    const handleReturnHome = () => { setAppState('home'); setQuizFailed(false); setApiError(''); };
    
    const resetQuizState = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsCorrect(null);
        setBotStatus('idle');
        setLastQuizXp(0);
        setQuizFailed(false);
    };

    const resetAnkiState = () => {
        setCurrentAnkiCardIndex(0);
        setIsCardFlipped(false);
    };

    const handleCheckAnswer = () => {
        if (!selectedAnswer) return;
        const correct = selectedAnswer === quizQuestions[currentQuestionIndex].correctAnswer;
        setIsAnswered(true);
        setIsCorrect(correct);
        setBotStatus(correct ? 'correct' : 'incorrect');
        
        if (correct) {
            const newXp = userData.xp + XP_PER_CORRECT_ANSWER;
            setLastQuizXp(prev => prev + XP_PER_CORRECT_ANSWER);
            updateUserData({ xp: newXp });
        } else {
            const newHearts = userData.hearts - 1;
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
    
    const handleSelectAnswer = (option) => { if (!isAnswered) setSelectedAnswer(option); };

    // --- Renderização ---
    const renderContent = () => {
        if (!userData && ENABLE_FIREBASE_AUTH && appState !== 'login') {
             return <LoadingScreen text="Carregando dados do usuário..." />;
        }

        switch (appState) {
            case 'loading': 
                return <LoadingScreen text="Gerando conteúdo..." />;
            case 'login':
                return <Login signInWithGoogle={signInWithGoogle} apiError={apiError} />;
            case 'home':
                return (
                    <Home
                        user={user}
                        userData={userData}
                        customTrails={customTrails}
                        selectedModel={selectedModel}
                        setSelectedModel={setSelectedModel}
                        geminiModels={geminiModels}
                        studyLevels={studyLevels}
                        handleSelectTrail={handleSelectTrail}
                        handleDeleteTrail={handleDeleteTrail}
                        handleClearCache={handleClearCache}
                        signOutUser={signOutUser}
                        setAppState={setAppState}
                        apiError={apiError}
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
                        apiError={apiError}
                        newTrailTitle={newTrailTitle}
                        setNewTrailTitle={setNewTrailTitle}
                        newTrailContent={newTrailContent}
                        setNewTrailContent={setNewTrailContent}
                        handleCreateTrail={handleCreateTrail}
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
                        handleSelectAnswer={handleSelectAnswer}
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
                        lastQuizXp={lastQuizXp}
                        handleReturnHome={handleReturnHome}
                    />
                );
            default: 
                return <LoadingScreen text="Carregando..." />;
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap');
                body { font-family: 'Nunito', sans-serif; }
                .prose { max-width: none; }
                .perspective-1000 { perspective: 1000px; }
                .transform-style-3d { transform-style: preserve-3d; }
                .rotate-y-180 { transform: rotateY(180deg); }
                .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }
                @keyframes slide-in-bottom { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: translateY(0); } }
                .animate-slide-in-bottom { animation: slide-in-bottom 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
                @keyframes xp-gain { 0% { opacity: 1; transform: translateY(0) scale(0.8); } 100% { opacity: 0; transform: translateY(-60px) scale(1.2); } }
                .animate-xp-gain { animation: xp-gain 1.5s ease-out forwards; }
                
                /* Estilos aprimorados para Markdown */
                .markdown-content { line-height: 1.8; font-size: 1.15rem; color: #334155; }
                .dark .markdown-content { color: #f1f5f9; }
                
                /* Cabeçalhos */
                .markdown-content h1, .markdown-content h2, .markdown-content h3 { margin-top: 2em; margin-bottom: 1em; font-weight: 800; line-height: 1.3; }
                .markdown-content h1 { font-size: 2.2rem; color: #4f46e5; border-bottom: 3px solid #e2e8f0; padding-bottom: 0.5rem; }
                .dark .markdown-content h1 { color: #a5b4fc; border-color: #4b5563; }
                .markdown-content h2 { font-size: 1.8rem; color: #4338ca; border-left: 5px solid #6366f1; padding-left: 1rem; }
                .dark .markdown-content h2 { color: #c7d2fe; border-color: #818cf8; }
                .markdown-content h3 { font-size: 1.4rem; color: #1e293b; margin-top: 1.5em; }
                .dark .markdown-content h3 { color: #e2e8f0; }
                
                /* Texto e Listas */
                .markdown-content p { margin-bottom: 1.25em; text-align: justify; }
                .markdown-content ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1.25em; }
                .markdown-content ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1.25em; }
                .markdown-content li { margin-bottom: 0.75em; padding-left: 0.5em; }
                .markdown-content blockquote { border-left: 4px solid #6366f1; padding: 1rem; font-style: italic; color: #4b5563; margin-bottom: 1.5em; background-color: #f8fafc; border-radius: 0 0.5rem 0.5rem 0; }
                .dark .markdown-content blockquote { border-color: #818cf8; color: #cbd5e1; background-color: #111827; }
                .markdown-content strong { color: #0f172a; font-weight: 800; }
                .dark .markdown-content strong { color: #f8fafc; }
                .markdown-content a { color: #4f46e5; text-decoration: underline; text-underline-offset: 2px; }
                .dark .markdown-content a { color: #a5b4fc; }
                
                /* Tabelas */
                .markdown-content table { width: 100%; border-collapse: collapse; margin: 2em 0; font-size: 1rem; }
                .markdown-content th, .markdown-content td { border: 1px solid #cbd5e1; padding: 1rem; text-align: left; }
                .markdown-content th { background-color: #f1f5f9; font-weight: 800; color: #1e293b; }
                .markdown-content tr:nth-child(even) { background-color: #f8fafc; }
                .dark .markdown-content th, .dark .markdown-content td { border-color: #4b5563; }
                .dark .markdown-content th { background-color: #374151; color: #f1f5f9; }
                .dark .markdown-content tr:nth-child(even) { background-color: #111827; }

                /* Código */
                .markdown-content code { font-family: 'Courier New', Courier, monospace; background-color: #e2e8f0; padding: 0.2em 0.4em; border-radius: 0.25em; font-size: 0.95em; color: #be185d; font-weight: 600; }
                .dark .markdown-content code { background-color: #374151; color: #f9a8d4; }
                .markdown-content pre { background-color: #1e293b; color: #f8fafc; padding: 1.5em; border-radius: 0.75em; overflow-x: auto; margin-bottom: 2em; border: 1px solid #334155; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); tab-size: 2; }
                .dark .markdown-content pre { background-color: #020617; border-color: #1e293b; }
                .markdown-content pre code { background-color: transparent; color: inherit; padding: 0; font-size: 1em; font-weight: 400; border: none; }
                
                /* Scrollbar personalizada */
                .custom-scrollbar::-webkit-scrollbar { width: 8px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; border: 3px solid transparent; background-clip: content-box; }
                .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #94a3b8; }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
                .dark .custom-scrollbar:hover::-webkit-scrollbar-thumb { background-color: #64748b; }
            `}</style>
            <ErrorBoundary>
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-slate-700 dark:text-slate-200 animate-fade-in">
                    {renderContent()}
                </div>
            </ErrorBoundary>
        </>
    );
}
