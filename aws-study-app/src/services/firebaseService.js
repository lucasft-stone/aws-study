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
export const checkIsAdmin = (user) => {
    if (!user) return false;
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
export const updateProgressCache = async (uid, trailId, cacheKey, content, isGlobal = false) => {
    if (!ENABLE_FIREBASE_AUTH || !db) return;

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
