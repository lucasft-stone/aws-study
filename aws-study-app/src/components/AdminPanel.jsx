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
    deleteGlobalTrail,
    fetchSystemAnnouncement,
    saveSystemAnnouncement,
    fetchAiSettings,
    saveAiSettings,
    fetchAuditLogs,
    logAdminAction,
    fetchSchools,
    createSchool,
    updateSchool,
    deleteSchool,
    fetchSchoolTrails,
    createSchoolTrail,
    updateSchoolTrail,
    deleteSchoolTrail
} from '../services/firebaseService';
import { fetchGeneratedStudyContent } from '../services/geminiService';
import QuizEditorModal from './QuizEditorModal';
import TheoryEditorModal from './TheoryEditorModal';
import AnkiEditorModal from './AnkiEditorModal';
import { 
    TOPIC_ICON_OPTIONS, 
    resolveTopicIcon, 
    getHideAwsTopicSetting, 
    setHideAwsTopicSetting 
} from '../utils/topicHelpers';

export default function AdminPanel({ user, handleReturnHome, reloadTrails }) {
    const isAuthorized = checkIsAdmin(user);

    const [usersList, setUsersList] = useState([]);
    const [globalTrails, setGlobalTrails] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingGlobals, setLoadingGlobals] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [userRoleFilter, setUserRoleFilter] = useState('all'); // 'all' | 'admin' | 'unlimited' | 'blocked'
    const [userSortBy, setUserSortBy] = useState('name'); // 'name' | 'email' | 'xp' | 'hearts'
    const [selectedUserUids, setSelectedUserUids] = useState([]);

    const [selectedUser, setSelectedUser] = useState(null);
    const [userDataModal, setUserDataModal] = useState({ trails: [], progress: [] });
    const [modalUserTab, setModalUserTab] = useState('settings'); // 'settings' | 'materials'
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [actionMessage, setActionMessage] = useState('');
    
    // Abas Principais do Painel Admin
    const [activeTab, setActiveTab] = useState('globals'); // 'globals' | 'users' | 'schools' | 'announcements' | 'aiConfig' | 'analytics' | 'audit'

    // Multi-Tenant / Escolas & Professores
    const [schoolsList, setSchoolsList] = useState([]);
    const [loadingSchools, setLoadingSchools] = useState(false);
    const [showSchoolModal, setShowSchoolModal] = useState(false);
    const [schoolForm, setSchoolForm] = useState({ name: '', code: '', teacherEmail: '' });
    const [selectedSchool, setSelectedSchool] = useState(null);
    const [schoolSubjects, setSchoolSubjects] = useState([]);
    const [showSubjectModal, setShowSubjectModal] = useState(false);
    const [subjectForm, setSubjectForm] = useState({ title: '', topic: 'Geral', description: '' });

    // Logs de Auditoria do Admin
    const [auditLogsList, setAuditLogsList] = useState([]);
    const [loadingAuditLogs, setLoadingAuditLogs] = useState(false);

    // AI Sandbox / Playground de Testes
    const [sandboxTopic, setSandboxTopic] = useState('AWS Cloud Practitioner');
    const [sandboxType, setSandboxType] = useState('study'); // 'study' | 'quiz' | 'anki'
    const [sandboxResult, setSandboxResult] = useState(null);
    const [isTestingSandbox, setIsTestingSandbox] = useState(false);
    const [sandboxTimeMs, setSandboxTimeMs] = useState(0);

    const [hideAwsTopic, setHideAwsTopic] = useState(() => getHideAwsTopicSetting());

    // Modais de Edição de Conteúdo da Trilha Global
    const [showGlobalModal, setShowGlobalModal] = useState(false);
    const [editingGlobalTrail, setEditingGlobalTrail] = useState(null);
    const [editingQuizTrail, setEditingQuizTrail] = useState(null);
    const [editingTheoryTrail, setEditingTheoryTrail] = useState(null);
    const [editingAnkiTrail, setEditingAnkiTrail] = useState(null);

    const [globalForm, setGlobalForm] = useState({
        title: '',
        topic: 'Matemática',
        icon: '',
        description: '',
        allowUserExpansion: true,
        published: true
    });

    const [isGeneratingPack, setIsGeneratingPack] = useState(false);
    const [generatingTrailId, setGeneratingTrailId] = useState(null);
    const [packStepMessage, setPackStepMessage] = useState('');

    // Form de Edição do Usuário Único
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

    // Form de Aviso/Banner do Sistema
    const [announcementForm, setAnnouncementForm] = useState({
        title: '📣 Comunicado aos Alunos',
        message: '',
        active: false,
        type: 'info' // 'info' | 'warning' | 'success' | 'alert'
    });
    const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);

    // Form de Configuração de IA & Prompts
    const [aiConfigForm, setAiConfigForm] = useState({
        studyInstructions: '',
        quizInstructions: '',
        ankiInstructions: '',
        botPersona: ''
    });
    const [isSavingAiConfig, setIsSavingAiConfig] = useState(false);

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

    const loadSchoolsList = async () => {
        setLoadingSchools(true);
        try {
            const list = await fetchSchools();
            setSchoolsList(list);
        } catch (err) {
            console.error("Erro ao carregar colégios:", err);
        } finally {
            setLoadingSchools(false);
        }
    };

    const handleSaveSchool = async (e) => {
        e.preventDefault();
        if (!schoolForm.name) return;

        try {
            const newSchool = await createSchool({
                name: schoolForm.name,
                code: schoolForm.code || Math.random().toString(36).substring(2, 8).toUpperCase(),
                teacherEmails: schoolForm.teacherEmail ? [schoolForm.teacherEmail] : []
            });
            setActionMessage(`Colégio "${newSchool.name}" (Código: ${newSchool.code}) cadastrado com sucesso!`);
            logAdminAction(user, 'create_school', `Colégio: ${newSchool.name} [${newSchool.code}]`);
            setShowSchoolModal(false);
            setSchoolForm({ name: '', code: '', teacherEmail: '' });
            await loadSchoolsList();
        } catch (err) {
            setActionMessage("Erro ao criar colégio: " + err.message);
        }
    };

    const handleOpenSchoolSubjects = async (school) => {
        setSelectedSchool(school);
        try {
            const subjects = await fetchSchoolTrails(school.id);
            setSchoolSubjects(subjects);
        } catch (err) {
            console.error("Erro ao carregar matérias do colégio:", err);
        }
    };

    const handleSaveSchoolSubject = async (e) => {
        e.preventDefault();
        if (!selectedSchool || !subjectForm.title) return;

        try {
            await createSchoolTrail(selectedSchool.id, {
                title: subjectForm.title,
                topic: subjectForm.topic || 'Geral',
                description: subjectForm.description || '',
                published: true
            });
            setActionMessage(`Matéria "${subjectForm.title}" adicionada ao colégio "${selectedSchool.name}"!`);
            logAdminAction(user, 'create_school_subject', `Matéria: "${subjectForm.title}" em ${selectedSchool.name}`);
            setShowSubjectModal(false);
            setSubjectForm({ title: '', topic: 'Geral', description: '' });
            await handleOpenSchoolSubjects(selectedSchool);
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao criar matéria: " + err.message);
        }
    };

    const loadSystemAnnouncementData = async () => {
        const data = await fetchSystemAnnouncement();
        if (data) {
            setAnnouncementForm({
                title: data.title || '📣 Comunicado aos Alunos',
                message: data.message || '',
                active: data.active ?? false,
                type: data.type || 'info'
            });
        }
    };

    const loadAiConfigData = async () => {
        const data = await fetchAiSettings();
        if (data) {
            setAiConfigForm({
                studyInstructions: data.studyInstructions || '',
                quizInstructions: data.quizInstructions || '',
                ankiInstructions: data.ankiInstructions || '',
                botPersona: data.botPersona || ''
            });
        }
    };

    const loadAuditLogsList = async () => {
        setLoadingAuditLogs(true);
        try {
            const logs = await fetchAuditLogs();
            setAuditLogsList(logs);
        } catch (err) {
            console.error("Erro ao carregar logs de auditoria:", err);
        } finally {
            setLoadingAuditLogs(false);
        }
    };

    const handleRunAiSandbox = async (e) => {
        e.preventDefault();
        if (!sandboxTopic.trim()) return;

        setIsTestingSandbox(true);
        setSandboxResult(null);
        const startTime = Date.now();

        try {
            const mockTrail = { title: sandboxTopic, content: sandboxTopic };
            const res = await fetchGeneratedStudyContent(mockTrail, sandboxType, 'google/gemini-2.5-flash', true);
            const endTime = Date.now();
            setSandboxTimeMs(endTime - startTime);
            setSandboxResult(res);
            setActionMessage(`Teste no AI Playground concluído em ${(endTime - startTime)}ms!`);
            logAdminAction(user, 'test_ai_sandbox', `Tópico: "${sandboxTopic}" [${sandboxType}]`);
        } catch (err) {
            console.error("Erro no teste de IA:", err);
            setSandboxResult({ error: err.message });
        } finally {
            setIsTestingSandbox(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) {
            loadUsers();
            loadGlobalTrailsList();
            loadSchoolsList();
            loadSystemAnnouncementData();
            loadAiConfigData();
            loadAuditLogsList();
        }
    }, [isAuthorized]);

    // Exportar Trilha Global para arquivo JSON
    const handleExportTrailJSON = (trail) => {
        const exportData = {
            title: trail.title,
            topic: trail.topic || 'Geral',
            icon: trail.icon || '',
            description: trail.description || '',
            allowUserExpansion: trail.allowUserExpansion !== false,
            published: trail.published !== false,
            cachedStudy: trail.cachedStudy || '',
            cachedQuiz: trail.cachedQuiz || [],
            cachedAnki: trail.cachedAnki || [],
            exportedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `trilha_${(trail.title || 'export').toLowerCase().replace(/[^a-z0-9]/g, '_')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setActionMessage(`Trilha "${trail.title}" exportada com sucesso em JSON!`);
        setTimeout(() => setActionMessage(''), 3000);
    };

    // Importar Trilha Global via arquivo JSON
    const handleImportTrailJSON = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (!parsed.title) {
                    throw new Error("Arquivo JSON inválido: campo 'title' é obrigatório.");
                }

                await createGlobalTrail({
                    title: parsed.title,
                    topic: parsed.topic || 'Geral',
                    icon: parsed.icon || '',
                    description: parsed.description || '',
                    allowUserExpansion: parsed.allowUserExpansion !== false,
                    published: parsed.published !== false,
                    cachedStudy: parsed.cachedStudy || null,
                    cachedQuiz: parsed.cachedQuiz || null,
                    cachedAnki: parsed.cachedAnki || null
                });

                setActionMessage(`Trilha global "${parsed.title}" importada e criada com sucesso!`);
                await loadGlobalTrailsList();
                if (reloadTrails) reloadTrails();
            } catch (err) {
                console.error("Erro ao importar JSON:", err);
                setActionMessage("Erro ao importar arquivo JSON: " + err.message);
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // Salvar Trilha Global (Criar / Editar Metadata)
    const handleSaveGlobalTrail = async (e) => {
        e.preventDefault();
        if (!globalForm.title) return;

        try {
            if (editingGlobalTrail) {
                await updateGlobalTrail(editingGlobalTrail.id, globalForm);
                logAdminAction(user, 'update_global_trail', `Edição de "${globalForm.title}"`);
                setActionMessage(`Trilha global "${globalForm.title}" atualizada com sucesso!`);
            } else {
                await createGlobalTrail(globalForm);
                logAdminAction(user, 'create_global_trail', `Criação de "${globalForm.title}"`);
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

    // Salvar Material Teórico Manualmente
    const handleSaveTheoryContent = async (updatedTheory) => {
        if (!editingTheoryTrail) return;
        try {
            if (editingTheoryTrail.isSchoolTrail && editingTheoryTrail.schoolId) {
                await updateSchoolTrail(editingTheoryTrail.schoolId, editingTheoryTrail.id, { cachedStudy: updatedTheory });
                logAdminAction(user, 'edit_school_theory', `Teoria editada: "${editingTheoryTrail.title}"`);
                if (selectedSchool) await handleOpenSchoolSubjects(selectedSchool);
            } else {
                await updateGlobalTrail(editingTheoryTrail.id, {
                    cachedStudy: updatedTheory,
                    updatedAt: new Date()
                });
                await loadGlobalTrailsList();
                if (reloadTrails) reloadTrails();
            }
            setActionMessage(`Material teórico da trilha "${editingTheoryTrail.title}" atualizado com sucesso!`);
        } catch (err) {
            console.error("Erro ao salvar teoria:", err);
            setActionMessage("Erro ao salvar teoria: " + err.message);
        }
    };

    // Salvar Perguntas de Exercício Manualmente
    const handleSaveQuizQuestions = async (updatedQuestions) => {
        if (!editingQuizTrail) return;
        try {
            if (editingQuizTrail.isSchoolTrail && editingQuizTrail.schoolId) {
                await updateSchoolTrail(editingQuizTrail.schoolId, editingQuizTrail.id, { cachedQuiz: updatedQuestions });
                logAdminAction(user, 'edit_school_quiz', `Quiz editado: "${editingQuizTrail.title}"`);
                if (selectedSchool) await handleOpenSchoolSubjects(selectedSchool);
            } else {
                await updateGlobalTrail(editingQuizTrail.id, {
                    cachedQuiz: updatedQuestions,
                    updatedAt: new Date()
                });
                await loadGlobalTrailsList();
                if (reloadTrails) reloadTrails();
            }
            setActionMessage(`Exercícios da trilha "${editingQuizTrail.title}" salvos com sucesso! (${updatedQuestions.length} questões)`);
        } catch (err) {
            console.error("Erro ao salvar exercícios:", err);
            setActionMessage("Erro ao salvar exercícios: " + err.message);
        }
    };

    // Salvar Cartões Anki Manualmente
    const handleSaveAnkiCards = async (updatedCards) => {
        if (!editingAnkiTrail) return;
        try {
            if (editingAnkiTrail.isSchoolTrail && editingAnkiTrail.schoolId) {
                await updateSchoolTrail(editingAnkiTrail.schoolId, editingAnkiTrail.id, { cachedAnki: updatedCards });
                logAdminAction(user, 'edit_school_anki', `Anki editado: "${editingAnkiTrail.title}"`);
                if (selectedSchool) await handleOpenSchoolSubjects(selectedSchool);
            } else {
                await updateGlobalTrail(editingAnkiTrail.id, {
                    cachedAnki: updatedCards,
                    updatedAt: new Date()
                });
                await loadGlobalTrailsList();
                if (reloadTrails) reloadTrails();
            }
            setActionMessage(`Flashcards Anki da trilha "${editingAnkiTrail.title}" salvos com sucesso! (${updatedCards.length} cartões)`);
        } catch (err) {
            console.error("Erro ao salvar cartões Anki:", err);
            setActionMessage("Erro ao salvar cartões Anki: " + err.message);
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
        setPackStepMessage(`📚 Etapa 1/3: Gerando Material Teórico com IA para "${trail.title}"... Por favor aguarde.`);

        try {
            const studyRes = await fetchGeneratedStudyContent(trail, 'study', 'google/gemini-2.5-flash', true);
            const studyText = studyRes?.studyMaterial || studyRes?.studyContent || '';

            setPackStepMessage(`📝 Etapa 2/3: Sintetizando Simulados e Exercícios de Múltipla Escolha... Por favor aguarde.`);
            const quizRes = await fetchGeneratedStudyContent(trail, 'quiz', 'google/gemini-2.5-flash', true);
            const questions = quizRes?.questions || [];

            setPackStepMessage(`🧠 Etapa 3/3: Estruturando Cartões Anki para Memorização Espaçada... Por favor aguarde.`);
            const ankiRes = await fetchGeneratedStudyContent(trail, 'anki', 'google/gemini-2.5-flash', true);
            const flashcards = ankiRes?.cards || ankiRes?.flashcards || [];

            setPackStepMessage(`💾 Finalizando e Publicando Pacote para Todos os Alunos...`);
            await updateGlobalTrail(trail.id, {
                cachedStudy: studyText,
                cachedQuiz: questions,
                cachedAnki: flashcards,
                published: true,
                updatedAt: new Date()
            });

            setActionMessage(`🎉 Pacote completo gerado e publicado com sucesso para "${trail.title}"!`);
            await loadGlobalTrailsList();
            if (reloadTrails) reloadTrails();
        } catch (err) {
            console.error("Erro ao gerar pacote completo:", err);
            setActionMessage("Erro ao gerar pacote de conteúdo: " + err.message);
        } finally {
            setIsGeneratingPack(false);
            setGeneratingTrailId(null);
            setPackStepMessage('');
        }
    };

    const handleGenerateSchoolPack = async (subject) => {
        if (!selectedSchool) return;
        setIsGeneratingPack(true);
        setGeneratingTrailId(subject.id);
        setPackStepMessage(`📚 Etapa 1/3: Gerando Material Teórico com IA para "${subject.title}"... Por favor aguarde.`);

        try {
            const studyRes = await fetchGeneratedStudyContent(subject, 'study', 'google/gemini-2.5-flash', true);
            const studyText = studyRes?.studyMaterial || studyRes?.studyContent || '';

            setPackStepMessage(`📝 Etapa 2/3: Sintetizando Simulados e Exercícios de Múltipla Escolha... Por favor aguarde.`);
            const quizRes = await fetchGeneratedStudyContent(subject, 'quiz', 'google/gemini-2.5-flash', true);
            const questions = quizRes?.questions || [];

            setPackStepMessage(`🧠 Etapa 3/3: Estruturando Cartões Anki para Memorização Espaçada... Por favor aguarde.`);
            const ankiRes = await fetchGeneratedStudyContent(subject, 'anki', 'google/gemini-2.5-flash', true);
            const flashcards = ankiRes?.cards || ankiRes?.flashcards || [];

            setPackStepMessage(`💾 Finalizando e Publicando Pacote para os alunos de ${selectedSchool.name}...`);
            await updateSchoolTrail(selectedSchool.id, subject.id, {
                cachedStudy: studyText,
                cachedQuiz: questions,
                cachedAnki: flashcards,
                published: true
            });

            setActionMessage(`🎉 Pacote completo gerado e publicado para "${subject.title}" em ${selectedSchool.name}!`);
            logAdminAction(user, 'generate_school_pack', `Matéria: "${subject.title}" em ${selectedSchool.name}`);
            await handleOpenSchoolSubjects(selectedSchool);
        } catch (err) {
            console.error("Erro ao gerar pacote do colégio:", err);
            setActionMessage("Erro ao gerar pacote de conteúdo: " + err.message);
        } finally {
            setIsGeneratingPack(false);
            setGeneratingTrailId(null);
            setPackStepMessage('');
        }
    };

    // Regenera UM tipo de conteúdo específico (Teoria, Quiz ou Anki) de uma matéria de colégio
    const handleRegenerateSchoolContent = async (subject, type) => {
        if (!selectedSchool) return;
        const typeLabels = { study: 'Material Teórico', quiz: 'Simulado/Exercícios', anki: 'Flashcards Anki' };
        if (!window.confirm(`Regenerar o conteúdo "${typeLabels[type]}" da matéria "${subject.title}" com IA? O conteúdo atual será substituído.`)) return;

        setIsGeneratingPack(true);
        setGeneratingTrailId(`${subject.id}-${type}`);
        setPackStepMessage(`🔄 Regenerando ${typeLabels[type]} para "${subject.title}"... Por favor aguarde.`);

        try {
            // Usa a teoria atual como base para quiz/anki, se existir
            const baseTrail = { ...subject, content: subject.cachedStudy || subject.content || subject.title };
            const res = await fetchGeneratedStudyContent(baseTrail, type, 'google/gemini-2.5-flash', true);

            let update = {};
            if (type === 'study' && (res?.studyMaterial || res?.studyContent)) update = { cachedStudy: res.studyMaterial || res.studyContent };
            else if (type === 'quiz' && res?.questions) update = { cachedQuiz: res.questions };
            else if (type === 'anki' && (res?.cards || res?.flashcards)) update = { cachedAnki: res.cards || res.flashcards };
            else throw new Error("A IA não retornou o conteúdo esperado.");

            await updateSchoolTrail(selectedSchool.id, subject.id, update);
            setActionMessage(`✅ ${typeLabels[type]} de "${subject.title}" regenerado com sucesso!`);
            logAdminAction(user, 'regenerate_school_content', `${typeLabels[type]} regenerado: "${subject.title}" em ${selectedSchool.name}`);
            await handleOpenSchoolSubjects(selectedSchool);
        } catch (err) {
            console.error("Erro ao regenerar conteúdo:", err);
            setActionMessage("Erro ao regenerar conteúdo: " + err.message);
        } finally {
            setIsGeneratingPack(false);
            setGeneratingTrailId(null);
            setPackStepMessage('');
        }
    };

    const handleDeleteSchoolSubject = async (subject) => {
        if (!selectedSchool) return;
        if (!window.confirm(`Excluir a matéria "${subject.title}" de ${selectedSchool.name}?`)) return;
        try {
            await deleteSchoolTrail(selectedSchool.id, subject.id);
            setActionMessage(`Matéria "${subject.title}" excluída com sucesso!`);
            logAdminAction(user, 'delete_school_subject', `Matéria: "${subject.title}" em ${selectedSchool.name}`);
            await handleOpenSchoolSubjects(selectedSchool);
        } catch (err) {
            setActionMessage("Erro ao excluir matéria: " + err.message);
        }
    };

    // Ações em Massa para Usuários Selecionados
    const handleSelectAllUsersToggle = (e) => {
        if (e.target.checked) {
            setSelectedUserUids(filteredUsers.map(u => u.uid));
        } else {
            setSelectedUserUids([]);
        }
    };

    const handleToggleUserSelection = (uid) => {
        setSelectedUserUids(prev => 
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const handleBatchAction = async (actionType, value) => {
        if (selectedUserUids.length === 0) return;

        const confirmMsg = `Deseja aplicar a ação "${actionType}" em ${selectedUserUids.length} usuário(s) selecionado(s)?`;
        if (!window.confirm(confirmMsg)) return;

        try {
            const promises = selectedUserUids.map(uid => {
                const targetUser = usersList.find(u => u.uid === uid);
                if (!targetUser || (isOwnerAdmin(targetUser) && (actionType === 'block' || actionType === 'delete'))) {
                    return Promise.resolve(); // Dono inalterável
                }

                let updates = {};
                if (actionType === 'addXp') {
                    updates = { xp: (targetUser.xp || 0) + (value || 50) };
                } else if (actionType === 'resetHearts') {
                    updates = { hearts: targetUser.customMaxHearts || 5 };
                } else if (actionType === 'resetDailyLimits') {
                    updates = { dailyRefreshes: 0, dailyTrailCreations: 0 };
                } else if (actionType === 'setUnlimited') {
                    updates = { isUnlimited: value };
                } else if (actionType === 'setBlocked') {
                    updates = { isBlocked: value };
                }

                return updateAdminUserSettings(uid, updates);
            });

            await Promise.all(promises);
            setActionMessage(`Ação em massa "${actionType}" executada em ${selectedUserUids.length} usuário(s)!`);
            setSelectedUserUids([]);
            await loadUsers();
            setTimeout(() => setActionMessage(''), 3500);
        } catch (err) {
            console.error("Erro em ação em massa:", err);
            setActionMessage("Erro ao executar ação em massa: " + err.message);
        }
    };

    // Salvar Aviso do Sistema
    const handleSaveAnnouncementForm = async (e) => {
        e.preventDefault();
        setIsSavingAnnouncement(true);
        try {
            await saveSystemAnnouncement(announcementForm);
            setActionMessage("Aviso global do sistema atualizado com sucesso!");
            setTimeout(() => setActionMessage(''), 3000);
        } catch (err) {
            console.error("Erro ao salvar aviso:", err);
            setActionMessage("Erro ao salvar aviso: " + err.message);
        } finally {
            setIsSavingAnnouncement(false);
        }
    };

    // Salvar Configurações de IA
    const handleSaveAiConfigForm = async (e) => {
        e.preventDefault();
        setIsSavingAiConfig(true);
        try {
            await saveAiSettings(aiConfigForm);
            setActionMessage("Configurações de IA e Prompts salvas com sucesso!");
            setTimeout(() => setActionMessage(''), 3000);
        } catch (err) {
            console.error("Erro ao salvar IA config:", err);
            setActionMessage("Erro ao salvar configurações de IA: " + err.message);
        } finally {
            setIsSavingAiConfig(false);
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
        setModalUserTab('settings');
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

    // Filtros e Ordenação de Usuários
    const filteredUsers = usersList.filter(u => {
        const term = searchTerm.toLowerCase();
        const matchesTerm = (
            (u.displayName && u.displayName.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.uid && u.uid.toLowerCase().includes(term))
        );

        if (!matchesTerm) return false;

        if (userRoleFilter === 'admin') {
            return isOwnerAdmin(u) || u.isAdmin || checkIsAdmin(u);
        }
        if (userRoleFilter === 'unlimited') {
            return u.isUnlimited || isOwnerAdmin(u) || checkIsAdmin(u);
        }
        if (userRoleFilter === 'blocked') {
            return u.isBlocked;
        }

        return true;
    }).sort((a, b) => {
        if (userSortBy === 'xp') {
            return (b.xp || 0) - (a.xp || 0);
        }
        if (userSortBy === 'hearts') {
            return (b.hearts ?? 5) - (a.hearts ?? 5);
        }
        if (userSortBy === 'email') {
            return (a.email || '').localeCompare(b.email || '');
        }
        return (a.displayName || a.email || a.uid || '').localeCompare(b.displayName || b.email || b.uid || '');
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
                        <span>⚙️ Painel de Administração Avançado</span>
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gerencie administradores, permissões, aviso global, configurações de IA e conteúdos oficiais.
                    </p>
                </div>
                <button
                    onClick={handleReturnHome}
                    className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-800 dark:text-slate-100 font-bold py-2.5 px-5 rounded-xl transition-colors text-sm"
                >
                    ← Sair do Admin
                </button>
            </div>

            {/* Mensagem de Ação */}
            {actionMessage && (
                <div className="w-full p-4 mb-6 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-semibold rounded-2xl text-center animate-slide-in-bottom">
                    {actionMessage}
                </div>
            )}

            {/* Métricas Globais Rápidas */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full mb-6">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
                        👥
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total Usuários</p>
                        <p className="text-xl font-extrabold text-slate-800 dark:text-white">{totalUsers}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/60 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl font-bold">
                        🌐
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Trilhas Globais</p>
                        <p className="text-xl font-extrabold text-slate-800 dark:text-white">{globalTrails.length}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/60 text-green-600 dark:text-green-400 flex items-center justify-center text-xl font-bold">
                        ⚡
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acesso Ilimitado</p>
                        <p className="text-xl font-extrabold text-slate-800 dark:text-white">{unlimitedUsers}</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 flex items-center justify-center text-xl font-bold">
                        🚫
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Bloqueados</p>
                        <p className="text-xl font-extrabold text-slate-800 dark:text-white">{blockedUsers}</p>
                    </div>
                </div>
            </div>

            {/* Navegação por Abas Principais */}
            <div className="w-full flex overflow-x-auto no-scrollbar flex-nowrap sm:flex-wrap bg-slate-100 dark:bg-gray-800 p-1.5 rounded-2xl mb-6 border border-slate-200 dark:border-gray-700 gap-1 select-none">
                <button
                    onClick={() => setActiveTab('globals')}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'globals' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>🌐 Trilhas Globais</span>
                    <span className="bg-indigo-950 text-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-mono">{globalTrails.length}</span>
                </button>
                <button
                    onClick={() => setActiveTab('users')}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>👥 Alunos ({totalUsers})</span>
                </button>
                <button
                    onClick={() => { setActiveTab('schools'); loadSchoolsList(); }}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'schools' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>🏫 Escolas ({schoolsList.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('announcements')}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'announcements' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>📣 Avisos</span>
                </button>
                <button
                    onClick={() => setActiveTab('aiConfig')}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'aiConfig' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>🤖 IA & Prompts</span>
                </button>
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>📊 Analytics</span>
                </button>
                <button
                    onClick={() => { setActiveTab('audit'); loadAuditLogsList(); }}
                    className={`py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap flex-shrink-0 sm:flex-1 ${activeTab === 'audit' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                >
                    <span>📋 Auditoria</span>
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
                                Crie e edite conteúdos unificados para todos os alunos com material teórico, simulados, flashcards Anki e exportação/importação JSON.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <label className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-3 px-4 rounded-2xl transition-all text-xs sm:text-sm shadow-md cursor-pointer flex items-center gap-2">
                                <span>📤 Importar JSON</span>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImportTrailJSON}
                                    className="hidden"
                                />
                            </label>

                            <button
                                onClick={() => {
                                    const next = !hideAwsTopic;
                                    setHideAwsTopic(next);
                                    setHideAwsTopicSetting(next);
                                    if (reloadTrails) reloadTrails();
                                    setActionMessage(`Trilha oficial de exemplo da AWS ${next ? 'OCULTADA' : 'EXIBIDA'} na tela inicial dos alunos!`);
                                }}
                                className={`py-3 px-4 rounded-2xl transition-all text-xs sm:text-sm font-extrabold flex items-center gap-2 border shadow-sm ${
                                    hideAwsTopic 
                                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800' 
                                        : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                                }`}
                                title="Ocultar ou exibir a trilha de exemplo da AWS na página inicial"
                            >
                                <span>{hideAwsTopic ? '👁️ Exemplo AWS Ocultado' : '☁️ Ocultar Exemplo AWS'}</span>
                            </button>

                            <button
                                onClick={() => {
                                    setEditingGlobalTrail(null);
                                    setGlobalForm({ title: '', topic: 'Matemática', icon: '', description: '', allowUserExpansion: true, published: true });
                                    setShowGlobalModal(true);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-5 rounded-2xl transition-all text-xs sm:text-sm shadow-md flex items-center gap-2"
                            >
                                <span>+ Nova Trilha Global</span>
                            </button>
                        </div>
                    </div>

                    {loadingGlobals ? (
                        <LoadingScreen text="Carregando trilhas globais..." />
                    ) : globalTrails.length === 0 ? (
                        <div className="w-full bg-white dark:bg-gray-800 p-12 rounded-3xl text-center text-slate-400 border border-slate-200 dark:border-gray-700">
                            Nenhuma trilha global criada ainda. Clique no botão acima para disponibilizar um material oficial para todos os alunos ou importe um JSON.
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
                                                    {trail.published !== false ? '🟢 Publicada' : '🟡 Rascunho'}
                                                </span>

                                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${trail.allowUserExpansion !== false ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800' : 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800'}`}>
                                                    {trail.allowUserExpansion !== false ? '🔓 Alunos Podem Aprofundar (IA)' : '🔒 Trilha Travada (Sem IA)'}
                                                </span>

                                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                                                    {trail.topic || 'Geral'}
                                                </span>
                                            </div>

                                            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white leading-tight flex items-center gap-2">
                                                <span>{trail.icon || resolveTopicIcon(trail.topic, '')}</span>
                                                <span>{trail.title}</span>
                                            </h3>

                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                                {trail.description || 'Sem descrição cadastrada.'}
                                            </p>

                                            {/* Status do Pacote de Conteúdo */}
                                            <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900/80 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                                                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Pacote de Conteúdo Oficial:</span>
                                                <div className="flex items-center gap-3 text-[11px] flex-wrap">
                                                    <span className={trail.cachedStudy ? 'text-emerald-500 font-bold' : 'text-slate-400'}>
                                                        {trail.cachedStudy ? '✅ Teoria Pronta' : '❌ Sem Teoria'}
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
                                        <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-slate-100 dark:border-gray-700">
                                            <button
                                                onClick={() => handleGenerateGlobalPack(trail)}
                                                disabled={isGenerating}
                                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition-all disabled:opacity-50 flex items-center gap-1 shadow-sm flex-1 justify-center min-w-[130px]"
                                                title="Gerar automaticamente o Material de Estudo, Simulados e Flashcards com IA"
                                            >
                                                {isGenerating ? (
                                                    <span className="animate-pulse">⚡ Gerando...</span>
                                                ) : (
                                                    <span>⚡ {hasPack ? 'Regerar Pacote IA' : 'Gerar Pacote IA'}</span>
                                                )}
                                            </button>

                                            <button
                                                onClick={() => setEditingTheoryTrail(trail)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition-colors shadow-sm"
                                                title="Editar manualmente o texto Markdown do material teórico"
                                            >
                                                📖 Teoria
                                            </button>

                                            <button
                                                onClick={() => setEditingQuizTrail(trail)}
                                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2 px-3 rounded-xl text-xs transition-colors shadow-sm"
                                                title="Criar ou editar manualmente os exercícios e alternativas"
                                            >
                                                📝 Quiz ({trail.cachedQuiz?.length || 0})
                                            </button>

                                            <button
                                                onClick={() => setEditingAnkiTrail(trail)}
                                                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold py-2 px-3 rounded-xl text-xs transition-colors shadow-sm"
                                                title="Editar cartões de memorização espaçada Anki"
                                            >
                                                🧠 Anki ({trail.cachedAnki?.length || 0})
                                            </button>

                                            <button
                                                onClick={() => handleExportTrailJSON(trail)}
                                                className="bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                                                title="Baixar cópia de segurança em arquivo .json"
                                            >
                                                📥 JSON
                                            </button>

                                            <button
                                                onClick={() => handleToggleGlobalPublish(trail)}
                                                className="bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                                                title="Alternar visibilidade para todos os alunos"
                                            >
                                                {trail.published !== false ? '👁️ Despublicar' : '🟢 Publicar'}
                                            </button>

                                            <button
                                                onClick={() => {
                                                    setEditingGlobalTrail(trail);
                                                    setGlobalForm({
                                                        title: trail.title || '',
                                                        topic: trail.topic || 'Matemática',
                                                        icon: trail.icon || '',
                                                        description: trail.description || '',
                                                        allowUserExpansion: trail.allowUserExpansion !== false,
                                                        published: trail.published !== false
                                                    });
                                                    setShowGlobalModal(true);
                                                }}
                                                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2 px-3 rounded-xl text-xs transition-colors"
                                            >
                                                ✏️ Dados
                                            </button>

                                            <button
                                                onClick={() => handleDeleteGlobalTrailItem(trail)}
                                                className="bg-rose-950 text-rose-300 hover:bg-rose-900 border border-rose-800 font-bold py-2 px-3 rounded-xl text-xs transition-colors"
                                            >
                                                🗑️
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
                    {/* Filtros, Pesquisa e Ordenação */}
                    <div className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl shadow border border-slate-100 dark:border-gray-700 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        <input
                            type="text"
                            placeholder="Pesquisar por nome, e-mail ou UID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-grow p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />

                        <div className="flex items-center gap-2 flex-wrap">
                            <select
                                value={userRoleFilter}
                                onChange={(e) => setUserRoleFilter(e.target.value)}
                                className="p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                            >
                                <option value="all">Filtro: Todos</option>
                                <option value="admin">⭐ Admins</option>
                                <option value="unlimited">⚡ Ilimitados</option>
                                <option value="blocked">🚫 Bloqueados</option>
                            </select>

                            <select
                                value={userSortBy}
                                onChange={(e) => setUserSortBy(e.target.value)}
                                className="p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                            >
                                <option value="name">Ordem: Nome</option>
                                <option value="email">Ordem: E-mail</option>
                                <option value="xp">Ordem: XP (Maior)</option>
                                <option value="hearts">Ordem: Vidas</option>
                            </select>

                            <button
                                onClick={loadUsers}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-colors text-xs flex items-center justify-center gap-1.5"
                            >
                                🔄 Recarregar
                            </button>
                        </div>
                    </div>

                    {/* Barra de Ações em Massa quando há itens selecionados */}
                    {selectedUserUids.length > 0 && (
                        <div className="w-full p-4 bg-indigo-900 text-white rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                            <span className="font-extrabold text-xs">
                                📌 {selectedUserUids.length} usuário(s) selecionado(s)
                            </span>

                            <div className="flex items-center gap-2 flex-wrap text-xs">
                                <button
                                    onClick={() => handleBatchAction('addXp', 50)}
                                    className="bg-indigo-600 hover:bg-indigo-500 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    +50 XP
                                </button>
                                <button
                                    onClick={() => handleBatchAction('resetHearts')}
                                    className="bg-red-600 hover:bg-red-500 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    ❤️ Encher Vidas
                                </button>
                                <button
                                    onClick={() => handleBatchAction('resetDailyLimits')}
                                    className="bg-amber-600 hover:bg-amber-500 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    🔄 Resetar Limites
                                </button>
                                <button
                                    onClick={() => handleBatchAction('setUnlimited', true)}
                                    className="bg-emerald-600 hover:bg-emerald-500 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    ⚡ Conceder Ilimitado
                                </button>
                                <button
                                    onClick={() => handleBatchAction('setBlocked', true)}
                                    className="bg-rose-700 hover:bg-rose-600 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    🚫 Bloquear
                                </button>
                                <button
                                    onClick={() => setSelectedUserUids([])}
                                    className="bg-slate-700 hover:bg-slate-600 font-bold px-3 py-1.5 rounded-lg transition-colors"
                                >
                                    Limpar Seleção
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tabela de Usuários */}
                    {loadingUsers ? (
                        <LoadingScreen text="Carregando lista de usuários do Firestore..." />
                    ) : filteredUsers.length === 0 ? (
                        <div className="w-full bg-white dark:bg-gray-800 p-8 rounded-2xl text-center text-slate-500 border border-slate-200 dark:border-gray-700">
                            Nenhum usuário encontrado com os filtros aplicados.
                        </div>
                    ) : (
                        <div className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow border border-slate-100 dark:border-gray-700 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 dark:bg-gray-900/80 text-slate-400 font-bold uppercase tracking-wider text-xs border-b border-slate-100 dark:border-gray-700">
                                        <tr>
                                            <th className="p-4 w-10 text-center">
                                                <input
                                                    type="checkbox"
                                                    onChange={handleSelectAllUsersToggle}
                                                    checked={selectedUserUids.length === filteredUsers.length && filteredUsers.length > 0}
                                                    className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                />
                                            </th>
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
                                            const isSelected = selectedUserUids.includes(u.uid);

                                            return (
                                                <tr key={u.uid} className={`hover:bg-slate-50/50 dark:hover:bg-gray-700/30 transition-colors ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''}`}>
                                                    <td className="p-4 text-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleUserSelection(u.uid)}
                                                            className="w-4 h-4 rounded accent-indigo-600 cursor-pointer"
                                                        />
                                                    </td>

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
                                                                    {isOwner && <span className="text-xs bg-amber-100 dark:bg-amber-900/70 text-amber-800 dark:text-amber-200 font-extrabold px-2 py-0.5 rounded-full">👑 Dono (Protegido)</span>}
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
                                                                    🚫 Bloqueado
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
                                                                    {isBlk ? '🔓' : '🚫'}
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

            {/* ABA MULTI-TENANT: COLÉGIOS, PROFESSORES & MATÉRIAS */}
            {activeTab === 'schools' && (
                <div className="w-full flex flex-col gap-6">
                    <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                <span>🏫 Gerenciamento de Colégios, Professores & Sessões (/colegio)</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                Cadastre colégios/instituições, atribua professores e gerencie matérias específicas por turma/escola.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                setSchoolForm({ name: '', code: Math.random().toString(36).substring(2, 8).toUpperCase(), teacherEmail: '' });
                                setShowSchoolModal(true);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-5 rounded-2xl transition-all text-xs sm:text-sm shadow-md flex items-center gap-2"
                        >
                            <span>+ Cadastrar Novo Colégio</span>
                        </button>
                    </div>

                    {loadingSchools ? (
                        <LoadingScreen text="Carregando instituições e colégios..." />
                    ) : schoolsList.length === 0 ? (
                        <div className="w-full bg-white dark:bg-gray-800 p-12 rounded-3xl text-center text-slate-400 border border-slate-200 dark:border-gray-700">
                            Nenhum colégio cadastrado ainda. Clique no botão acima para registrar a primeira instituição ou escola particular.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            {schoolsList.map((sc) => (
                                <div key={sc.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col justify-between gap-4">
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <span className="text-[10px] font-mono font-extrabold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                                                CÓDIGO: {sc.code}
                                            </span>
                                            <span className="text-xs text-slate-400 font-bold">
                                                {sc.studentUids?.length || 0} Aluno(s) Matriculado(s)
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                            <span>🏫</span>
                                            <span>{sc.name}</span>
                                        </h3>

                                        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                                            <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Professores Responsáveis:</span>
                                            {sc.teacherEmails && sc.teacherEmails.length > 0 ? (
                                                <p className="text-[11px] text-indigo-500 font-semibold">{sc.teacherEmails.join(', ')}</p>
                                            ) : (
                                                <p className="text-[11px] text-slate-400 italic">Sem professores vinculados especificamente.</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-3 border-t border-slate-100 dark:border-gray-700">
                                        <button
                                            onClick={() => {
                                                handleOpenSchoolSubjects(sc);
                                                setShowSubjectModal(true);
                                            }}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs transition-all shadow-sm flex-1 justify-center flex items-center gap-1"
                                        >
                                            <span>📚 Gerenciar Matérias (/colegio/materia)</span>
                                        </button>
                                        <button
                                            onClick={async () => {
                                                if (window.confirm(`Tem certeza que deseja excluir o colégio "${sc.name}"?`)) {
                                                    await deleteSchool(sc.id);
                                                    await loadSchoolsList();
                                                }
                                            }}
                                            className="bg-rose-950 text-rose-300 border border-rose-800 font-bold p-2 rounded-xl text-xs hover:bg-rose-900 transition-colors"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ABA 3: AVISOS E BANNERS DO SISTEMA */}
            {activeTab === 'announcements' && (
                <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                            <span>📣 Comunicado / Banner Global do Sistema</span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Configure uma mensagem importante que será exibida no topo da página inicial de todos os alunos.
                        </p>
                    </div>

                    <form onSubmit={handleSaveAnnouncementForm} className="flex flex-col gap-5">
                        <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700">
                            <div>
                                <h4 className="font-extrabold text-sm text-slate-800 dark:text-white">Status do Banner</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Ativar ou desativar exibição aos alunos.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={announcementForm.active}
                                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, active: e.target.checked }))}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            </label>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Título do Aviso</label>
                                <input
                                    type="text"
                                    placeholder="Ex: 🚀 Nova Atualização de Conteúdo!"
                                    value={announcementForm.title}
                                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-semibold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Estilo do Banner</label>
                                <select
                                    value={announcementForm.type}
                                    onChange={(e) => setAnnouncementForm(prev => ({ ...prev, type: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-semibold"
                                >
                                    <option value="info">🔷 Informativo (Azul/Índigo)</option>
                                    <option value="warning">⚠️ Alerta / Atenção (Amarelo)</option>
                                    <option value="success">🎉 Novidade / Sucesso (Verde)</option>
                                    <option value="alert">🚨 Importante / Urgente (Vermelho)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Mensagem aos Alunos *</label>
                            <textarea
                                rows="3"
                                required
                                placeholder="Digite a mensagem que aparecerá no topo do aplicativo..."
                                value={announcementForm.message}
                                onChange={(e) => setAnnouncementForm(prev => ({ ...prev, message: e.target.value }))}
                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-semibold resize-none"
                            />
                        </div>

                        {/* Live Preview */}
                        <div>
                            <span className="block text-xs font-extrabold uppercase text-slate-400 mb-2">Pré-visualização do Banner:</span>
                            <div className={`p-4 rounded-2xl border text-left flex items-start justify-between gap-3 ${
                                announcementForm.type === 'warning'
                                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
                                    : announcementForm.type === 'success'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                                    : announcementForm.type === 'alert'
                                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                                    : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-900 dark:text-indigo-200'
                            }`}>
                                <div className="flex items-start gap-2.5">
                                    <span className="text-xl">
                                        {announcementForm.type === 'warning' ? '⚠️' : announcementForm.type === 'success' ? '🎉' : announcementForm.type === 'alert' ? '🚨' : '📣'}
                                    </span>
                                    <div>
                                        {announcementForm.title && (
                                            <h4 className="font-extrabold text-xs uppercase tracking-wider mb-0.5 opacity-90">
                                                {announcementForm.title}
                                            </h4>
                                        )}
                                        <p className="text-xs sm:text-sm font-semibold leading-relaxed">
                                            {announcementForm.message || 'Sua mensagem aparecerá aqui...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSavingAnnouncement}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition-colors text-sm self-end disabled:opacity-50"
                        >
                            {isSavingAnnouncement ? '💾 Salvando...' : '💾 Salvar e Publicar Aviso'}
                        </button>
                    </form>
                </div>
            )}

            {/* ABA 4: CONFIGURAÇÕES DE IA & PROMPTS */}
            {activeTab === 'aiConfig' && (
                <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col gap-6">
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                            <span>🤖 Configurações Globais de IA & Prompts</span>
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Ajuste as diretrizes e regras pedagógicas enviadas para os modelos de IA ao gerarem materiais de estudo, simulados e respostas do bot.
                        </p>
                    </div>

                    <form onSubmit={handleSaveAiConfigForm} className="flex flex-col gap-5">
                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                                Diretrizes para Geração de Conteúdo Teórico (Markdown)
                            </label>
                            <textarea
                                rows="3"
                                placeholder="Ex: Sempre inclua exemplos em código Python e tabelas comparativas. Seja objetivo e didático."
                                value={aiConfigForm.studyInstructions}
                                onChange={(e) => setAiConfigForm(prev => ({ ...prev, studyInstructions: e.target.value }))}
                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                                Diretrizes para Simulados & Quizzes
                            </label>
                            <textarea
                                rows="3"
                                placeholder="Ex: Crie pegadinhas realistas de provas de certificação. Explique o motivo exato pelo qual as alternativas incorretas estão erradas."
                                value={aiConfigForm.quizInstructions}
                                onChange={(e) => setAiConfigForm(prev => ({ ...prev, quizInstructions: e.target.value }))}
                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                                Diretrizes para Flashcards Anki
                            </label>
                            <textarea
                                rows="3"
                                placeholder="Ex: Mantenha perguntas curtas e diretas na frente. No verso, dê uma resposta em bullets de no máximo 3 linhas."
                                value={aiConfigForm.ankiInstructions}
                                onChange={(e) => setAiConfigForm(prev => ({ ...prev, ankiInstructions: e.target.value }))}
                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">
                                Persona & Instruções do StudyBot (Chat)
                            </label>
                            <textarea
                                rows="3"
                                placeholder="Ex: Você é o StudyBot, um tutor amigável e entusiasmado. Incentive o aluno com emojis e dê explicações curtas."
                                value={aiConfigForm.botPersona}
                                onChange={(e) => setAiConfigForm(prev => ({ ...prev, botPersona: e.target.value }))}
                                className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-mono"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSavingAiConfig}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-6 rounded-2xl shadow-lg transition-colors text-sm self-end disabled:opacity-50"
                        >
                            {isSavingAiConfig ? '💾 Salvando...' : '💾 Salvar Diretrizes de IA'}
                        </button>
                    </form>

                    {/* AI Sandbox / Playground de Testes em Tempo Real */}
                    <div className="pt-6 border-t border-slate-100 dark:border-gray-700">
                        <div className="mb-4">
                            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                <span>🧪 AI Sandbox & Playground de Testes</span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Teste requisições à IA em tempo real para verificar a qualidade do JSON gerado antes de publicar trilhas para alunos.
                            </p>
                        </div>

                        <form onSubmit={handleRunAiSandbox} className="flex flex-col gap-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2">
                                    <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Tópico de Teste</label>
                                    <input
                                        type="text"
                                        value={sandboxTopic}
                                        onChange={(e) => setSandboxTopic(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                                        placeholder="Ex: Arquitetura de Microserviços na AWS"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-extrabold uppercase text-slate-400 mb-1">Tipo de Conteúdo</label>
                                    <select
                                        value={sandboxType}
                                        onChange={(e) => setSandboxType(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                                    >
                                        <option value="study">📖 Material Teórico</option>
                                        <option value="quiz">📝 Quiz / Simulado</option>
                                        <option value="anki">🧠 Flashcards Anki</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isTestingSandbox}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold py-3 px-5 rounded-xl text-xs shadow-md transition-all self-start flex items-center gap-1.5 disabled:opacity-50"
                            >
                                {isTestingSandbox ? '⚡ Testando IA...' : '🧪 Executar Teste na IA'}
                            </button>
                        </form>

                        {/* Resultado do Teste */}
                        {sandboxResult && (
                            <div className="mt-4 p-4 bg-slate-900 rounded-2xl border border-slate-800 text-left font-mono text-xs text-indigo-300">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-[11px] text-slate-400">
                                    <span>Resultado JSON ({sandboxTimeMs}ms)</span>
                                    <button onClick={() => setSandboxResult(null)} className="hover:text-white">✕</button>
                                </div>
                                <pre className="max-h-60 overflow-y-auto custom-scrollbar text-[11px] text-slate-200 whitespace-pre-wrap">
                                    {JSON.stringify(sandboxResult, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ABA 5: ANALYTICS & MÉTRICAS DE DESEMPENHO */}
            {activeTab === 'analytics' && (
                <div className="w-full flex flex-col gap-6">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border border-slate-100 dark:border-gray-700">
                        <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mb-4">
                            📊 Analytics & Visão Geral da Plataforma
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700">
                                <span className="text-xs font-bold text-slate-400 block uppercase">Média de XP por Aluno</span>
                                <span className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                                    {totalUsers > 0 ? Math.round(usersList.reduce((acc, u) => acc + (u.xp || 0), 0) / totalUsers) : 0} XP
                                </span>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700">
                                <span className="text-xs font-bold text-slate-400 block uppercase">Trilhas Globais com Teoria OK</span>
                                <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
                                    {globalTrails.filter(t => t.cachedStudy).length} / {globalTrails.length}
                                </span>
                            </div>

                            <div className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700">
                                <span className="text-xs font-bold text-slate-400 block uppercase">Trilhas Globais com Quizzes OK</span>
                                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                                    {globalTrails.filter(t => t.cachedQuiz?.length > 0).length} / {globalTrails.length}
                                </span>
                            </div>
                        </div>

                        {/* Top 5 Alunos com Mais XP */}
                        <div>
                            <h3 className="font-extrabold text-sm text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-3">
                                🏆 Top 5 Alunos com Maior XP
                            </h3>
                            <div className="space-y-2">
                                {[...usersList].sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 5).map((u, idx) => (
                                    <div key={u.uid} className="p-3 bg-slate-50 dark:bg-gray-900 rounded-xl flex items-center justify-between text-xs font-bold border border-slate-200 dark:border-gray-700">
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                                                #{idx + 1}
                                            </span>
                                            <span className="text-slate-800 dark:text-white">{u.displayName || u.email || u.uid}</span>
                                        </div>
                                        <span className="text-indigo-600 dark:text-indigo-400">{u.xp || 0} XP</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ABA 6: LOGS DE AUDITORIA DO ADMIN */}
            {activeTab === 'audit' && (
                <div className="w-full bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border border-slate-100 dark:border-gray-700 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                <span>📋 Histórico & Logs de Auditoria</span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Registro transparente de todas as ações administrativas realizadas no sistema.
                            </p>
                        </div>
                        <button
                            onClick={loadAuditLogsList}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-xl transition-colors text-xs"
                        >
                            🔄 Atualizar Logs
                        </button>
                    </div>

                    {loadingAuditLogs ? (
                        <LoadingScreen text="Carregando histórico de auditoria..." />
                    ) : auditLogsList.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 border border-slate-200 dark:border-gray-700 rounded-2xl">
                            Nenhum log de auditoria registrado ainda.
                        </div>
                    ) : (
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                            {auditLogsList.map((log) => (
                                <div key={log.id} className="p-3 bg-slate-50 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 flex items-center justify-between text-xs">
                                    <div>
                                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400 mr-2">
                                            [{log.actionType}]
                                        </span>
                                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                                            {log.details}
                                        </span>
                                        <span className="block text-[10px] text-slate-400 mt-0.5">
                                            Por: {log.adminName} ({log.adminEmail})
                                        </span>
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                                        {log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000).toLocaleString('pt-BR') : 'Agora'}
                                    </span>
                                </div>
                            ))}
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
                                onClick={() => setModalUserTab('settings')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${modalUserTab === 'settings' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                ⚙️ Editar Dados & Limites
                            </button>
                            <button
                                onClick={() => setModalUserTab('materials')}
                                className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${modalUserTab === 'materials' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                            >
                                📚 Trilhas & Materiais ({userDataModal.trails.length})
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-grow">
                            {modalUserTab === 'settings' ? (
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
                                            <span>🎛️ Personalização de Limites do Usuário</span>
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
                                            <span>🗺️ Trilhas Criadas pelo Usuário</span>
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
                                            <span>📑 Materiais & Quizzes em Cache</span>
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
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1 flex items-center justify-between">
                                    <span>🎨 Ícone Visual do Tópico (Opcional)</span>
                                    <span className="text-indigo-500 font-extrabold text-[11px]">
                                        {globalForm.icon ? globalForm.icon : `Auto: ${resolveTopicIcon(globalForm.topic, '')}`}
                                    </span>
                                </label>
                                <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 max-h-28 overflow-y-auto custom-scrollbar">
                                    {TOPIC_ICON_OPTIONS.map((item) => {
                                        const isSelected = globalForm.icon === item.icon;
                                        return (
                                            <button
                                                type="button"
                                                key={item.icon}
                                                onClick={() => setGlobalForm(prev => ({ ...prev, icon: isSelected ? '' : item.icon }))}
                                                className={`p-1.5 text-lg sm:text-xl rounded-lg transition-all border flex items-center justify-center ${
                                                    isSelected 
                                                        ? 'bg-indigo-600 border-indigo-500 scale-105 shadow text-white' 
                                                        : 'bg-white dark:bg-gray-800 border-slate-200 dark:border-gray-700 hover:bg-slate-200 dark:hover:bg-gray-700'
                                                }`}
                                                title={item.label}
                                            >
                                                {item.icon}
                                            </button>
                                        );
                                    })}
                                </div>
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
                                        🟢 Publicar imediatamente para todos os alunos
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

            {/* Modal de Edição Manual Teórica */}
            {editingTheoryTrail && (
                <TheoryEditorModal
                    trail={editingTheoryTrail}
                    onClose={() => setEditingTheoryTrail(null)}
                    onSave={handleSaveTheoryContent}
                />
            )}

            {/* Modal de Edição Manual de Exercícios pelo Admin */}
            {editingQuizTrail && (
                <QuizEditorModal
                    trail={editingQuizTrail}
                    onClose={() => setEditingQuizTrail(null)}
                    onSave={handleSaveQuizQuestions}
                />
            )}

            {/* Modal de Edição Manual de Cartões Anki */}
            {editingAnkiTrail && (
                <AnkiEditorModal
                    trail={editingAnkiTrail}
                    onClose={() => setEditingAnkiTrail(null)}
                    onSave={handleSaveAnkiCards}
                />
            )}

            {/* Overlay de Geração de Conteúdo IA do Admin */}
            {isGeneratingPack && (
                <LoadingScreen
                    text="⚡ Gerando Pacote Completo com IA"
                    subtext={packStepMessage || "Por favor, aguarde alguns instantes enquanto a IA constrói o material de estudo, simulados e flashcards..."}
                />
            )}

            {/* Modal de Cadastro de Colégio / Escola */}
            {showSchoolModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-lg p-6 flex flex-col gap-4 border border-slate-100 dark:border-gray-700">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-gray-700">
                            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                                <span>🏫 Cadastrar Novo Colégio / Instituição</span>
                            </h3>
                            <button onClick={() => setShowSchoolModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
                        </div>

                        <form onSubmit={handleSaveSchool} className="flex flex-col gap-4">
                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Nome da Instituição / Escola *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Colégio Visão ou Curso de Inglês Prof. Ana"
                                    value={schoolForm.name}
                                    onChange={(e) => setSchoolForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-bold"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">Código de Acesso Único (Alunos)</label>
                                <input
                                    type="text"
                                    placeholder="Ex: VIS2025"
                                    value={schoolForm.code}
                                    onChange={(e) => setSchoolForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-mono font-bold uppercase"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-extrabold uppercase text-slate-500 mb-1">E-mail do Professor Responsável (Opcional)</label>
                                <input
                                    type="email"
                                    placeholder="Ex: professor@colegio.com"
                                    value={schoolForm.teacherEmail}
                                    onChange={(e) => setSchoolForm(prev => ({ ...prev, teacherEmail: e.target.value }))}
                                    className="w-full p-3 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-sm font-bold"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setShowSchoolModal(false)} className="bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs">Cancelar</button>
                                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-lg">💾 Salvar Colégio</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Matérias do Colégio (/colegio/materia) */}
            {showSubjectModal && selectedSchool && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl p-6 flex flex-col gap-4 border border-slate-100 dark:border-gray-700 max-h-[90vh] overflow-hidden">
                        <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-gray-700">
                            <div>
                                <span className="text-[10px] font-extrabold text-indigo-500 uppercase">Colégio: {selectedSchool.name}</span>
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white">📚 Matérias & Conteúdos Exclusivos (/colegio/materia)</h3>
                            </div>
                            <button onClick={() => setShowSubjectModal(false)} className="text-slate-400 hover:text-slate-600 text-lg font-bold">✕</button>
                        </div>

                        {/* Form rápida de nova matéria */}
                        <form onSubmit={handleSaveSchoolSubject} className="p-4 bg-slate-50 dark:bg-gray-900 rounded-2xl border border-slate-200 dark:border-gray-700 flex flex-col gap-3">
                            <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 uppercase">+ Adicionar Matéria para {selectedSchool.name}</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <input
                                    type="text"
                                    required
                                    placeholder="Nome da Matéria (Ex: Física II)"
                                    value={subjectForm.title}
                                    onChange={(e) => setSubjectForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="p-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                                />
                                <input
                                    type="text"
                                    placeholder="Tópico / Categoria"
                                    value={subjectForm.topic}
                                    onChange={(e) => setSubjectForm(prev => ({ ...prev, topic: e.target.value }))}
                                    className="p-2.5 bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold"
                                />
                            </div>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs shadow-md self-end">
                                + Publicar Matéria no Colégio
                            </button>
                        </form>

                        {/* Lista de matérias existentes */}
                        <div className="space-y-2 overflow-y-auto max-h-80 custom-scrollbar pr-1">
                            {schoolSubjects.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-4">Nenhuma matéria criada para este colégio ainda.</p>
                            ) : (
                                schoolSubjects.map(sub => (
                                    <div key={sub.id} className="p-3 bg-slate-50 dark:bg-gray-900 rounded-xl border border-slate-200 dark:border-gray-700 space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <h5 className="font-extrabold text-xs text-slate-800 dark:text-white truncate">{sub.title}</h5>
                                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                                    <span className="text-[10px] text-indigo-500 font-bold">{sub.topic || 'Geral'}</span>
                                                    <span className={`text-[9px] font-extrabold ${sub.cachedStudy ? 'text-emerald-500' : 'text-slate-400'}`}>📖 {sub.cachedStudy ? '✔' : '✖'}</span>
                                                    <span className={`text-[9px] font-extrabold ${sub.cachedQuiz?.length ? 'text-emerald-500' : 'text-slate-400'}`}>📝 {sub.cachedQuiz?.length ? `✔ ${sub.cachedQuiz.length}q` : '✖'}</span>
                                                    <span className={`text-[9px] font-extrabold ${sub.cachedAnki?.length ? 'text-emerald-500' : 'text-slate-400'}`}>🃏 {sub.cachedAnki?.length ? `✔ ${sub.cachedAnki.length}c` : '✖'}</span>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteSchoolSubject(sub)}
                                                className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-extrabold px-2.5 py-1 rounded-lg text-[10px] flex-shrink-0"
                                                title="Excluir matéria"
                                            >
                                                🗑️
                                            </button>
                                        </div>

                                        {/* Ações de Conteúdo: Ver/Editar + Regenerar por tipo */}
                                        <div className="grid grid-cols-3 gap-1.5">
                                            <button
                                                onClick={() => setEditingTheoryTrail({ ...sub, schoolId: selectedSchool.id })}
                                                className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-sky-200 transition-colors"
                                                title="Visualizar e editar o material teórico"
                                            >
                                                📖 Teoria
                                            </button>
                                            <button
                                                onClick={() => setEditingQuizTrail({ ...sub, schoolId: selectedSchool.id })}
                                                className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-violet-200 transition-colors"
                                                title="Visualizar e editar as questões do simulado"
                                            >
                                                📝 Quiz
                                            </button>
                                            <button
                                                onClick={() => setEditingAnkiTrail({ ...sub, schoolId: selectedSchool.id })}
                                                className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-amber-200 transition-colors"
                                                title="Visualizar e editar os flashcards"
                                            >
                                                🃏 Anki
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateSchoolContent(sub, 'study')}
                                                disabled={isGeneratingPack}
                                                className="bg-sky-600 disabled:opacity-50 text-white font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-sky-700 transition-colors"
                                                title="Regenerar SOMENTE a teoria com IA"
                                            >
                                                {generatingTrailId === `${sub.id}-study` ? '⏳' : '🔄'} Teoria
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateSchoolContent(sub, 'quiz')}
                                                disabled={isGeneratingPack}
                                                className="bg-violet-600 disabled:opacity-50 text-white font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-violet-700 transition-colors"
                                                title="Regenerar SOMENTE o quiz com IA"
                                            >
                                                {generatingTrailId === `${sub.id}-quiz` ? '⏳' : '🔄'} Quiz
                                            </button>
                                            <button
                                                onClick={() => handleRegenerateSchoolContent(sub, 'anki')}
                                                disabled={isGeneratingPack}
                                                className="bg-amber-600 disabled:opacity-50 text-white font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-amber-700 transition-colors"
                                                title="Regenerar SOMENTE os flashcards com IA"
                                            >
                                                {generatingTrailId === `${sub.id}-anki` ? '⏳' : '🔄'} Anki
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => handleGenerateSchoolPack(sub)}
                                            disabled={isGeneratingPack}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px]"
                                        >
                                            {generatingTrailId === sub.id ? '⏳ Gerando Pacote Completo...' : '⚡ Gerar Pacote IA Completo (Teoria + Quiz + Anki)'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
