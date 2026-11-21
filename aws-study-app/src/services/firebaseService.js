import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    onAuthStateChanged, 
    signOut 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    updateDoc, 
    deleteDoc,
    increment
} from 'firebase/firestore';

export const ENABLE_FIREBASE_AUTH = import.meta.env.VITE_ENABLE_FIREBASE_AUTH === 'true';

// ============================================================================
// 🎭 MODO DEMONSTRAÇÃO (VITE_ENABLE_FIREBASE_AUTH=false)
// Dataset fictício de colégio para demos, testes e capturas de tela.
// NUNCA é usado em produção (quando o Firebase Auth está ativo).
// ============================================================================
export const DEMO_SCHOOL = {
    id: 'demo-school-1',
    name: 'Colégio Demonstração',
    code: 'DEMO01',
    teacherEmails: ['professor@demo.com'],
    teacherUids: ['test-user-123'],
    studentUids: ['aluno-1', 'aluno-2', 'aluno-3']
};

export const DEMO_SUBJECT = {
    id: 'demo-subject-1',
    schoolId: 'demo-school-1',
    isSchoolTrail: true,
    schoolName: 'Colégio Demonstração',
    title: 'Fundamentos de Computação em Nuvem',
    topic: 'Tecnologia',
    subjectTopic: 'Tecnologia',
    icon: '☁️',
    published: true,
    content: 'Conceitos de IaaS, PaaS, SaaS e modelos de implantação de nuvem.',
    cachedStudy: '## ☁️ Fundamentos de Computação em Nuvem\n\nA **computação em nuvem** é a entrega de recursos de TI sob demanda pela internet, com pagamento conforme o uso.\n\n### Modelos de Serviço\n\n| Modelo | O que você gerencia | Exemplo |\n|---|---|---|\n| **IaaS** | SO, middleware, apps | EC2, VMs |\n| **PaaS** | Apenas o código | Elastic Beanstalk |\n| **SaaS** | Apenas o uso | Gmail, Salesforce |\n\n> 💡 **Dica de prova:** IaaS = você gerencia MAIS; SaaS = você gerencia MENOS.\n\n### Benefícios\n\n1. **Elasticidade** — escala conforme a demanda\n2. **Custo variável** — troque CapEx por OpEx\n3. **Alcance global** — deploy em minutos\n\n```mermaid\ngraph TD\n    A[Usuário] --> B[Internet]\n    B --> C[Provedor de Nuvem]\n    C --> D[IaaS]\n    C --> E[PaaS]\n    C --> F[SaaS]\n```\n\n### Disponibilidade (SLA)\n\nUm SLA de 99,9% permite apenas $\n0.001 \\times 30 \\times 24 = 0{,}72$ horas de indisponibilidade por mês.',
    cachedQuiz: [
        { id: 'dq1', question: 'Uma empresa quer migrar sua aplicação SEM gerenciar servidores, sistema operacional ou runtime. Qual modelo de nuvem é MAIS adequado?', options: ['IaaS (Infrastructure as a Service)', 'PaaS (Platform as a Service)', 'SaaS (Software as a Service)', 'On-premises com virtualização'], correctAnswer: 'PaaS (Platform as a Service)', explanation: 'No PaaS o desenvolvedor foca apenas no código; o provedor gerencia SO, runtime e servidores. IaaS exigiria gerenciar o SO, e SaaS é software pronto (não plataforma para deploy).' },
        { id: 'dq2', question: 'Qual benefício da nuvem permite aumentar ou reduzir recursos automaticamente conforme a demanda?', options: ['Elasticidade', 'Agilidade', 'Segurança', 'Economia de escala'], correctAnswer: 'Elasticidade', explanation: 'Elasticidade é a capacidade de escalar recursos dinamicamente. Agilidade refere-se à velocidade de provisionamento; economia de escala refere-se ao custo.' },
        { id: 'dq3', question: 'Gmail e Google Drive são exemplos clássicos de qual modelo de serviço?', options: ['IaaS', 'PaaS', 'SaaS', 'DaaS'], correctAnswer: 'SaaS', explanation: 'SaaS entrega software completo pela internet — o usuário apenas consome, sem gerenciar nada da infraestrutura.' },
        { id: 'dq4', question: 'Um SLA de 99,9% de disponibilidade permite aproximadamente quanto tempo de indisponibilidade por mês?', options: ['~43 minutos', '~8,7 horas', '~0,72 horas (43 min)', '~1 dia'], correctAnswer: '~0,72 horas (43 min)', explanation: '0,1% de 30 dias × 24h = 0,72h ≈ 43 minutos/mês. SLA de 99,99% permite apenas ~4,3 minutos.' },
        { id: 'dq5', question: 'Trocar grandes investimentos iniciais em hardware (CapEx) por gastos variáveis conforme o uso (OpEx) é conhecido como:', options: ['Despesa de capital', 'Custo variável / OpEx', 'Depreciação', 'Provisionamento fixo'], correctAnswer: 'Custo variável / OpEx', explanation: 'A nuvem transforma CapEx (compra de datacenters) em OpEx (pague pelo que usar), reduzindo riscos e desperdício.' }
    ],
    cachedAnki: [
        { id: 'da1', front: 'O que é IaaS?', back: 'Infrastructure as a Service: o provedor entrega infraestrutura (servidores, rede, storage); você gerencia SO, middleware e aplicações. Ex: Amazon EC2.', topic: 'Tecnologia', difficulty: 'medium', repetition: 0, interval: 1, easeFactor: 2.5 },
        { id: 'da2', front: 'Qual a diferença entre PaaS e SaaS?', back: 'PaaS = plataforma para você fazer DEPLOY do seu código (ex: Elastic Beanstalk). SaaS = software PRONTO para uso (ex: Gmail).', topic: 'Tecnologia', difficulty: 'medium', repetition: 0, interval: 1, easeFactor: 2.5 },
        { id: 'da3', front: 'O que é elasticidade na nuvem?', back: 'Capacidade de escalar recursos automaticamente para cima ou para baixo conforme a demanda, pagando apenas pelo uso.', topic: 'Tecnologia', difficulty: 'easy', repetition: 0, interval: 1, easeFactor: 2.5 }
    ]
};

const DEMO_STUDENTS = [
    { uid: 'aluno-1', displayName: 'Ana Beatriz Silva', email: 'ana.silva@demo.com', xp: 340, hearts: 5 },
    { uid: 'aluno-2', displayName: 'Carlos Eduardo Santos', email: 'carlos.santos@demo.com', xp: 210, hearts: 4 },
    { uid: 'aluno-3', displayName: 'Mariana Oliveira', email: 'mariana.oliveira@demo.com', xp: 125, hearts: 5 }
];

const DEMO_PERFORMANCE = [
    { id: 'aluno-1_demo-subject-1', studentUid: 'aluno-1', studentName: 'Ana Beatriz Silva', studentEmail: 'ana.silva@demo.com', subjectId: 'demo-subject-1', subjectTitle: 'Fundamentos de Computação em Nuvem', totalAnswers: 10, correctAnswers: 9, wrongAnswers: 1 },
    { id: 'aluno-2_demo-subject-1', studentUid: 'aluno-2', studentName: 'Carlos Eduardo Santos', studentEmail: 'carlos.santos@demo.com', subjectId: 'demo-subject-1', subjectTitle: 'Fundamentos de Computação em Nuvem', totalAnswers: 10, correctAnswers: 5, wrongAnswers: 5 },
    { id: 'aluno-3_demo-subject-1', studentUid: 'aluno-3', studentName: 'Mariana Oliveira', studentEmail: 'mariana.oliveira@demo.com', subjectId: 'demo-subject-1', subjectTitle: 'Fundamentos de Computação em Nuvem', totalAnswers: 8, correctAnswers: 2, wrongAnswers: 6 }
];

const DEMO_SCORES = [
    { id: 'aluno-1', studentUid: 'aluno-1', studentName: 'Ana Beatriz Silva', studentEmail: 'ana.silva@demo.com', schoolXp: 225 },
    { id: 'aluno-2', studentUid: 'aluno-2', studentName: 'Carlos Eduardo Santos', studentEmail: 'carlos.santos@demo.com', schoolXp: 125 },
    { id: 'aluno-3', studentUid: 'aluno-3', studentName: 'Mariana Oliveira', studentEmail: 'mariana.oliveira@demo.com', schoolXp: 50 }
];
export const HIDE_EXISTING_TRAILS = import.meta.env.VITE_HIDE_EXISTING_TRAILS === 'true';
export const ROOT_USER_UID = import.meta.env.VITE_ROOT_USER_UID;

export const OWNER_EMAIL = 'lucasft.pwa@gmail.com';
export const OWNER_UID = 'Wafgz4MpWUXOf7TKREcC9yZ5k073';

/**
 * Verifica se o usuário é o Administrador Principal/Dono (inalterável e protegido).
 */
export const isOwnerAdmin = (user) => {
    if (!user) return false;
    return user.uid === OWNER_UID || user.email === OWNER_EMAIL;
};

/**
 * Verifica se um usuário possui permissões de Administrador / Ilimitado (via Dono, Firestore ou lista).
 */
/**
 * Verifica se o admin ativou o "Modo Aluno" (preview sem privilégios de admin).
 */
export const isStudentPreviewMode = () => {
    try { return localStorage.getItem('previewAsStudent') === 'true'; } catch { return false; }
};

export const setStudentPreviewMode = (enabled) => {
    try {
        if (enabled) localStorage.setItem('previewAsStudent', 'true');
        else localStorage.removeItem('previewAsStudent');
    } catch { /* ignora */ }
};

export const checkIsAdmin = (user) => {
    if (!user) return false;
    // "Modo Aluno": o admin enxerga o app exatamente como um aluno comum
    if (isStudentPreviewMode()) return false;
    if (isOwnerAdmin(user)) return true;
    
    // Administrador promovido via Firestore
    if (user.isAdmin === true || user.isUnlimited === true) return true;

    const rawAdmins = import.meta.env.VITE_ROOT_USER_UID || '';
    const adminList = rawAdmins.split(',').map(s => s.trim()).filter(Boolean);
    const builtInSet = new Set(['fy9fGuWe5Kh4veCFkRbp6pN9MyK2', 'felps.st2020@gmail.com', ...adminList]);

    return builtInSet.has(user.uid) || (user.email && builtInSet.has(user.email));
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

let app = null;
let auth = null;
let db = null;

if (ENABLE_FIREBASE_AUTH) {
    try {
        app = initializeApp(firebaseConfig);
        auth = getAuth(app);
        db = getFirestore(app);
    } catch (error) {
        console.error("Erro ao inicializar o Firebase. Verifique suas credenciais em '.env'.", error);
    }
}

export { auth, db };

/**
 * Escuta mudanças no estado de autenticação do Firebase.
 */
export const subscribeToAuthChanges = (onUserChanged) => {
    if (!ENABLE_FIREBASE_AUTH || !auth) {
        return () => {};
    }
    return onAuthStateChanged(auth, onUserChanged);
};

/**
 * Inicia sessão com Google Popup.
 */
export const loginWithGoogle = async () => {
    if (!ENABLE_FIREBASE_AUTH || !auth) return null;
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return result.user;
};

/**
 * Faz logout do usuário atual.
 */
export const logoutUser = async () => {
    if (!ENABLE_FIREBASE_AUTH || !auth) return;
    await signOut(auth);
};

/**
 * Carrega ou inicializa o documento do usuário no Firestore, salvando foto, nome e email.
 */
/**
 * Busca os dados brutos do usuário no Firestore (sem criar).
 */
export const fetchUserData = async (uid) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !uid) return null;
    try {
        const docSnap = await getDoc(doc(db, 'users', uid));
        return docSnap.exists() ? docSnap.data() : null;
    } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
        return null;
    }
};

export const loadOrCreateUserData = async (currentUser, maxHearts) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !currentUser) {
        const today = new Date().toISOString().split('T')[0];
        return {
            xp: 150,
            hearts: maxHearts,
            lastRefreshDate: today,
            dailyRefreshes: 0,
            lastTrailCreationDate: today,
            dailyTrailCreations: 0
        };
    }

    const uid = currentUser.uid || currentUser;
    const userRef = doc(db, 'users', uid);
    let docSnap = await getDoc(userRef);

    const profileData = {
        displayName: currentUser.displayName || '',
        email: currentUser.email || '',
        photoURL: currentUser.photoURL || ''
    };

    let data;
    if (docSnap.exists()) {
        data = { ...docSnap.data(), ...profileData };
        // Atualiza nome, email e foto se necessário
        if (currentUser.displayName || currentUser.email) {
            await setDoc(userRef, profileData, { merge: true });
        }
    } else {
        data = { 
            xp: 0, 
            hearts: maxHearts, 
            createdAt: new Date(),
            ...profileData 
        };
        await setDoc(userRef, data);
    }

    return await checkAndResetDailyLimits(uid, data);
};

/**
 * Reseta contadores diários se o dia mudou.
 */
export const checkAndResetDailyLimits = async (uid, data) => {
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

    if (needsUpdate && ENABLE_FIREBASE_AUTH && db && uid) {
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

/**
 * Atualiza o documento de dados do usuário no Firestore com mesclagem segura.
 */
export const saveUserData = async (uid, newData) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !uid) return;
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, newData, { merge: true });
};

/**
 * Busca as trilhas customizadas criadas pelo usuário.
 */
export const fetchUserCustomTrails = async (uid) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !uid) return [];
    const trailsQuery = query(collection(db, 'users', uid, 'customTrails'));
    const querySnapshot = await getDocs(trailsQuery);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Adiciona uma nova trilha personalizada.
 */
export const createCustomTrail = async (uid, trail) => {
    if (ENABLE_FIREBASE_AUTH && db && uid) {
        const userTrailsRef = collection(db, 'users', uid, 'customTrails');
        const docRef = await addDoc(userTrailsRef, trail);
        return { ...trail, id: docRef.id };
    }
    return { ...trail, id: Date.now().toString() };
};

/**
 * Exclui uma trilha do banco de dados (se ativo) e retorna true.
 */
export const deleteCustomTrail = async (uid, trailId) => {
    if (ENABLE_FIREBASE_AUTH && db && uid) {
        const trailRef = doc(db, 'users', uid, 'customTrails', trailId);
        await deleteDoc(trailRef);
    }
    return true;
};

/**
 * Atualiza uma trilha personalizada existente no Firestore (título, conteúdo, tópico e limpa caches antigos).
 */
export const updateCustomTrail = async (uid, trailId, updatedData) => {
    if (ENABLE_FIREBASE_AUTH && db && uid && trailId) {
        const trailRef = doc(db, 'users', uid, 'customTrails', trailId);
        await setDoc(trailRef, {
            ...updatedData,
            cachedStudy: null,
            cachedQuiz: null,
            cachedAnki: null,
            updatedAt: new Date()
        }, { merge: true });
    }
};

/**
 * Salva no Firestore o cache de conteúdo gerado (material de estudo, quiz ou anki).
 */
export const updateProgressCache = async (uid, trailId, cacheKey, content, isGlobal = false, schoolId = null) => {
    if (!ENABLE_FIREBASE_AUTH || !db) return;

    // Matérias de colégio: salva o cache no documento da matéria (compartilhado com todos os alunos)
    if (schoolId) {
        const subjectRef = doc(db, 'schools', schoolId, 'subjects', trailId);
        await setDoc(subjectRef, { [cacheKey]: content, updatedAt: new Date() }, { merge: true });
        return;
    }

    if (isGlobal || (trailId && (trailId.startsWith('global-') || cacheKey.startsWith('global_')))) {
        const trailRef = doc(db, 'globalTrails', trailId);
        await setDoc(trailRef, { [cacheKey]: content, updatedAt: new Date() }, { merge: true });
        return;
    }

    if (!uid) return;
    const isStudyLevel = trailId.startsWith('level-');
    const collectionName = isStudyLevel ? 'studyLevelProgress' : 'customTrails';

    const trailRef = doc(db, 'users', uid, collectionName, trailId);
    await setDoc(trailRef, { [cacheKey]: content }, { merge: true });
};

/**
 * Busca progresso do nível guiado.
 */
export const fetchStudyLevelProgress = async (uid, levelId) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !uid) return null;
    const progressRef = doc(db, 'users', uid, 'studyLevelProgress', levelId);
    const docSnap = await getDoc(progressRef);
    return docSnap.exists() ? docSnap.data() : null;
};

/**
 * Limpa todo o cache de materiais de estudo no banco de dados.
 */
export const clearStudyCache = async (uid) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !uid) return;
    const progressCollectionRef = collection(db, 'users', uid, 'studyLevelProgress');
    const querySnapshot = await getDocs(progressCollectionRef);
    const deletePromises = [];
    querySnapshot.forEach((d) => {
        deletePromises.push(deleteDoc(d.ref));
    });
    await Promise.all(deletePromises);
};

/**
 * [ADMIN] Busca a lista de todos os usuários cadastrados no Firestore.
 */
export const fetchAllUsers = async () => {
    if (!ENABLE_FIREBASE_AUTH || !db) return [];
    try {
        const usersQuery = query(collection(db, 'users'));
        const querySnapshot = await getDocs(usersQuery);
        return querySnapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch (error) {
        console.error("Erro ao buscar lista de usuários:", error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
            throw new Error("Permissão negada pelas regras do Firestore. Atualize o arquivo 'firestore.rules' no Firebase Console para permitir que administradores leiam a coleção '/users'.");
        }
        throw error;
    }
};

/**
 * [ADMIN] Atualiza configurações, limites e status de bloqueio de um usuário alvo.
 */
export const updateAdminUserSettings = async (targetUid, settings) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !targetUid) return;
    const userRef = doc(db, 'users', targetUid);
    await setDoc(userRef, settings, { merge: true });
};

/**
 * [ADMIN] Exclui permanentemente um usuário e todos os seus dados e subcoleções do Firestore.
 */
export const deleteUserByAdmin = async (targetUid, targetUser) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !targetUid) return;

    if (targetUid === OWNER_UID || targetUser?.email === OWNER_EMAIL || targetUser?.uid === OWNER_UID) {
        throw new Error("O Administrador Dono (lucasft.pwa@gmail.com) é inalterável e não pode ser excluído!");
    }

    // 1. Exclui todas as trilhas do usuário
    const trailsSnap = await getDocs(collection(db, 'users', targetUid, 'customTrails'));
    const deleteTrails = trailsSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deleteTrails);

    // 2. Exclui todo o progresso do usuário
    const progressSnap = await getDocs(collection(db, 'users', targetUid, 'studyLevelProgress'));
    const deleteProgress = progressSnap.docs.map(d => deleteDoc(d.ref));
    await Promise.all(deleteProgress);

    // 3. Exclui o documento principal do usuário
    const userRef = doc(db, 'users', targetUid);
    await deleteDoc(userRef);
};

/**
 * [ADMIN] Exclui uma trilha específica de qualquer usuário.
 */
export const deleteUserTrailByAdmin = async (targetUid, trailId) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !targetUid || !trailId) return;
    const trailRef = doc(db, 'users', targetUid, 'customTrails', trailId);
    await deleteDoc(trailRef);
};

/**
 * [ADMIN] Busca todas as trilhas e materiais gerados para um usuário específico.
 */
export const fetchUserAllData = async (targetUid) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !targetUid) return { trails: [], progress: [] };
    
    // Busca trilhas customizadas
    const trailsQuery = query(collection(db, 'users', targetUid, 'customTrails'));
    const trailsSnap = await getDocs(trailsQuery);
    const trails = trailsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Busca progresso de materiais de estudo
    const progressQuery = query(collection(db, 'users', targetUid, 'studyLevelProgress'));
    const progressSnap = await getDocs(progressQuery);
    const progress = progressSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return { trails, progress };
};

/**
 * [GLOBAL TRAILS] Busca todas as trilhas globais/públicas criadas pelo Admin.
 */
export const fetchGlobalTrails = async () => {
    if (!ENABLE_FIREBASE_AUTH || !db) return [];
    try {
        const trailsQuery = query(collection(db, 'globalTrails'));
        const querySnapshot = await getDocs(trailsQuery);
        return querySnapshot.docs.map(d => ({ id: d.id, isGlobal: true, ...d.data() }));
    } catch (error) {
        console.error("Erro ao buscar trilhas globais:", error);
        return [];
    }
};

/**
 * [ADMIN] Cria uma nova trilha global disponível para todos os usuários.
 */
export const createGlobalTrail = async (trailData) => {
    if (ENABLE_FIREBASE_AUTH && db) {
        const globalTrailsRef = collection(db, 'globalTrails');
        const docRef = await addDoc(globalTrailsRef, {
            ...trailData,
            isGlobal: true,
            published: trailData.published ?? true,
            allowUserExpansion: trailData.allowUserExpansion ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        return { ...trailData, id: docRef.id, isGlobal: true };
    }
    return { ...trailData, id: `global-${Date.now()}`, isGlobal: true };
};

/**
 * [ADMIN] Atualiza os dados de uma trilha global (ex: publicar/despublicar, bloquear expansão, salvar conteúdo gerado).
 */
export const updateGlobalTrail = async (trailId, updatedData) => {
    if (ENABLE_FIREBASE_AUTH && db && trailId) {
        const trailRef = doc(db, 'globalTrails', trailId);
        await setDoc(trailRef, {
            ...updatedData,
            updatedAt: new Date()
        }, { merge: true });
    }
};

/**
 * [ADMIN] Exclui uma trilha global do Firestore.
 */
export const deleteGlobalTrail = async (trailId) => {
    if (ENABLE_FIREBASE_AUTH && db && trailId) {
        const trailRef = doc(db, 'globalTrails', trailId);
        await deleteDoc(trailRef);
    }
    return true;
};

/**
 * [SYSTEM ANNOUNCEMENT] Busca o aviso/banner ativo do sistema.
 */
export const fetchSystemAnnouncement = async () => {
    if (!ENABLE_FIREBASE_AUTH || !db) return null;
    try {
        const docRef = doc(db, 'systemSettings', 'announcement');
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    } catch (err) {
        console.error("Erro ao buscar aviso do sistema:", err);
        return null;
    }
};

/**
 * [ADMIN] Atualiza ou salva o aviso/banner global do sistema.
 */
export const saveSystemAnnouncement = async (announcementData) => {
    if (!ENABLE_FIREBASE_AUTH || !db) return;
    const docRef = doc(db, 'systemSettings', 'announcement');
    await setDoc(docRef, {
        ...announcementData,
        updatedAt: new Date()
    }, { merge: true });
};

/**
 * [AI SETTINGS] Busca as configurações personalizadas de IA e Prompts.
 */
export const fetchAiSettings = async () => {
    if (!ENABLE_FIREBASE_AUTH || !db) return null;
    try {
        const docRef = doc(db, 'systemSettings', 'aiConfig');
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    } catch (err) {
        console.error("Erro ao buscar configurações de IA:", err);
        return null;
    }
};

/**
 * [ADMIN] Salva ou atualiza as configurações globais de IA e Prompts.
 */
export const saveAiSettings = async (aiConfig) => {
    if (!ENABLE_FIREBASE_AUTH || !db) return;
    const docRef = doc(db, 'systemSettings', 'aiConfig');
    await setDoc(docRef, {
        ...aiConfig,
        updatedAt: new Date()
    }, { merge: true });
};

/**
 * [ADMIN AUDIT LOGS] Registra uma ação administrativa no Firestore.
 */
export const logAdminAction = async (adminUser, actionType, details = '') => {
    if (!ENABLE_FIREBASE_AUTH || !db) return;
    try {
        const logsRef = collection(db, 'adminAuditLogs');
        await addDoc(logsRef, {
            adminUid: adminUser?.uid || 'system',
            adminEmail: adminUser?.email || 'admin',
            adminName: adminUser?.displayName || 'Admin',
            actionType,
            details,
            createdAt: new Date()
        });
    } catch (err) {
        console.error("Erro ao gravar log de auditoria:", err);
    }
};

/**
 * [ADMIN AUDIT LOGS] Busca os últimos logs de auditoria do sistema.
 */
export const fetchAuditLogs = async () => {
    if (!ENABLE_FIREBASE_AUTH || !db) return [];
    try {
        const logsQuery = query(collection(db, 'adminAuditLogs'));
        const querySnapshot = await getDocs(logsQuery);
        const logs = querySnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        return logs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).slice(0, 50);
    } catch (err) {
        console.error("Erro ao buscar logs de auditoria:", err);
        return [];
    }
};

/**
 * [MULTI-TENANT / ESCOLAS] Busca todas as instituições/colégios.
 */
/**
 * [MULTI-TENANT] Busca um colégio específico pelo ID.
 */
export const fetchSchoolById = async (schoolId) => {
    if (!ENABLE_FIREBASE_AUTH) return schoolId === 'demo-school-1' ? { ...DEMO_SCHOOL } : null;
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return null;
    try {
        const docSnap = await getDoc(doc(db, 'schools', schoolId));
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (err) {
        console.error("Erro ao buscar colégio por ID:", err);
        return null;
    }
};

export const fetchSchools = async () => {
    if (!ENABLE_FIREBASE_AUTH || !db) return [];
    try {
        const querySnap = await getDocs(collection(db, 'schools'));
        return querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error("Erro ao buscar colégios:", err);
        return [];
    }
};

/**
 * [MULTI-TENANT / ESCOLAS] Cria um novo colégio/instituição.
 */
export const createSchool = async (schoolData) => {
    if (!ENABLE_FIREBASE_AUTH || !db) return { id: `school-${Date.now()}`, ...schoolData };
    const code = schoolData.code || Math.random().toString(36).substring(2, 8).toUpperCase();
    const docRef = await addDoc(collection(db, 'schools'), {
        ...schoolData,
        code,
        teacherUids: schoolData.teacherUids || [],
        studentUids: schoolData.studentUids || [],
        createdAt: new Date()
    });
    return { id: docRef.id, code, ...schoolData };
};

/**
 * [MULTI-TENANT / ESCOLAS] Atualiza dados do colégio.
 */
export const updateSchool = async (schoolId, updatedData) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return;
    const docRef = doc(db, 'schools', schoolId);
    await setDoc(docRef, { ...updatedData, updatedAt: new Date() }, { merge: true });
};

/**
 * [MULTI-TENANT / ESCOLAS] Exclui um colégio.
 */
export const deleteSchool = async (schoolId) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return;
    const docRef = doc(db, 'schools', schoolId);
    await deleteDoc(docRef);
};

/**
 * [MULTI-TENANT / TRILHAS DE MATÉRIA] Busca trilhas vinculadas a um colégio/professor.
 */
export const fetchSchoolTrails = async (schoolId) => {
    if (!ENABLE_FIREBASE_AUTH) return schoolId === 'demo-school-1' ? [{ ...DEMO_SUBJECT }] : [];
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return [];
    try {
        const querySnap = await getDocs(collection(db, 'schools', schoolId, 'subjects'));
        return querySnap.docs.map(d => ({ id: d.id, schoolId, isSchoolTrail: true, ...d.data() }));
    } catch (err) {
        console.error("Erro ao buscar matérias do colégio:", err);
        return [];
    }
};

/**
 * [MULTI-TENANT / TRILHAS DE MATÉRIA] Busca UMA matéria atualizada direto do banco.
 * Garante que o aluno sempre veja o conteúdo mais recente publicado pelo professor.
 */
export const fetchSchoolTrailById = async (schoolId, subjectId) => {
    if (!ENABLE_FIREBASE_AUTH) return subjectId === 'demo-subject-1' ? { ...DEMO_SUBJECT } : null;
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId || !subjectId) return null;
    try {
        const docSnap = await getDoc(doc(db, 'schools', schoolId, 'subjects', subjectId));
        return docSnap.exists() ? { id: docSnap.id, schoolId, isSchoolTrail: true, ...docSnap.data() } : null;
    } catch (err) {
        console.error("Erro ao buscar matéria atualizada:", err);
        return null;
    }
};

/**
 * [MULTI-TENANT / TRILHAS DE MATÉRIA] Cria uma matéria/trilha no colégio.
 */
export const createSchoolTrail = async (schoolId, trailData) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return { id: `subj-${Date.now()}`, ...trailData };
    const docRef = await addDoc(collection(db, 'schools', schoolId, 'subjects'), {
        ...trailData,
        schoolId,
        isSchoolTrail: true,
        published: trailData.published ?? true,
        createdAt: new Date()
    });
    return { id: docRef.id, schoolId, isSchoolTrail: true, ...trailData };
};

/**
 * [MULTI-TENANT / TRILHAS DE MATÉRIA] Atualiza uma matéria/trilha do colégio (ex: cache de conteúdo IA).
 */
export const updateSchoolTrail = async (schoolId, subjectId, updatedData) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId || !subjectId) return;
    const docRef = doc(db, 'schools', schoolId, 'subjects', subjectId);
    await updateDoc(docRef, { ...updatedData, updatedAt: new Date() });
};

/**
 * [MULTI-TENANT / TRILHAS DE MATÉRIA] Exclui uma matéria/trilha do colégio.
 */
export const deleteSchoolTrail = async (schoolId, subjectId) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId || !subjectId) return;
    const docRef = doc(db, 'schools', schoolId, 'subjects', subjectId);
    await deleteDoc(docRef);
};

/**
 * [MULTI-TENANT / PROFESSOR] Busca os colégios em que o usuário é professor.
 * Critérios: email em teacherEmails, uid em teacherUids, ou flag isTeacher/isAdmin no perfil.
 */
export const fetchTeacherSchools = async (user, userData = null) => {
    if (!ENABLE_FIREBASE_AUTH) return [{ ...DEMO_SCHOOL }];
    if (!ENABLE_FIREBASE_AUTH || !db || !user) return [];
    try {
        const querySnap = await getDocs(collection(db, 'schools'));
        const email = (user.email || '').toLowerCase();
        return querySnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(school => {
                const emails = Array.isArray(school.teacherEmails) ? school.teacherEmails.map(e => (e || '').toLowerCase()) : [];
                const uids = Array.isArray(school.teacherUids) ? school.teacherUids : [];
                return (email && emails.includes(email)) || uids.includes(user.uid);
            });
    } catch (err) {
        console.error("Erro ao buscar colégios do professor:", err);
        return [];
    }
};

/**
 * [MULTI-TENANT / PROFESSOR] Verifica se o usuário leciona em algum colégio.
 */
export const checkIsTeacher = async (user, userData = null) => {
    if (!user) return false;
    if (isOwnerAdmin(user)) return true;
    if (userData?.isTeacher === true) return true;
    const schools = await fetchTeacherSchools(user, userData);
    return schools.length > 0;
};

/**
 * [MULTI-TENANT / PROFESSOR] Busca os dados de perfil dos alunos matriculados em um colégio.
 */
export const fetchSchoolStudents = async (school) => {
    if (!ENABLE_FIREBASE_AUTH) return DEMO_STUDENTS.map(st => ({ ...st }));
    if (!ENABLE_FIREBASE_AUTH || !db || !school) return [];
    const uids = Array.isArray(school.studentUids) ? school.studentUids : [];
    const students = [];
    for (const uid of uids) {
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            if (snap.exists()) {
                students.push({ uid, ...snap.data() });
            } else {
                students.push({ uid, displayName: 'Aluno (sem perfil)', email: '' });
            }
        } catch (err) {
            console.error("Erro ao buscar aluno", uid, err);
        }
    }
    return students;
};

/**
 * [MULTI-TENANT / DESEMPENHO] Registra uma resposta de quiz de um aluno em uma matéria de colégio.
 * Agrega acertos/erros por aluno+matéria no doc schools/{schoolId}/performance/{uid_subjectId}.
 */
export const recordSchoolQuizAnswer = async (studentProfile, schoolId, subjectId, subjectTitle, isCorrect) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !studentProfile?.uid || !schoolId || !subjectId) return;
    try {
        const perfRef = doc(db, 'schools', schoolId, 'performance', `${studentProfile.uid}_${subjectId}`);
        await setDoc(perfRef, {
            studentUid: studentProfile.uid,
            studentName: studentProfile.displayName || 'Aluno',
            studentEmail: studentProfile.email || '',
            subjectId,
            subjectTitle: subjectTitle || 'Matéria',
            totalAnswers: increment(1),
            correctAnswers: increment(isCorrect ? 1 : 0),
            wrongAnswers: increment(isCorrect ? 0 : 1),
            lastAnswerAt: new Date()
        }, { merge: true });
    } catch (err) {
        console.error("Erro ao registrar desempenho do aluno:", err);
    }
};

/**
 * [MULTI-TENANT / PLACAR] Incrementa a pontuação do aluno dentro de um colégio específico.
 * Doc: schools/{schoolId}/scores/{uid}
 */
export const recordSchoolScore = async (studentProfile, schoolId, xpDelta) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !studentProfile?.uid || !schoolId || !xpDelta) return;
    try {
        const scoreRef = doc(db, 'schools', schoolId, 'scores', studentProfile.uid);
        await setDoc(scoreRef, {
            studentUid: studentProfile.uid,
            studentName: studentProfile.displayName || 'Aluno',
            studentEmail: studentProfile.email || '',
            schoolXp: increment(xpDelta),
            updatedAt: new Date()
        }, { merge: true });
    } catch (err) {
        console.error("Erro ao registrar pontuação no colégio:", err);
    }
};

/**
 * [MULTI-TENANT / PLACAR] Busca a pontuação de UM aluno em um colégio.
 */
export const fetchStudentSchoolScore = async (uid, schoolId) => {
    if (!ENABLE_FIREBASE_AUTH) return 75;
    if (!ENABLE_FIREBASE_AUTH || !db || !uid || !schoolId) return 0;
    try {
        const snap = await getDoc(doc(db, 'schools', schoolId, 'scores', uid));
        return snap.exists() ? (snap.data().schoolXp || 0) : 0;
    } catch (err) {
        console.error("Erro ao buscar pontuação do aluno no colégio:", err);
        return 0;
    }
};

/**
 * [MULTI-TENANT / PLACAR] Busca o placar completo de um colégio (para o professor).
 */
export const fetchSchoolScores = async (schoolId) => {
    if (!ENABLE_FIREBASE_AUTH) return DEMO_SCORES.map(sc => ({ ...sc }));
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return [];
    try {
        const querySnap = await getDocs(collection(db, 'schools', schoolId, 'scores'));
        return querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error("Erro ao buscar placar do colégio:", err);
        return [];
    }
};

/**
 * [MULTI-TENANT / DESEMPENHO] Busca todos os registros de desempenho de um colégio.
 */
export const fetchSchoolPerformance = async (schoolId) => {
    if (!ENABLE_FIREBASE_AUTH) return DEMO_PERFORMANCE.map(pf => ({ ...pf }));
    if (!ENABLE_FIREBASE_AUTH || !db || !schoolId) return [];
    try {
        const querySnap = await getDocs(collection(db, 'schools', schoolId, 'performance'));
        return querySnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
        console.error("Erro ao buscar desempenho do colégio:", err);
        return [];
    }
};

/**
 * [MULTI-TENANT / ALUNO] Matricula um aluno em um colégio pelo código de acesso.
 */
export const enrollStudentInSchoolByCode = async (studentUid, code) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !studentUid || !code) return null;
    
    const schoolsSnap = await getDocs(collection(db, 'schools'));
    const matchedSchool = schoolsSnap.docs.find(d => d.data().code === code.trim().toUpperCase());
    
    if (!matchedSchool) {
        throw new Error("Código de colégio inválido ou não encontrado.");
    }

    const schoolId = matchedSchool.id;
    const schoolData = matchedSchool.data();
    const studentUids = Array.isArray(schoolData.studentUids) ? schoolData.studentUids : [];

    if (!studentUids.includes(studentUid)) {
        await updateSchool(schoolId, { studentUids: [...studentUids, studentUid] });
    }

    // Atualiza o perfil do aluno
    const userRef = doc(db, 'users', studentUid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        const uData = userSnap.data();
        const enrolled = Array.isArray(uData.enrolledSchoolIds) ? uData.enrolledSchoolIds : [];
        if (!enrolled.includes(schoolId)) {
            await setDoc(userRef, { enrolledSchoolIds: [...enrolled, schoolId] }, { merge: true });
        }
    }

    return { id: schoolId, ...schoolData };
};
