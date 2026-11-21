import { useState, useEffect, useCallback, useRef } from 'react';
import { 
    ENABLE_FIREBASE_AUTH, 
    subscribeToAuthChanges, 
    loginWithGoogle, 
    logoutUser, 
    loadOrCreateUserData, 
    saveUserData, 
    fetchUserCustomTrails, 
    fetchGlobalTrails,
    fetchUserData,
    fetchSchoolById,
    fetchSchoolTrails,
    createCustomTrail, 
    updateCustomTrail,
    deleteCustomTrail, 
    clearStudyCache,
    DEMO_SUBJECT
} from '../services/firebaseService';

const MAX_HEARTS = 5;

export function useAuthAndData() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [customTrails, setCustomTrails] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const demoInitRef = useRef(false);
    const [authError, setAuthError] = useState('');

    const reloadTrails = useCallback(async (currentUser, knownUserData = null) => {
        const targetUser = currentUser || user;
        if (!targetUser) return;
        try {
            const userTrails = await fetchUserCustomTrails(targetUser.uid);
            const globals = await fetchGlobalTrails();
            const isRootAdmin = targetUser.email === 'lucasft.pwa@gmail.com' || targetUser.uid === 'Wafgz4MpWUXOf7TKREcC9yZ5k073';
            const visibleGlobals = globals.filter(g => g.published !== false || isRootAdmin);

            // [MULTI-TENANT] Carrega matérias dos colégios em que o aluno está matriculado
            let schoolTrails = [];
            try {
                const uData = knownUserData || await fetchUserData(targetUser.uid);
                const enrolledIds = Array.isArray(uData?.enrolledSchoolIds) ? uData.enrolledSchoolIds : [];
                for (const schoolId of enrolledIds) {
                    const school = await fetchSchoolById(schoolId);
                    if (!school) continue;
                    const subjects = await fetchSchoolTrails(schoolId);
                    const publishedSubjects = subjects.filter(s => s.published !== false || isRootAdmin);
                    schoolTrails.push(...publishedSubjects.map(subj => ({
                        ...subj,
                        schoolName: school.name,
                        subjectTopic: subj.topic || 'Geral',
                        topic: `🏫 ${school.name}`,
                        icon: subj.icon || '🏫',
                        isSchoolTrail: true
                    })));
                }
            } catch (schoolErr) {
                console.error("Erro ao carregar colégios do aluno:", schoolErr);
            }

            setCustomTrails([...visibleGlobals, ...schoolTrails, ...userTrails]);
        } catch (err) {
            console.error("Erro ao recarregar trilhas:", err);
        }
    }, [user]);

    useEffect(() => {
        if (ENABLE_FIREBASE_AUTH) {
            const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
                try {
                    if (currentUser) {
                        setUser(currentUser);
                        const data = await loadOrCreateUserData(currentUser, MAX_HEARTS);
                        setUserData(data);
                        await reloadTrails(currentUser, data);
                    } else {
                        setUser(null);
                        setUserData(null);
                        setCustomTrails([]);
                    }
                } catch (error) {
                    console.error("Erro ao sincronizar dados com o Firebase:", error);
                    setAuthError("Não foi possível carregar os dados de usuário.");
                } finally {
                    setAuthLoading(false);
                }
            });
            return () => unsubscribe();
        } else {
            // Modo local/teste sem Firebase — executa UMA única vez (evita loop infinito:
            // setUser cria novo objeto → recria reloadTrails → re-executa este efeito)
            if (demoInitRef.current) return;
            demoInitRef.current = true;
            const today = new Date().toISOString().split('T')[0];
            setUser({ 
                displayName: "Usuário Teste", 
                photoURL: "https://placehold.co/40x40/6366f1/FFFFFF?text=T", 
                uid: "test-user-123" 
            });
            setUserData({
                xp: 150, 
                hearts: MAX_HEARTS,
                lastRefreshDate: today, 
                dailyRefreshes: 0,
                lastTrailCreationDate: today, 
                dailyTrailCreations: 0,
                enrolledSchoolIds: ['demo-school-1']
            });
            setCustomTrails([
                { id: '1', title: 'Minha Primeira Trilha', content: 'Este é um teste de AWS IAM e Buckets S3.' },
                { ...DEMO_SUBJECT, topic: '🏫 Colégio Demonstração' }
            ]);
            setAuthLoading(false);
        }
    }, [reloadTrails]);

    const updateUserData = useCallback(async (newData) => {
        setUserData(prev => {
            const updated = { ...prev, ...newData };
            if (user?.uid) {
                saveUserData(user.uid, updated).catch(err => 
                    console.error("Erro ao salvar no Firestore:", err)
                );
            }
            return updated;
        });
    }, [user]);

    const signIn = async () => {
        try {
            setAuthError('');
            await loginWithGoogle();
        } catch (error) {
            console.error("Erro ao fazer login:", error);
            setAuthError("Ocorreu um erro durante o login com Google.");
        }
    };

    const signOut = async () => {
        try {
            await logoutUser();
            setUser(null);
            setUserData(null);
        } catch (error) {
            console.error("Erro no logout:", error);
        }
    };

    const addTrail = async (title, content, topic = 'Minhas Trilhas Personalizadas', icon = '') => {
        const newTrail = { title, content, topic, icon, createdAt: new Date() };
        const savedTrail = await createCustomTrail(user?.uid, newTrail);
        setCustomTrails(prev => [...prev, savedTrail]);

        if (userData) {
            await updateUserData({ 
                dailyTrailCreations: (userData.dailyTrailCreations || 0) + 1 
            });
        }
        return savedTrail;
    };

    const editTrail = async (trailId, title, content, topic, icon = '') => {
        const updatedData = { title, content, topic, icon, cachedStudy: content, cachedQuiz: null, cachedAnki: null };
        await updateCustomTrail(user?.uid, trailId, updatedData);
        setCustomTrails(prev => prev.map(t => t.id === trailId ? { ...t, ...updatedData } : t));
    };

    const removeTrail = async (trailId) => {
        await deleteCustomTrail(user?.uid, trailId);
        setCustomTrails(prev => prev.filter(t => t.id !== trailId));
    };

    const removeTopic = async (topicTitle, trailsInTopic) => {
        if (!trailsInTopic || trailsInTopic.length === 0) return;
        const deletePromises = trailsInTopic.map(t => deleteCustomTrail(user?.uid, t.id));
        await Promise.all(deletePromises);
        const trailIdsToRemove = new Set(trailsInTopic.map(t => t.id));
        setCustomTrails(prev => prev.filter(t => !trailIdsToRemove.has(t.id)));
    };

    const clearCache = async () => {
        if (user?.uid) {
            await clearStudyCache(user.uid);
        }
    };

    return {
        user,
        userData,
        customTrails,
        setCustomTrails,
        reloadTrails: () => reloadTrails(user),
        authLoading,
        authError,
        setAuthError,
        updateUserData,
        signIn,
        signOut,
        addTrail,
        editTrail,
        removeTrail,
        removeTopic,
        clearCache,
        MAX_HEARTS
    };
}
