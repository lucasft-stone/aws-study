import React, { useState, useEffect } from 'react';
// Importações do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

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

// Inicializa o Firebase e os serviços
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Componentes de UI e Mascote ---
const StudyBot = ({ status = 'idle', className = '' }) => {
    const statusProps = {
        idle: { eyeY: 0, mouth: "M 40 70 Q 50 72 60 70", pupilX: 0, pupilY: 0, antennaRotate: 0 },
        loading: { eyeY: 0, mouth: "M 45 70 Q 50 65 55 70", pupilX: 0, pupilY: 0, antennaRotate: 0 },
        correct: { eyeY: -2, mouth: "M 35 65 Q 50 80 65 65", pupilX: 0, pupilY: -1, antennaRotate: 10 },
        incorrect: { eyeY: 2, mouth: "M 35 70 Q 50 60 65 70", pupilX: 0, pupilY: 1, antennaRotate: -10 },
    };
    const currentStatus = statusProps[status];
    return (
        <div className={`w-32 h-32 mx-auto mb-4 transition-transform duration-500 transform ${status === 'correct' ? 'scale-110' : ''} ${className}`}>
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <defs><linearGradient id="botBodyGradient" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stopColor="#818cf8" /><stop offset="100%" stopColor="#6366f1" /></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#000000" floodOpacity="0.15" /></filter></defs>
                <g style={{ transform: `rotate(${currentStatus.antennaRotate}deg)`, transformOrigin: '50px 25px', transition: 'transform 0.4s ease-in-out' }}><line x1="50" y1="25" x2="50" y2="10" stroke="#a78bfa" strokeWidth="2" /><circle cx="50" cy="8" r="4" fill="#c4b5fd" className={status === 'loading' ? 'animate-pulse' : ''} /></g>
                <path d="M 50,95 C 20,95 10,75 10,50 C 10,25 20,5 50,5 C 80,5 90,25 90,50 C 90,75 80,95 50,95 Z" fill="url(#botBodyGradient)" filter="url(#shadow)" />
                <g style={{ transition: 'transform 0.3s ease-in-out', transform: `translateY(${currentStatus.eyeY}px)` }}><circle cx="36" cy="48" r="10" fill="white" /><circle cx="64" cy="48" r="10" fill="white" /><circle cx={36 + currentStatus.pupilX} cy={48 + currentStatus.pupilY} r="5" fill="#4338ca" /><circle cx={64 + currentStatus.pupilX} cy={48 + currentStatus.pupilY} r="5" fill="#4338ca" />{status !== 'incorrect' && <><circle cx="39" cy="45" r="2" fill="white" fillOpacity="0.9" /><circle cx="67" cy="45" r="2" fill="white" fillOpacity="0.9" /></>}</g>
                <path d={currentStatus.mouth} stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" style={{ transition: 'd 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55)' }} />
            </svg>
        </div>
    );
};
const LoadingScreen = () => ( <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-center"><StudyBot status="loading" /><h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mt-4">Analisando...</h2><p className="text-slate-500 dark:text-slate-400">A IA está preparando seu desafio!</p></div>);
const CardButton = ({ title, description, onClick, disabled = false, icon }) => ( <button onClick={onClick} disabled={disabled} className={`relative w-full p-6 text-left bg-white dark:bg-gray-800 rounded-2xl shadow-lg transition-all duration-300 ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-1'}`}><div className="flex items-center gap-5"><div>{icon}</div><div><h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2><p className="text-slate-500 dark:text-slate-400">{description}</p></div></div>{!disabled && <div className="absolute top-4 right-4 text-slate-400">→</div>}</button>);

// --- Constantes e Trilha de Módulos Expandida ---
const XP_PER_CORRECT_ANSWER = 25;
const MAX_HEARTS = 5;
const studyLevels = [
    { id: 1, title: 'Fundamentos de IAM', topic: 'AWS IAM: Users, Groups, Roles, and Policies', xpRequired: 0, icon: '👤' },
    { id: 2, title: 'Armazenamento com S3', topic: 'AWS S3: Buckets, Storage Classes, and Lifecycle Policies', xpRequired: 100, icon: '🗃️' },
    { id: 3, title: 'Computação com EC2', topic: 'AWS EC2: Instances, AMIs, and Security Groups', xpRequired: 250, icon: '💻' },
    { id: 4, title: 'Redes com VPC', topic: 'AWS VPC: Subnets, Route Tables, and NAT Gateways', xpRequired: 500, icon: '🌐' },
    { id: 5, title: 'Bancos de Dados com RDS', topic: 'AWS RDS: Relational Databases, Read Replicas, and Multi-AZ', xpRequired: 800, icon: '💾' },
    { id: 6, title: 'Serverless com Lambda', topic: 'AWS Lambda: Functions, Triggers, and Execution Roles', xpRequired: 1200, icon: '⚡' },
    { id: 7, title: 'Segurança e Conformidade', topic: 'AWS Security: KMS, WAF, and GuardDuty', xpRequired: 1700, icon: '🛡️' },
    { id: 8, title: 'Monitoramento e Logs', topic: 'AWS Monitoring: CloudWatch Alarms, Metrics, and Logs', xpRequired: 2300, icon: '📊' },
];

// --- Componente Principal ---
export default function App() {
    const [appState, setAppState] = useState('loading'); // loading, login, home, level_selection, material_input, quiz, completed
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState({ xp: 0, hearts: MAX_HEARTS });
    
    const [studyMaterial, setStudyMaterial] = useState('');
    const [quizQuestions, setQuizQuestions] = useState([]);
    const [apiError, setApiError] = useState('');
    
    const [lastQuizXp, setLastQuizXp] = useState(0);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [isAnswered, setIsAnswered] = useState(false);
    const [isCorrect, setIsCorrect] = useState(null);
    const [score, setScore] = useState(0);
    const [botStatus, setBotStatus] = useState('idle');
    const [quizTopic, setQuizTopic] = useState('');
    const [quizFailed, setQuizFailed] = useState(false);

    // --- Gerenciamento de Autenticação e Dados do Usuário ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                const userRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(userRef);
                if (docSnap.exists()) {
                    setUserData(docSnap.data());
                } else {
                    const newUserData = { xp: 0, hearts: MAX_HEARTS, createdAt: new Date() };
                    await setDoc(userRef, newUserData);
                    setUserData(newUserData);
                }
                setAppState('home');
            } else {
                setUser(null);
                setAppState('login');
            }
        });
        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        try {
            await signInWithPopup(auth, provider);
            setApiError(''); // Limpa o erro em caso de sucesso
        } catch (error) {
            console.error("Erro no login com Google:", error);
            if (error.code === 'auth/configuration-not-found' || error.code === 'auth/unauthorized-domain') {
                setApiError("Erro de configuração. Verifique se o domínio deste aplicativo está na lista de 'Domínios autorizados' nas configurações de Autenticação do seu projeto Firebase.");
            } else {
                setApiError("Ocorreu um erro durante o login. Tente novamente.");
            }
        }
    };

    const signOutUser = async () => {
        await signOut(auth);
    };

    const updateUserData = async (newData) => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        const updatedData = { ...userData, ...newData };
        await setDoc(userRef, updatedData, { merge: true });
        setUserData(updatedData);
    };

    // --- Lógica de Geração de Quiz ---
    const generateQuiz = async (promptText) => {
        setAppState('loading');
        setApiError('');
        const payload = {
            contents: [{ role: "user", parts: [{ text: promptText }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT", properties: { questions: { type: "ARRAY", items: { type: "OBJECT", properties: { question: { type: "STRING" }, options: { type: "ARRAY", items: { type: "STRING" } }, correctAnswer: { type: "STRING" }, explanation: { type: "STRING" } }, required: ["question", "options", "correctAnswer", "explanation"] } } }, required: ["questions"]
                }
            }
        };

        try {
            const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`Erro na API: ${response.statusText}`);
            const result = await response.json();
            const jsonText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!jsonText) throw new Error("A resposta da IA está vazia ou em formato inválido.");
            const parsedData = JSON.parse(jsonText);
            if (parsedData.questions && parsedData.questions.length > 0) {
                setQuizQuestions(parsedData.questions);
                resetQuizState();
                setAppState('quiz');
            } else {
                throw new Error("Nenhuma pergunta foi gerada. O material pode ser muito curto.");
            }
        } catch (error) {
            console.error("Falha ao gerar quiz:", error);
            setApiError(`Não foi possível gerar o quiz. Detalhe: ${error.message}`);
            setAppState('home');
        }
    };
    
    const handleGenerateFromTopic = (topic) => {
        setQuizTopic(topic);
        const prompt = `Gere um quiz com 5 perguntas de múltipla escolha sobre o tópico "${topic}". As perguntas devem ser adequadas para um profissional de TI estudando para uma certificação. Para cada pergunta, forneça 4 opções, indique a resposta correta e uma breve explicação do porquê.`;
        generateQuiz(prompt);
    };

    const handleGenerateFromMaterial = () => {
        if (!studyMaterial.trim()) {
            setApiError("Por favor, insira o material de estudo.");
            return;
        }
        setQuizTopic("Seu Material de Estudo");
        const prompt = `Com base no seguinte material de estudo, gere um quiz com 5 perguntas de múltipla escolha. As perguntas devem testar os conceitos chave apresentados no texto. Para cada pergunta, forneça 4 opções, indique a resposta correta e uma breve explicação do porquê, baseando-se estritamente no conteúdo fornecido. Material: """${studyMaterial}"""`;
        generateQuiz(prompt);
    };

    const resetQuizState = () => {
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswered(false);
        setIsCorrect(null);
        setScore(0);
        setBotStatus('idle');
        setLastQuizXp(0);
        setQuizFailed(false);
    };

    // --- Lógica do Quiz com Corações ---
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
    
    const handleReturnHome = () => {
        setAppState('home');
        setQuizFailed(false);
    };

    // --- Renderização ---
    const renderContent = () => {
        switch (appState) {
            case 'loading': return <div className="text-center"><StudyBot status="loading" /><p>Carregando...</p></div>;
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
                return (
                    <div className="w-full max-w-lg text-center">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2">
                                <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full" />
                                <span className="font-bold">{user.displayName}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-xl font-bold text-red-500 flex items-center gap-1">❤️ {userData.hearts}</span>
                                <button onClick={signOutUser} className="text-sm font-bold text-slate-500">Sair</button>
                            </div>
                        </div>
                        <StudyBot status="idle" />
                        <h1 className="text-4xl font-extrabold text-slate-800 dark:text-white mb-2">StudyBot AWS</h1>
                        <p className="text-slate-500 dark:text-slate-300 mb-4">Sua pontuação total: <span className="font-bold text-indigo-500">{userData.xp} XP</span></p>
                        {apiError && <p className="text-red-500 text-sm mb-4">{apiError}</p>}
                        <div className="space-y-4">
                            <CardButton title="Trilha de Módulos" description="Siga um caminho de aprendizado e desbloqueie níveis." onClick={() => setAppState('level_selection')} icon={<span>📚</span>} />
                            <CardButton title="Estudo com Meu Material" description="Cole seu texto e crie um quiz personalizado." onClick={() => setAppState('material_input')} icon={<span>✍️</span>} />
                        </div>
                    </div>
                );
            case 'level_selection':
                return (
                    <div className="w-full max-w-2xl">
                        <h1 className="text-3xl font-bold text-center mb-6">Trilha de Módulos</h1>
                        <div className="space-y-4">
                            {studyLevels.map(level => (
                                <CardButton key={level.id} title={level.title} description={`${level.xpRequired} XP necessários`} disabled={userData.xp < level.xpRequired} onClick={() => handleGenerateFromTopic(level.topic)} icon={userData.xp < level.xpRequired ? '🔒' : '✅'} />
                            ))}
                        </div>
                        <button onClick={handleReturnHome} className="mt-6 text-indigo-500 font-bold">← Voltar</button>
                    </div>
                );
            case 'material_input':
                 return (
                    <div className="w-full max-w-2xl">
                        <h1 className="text-3xl font-bold text-center mb-6">Gerar com Meu Material</h1>
                        <textarea value={studyMaterial} onChange={(e) => setStudyMaterial(e.target.value)} placeholder="Cole aqui o conteúdo da sua aula..." className="w-full h-60 p-4 border-2 border-slate-200 dark:border-gray-700 rounded-2xl bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4" />
                        <button onClick={handleGenerateFromMaterial} className="w-full bg-indigo-600 text-white font-bold py-4 rounded-2xl shadow-lg transition-transform hover:scale-105 disabled:bg-slate-400" disabled={!studyMaterial.trim()}>Gerar Desafio</button>
                        <button onClick={handleReturnHome} className="mt-6 text-indigo-500 font-bold">← Voltar</button>
                    </div>
                );
            case 'quiz':
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
                            {quizFailed ? `Você ficou sem corações. Estude mais um pouco e tente novamente!` : `Você dominou o módulo sobre ${quizTopic}!`}
                        </p>
                        {!quizFailed && <div className="bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl p-4 mb-6"><p className="text-lg font-bold text-indigo-800 dark:text-indigo-200">XP Ganho: +{lastQuizXp}</p></div>}
                        <button onClick={handleReturnHome} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-2xl shadow-lg transition-transform hover:scale-105">Voltar ao Início</button>
                    </div>
                );
            default: return <div>Carregando...</div>;
        }
    };

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap');
                body { font-family: 'Nunito', sans-serif; }
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
