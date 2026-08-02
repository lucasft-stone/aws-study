import { useState, useEffect, useCallback } from 'react';
import { 
    ENABLE_FIREBASE_AUTH, 
    subscribeToAuthChanges, 
    loginWithGoogle, 
    logoutUser, 
    loadOrCreateUserData, 
    saveUserData, 
    fetchUserCustomTrails, 
    createCustomTrail, 
    updateCustomTrail,
    deleteCustomTrail, 
    clearStudyCache 
} from '../services/firebaseService';

const MAX_HEARTS = 5;

export function useAuthAndData() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [customTrails, setCustomTrails] = useState([]);
    const [authLoading, setAuthLoading] = useState(true);
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        if (ENABLE_FIREBASE_AUTH) {
            const unsubscribe = subscribeToAuthChanges(async (currentUser) => {
                try {
                    if (currentUser) {
                        setUser(currentUser);
                        const data = await loadOrCreateUserData(currentUser, MAX_HEARTS);
                        setUserData(data);
                        const trails = await fetchUserCustomTrails(currentUser.uid);
                        setCustomTrails(trails);
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
            // Modo local/teste sem Firebase
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
                dailyTrailCreations: 0
            });
            setCustomTrails([
                { id: '1', title: 'Minha Primeira Trilha', content: 'Este é um teste de AWS IAM e Buckets S3.' }
            ]);
            setAuthLoading(false);
        }
    }, []);

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

    const addTrail = async (title, content, topic = 'Minhas Trilhas Personalizadas') => {
        const newTrail = { title, content, topic, createdAt: new Date() };
        const savedTrail = await createCustomTrail(user?.uid, newTrail);
        setCustomTrails(prev => [...prev, savedTrail]);

        if (userData) {
            await updateUserData({ 
                dailyTrailCreations: (userData.dailyTrailCreations || 0) + 1 
            });
        }
        return savedTrail;
    };

    const editTrail = async (trailId, title, content, topic) => {
        const updatedData = { title, content, topic, cachedStudy: null, cachedQuiz: null, cachedAnki: null };
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
