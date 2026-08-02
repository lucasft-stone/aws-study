import React, { useState, useEffect } from 'react';
import LoadingScreen from './LoadingScreen';
import { 
    fetchAllUsers, 
    updateAdminUserSettings, 
    fetchUserAllData, 
    checkIsAdmin,
    isOwnerAdmin,
    OWNER_EMAIL,
    deleteUserByAdmin,
    deleteUserTrailByAdmin,
    fetchGlobalTrails,
    createGlobalTrail,
    updateGlobalTrail,
    deleteGlobalTrail
} from '../services/firebaseService';
import { fetchGeneratedStudyContent } from '../services/geminiService';

export default function AdminPanel({ user, handleReturnHome, reloadTrails }) {
    const isAuthorized = checkIsAdmin(user);

    const [usersList, setUsersList] = useState([]);
    const [globalTrails, setGlobalTrails] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingGlobals, setLoadingGlobals] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDataModal, setUserDataModal] = useState({ trails: [], progress: [] });
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [activeTab, setActiveTab] = useState('globals'); // 'globals' | 'users'

    // Form de criação/edição de trilha global
    const [showGlobalModal, setShowGlobalModal] = useState(false);
    const [editingGlobalTrail, setEditingGlobalTrail] = useState(null);
    const [globalForm, setGlobalForm] = useState({
        title: '',
        topic: 'Matemática',
        description: '',
        allowUserExpansion: true,
        published: true
    });
    const [isGeneratingPack, setIsGeneratingPack] = useState(false);
    const [generatingTrailId, setGeneratingTrailId] = useState(null);

    // Form de edição do usuário selecionado
    const [editForm, setEditForm] = useState({
        displayName: '',
        email: '',
        isAdmin: false,
        isBlocked: false,
        isUnlimited: false,
        xp: 0,
        hearts: 5,
        customMaxHearts: 5,
        customMaxDailyRefreshes: 10,
        customMaxDailyTrailCreations: 1,
        dailyRefreshes: 0,
        dailyTrailCreations: 0
    });

    const loadUsers = async () => {
        setLoadingUsers(true);
        try {
            const users = await fetchAllUsers();
            setUsersList(users);
        } catch (err) {
            console.error("Erro ao carregar usuários no Painel Admin:", err);
            setActionMessage("Erro ao carregar lista de usuários: " + err.message);
        } finally {
            setLoadingUsers(false);
        }
    };

    const loadGlobalTrailsList = async () => {
        setLoadingGlobals(true);
        try {
            const list = await fetchGlobalTrails();
            setGlobalTrails(list);
        } catch (err) {
            console.error("Erro ao carregar trilhas globais:", err);
        } finally {
            setLoadingGlobals(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) {
            loadUsers();
            loadGlobalTrailsList();
        }
    }, [isAuthorized]);

    const handleSaveGlobalTrail = async (e) => {
        e.preventDefault();
        if (!globalForm.title) return;

        try {
            if (editingGlobalTrail) {
                await updateGlobalTrail(editingGlobalTrail.id, globalForm);
                setActionMessage(`Trilha global "${globalForm.title}" atualizada com sucesso!`);
            } else {
                await createGlobalTrail(globalForm);
                setActionMessage(`Trilha global "${globalForm.title}" criada para todos os alunos!`);
            }
            setShowGlobalModal(false);
            setEditingGlobalTrail(null);
            setGlobalForm({ title: '', topic: 'Matemática', description: '', allowUserExpansion: true, published: true });
            await loadGlobalTrailsList();
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao salvar trilha global: " + err.message);
        }
    };

    const handleToggleGlobalPublish = async (trail) => {
        const newStatus = !trail.published;
        try {
            await updateGlobalTrail(trail.id, { published: newStatus });
            setActionMessage(`Status da trilha "${trail.title}" alterado para ${newStatus ? 'PUBLICADA' : 'RASCUNHO'}!`);
            await loadGlobalTrailsList();
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao alterar publicação: " + err.message);
        }
    };

    const handleToggleGlobalExpansion = async (trail) => {
        const newStatus = !(trail.allowUserExpansion ?? true);
        try {
            await updateGlobalTrail(trail.id, { allowUserExpansion: newStatus });
            setActionMessage(`Permissão de expansão por IA para "${trail.title}" alterada para ${newStatus ? 'PERMITIDA' : 'BLOQUEADA'}!`);
            await loadGlobalTrailsList();
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao alterar permissão: " + err.message);
        }
    };

    const handleDeleteGlobalTrailItem = async (trail) => {
        if (!window.confirm(`Tem certeza que deseja excluir permanentemente a trilha global "${trail.title}"?`)) return;
        try {
            await deleteGlobalTrail(trail.id);
            setActionMessage(`Trilha global "${trail.title}" excluída com sucesso!`);
            await loadGlobalTrailsList();
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao excluir trilha global: " + err.message);
        }
    };

    const handleGenerateGlobalPack = async (trail) => {
        setIsGeneratingPack(true);
        setGeneratingTrailId(trail.id);
        setActionMessage(`⚡ Gerando pacote completo (Estudo + Exercícios + Flashcards) para "${trail.title}" via IA... Aguarde alguns instantes.`);

        try {
            const studyRes = await fetchGeneratedStudyContent(trail, 'study', 'gemini-2.5-flash', true);
            const studyText = studyRes?.studyContent || '';

            const quizRes = await fetchGeneratedStudyContent(trail, 'quiz', 'gemini-2.5-flash', true);
            const questions = quizRes?.questions || [];

            const ankiRes = await fetchGeneratedStudyContent(trail, 'anki', 'gemini-2.5-flash', true);
            const flashcards = ankiRes?.flashcards || [];

            await updateGlobalTrail(trail.id, {
                cachedStudy: studyText,
                cachedQuiz: questions,
                cachedAnki: flashcards,
                published: true,
                updatedAt: new Date()
            });

            setActionMessage(`🚀 Pacote completo gerado e publicado com sucesso para todos os alunos!`);
            await loadGlobalTrailsList();
            if (reloadTrails) reloadTrails();
        } catch (err) {
            console.error("Erro ao gerar pacote completo:", err);
            setActionMessage("Erro ao gerar pacote de conteúdo: " + err.message);
        } finally {
            setIsGeneratingPack(false);
            setGeneratingTrailId(null);
        }
    };

    if (!isAuthorized) {
        return (
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center border border-red-200 dark:border-red-900/50">
                <div className="text-5xl mb-4">⛔</div>
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-2">Acesso Negado</h2>
                <p className="text-slate-600 dark:text-slate-300 mb-6">
                    Apenas administradores autorizados têm permissão para acessar o Painel de Controle (/admin).
                </p>
                <button
                    onClick={handleReturnHome}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
                >
                    Voltar para o App
                </button>
            </div>
        );
    }

    const openUserModal = async (u) => {
        const isOwner = isOwnerAdmin(u);
        setSelectedUser(u);
        setEditForm({
            displayName: u.displayName || '',
            email: u.email || '',
            isAdmin: isOwner || u.isAdmin || false,
            isBlocked: u.isBlocked || false,
            isUnlimited: isOwner || u.isUnlimited || false,
            xp: u.xp || 0,
            hearts: u.hearts ?? 5,
            customMaxHearts: u.customMaxHearts ?? 5,
            customMaxDailyRefreshes: u.customMaxDailyRefreshes ?? 10,
            customMaxDailyTrailCreations: u.customMaxTrailCreations ?? 1,
            dailyRefreshes: u.dailyRefreshes || 0,
            dailyTrailCreations: u.dailyTrailCreations || 0
        });
        setActiveTab('settings');
        setLoadingDetails(true);

        try {
            const data = await fetchUserAllData(u.uid);
            setUserDataModal(data);
        } catch (err) {
            console.error("Erro ao carregar materiais do usuário:", err);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handleToggleAdmin = async (u) => {
        if (isOwnerAdmin(u)) {
            setActionMessage("O Administrador Dono (lucasft.pwa@gmail.com) é inalterável!");
            setTimeout(() => setActionMessage(''), 3000);
            return;
        }
        const newAdminStatus = !u.isAdmin;
        try {
            await updateAdminUserSettings(u.uid, { 
                isAdmin: newAdminStatus,
                isUnlimited: newAdminStatus ? true : u.isUnlimited 
            });
            setUsersList(prev => prev.map(item => item.uid === u.uid ? { 
                ...item, 
                isAdmin: newAdminStatus, 
                isUnlimited: newAdminStatus ? true : item.isUnlimited 
            } : item));
            setActionMessage(`Permissão de Administrador para ${u.displayName || u.email || u.uid} alterada!`);
            setTimeout(() => setActionMessage(''), 3000);
        } catch (err) {
            setActionMessage("Erro ao alterar permissão de Admin: " + err.message);
        }
    };

    const handleToggleBlock = async (u) => {
        if (isOwnerAdmin(u)) {
            setActionMessage("O Administrador Dono (lucasft.pwa@gmail.com) não pode ser bloqueado!");
            setTimeout(() => setActionMessage(''), 3000);
            return;
        }
        const newStatus = !u.isBlocked;
        try {
            await updateAdminUserSettings(u.uid, { isBlocked: newStatus });
            setUsersList(prev => prev.map(item => item.uid === u.uid ? { ...item, isBlocked: newStatus } : item));
            setActionMessage(`Status de bloqueio do usuário ${u.displayName || u.uid} alterado!`);
            setTimeout(() => setActionMessage(''), 3000);
        } catch (err) {
            setActionMessage("Erro ao alterar bloqueio: " + err.message);
        }
    };

    const handleToggleUnlimited = async (u) => {
        const newStatus = !u.isUnlimited;
        try {
            await updateAdminUserSettings(u.uid, { isUnlimited: newStatus });
            setUsersList(prev => prev.map(item => item.uid === u.uid ? { ...item, isUnlimited: newStatus } : item));
            setActionMessage(`Acesso ilimitado de ${u.displayName || u.uid} atualizado!`);
            setTimeout(() => setActionMessage(''), 3000);
        } catch (err) {
            setActionMessage("Erro ao alterar acesso ilimitado: " + err.message);
        }
    };

    const handleDeleteUser = async (u) => {
        if (isOwnerAdmin(u)) {
            setActionMessage("O Administrador Dono (lucasft.pwa@gmail.com) é inalterável e não pode ser excluído!");
            setTimeout(() => setActionMessage(''), 3000);
            return;
        }
        const nameToDisplay = u.displayName || u.email || u.uid;
        const confirmDelete = confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o usuário "${nameToDisplay}" e todas as suas trilhas? Esta ação não poderá ser desfeita.`);
        if (confirmDelete) {
            try {
                await deleteUserByAdmin(u.uid, u);
                setUsersList(prev => prev.filter(item => item.uid !== u.uid));
                if (selectedUser?.uid === u.uid) {
                    setSelectedUser(null);
                }
                setActionMessage(`Usuário "${nameToDisplay}" foi excluído permanentemente.`);
                setTimeout(() => setActionMessage(''), 3000);
            } catch (err) {
                setActionMessage("Erro ao excluir usuário: " + err.message);
            }
        }
    };

    const handleDeleteUserTrail = async (trail) => {
        if (!selectedUser) return;
        const confirmDelete = confirm(`Tem certeza que deseja APAGAR a trilha "${trail.title}" do usuário ${selectedUser.displayName || selectedUser.uid}?`);
        if (confirmDelete) {
            try {
                await deleteUserTrailByAdmin(selectedUser.uid, trail.id);
                setUserDataModal(prev => ({
                    ...prev,
                    trails: prev.trails.filter(t => t.id !== trail.id)
                }));
                setActionMessage(`Trilha "${trail.title}" excluída com sucesso!`);
                setTimeout(() => setActionMessage(''), 3000);
            } catch (err) {
                setActionMessage("Erro ao excluir trilha: " + err.message);
            }
        }
    };

    const handleSaveUserForm = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;

        if (isOwnerAdmin(selectedUser) && editForm.isBlocked) {
            setActionMessage("O Administrador Dono (lucasft.pwa@gmail.com) não pode ser bloqueado!");
            setTimeout(() => setActionMessage(''), 3000);
            return;
        }

        try {
            await updateAdminUserSettings(selectedUser.uid, editForm);
            setUsersList(prev => prev.map(item => item.uid === selectedUser.uid ? { ...item, ...editForm } : item));
            setActionMessage(`Configurações de ${editForm.displayName || selectedUser.uid} salvas com sucesso!`);
            setTimeout(() => setActionMessage(''), 3000);
            setSelectedUser(null);
        } catch (err) {
            setActionMessage("Erro ao salvar alterações: " + err.message);
        }
    };

    const filteredUsers = usersList.filter(u => {
        const term = searchTerm.toLowerCase();
        return (
            (u.displayName && u.displayName.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.uid && u.uid.toLowerCase().includes(term))
        );
    });

    const totalUsers = usersList.length;
    const blockedUsers = usersList.filter(u => u.isBlocked).length;
    const unlimitedUsers = usersList.filter(u => u.isUnlimited || checkIsAdmin(u)).length;

    return (
        <div className="w-full max-w-6xl flex flex-col items-center animate-fade-in py-4">
            {/* Header */}
            <div className="w-full flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        <span>👑 Painel de Administração</span>
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gerencie administradores, permissões, limites, bloqueios e trilhas de estudo.
                    </p>
                </div>
                <button
                    onClick={handleReturnHome}
                    className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-slate-100 font-bold py-2.5 px-5 rounded-xl transition-colors text-sm"
                >
                    ← Sair do Admin
                </button>
            </div>

            {/* Mensagem de ação */}
            {actionMessage && (
                <div className="w-full p-4 mb-6 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-semibold rounded-2xl text-center animate-slide-in-bottom">
                    {actionMessage}
                </div>
            )}

            {/* Métricas do Sistema */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full mb-6">
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl font-bold">
                        👥
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Usuários</p>
                        <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{totalUsers}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-400 flex items-center justify-center text-2xl font-bold">
                        ⚡
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Acesso Ilimitado</p>
                        <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{unlimitedUsers}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center text-2xl font-bold">
                        🔒
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bloqueados</p>
                        <p className="text-2xl font-extrabold text-slate-800 dark:text-white">{blockedUsers}</p>
                    </div>
                </div>
            </div>

            {/* Navegação por Abas (Trilhas Globais vs Alunos) */}
            <div className="w-full flex bg-slate-100 dark:bg-gray-800 p-1.5 rounded-2xl mb-6 border border-slate-200 dark:border-gray-700">
                <button
                    onClick={() => setActiveTab('globals')}
                    className={`flex-1 py-3 px-4 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'globals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>🌐 Trilhas Globais (Material para Todos)</span>
                    <span className="bg-indigo-950 text-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-mono">{globalTrails.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex-1 py-3 px-4 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>👥 Gerenciamento de Alunos ({totalUsers})</span>
                </button>
            </div>

            {/* ABA 1: TRILHAS GLOBAIS DA COMUNIDADE */}
            {activeTab === 'globals' && (
                <div className="w-full flex flex-col gap-6">
                    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                <span>🌐 Trilhas de Estudo Globais</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Crie conteúdos unificados para todos os alunos com material de estudo, quiz e flashcards pré-gerados via IA.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setEditingGlobalTrail(null);
                                setGlobalForm({ title: '', topic: 'Matemática', description: '', allowUserExpansion: true, published: true });
                                setShowGlobalModal(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-5 rounded-2xl transition-all text-xs sm:text-sm shadow-md flex items-center gap-2"
                        >
                            <span>+ Nova Trilha Global</span>
                        </button>
                    </div>

                    {loadingGlobals ? (
                        <LoadingScreen text="Carregando trilhas globais..." />
                    ) : globalTrails.length === 0 ? (
                        <div className="w-full bg-white dark:bg-gray-800 p-12 rounded-3xl text-center text-slate-400 border border-slate-200 dark:border-gray-700">
                            Nenhuma trilha global criada ainda. Clique no botão acima para disponibilizar um material oficial para todos os alunos.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            {globalTrails.map((trail) => {
                                const hasPack = trail.cachedStudy && trail.cachedQuiz && trail.cachedAnki;
                                const isGenerating = isGeneratingPack && generatingTrailId === trail.id;

                                return (
                                    <div key={trail.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col justify-between gap-4 relative overflow-hidden">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${trail.published !== false ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800'}`}>
                                                    {trail.published !== false ? '🌐 Publicada' : '📝 Rascunho'}
                                                </span>

                                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${trail.allowUserExpansion !== false ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800'}`}>
                                                    {trail.allowUserExpansion !== false ? '🔓 Alunos Podem Aprofundar (IA)' : '🔒 Trilha Travada (Sem IA)'}
                                                </span>

                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                                    {trail.topic || 'Geral'}
                                                </span>
                                            </div>

                                            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white leading-tight">
                                                {trail.title}
                                            </h3>

                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                {trail.description || 'Sem descrição cadastrada.'}
                                            </p>

                                            {/* Status do Pacote de Conteúdo */}
                                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Pacote de Conteúdo Oficial:</span>
                                                <div className="flex items-center gap-3 text-[11px]">
                                                    <span className={trail.cachedStudy ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                                        {trail.cachedStudy ? '✅ Estudo Gerado' : '❌ Sem Estudo'}
                                                    </span>
                                                    <span className={trail.cachedQuiz ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                                        {trail.cachedQuiz ? `✅ ${trail.cachedQuiz.length || 0} Questões` : '❌ Sem Quiz'}
                                                    </span>
                                                    <span className={trail.cachedAnki ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                                        {trail.cachedAnki ? `✅ ${trail.cachedAnki.length || 0} Flashcards` : '❌ Sem Anki'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Ações da Trilha Global */}
                                        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 dark:border-gray-700">
                                            <button
                                                onClick={() => handleGenerateGlobalPack(trail)}
                                                disabled={isGenerating}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm flex-1 justify-center"
                                                title="Gerar automaticamente o Material de Estudo, Simulados e Flashcards com IA"
                                            >
                                                {isGenerating ? (
                                                    <span className="animate-pulse">⚡ Gerando Pacote...</span>
                                                ) : (
                                                    <span>⚡ {hasPack ? 'Regerar Pacote IA' : 'Gerar Pacote Completo (IA)'}</span>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => handleToggleGlobalPublish(trail)}
                                                className="bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                                                title="Alternar visibilidade para todos os alunos"
                                            >
                                                {trail.published !== false ? '👁️ Despublicar' : '🚀 Publicar'}
                                            </button>

                                            <button
                                                onClick={() => handleToggleGlobalExpansion(trail)}
                                                className="bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 dark:hover:bg-gray-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                                                title="Permitir ou proibir que alunos aprofundem o estudo via IA"
                                            >
                                                {trail.allowUserExpansion !== false ? '🔒 Travar IA' : '🔓 Liberar IA'}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setEditingGlobalTrail(trail);
                                                    setGlobalForm({
                                                        title: trail.title || '',
                                                        topic: trail.topic || 'Matemática',
                                                        description: trail.description || '',
                                                        allowUserExpansion: trail.allowUserExpansion !== false,
                                                        published: trail.published !== false
                                                    });
                                                    setShowGlobalModal(true);
                                                }}
                                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2 px-3 rounded-xl text-xs transition-colors"
                                            >
                                                ✏️ Editar
                                            </button>

                                            <button
                                                onClick={() => handleDeleteGlobalTrailItem(trail)}
                                                className="bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                                            >
                                                🗑️ Excluir
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ABA 2: GERENCIAMENTO DE ALUNOS & USUÁRIOS */}
            {activeTab === 'users' && (
                <div className="w-full flex flex-col gap-4">
                    {/* Barra de Pesquisa e Recarga */}
                    <div className="w-full flex flex-col sm:flex-row gap-3">
                        <input
                            type="text"
                            placeholder="Pesquisar por nome, e-mail ou UID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-grow p-3 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                        />
                        <button
                            onClick={loadUsers}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                        >
                            🔄 Recarregar Lista
                        </button>
                    </div>

                    {/* Tabela de Usuários quando a aba 'users' está ativa */}
                    {loadingUsers ? (
                        <LoadingScreen text="Carregando lista de usuários do Firestore..." />
                    ) : filteredUsers.length === 0 ? (
                        <div className="w-full bg-white dark:bg-gray-800 p-8 rounded-2xl text-center text-slate-500 border border-slate-200 dark:border-gray-700">
                            Nenhum usuário encontrado.
                        </div>
                    ) : (
                        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow border border-slate-100 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-gray-900/80 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-100 dark:border-gray-700">
                                <tr>
                                    <th className="p-4">Usuário / E-mail</th>
                                    <th className="p-4">XP / Vidas</th>
                                    <th className="p-4">Uso Hoje</th>
                                    <th className="p-4">Status / Cargo</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/60">
                                {filteredUsers.map((u) => {
                                    const isOwner = isOwnerAdmin(u);
                                    const isAdminUser = isOwner || u.isAdmin || checkIsAdmin(u);
                                    const isUnl = u.isUnlimited || isAdminUser;
                                    const isBlk = u.isBlocked;
                                    const displayName = u.displayName || (isOwner ? 'Lucas (Dono)' : 'Sem Nome Cadastrado');
                                    const emailDisplay = u.email || (isOwner ? OWNER_EMAIL : 'E-mail não registrado');

                                    return (
                                        <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    {u.photoURL ? (
                                                        <img src={u.photoURL} alt="" className="w-10 h-10 rounded-full" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow">
                                                            {displayName[0].toUpperCase()}
                                                        </div>
                                                    )}
                                                    <div>
                                                        <p className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                                                            <span>{displayName}</span>
                                                            {isOwner && <span className="text-xs bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 font-extrabold px-2 py-0.5 rounded-full">👑 Dono (Inalterável)</span>}
                                                        </p>
                                                        <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">{emailDisplay}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">UID: {u.uid}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="p-4 font-medium">
                                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{u.xp || 0} XP</span>
                                                <span className="text-slate-400 mx-1">•</span>
                                                <span className="text-red-500 font-bold">❤️ {u.hearts ?? (u.customMaxHearts || 5)}</span>
                                            </td>

                                            <td className="p-4 text-xs text-slate-500">
                                                <span>Refreshes: {u.dailyRefreshes || 0} / {isUnl ? '∞' : (u.customMaxDailyRefreshes || 10)}</span><br />
                                                <span>Trilhas: {u.dailyTrailCreations || 0} / {isUnl ? '∞' : (u.customMaxDailyTrailCreations || 1)}</span>
                                            </td>

                                            <td className="p-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {isBlk && (
                                                        <span className="bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                                                            🔒 Bloqueado
                                                        </span>
                                                    )}
                                                    {isOwner ? (
                                                        <span className="bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                                                            👑 Dono
                                                        </span>
                                                    ) : isAdminUser ? (
                                                        <span className="bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                                                            ⭐ Admin
                                                        </span>
                                                    ) : isUnl ? (
                                                        <span className="bg-green-100 dark:bg-green-900/60 text-green-700 dark:text-green-300 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full">
                                                            ⚡ Ilimitado
                                                        </span>
                                                    ) : (
                                                        <span className="bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 text-[11px] font-semibold px-2.5 py-0.5 rounded-full">
                                                            Padrão
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleToggleUnlimited(u)}
                                                        title={isUnl ? "Remover Ilimitado" : "Conceder Ilimitado"}
                                                        className={`p-2 rounded-xl text-xs font-bold transition-colors ${isUnl ? 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/50 dark:text-green-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-slate-200'}`}
                                                    >
                                                        ⚡ {isUnl ? 'Ilimitado' : 'Limitar'}
                                                    </button>

                                                    {!isOwner ? (
                                                        <button
                                                            onClick={() => handleToggleAdmin(u)}
                                                            title={u.isAdmin ? "Remover cargo de Admin" : "Promover a Administrador"}
                                                            className={`p-2 rounded-xl text-xs font-bold transition-colors ${u.isAdmin ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-slate-200'}`}
                                                        >
                                                            ⭐ {u.isAdmin ? 'Admin' : '+ Admin'}
                                                        </button>
                                                    ) : (
                                                        <span className="p-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                                                            👑 Protegido
                                                        </span>
                                                    )}

                                                    {!isOwner && (
                                                        <button
                                                            onClick={() => handleToggleBlock(u)}
                                                            title={isBlk ? "Desbloquear Usuário" : "Bloquear Usuário"}
                                                            className={`p-2 rounded-xl text-xs font-bold transition-colors ${isBlk ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-slate-200'}`}
                                                        >
                                                            {isBlk ? '🔓' : '🔒'}
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => openUserModal(u)}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 px-3 rounded-xl text-xs transition-colors"
                                                    >
                                                        ⚙️ Editar
                                                    </button>

                                                    {!isOwner && (
                                                        <button
                                                            onClick={() => handleDeleteUser(u)}
                                                            title="Excluir Usuário"
                                                            className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70 font-bold p-2 rounded-xl text-xs transition-colors"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            </div>
            )}

            {/* Modal de Detalhes e Gerenciamento do Usuário Selecionado */}
            {selectedUser && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 dark:border-gray-700">
                        {/* Modal Header */}
                        <div className="p-6 bg-slate-50 dark:bg-gray-900 border-b border-slate-100 dark:border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                {selectedUser.photoURL ? (
                                    <img src={selectedUser.photoURL} alt="" className="w-12 h-12 rounded-full" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-indigo-600 text-white font-bold text-lg flex items-center justify-center">
                                        {(editForm.displayName || selectedUser.displayName || 'U')[0]}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                        <span>{editForm.displayName || selectedUser.displayName || "Usuário"}</span>
                                        {isOwnerAdmin(selectedUser) && <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2 py-0.5 rounded-full">👑 Dono</span>}
                                    </h3>
                                    <p className="text-xs font-semibold text-indigo-500">{editForm.email || selectedUser.email || selectedUser.uid}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedUser(null)}
                                className="text-2xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Tabs */}
                        <div className="flex border-b border-slate-100 dark:border-gray-700 bg-slate-50/50 dark:bg-gray-900/50">
                            <button
                                onClick={() => setActiveTab('settings')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'settings' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                ⚙️ Editar Dados & Limites
                            </button>
                            <button
                                onClick={() => setActiveTab('materials')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'materials' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                📚 Trilhas & Materiais ({userDataModal.trails.length})
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-grow">
                            {activeTab === 'settings' ? (
                                <form onSubmit={handleSaveUserForm} className="space-y-5">
                                    {/* Edição de Nome e Email */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Nome / Apelido</label>
                                            <input
                                                type="text"
                                                placeholder="Digite o nome do usuário..."
                                                value={editForm.displayName}
                                                onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">E-mail do Usuário</label>
                                            <input
                                                type="email"
                                                placeholder="Digite o e-mail do usuário..."
                                                value={editForm.email}
                                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold"
                                            />
                                        </div>
                                    </div>

                                    {/* Toggles de Admin e Bloqueio */}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-indigo-600 dark:text-indigo-400">Promover Admin</p>
                                                <p className="text-[11px] text-slate-400">Acesso ao Painel Admin.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                disabled={isOwnerAdmin(selectedUser)}
                                                checked={editForm.isAdmin || isOwnerAdmin(selectedUser)}
                                                onChange={(e) => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                                                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer disabled:opacity-50"
                                            />
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm">Acesso Ilimitado</p>
                                                <p className="text-[11px] text-slate-400">Pula contadores diários.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={editForm.isUnlimited}
                                                onChange={(e) => setEditForm({ ...editForm, isUnlimited: e.target.checked })}
                                                className="w-5 h-5 accent-green-600 rounded cursor-pointer"
                                            />
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-red-600 dark:text-red-400">Bloquear Conta</p>
                                                <p className="text-[11px] text-slate-400">Suspende o uso do app.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                disabled={isOwnerAdmin(selectedUser)}
                                                checked={editForm.isBlocked && !isOwnerAdmin(selectedUser)}
                                                onChange={(e) => setEditForm({ ...editForm, isBlocked: e.target.checked })}
                                                className="w-5 h-5 accent-red-600 rounded cursor-pointer disabled:opacity-50"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">XP Atual</label>
                                            <input
                                                type="number"
                                                value={editForm.xp}
                                                onChange={(e) => setEditForm({ ...editForm, xp: parseInt(e.target.value) || 0 })}
                                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">Corações Atuais</label>
                                            <input
                                                type="number"
                                                value={editForm.hearts}
                                                onChange={(e) => setEditForm({ ...editForm, hearts: parseInt(e.target.value) || 0 })}
                                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold"
                                            />
                                        </div>
                                    </div>

                                    {/* Seção de Limites Customizados */}
                                    <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 space-y-4">
                                        <h4 className="font-bold text-sm text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                            <span>🎯 Personalização de Limites do Usuário</span>
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Max Corações</label>
                                                <input
                                                    type="number"
                                                    value={editForm.customMaxHearts}
                                                    onChange={(e) => setEditForm({ ...editForm, customMaxHearts: parseInt(e.target.value) || 5 })}
                                                    className="w-full p-2.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Max Refreshes/Dia</label>
                                                <input
                                                    type="number"
                                                    value={editForm.customMaxDailyRefreshes}
                                                    onChange={(e) => setEditForm({ ...editForm, customMaxDailyRefreshes: parseInt(e.target.value) || 10 })}
                                                    className="w-full p-2.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Max Trilhas/Dia</label>
                                                <input
                                                    type="number"
                                                    value={editForm.customMaxDailyTrailCreations}
                                                    onChange={(e) => setEditForm({ ...editForm, customMaxDailyTrailCreations: parseInt(e.target.value) || 1 })}
                                                    className="w-full p-2.5 bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl font-bold text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="submit"
                                            className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-colors"
                                        >
                                            Salvar Alterações
                                        </button>
                                        {!isOwnerAdmin(selectedUser) && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteUser(selectedUser)}
                                                className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 rounded-2xl transition-colors text-sm flex items-center justify-center gap-1.5"
                                            >
                                                <span>🗑️ Excluir Usuário</span>
                                            </button>
                                        )}
                                    </div>
                                </form>
                            ) : loadingDetails ? (
                                <LoadingScreen text="Carregando materiais do usuário..." />
                            ) : (
                                <div className="space-y-6">
                                    {/* Trilhas Personalizadas */}
                                    <div>
                                        <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                            <span>🗂️ Trilhas Criadas pelo Usuário</span>
                                            <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                                                {userDataModal.trails.length}
                                            </span>
                                        </h4>
                                        {userDataModal.trails.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">Nenhuma trilha customizada criada ainda.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {userDataModal.trails.map(t => (
                                                    <div key={t.id} className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-between gap-4">
                                                        <div className="flex-grow">
                                                            <h5 className="font-bold text-slate-800 dark:text-slate-100">{t.title}</h5>
                                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{t.content}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeleteUserTrail(t)}
                                                            className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/80 font-bold text-xs py-2 px-3 rounded-xl transition-colors flex-shrink-0"
                                                        >
                                                            🗑️ Apagar Trilha
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Progresso de Materiais */}
                                    <div>
                                        <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                            <span>📖 Materiais & Quizzes em Cache</span>
                                            <span className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 font-bold px-2 py-0.5 rounded-full">
                                                {userDataModal.progress.length}
                                            </span>
                                        </h4>
                                        {userDataModal.progress.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">Nenhum material gerado em cache para este usuário.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {userDataModal.progress.map(p => (
                                                    <div key={p.id} className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700">
                                                        <p className="font-bold text-xs text-indigo-500 uppercase">Nível: {p.id}</p>
                                                        {p.cachedStudy && <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">✔ Material de Estudo gerado</p>}
                                                        {p.cachedQuiz && <p className="text-xs text-slate-600 dark:text-slate-300">✔ Quiz de Múltipla Escolha gerado ({p.cachedQuiz.length} questões)</p>}
                                                        {p.cachedAnki && <p className="text-xs text-slate-600 dark:text-slate-300">✔ Flashcards Anki ({p.cachedAnki.length} cartas)</p>}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Modal de Criação e Edição de Trilha Global */}
            {showGlobalModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4 border border-slate-100 dark:border-gray-700">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-gray-700">
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                <span>{editingGlobalTrail ? '✏️ Editar Trilha Global' : '🌐 Nova Trilha Global'}</span>
                            </h3>
                            <button
                                onClick={() => setShowGlobalModal(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleSaveGlobalTrail} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Título da Trilha Global *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Cálculo I: Limites e Derivadas"
                                    value={globalForm.title}
                                    onChange={(e) => setGlobalForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Tópico / Categoria</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Matemática, AWS, Física, Programação"
                                    value={globalForm.topic}
                                    onChange={(e) => setGlobalForm(prev => ({ ...prev, topic: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Descrição Breve para os Alunos</label>
                                <textarea
                                    rows="3"
                                    placeholder="Ex: Material oficial completo com conceitos teóricos, fórmulas e exercícios resolvidos."
                                    value={globalForm.description}
                                    onChange={(e) => setGlobalForm(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white resize-none"
                                />
                            </div>

                            {/* Controles de Permissão e Publicação */}
                            <div className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={globalForm.published}
                                        onChange={(e) => setGlobalForm(prev => ({ ...prev, published: e.target.checked }))}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                        🌐 Publicar imediatamente para todos os alunos
                                    </span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={globalForm.allowUserExpansion}
                                        onChange={(e) => setGlobalForm(prev => ({ ...prev, allowUserExpansion: e.target.checked }))}
                                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                        🔓 Permitir que os alunos aprofundem o material e gerem mais exercícios com IA
                                    </span>
                                </label>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowGlobalModal(false)}
                                    className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-lg"
                                >
                                    💾 Salvar Trilha Global
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
