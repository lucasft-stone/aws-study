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
    deleteDoc 
} from 'firebase/firestore';

export const ENABLE_FIREBASE_AUTH = import.meta.env.VITE_ENABLE_FIREBASE_AUTH === 'true';
export const HIDE_EXISTING_TRAILS = import.meta.env.VITE_HIDE_EXISTING_TRAILS === 'true';
export const ROOT_USER_UID = import.meta.env.VITE_ROOT_USER_UID;

/**
 * Verifica se um usuário possui permissões de Administrador / Ilimitado (via UID ou E-mail).
 */
export const checkIsAdmin = (user) => {
    if (!user) return false;
    const rawAdmins = import.meta.env.VITE_ROOT_USER_UID || '';
    const adminList = rawAdmins.split(',').map(s => s.trim()).filter(Boolean);
    
    // Lista de usuários ilimitados (por UID ou E-mail)
    const unlimitedUsers = [
        'felps.st2020@gmail.com',
        ...adminList
    ];

    return unlimitedUsers.includes(user.uid) || (user.email && unlimitedUsers.includes(user.email));
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
 * Carrega ou inicializa o documento do usuário no Firestore.
 */
export const loadOrCreateUserData = async (uid, maxHearts) => {
    if (!ENABLE_FIREBASE_AUTH || !db) {
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

    const userRef = doc(db, 'users', uid);
    let docSnap = await getDoc(userRef);

    let data;
    if (docSnap.exists()) {
        data = docSnap.data();
    } else {
        data = { xp: 0, hearts: maxHearts, createdAt: new Date() };
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
 * Salva no Firestore o cache de conteúdo gerado (material de estudo, quiz ou anki).
 */
export const updateProgressCache = async (uid, trailId, cacheKey, content) => {
    if (!ENABLE_FIREBASE_AUTH || !db || !uid) return;
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

