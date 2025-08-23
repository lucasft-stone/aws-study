import React, { useState, useEffect } from 'react';
// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, getDocs, query, updateDoc, deleteDoc } from 'firebase/firestore';
import { marked } from 'marked';

// --- FLAG PARA TESTE ---
// Mude para 'true' para ativar o login real com Google e salvar no banco de dados.
// Mude para 'false' para pular o login e testar o app com dados locais.
const ENABLE_FIREBASE_AUTH = import.meta.env.VITE_ENABLE_FIREBASE_AUTH;

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

// --- Componentes de UI e Mascote ---
const StudyBot = ({ status = 'idle', className = '' }) => {
    const statusProps = {
        idle: { eyeY: 0, mouth: "M 43 70 C 47 73, 53 73, 57 70", pupilX: 0, pupilY: 0, earRotate: 0 },
        loading: { eyeY: 0, mouth: "M 48 70 Q 50 68 52 70", pupilX: 0, pupilY: 0, earRotate: 0 },
        correct: { eyeY: -2, mouth: "M 40 68 C 45 80, 55 80, 60 68", pupilX: 0, pupilY: -1, earRotate: -5 },
        incorrect: { eyeY: 2, mouth: "M 43 72 C 47 68, 53 68, 57 72", pupilX: 0, pupilY: 1, earRotate: 5 },
    };
    const currentStatus = statusProps[status];
    return (
        <div className={`w-32 h-32 mx-auto mb-4 transition-transform duration-500 transform ${status === 'correct' ? 'scale-110' : ''} ${className}`}>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="botBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                    <linearGradient id="innerEarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#c4b5fd" />
                        <stop offset="100%" stopColor="#a78bfa" />
                    </linearGradient>
                    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" />
                    </filter>
                </defs>
                
                <g filter="url(#shadow)">
                    <path d="M 50,95 C 25,95 15,75 15,50 C 15,25 25,10 50,10 C 75,10 85,25 85,50 C 85,75 75,95 50,95 Z" fill="url(#botBodyGradient)" />
                    <g style={{ transform: `rotate(${currentStatus.earRotate}deg)`, transformOrigin: '35px 25px', transition: 'transform 0.4s ease-in-out' }}>
                        <path d="M 20 28 C 25 -5, 45 -5, 50 28 Z" fill="url(#botBodyGradient)" />
                        <path d="M 28 28 C 31 10, 39 10, 42 28 Z" fill="url(#innerEarGradient)" />
                    </g>
                    <g style={{ transform: `rotate(${-currentStatus.earRotate}deg)`, transformOrigin: '65px 25px', transition: 'transform 0.4s ease-in-out' }}>
                        <path d="M 80 28 C 75 -5, 55 -5, 50 28 Z" fill="url(#botBodyGradient)" />
                        <path d="M 72 28 C 69 10, 61 10, 58 28 Z" fill="url(#innerEarGradient)" />
                    </g>
                </g>

                <g style={{ transition: 'transform 0.3s ease-in-out', transform: `translateY(${currentStatus.eyeY}px)` }}>
                    <circle cx="38" cy="50" r="12" fill="white" />
                    <circle cx="62" cy="50" r="12" fill="white" />
                    <circle cx={38 + currentStatus.pupilX} cy={50 + currentStatus.pupilY} r="6" fill="#4338ca" />
                    <circle cx={62 + currentStatus.pupilX} cy={50 + currentStatus.pupilY} r="6" fill="#4338ca" />
                    {status !== 'incorrect' && <>
                        <circle cx="43" cy="45" r="3.5" fill="white" fillOpacity="0.95" />
                        <circle cx="67" cy="45" r="3.5" fill="white" fillOpacity="0.95" />
                        <circle cx="36" cy="55" r="1.5" fill="white" fillOpacity="0.7" />
                        <circle cx="60" cy="55" r="1.5" fill="white" fillOpacity="0.7" />
                    </>}
                </g>
                <path d="M 51.5 60 L 50 63 L 48.5 60 Z" fill="white" />
                <path d={currentStatus.mouth} stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" style={{ transition: 'd 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)' }} />

                <g stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.7">
                    <path d="M 20 60 Q 30 62 38 60" fill="none" />
                    <path d="M 22 65 Q 32 67 40 65" fill="none" />
                    <path d="M 80 60 Q 70 62 62 60" fill="none" />
                    <path d="M 78 65 Q 68 67 60 65" fill="none" />
                </g>
            </svg>
        </div>
    );
};

const LoadingScreen = ({text}) => ( <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-center"><StudyBot status="loading" /><h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mt-4">{text || "Carregando..."}</h2></div>);
const CardButton = ({ title, description, onClick, disabled = false, icon, onDelete }) => (
    <div className="relative group">
        <button onClick={onClick} disabled={disabled} className={`w-full mb-4 p-6 text-left bg-white dark:bg-gray-800 rounded-2xl shadow-lg transition-all duration-300 ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-1'}`}>
            <div className="flex items-center gap-5">
                <div className="text-3xl">{icon}</div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
                    <p className="text-slate-500 dark:text-slate-400">{description}</p>
                </div>
            </div>
        </button>
        {onDelete && !disabled && (
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                }}
                className="absolute top-1/2 -right-4 -translate-y-1/2 text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Apagar trilha"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
            </button>
        )}
    </div>
);

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

// --- Componente Principal ---
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
    
    const [selectedModel, setSelectedModel] = useState('gemini-2.5-pro'); // Novo estado para o modelo

    // Estados para o modo Anki/Flashcard
    const [ankiCards, setAnkiCards] = useState([]);
    const [currentAnkiCardIndex, setCurrentAnkiCardIndex] = useState(0);
    const [isCardFlipped, setIsCardFlipped] = useState(false);

    const geminiModels = [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
        { id: 'gemini-live-2.5-flash-preview', name: 'Gemini 2.5 Flash Live' },
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
            setCustomTrails([{id: '1', title: 'Minha Primeira Trilha', content: 'Este é um teste.'}]);
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
        if (!ENABLE_FIREBASE_AUTH || !db) return; // Ignora se o Firebase estiver desativado
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
        if (!ENABLE_FIREBASE_AUTH || !user) return; // Ignora se o Firebase estiver desativado
        const userRef = doc(db, 'users', user.uid);
        const updatedData = { ...userData, ...newData };
        await setDoc(userRef, updatedData, { merge: true });
        setUserData(updatedData);
    };

    // --- Lógica de Geração de Conteúdo com Cache e Limites ---
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
        if (ENABLE_FIREBASE_AUTH) {
            updateUserData(updatedLimits);
        } else {
            setUserData(prev => ({...prev, ...updatedLimits}));
        }
        setAppState('home');
    };

    const handleDeleteTrail = async (trailId) => {
        if (!ENABLE_FIREBASE_AUTH || !user) return;
        const userConfirmed = confirm("Tem certeza que deseja apagar esta trilha?");
        if (userConfirmed) {
            const trailRef = doc(db, 'users', user.uid, 'customTrails', trailId);
            await deleteDoc(trailRef);
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
            setTimeout(() => setApiError(''), 3000); // Limpa a mensagem após 3 segundos
        }
    };

    const callGeminiAPI = async (payload) => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const isRoot = user?.uid === ROOT_USER_UID;
    
        const attemptApiCall = async (model) => {
            try {
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                if (!response.ok) throw new Error(`Erro na API (${model}): ${response.statusText}`);
                const result = await response.json();
                const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (!jsonText) throw new Error("A resposta da IA está vazia ou em formato inválido.");
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
                console.warn(`Falha ao usar o modelo ${selectedModel}. Retornando para o modelo padrão 'gemini-2.5-flash-lite'.`, error);
                setApiError(`Modelo ${selectedModel} falhou. Usando o padrão. Detalhe: ${error.message}`);
            }
        }

        try {
            return await attemptApiCall('gemini-2.5-flash-lite');
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
             if (ENABLE_FIREBASE_AUTH) {
                updateUserData(updatedLimits);
            } else {
                setUserData(prev => ({...prev, ...updatedLimits}));
            }
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
                prompt = `Crie um material de estudo didático e engajador sobre o seguinte conteúdo, como se fosse para uma aula. Use analogias e exemplos práticos. Retorne o conteúdo em formato JSON com uma única chave "studyMaterial" contendo o texto em markdown. Conteúdo: """${trail.content}"""`;
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
            const updatedData = { hearts: MAX_HEARTS };
            if (ENABLE_FIREBASE_AUTH) updateUserData(updatedData);
            else setUserData(prev => ({...prev, ...updatedData}));
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
            if(ENABLE_FIREBASE_AUTH) updateUserData({ xp: newXp });
            else setUserData(prev => ({...prev, xp: newXp}));
        } else {
            const newHearts = userData.hearts - 1;
            if(ENABLE_FIREBASE_AUTH) updateUserData({ hearts: newHearts });
            else setUserData(prev => ({...prev, hearts: newHearts}));
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
            case 'loading': return <LoadingScreen text="Gerando conteúdo..." />;
            case 'login':
                return (
                    <div className="w-full max-w-sm text-center">
                        <StudyBot status="idle" />
                        <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-2">Bem-vindo ao StudyBot!</h1>
                        <p className="text-slate-500 dark:text-slate-300 mb-8">Faça login para salvar seu progresso e começar a estudar.</p>
                        <button onClick={signInWithGoogle} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 transition-transform hover:scale-105">
                            <svg className="w-6 h-6" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path><path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"></path><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C42.022,35.244,44,30.036,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path></svg>
                            Entrar com Google
                        </button>
                        {apiError && <p className="text-red-500 text-sm mt-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">{apiError}</p>}
                    </div>
                );
            case 'home':
                const creationLimitReached = userData.dailyTrailCreations >= MAX_DAILY_TRAIL_CREATIONS && user?.uid !== ROOT_USER_UID;
                return (
                    <div className="w-full max-w-2xl text-center">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2"><img src={user?.photoURL} alt={user?.displayName} className="w-10 h-10 rounded-full" /><span className="font-bold">{user?.displayName}</span></div>
                            <div className="flex items-center gap-4">
                                <span className="text-xl font-bold text-red-500 flex items-center gap-1">❤️ {userData.hearts}</span>
                                {ENABLE_FIREBASE_AUTH && <button onClick={handleClearCache} className="text-sm font-bold text-slate-500 hover:text-indigo-600">Limpar Cache</button>}
                                {ENABLE_FIREBASE_AUTH && <button onClick={signOutUser} className="text-sm font-bold text-slate-500 hover:text-indigo-600">Sair</button>}
                            </div>
                        </div>
                        <StudyBot status="idle" />
                        <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-2">StudyBot AWS</h1>
                        <p className="text-slate-500 dark:text-slate-300 mb-6">Sua pontuação total: <span className="font-bold text-indigo-500">{userData.xp} XP</span></p>
                        {apiError && <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">{apiError}</p>}
                        {user?.uid === ROOT_USER_UID && (
                            <div className="my-4">
                                <label htmlFor="model-select" className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                                    Root: Select Gemini Model
                                </label>
                                <select
                                    id="model-select"
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="w-full max-w-xs mx-auto bg-white dark:bg-gray-800 border border-slate-300 dark:border-gray-600 rounded-md shadow-sm p-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                >
                                    {geminiModels.map(model => (
                                        <option key={model.id} value={model.id}>{model.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        <div className="space-y-6">
                            {(!HIDE_EXISTING_TRAILS || user?.uid === ROOT_USER_UID) &&
                                <>
                                    <div>
                                        <h2 className="text-2xl font-bold text-left mb-3">Trilhas Guiadas</h2>
                                        {studyLevels.map(level => (
                                            <CardButton key={level.id} title={level.title} description={`${level.xpRequired} XP necessários`} disabled={userData.xp < level.xpRequired} onClick={() => handleSelectTrail(level)} icon={userData.xp < level.xpRequired ? '🔒' : level.icon} />
                                        ))}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-left mb-3">Minhas Trilhas</h2>
                                        {customTrails.length > 0 ? customTrails.map(trail => (
                                            <CardButton key={trail.id} title={trail.title} description="Sua trilha personalizada" onClick={() => handleSelectTrail(trail)} icon={'📌'} onDelete={() => handleDeleteTrail(trail.id)} />
                                        )) : <p className="text-slate-500">Você ainda não criou nenhuma trilha.</p>}
                                    </div>
                                </>
                            }
                            <div>
                                <button onClick={() => setAppState('create_trail')} disabled={creationLimitReached} className="mt-4 w-full bg-indigo-100 text-indigo-700 font-bold py-3 rounded-2xl hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed">
                                    + Criar Nova Trilha de Estudo
                                </button>
                                {creationLimitReached && <p className="text-sm text-amber-600 mt-2">Você atingiu seu limite de criação de trilhas por hoje.</p>}
                            </div>
                        </div>
                    </div>
                );
            case 'create_trail':
                 return (
                    <div className="w-full max-w-2xl">
                        <button onClick={handleReturnHome} className="text-indigo-500 font-bold mb-4">← Voltar</button>
                        <h1 className="text-3xl font-bold text-center mb-6">Criar Nova Trilha</h1>
                        {apiError && <p className="text-red-500 text-sm mb-4 bg-red-100 dark:bg-red-900/30 p-3 rounded-lg">{apiError}</p>}
                        <input type="text" value={newTrailTitle} onChange={(e) => setNewTrailTitle(e.target.value)} placeholder="Título da Trilha (ex: AWS S3 - Aula 5)" className="w-full p-3 mb-4 border-2 rounded-xl" />
                        <textarea value={newTrailContent} onChange={(e) => setNewTrailContent(e.target.value)} placeholder="Cole aqui o conteúdo da sua aula..." className="w-full h-60 p-4 border-2 rounded-xl mb-4" />
                        <button onClick={handleCreateTrail} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg">Salvar Trilha</button>
                    </div>
                );
            case 'trail_options':
                return (
                    <div className="w-full max-w-lg text-center">
                         <button onClick={handleReturnHome} className="text-indigo-500 font-bold absolute top-6 left-6">← Voltar</button>
                        <StudyBot status="idle" />
                        <h1 className="text-3xl font-bold mb-2">{currentTrail.title}</h1>
                        <p className="text-slate-500 mb-6">O que você gostaria de fazer?</p>
                        <div className="space-y-4">
                            <CardButton title="Estudar Material" description="Revise o conteúdo antes do quiz." onClick={() => generateContent(currentTrail, 'study')} icon={<span>📖</span>} />
                            <CardButton title="Flashcards (Anki)" description="Memorize os pontos-chave." onClick={() => generateContent(currentTrail, 'anki')} icon={<span>🗂️</span>} />
                            <CardButton title="Ir Direto para o Quiz" description={`${userData.hearts} corações restantes.`} onClick={() => generateContent(currentTrail, 'quiz')} disabled={userData.hearts <= 0} icon={<span>🧠</span>} />
                        </div>
                        {userData.hearts <= 0 && <p className="text-red-500 mt-4">Você está sem corações! Estude o material para recarregá-los.</p>}
                    </div>
                );
            case 'studying_material':
                const refreshLimitReached = userData.dailyRefreshes >= MAX_DAILY_REFRESHES && user?.uid !== ROOT_USER_UID;
                return (
                     <div className="w-full max-w-3xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                        <div className="flex justify-between items-center mb-4">
                            <h1 className="text-3xl font-bold">{currentTrail.title}</h1>
                            <button onClick={() => generateContent(currentTrail, 'study', true)} disabled={refreshLimitReached} title={refreshLimitReached ? 'Limite de atualizações diárias atingido' : 'Gerar novo material de estudo'} className="text-slate-400 hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
                            </button>
                        </div>
                        <div className="prose dark:prose-invert max-h-[60vh] overflow-y-auto p-2" dangerouslySetInnerHTML={{ __html: marked(studyContent) }}>
                        </div>
                        <div className="mt-6 flex justify-between items-center">
                            <button onClick={() => setAppState('trail_options')} className="text-indigo-500 font-bold">← Voltar</button>
                            <button onClick={handleFinishStudyAndStartQuiz} className="bg-green-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg">
                                {userData.hearts <= 0 ? "Concluir Estudo e Restaurar Corações!" : "Concluir Estudo e Iniciar Quiz"}
                            </button>
                        </div>
                    </div>
                );
            case 'studying_anki':
                if (!ankiCards || ankiCards.length === 0) return <LoadingScreen text="Gerando flashcards..." />;
                const currentCard = ankiCards[currentAnkiCardIndex];
                return (
                    <div className="w-full max-w-2xl flex flex-col items-center">
                        <button onClick={() => setAppState('trail_options')} className="text-indigo-500 font-bold self-start mb-4">← Voltar</button>
                        <h2 className="text-2xl font-bold mb-2">{currentTrail.title}</h2>
                        <p className="text-slate-500 mb-6 font-bold">Flashcard {currentAnkiCardIndex + 1} de {ankiCards.length}</p>
                        
                        <div className="w-full h-80 perspective-1000">
                            <div className={`relative w-full h-full transition-transform duration-700 transform-style-3d ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                                <div className="absolute w-full h-full backface-hidden bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex items-center justify-center p-6 text-center">
                                    <p className="text-2xl font-semibold">{currentCard.front}</p>
                                </div>
                                <div className="absolute w-full h-full backface-hidden bg-indigo-100 dark:bg-indigo-900/80 rounded-2xl shadow-xl flex items-center justify-center p-6 text-center transform rotate-y-180">
                                    <p className="text-xl">{currentCard.back}</p>
                                </div>
                            </div>
                        </div>

                        <button onClick={() => setIsCardFlipped(!isCardFlipped)} className="mt-6 w-full max-w-sm bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg">
                            {isCardFlipped ? 'Ver Pergunta' : 'Virar Cartão'}
                        </button>

                        <div className="flex justify-between w-full max-w-sm mt-4">
                            <button onClick={() => { setCurrentAnkiCardIndex(i => i - 1); setIsCardFlipped(false); }} disabled={currentAnkiCardIndex === 0} className="font-bold text-slate-500 disabled:opacity-50">Anterior</button>
                            <button onClick={() => { setCurrentAnkiCardIndex(i => i + 1); setIsCardFlipped(false); }} disabled={currentAnkiCardIndex === ankiCards.length - 1} className="font-bold text-slate-500 disabled:opacity-50">Próximo</button>
                        </div>

                        <button onClick={handleFinishStudyAndStartQuiz} className="mt-8 bg-green-500 text-white font-bold py-3 px-6 rounded-2xl shadow-lg">
                            Iniciar Quiz
                        </button>
                    </div>
                );
            case 'quiz':
                if (!quizQuestions || quizQuestions.length === 0) return <LoadingScreen text="Gerando quiz..." />;
                const currentQuestion = quizQuestions[currentQuestionIndex];
                const progressPercentage = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
                return (
                    <div className="container mx-auto max-w-2xl p-4 flex flex-col justify-between min-h-screen">
                        <header className="pt-4 flex items-center gap-4">
                            <button onClick={handleReturnHome} className="text-2xl text-slate-500 hover:text-slate-800">✕</button>
                            <div className="flex-grow bg-slate-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden"><div className="bg-green-500 h-4 rounded-full transition-all duration-500" style={{ width: `${progressPercentage}%` }}></div></div>
                            <div className="text-xl font-bold text-red-500 flex items-center gap-1">❤️ {userData.hearts}</div>
                        </header>
                        <main className="flex-grow flex flex-col items-center justify-center animate-fade-in" key={currentQuestionIndex}>
                            <StudyBot status={botStatus} />
                            <h2 className="text-2xl font-bold text-center mb-8">{currentQuestion.question}</h2>
                            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3">{currentQuestion.options.map((option, index) => {
                                const isSelected = selectedAnswer === option;
                                let buttonClass = "border-slate-200 dark:border-gray-600 hover:bg-slate-100 dark:hover:bg-gray-700";
                                if (isAnswered) {
                                    if (option === currentQuestion.correctAnswer) buttonClass = "bg-green-100 border-green-300 text-green-800 dark:bg-green-900/50 dark:border-green-600 dark:text-white";
                                    else if (isSelected) buttonClass = "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/50 dark:border-red-600 dark:text-white";
                                    else buttonClass = "opacity-50";
                                } else if (isSelected) {
                                    buttonClass = "bg-indigo-100 border-indigo-300 dark:bg-indigo-900/50 dark:border-indigo-600";
                                }
                                return (<button key={index} onClick={() => handleSelectAnswer(option)} disabled={isAnswered} className={`p-4 border-2 rounded-2xl text-left font-bold transition-all duration-200 ${buttonClass}`}>{option}</button>);
                            })}</div>
                        </main>
                        <footer className="h-44">
                            {!isAnswered ? (
                                <div className="flex items-end h-full pb-4">
                                    <button onClick={handleCheckAnswer} disabled={!selectedAnswer} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform hover:scale-105 disabled:bg-slate-400">Verificar</button>
                                </div>
                            ) : (
                                <div className={`relative p-6 rounded-t-3xl animate-slide-in-bottom ${isCorrect ? 'bg-green-100 dark:bg-green-900/70' : 'bg-red-100 dark:bg-red-900/70'}`}>
                                    {isCorrect && <div className="absolute -top-8 left-1/2 -translate-x-1/2 text-green-500 font-extrabold text-xl animate-xp-gain">+{XP_PER_CORRECT_ANSWER} XP</div>}
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <h3 className={`font-bold text-xl ${isCorrect ? 'text-green-600 dark:text-green-300' : 'text-red-600 dark:text-red-300'}`}>{isCorrect ? 'Resposta Correta!' : 'Resposta Incorreta'}</h3>
                                            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{quizQuestions[currentQuestionIndex].explanation}</p>
                                        </div>
                                        <button onClick={handleNextQuestion} className={`font-bold py-3 px-8 rounded-2xl shadow-md transition-transform transform hover:scale-105 ${isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>Próximo</button>
                                    </div>
                                </div>
                            )}
                        </footer>
                    </div>
                );
            case 'completed':
                return (
                    <div className="w-full max-w-md text-center">
                        <StudyBot status={quizFailed ? 'incorrect' : 'correct'} />
                        <h2 className={`text-3xl font-bold mb-2 ${quizFailed ? 'text-red-500' : 'text-green-500'}`}>
                            {quizFailed ? 'Oh não!' : 'Desafio Concluído!'}
                        </h2>
                        <p className="text-xl text-slate-600 dark:text-slate-300 mb-4">
                            {quizFailed ? `Você ficou sem corações. Estude mais um pouco e tente novamente!` : `Você dominou o módulo sobre ${currentTrail.title}!`}
                        </p>
                        {!quizFailed && <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl p-4 mb-6"><p className="text-lg font-bold text-indigo-800 dark:text-indigo-200">XP Ganho: +{lastQuizXp}</p></div>}
                        <button onClick={handleReturnHome} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-transform hover:scale-105">Voltar ao Início</button>
                    </div>
                );
            default: return <LoadingScreen text="Carregando..." />;
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
            `}</style>
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-slate-700 dark:text-slate-200 animate-fade-in">
                {renderContent()}
            </div>
        </>
    );
}
