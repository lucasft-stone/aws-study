import React, { useState, useEffect } from 'react';
import LoadingScreen from './LoadingScreen';
import { 
    fetchAllUsers, 
    updateAdminUserSettings, 
    fetchUserAllData, 
    checkIsAdmin,
    deleteUserByAdmin,
    deleteUserTrailByAdmin
} from '../services/firebaseService';

export default function AdminPanel({ user, handleReturnHome }) {
    const isAuthorized = checkIsAdmin(user);

    const [usersList, setUsersList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDataModal, setUserDataModal] = useState({ trails: [], progress: [] });
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'materials'

    // Form de edição do usuário selecionado
    const [editForm, setEditForm] = useState({
        displayName: '',
        email: '',
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

    useEffect(() => {
        if (isAuthorized) {
            loadUsers();
        }
    }, [isAuthorized]);

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
        setSelectedUser(u);
        setEditForm({
            displayName: u.displayName || '',
            email: u.email || '',
            isBlocked: u.isBlocked || false,
            isUnlimited: u.isUnlimited || false,
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

    const handleToggleBlock = async (u) => {
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
        const nameToDisplay = u.displayName || u.email || u.uid;
        const confirmDelete = confirm(`Tem certeza que deseja EXCLUIR PERMANENTEMENTE o usuário "${nameToDisplay}" e todas as suas trilhas? Esta ação não poderá ser desfeita.`);
        if (confirmDelete) {
            try {
                await deleteUserByAdmin(u.uid);
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
                        Gerencie usuários, e-mails, nomes, limites, exclusões e inspecione trilhas de estudo.
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

            {/* Barra de Pesquisa e Recarga */}
            <div className="w-full flex flex-col sm:flex-row gap-3 mb-6">
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

            {/* Tabela de Usuários */}
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
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-700/60">
                                {filteredUsers.map((u) => {
                                    const isAdmin = checkIsAdmin(u);
                                    const isUnl = u.isUnlimited || isAdmin;
                                    const isBlk = u.isBlocked;
                                    const displayName = u.displayName || (isAdmin ? 'Administrador' : 'Sem Nome Cadastrado');
                                    const emailDisplay = u.email || (u.uid === 'fy9fGuWe5Kh4veCFkRbp6pN9MyK2' ? 'felps.st2020@gmail.com' : 'E-mail não sincronizado');

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
                                                            {isAdmin && <span className="text-xs text-amber-500 font-normal" title="Administrador Raiz">👑</span>}
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
                                                    {isUnl ? (
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

                                                    <button
                                                        onClick={() => handleToggleBlock(u)}
                                                        title={isBlk ? "Desbloquear Usuário" : "Bloquear Usuário"}
                                                        className={`p-2 rounded-xl text-xs font-bold transition-colors ${isBlk ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-gray-700 dark:text-slate-200'}`}
                                                    >
                                                        {isBlk ? '🔓' : '🔒'}
                                                    </button>

                                                    <button
                                                        onClick={() => openUserModal(u)}
                                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold p-2 px-3 rounded-xl text-xs transition-colors"
                                                    >
                                                        ⚙️ Editar
                                                    </button>

                                                    <button
                                                        onClick={() => handleDeleteUser(u)}
                                                        title="Excluir Usuário"
                                                        className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/70 font-bold p-2 rounded-xl text-xs transition-colors"
                                                    >
                                                        🗑️
                                                    </button>
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
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-white">
                                        {editForm.displayName || selectedUser.displayName || "Usuário"}
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

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm">Acesso Ilimitado</p>
                                                <p className="text-xs text-slate-400">Pula contadores diários e libera recursos.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={editForm.isUnlimited}
                                                onChange={(e) => setEditForm({ ...editForm, isUnlimited: e.target.checked })}
                                                className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
                                            />
                                        </div>

                                        <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-between">
                                            <div>
                                                <p className="font-bold text-sm text-red-600 dark:text-red-400">Bloquear Usuário</p>
                                                <p className="text-xs text-slate-400">Impede o uso do app.</p>
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={editForm.isBlocked}
                                                onChange={(e) => setEditForm({ ...editForm, isBlocked: e.target.checked })}
                                                className="w-5 h-5 accent-red-600 rounded cursor-pointer"
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
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteUser(selectedUser)}
                                            className="bg-red-500 hover:bg-red-600 text-white font-bold px-5 rounded-2xl transition-colors text-sm flex items-center justify-center gap-1.5"
                                        >
                                            <span>🗑️ Excluir Usuário</span>
                                        </button>
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
        </div>
    );
}
