import React, { useState, useEffect, useCallback } from 'react';
import {
    fetchSchoolTrails,
    createSchoolTrail,
    updateSchoolTrail,
    deleteSchoolTrail,
    fetchSchoolStudents,
    fetchSchoolPerformance,
    logAdminAction
} from '../services/firebaseService';
import { fetchGeneratedStudyContent } from '../services/geminiService';
import TheoryEditorModal from './TheoryEditorModal';
import QuizEditorModal from './QuizEditorModal';
import AnkiEditorModal from './AnkiEditorModal';
import LoadingScreen from './LoadingScreen';

/**
 * Painel do Professor (Multi-Tenant): versão com escopo do Painel Admin.
 * O professor gerencia SOMENTE os colégios em que leciona:
 * - Matérias: criar, editar conteúdo (teoria/quiz/anki), regenerar com IA, excluir
 * - Alunos: lista de matriculados
 * - Desempenho: acertos/erros de cada aluno por matéria
 */
export default function TeacherPanel({ user, teacherSchools = [], handleReturnHome, reloadTrails }) {
    const [selectedSchool, setSelectedSchool] = useState(teacherSchools[0] || null);
    const [activeTab, setActiveTab] = useState('subjects'); // 'subjects' | 'students' | 'performance'

    // Garante seleção quando a lista de colégios chega de forma assíncrona
    useEffect(() => {
        if (!selectedSchool && teacherSchools.length > 0) {
            setSelectedSchool(teacherSchools[0]);
        } else if (selectedSchool && teacherSchools.length > 0 && !teacherSchools.find(s => s.id === selectedSchool.id)) {
            setSelectedSchool(teacherSchools[0]);
        }
    }, [teacherSchools, selectedSchool]);

    const [subjects, setSubjects] = useState([]);
    const [students, setStudents] = useState([]);
    const [performance, setPerformance] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [actionMessage, setActionMessage] = useState('');

    // Form de nova matéria
    const [subjectForm, setSubjectForm] = useState({ title: '', topic: '' });

    // Geração IA
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatingId, setGeneratingId] = useState(null);
    const [genStepMessage, setGenStepMessage] = useState('');

    // Editores manuais
    const [editingTheory, setEditingTheory] = useState(null);
    const [editingQuiz, setEditingQuiz] = useState(null);
    const [editingAnki, setEditingAnki] = useState(null);

    const loadSchoolData = useCallback(async (school) => {
        if (!school) return;
        setLoadingData(true);
        try {
            const [subs, studs, perf] = await Promise.all([
                fetchSchoolTrails(school.id),
                fetchSchoolStudents(school),
                fetchSchoolPerformance(school.id)
            ]);
            setSubjects(subs);
            setStudents(studs);
            setPerformance(perf);
        } catch (err) {
            console.error("Erro ao carregar dados do colégio:", err);
            setActionMessage("Erro ao carregar dados: " + err.message);
        } finally {
            setLoadingData(false);
        }
    }, []);

    useEffect(() => {
        loadSchoolData(selectedSchool);
    }, [selectedSchool, loadSchoolData]);

    // ---------- MATÉRIAS ----------
    const handleCreateSubject = async (e) => {
        e.preventDefault();
        if (!selectedSchool || !subjectForm.title) return;
        try {
            await createSchoolTrail(selectedSchool.id, {
                title: subjectForm.title,
                topic: subjectForm.topic || 'Geral',
                content: subjectForm.title,
                published: true
            });
            setActionMessage(`Matéria "${subjectForm.title}" criada com sucesso!`);
            logAdminAction(user, 'teacher_create_subject', `Matéria: "${subjectForm.title}" em ${selectedSchool.name}`);
            setSubjectForm({ title: '', topic: '' });
            await loadSchoolData(selectedSchool);
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao criar matéria: " + err.message);
        }
    };

    const handleDeleteSubject = async (subject) => {
        if (!window.confirm(`Excluir a matéria "${subject.title}"? Esta ação não pode ser desfeita.`)) return;
        try {
            await deleteSchoolTrail(selectedSchool.id, subject.id);
            setActionMessage(`Matéria "${subject.title}" excluída.`);
            logAdminAction(user, 'teacher_delete_subject', `Matéria: "${subject.title}" em ${selectedSchool.name}`);
            await loadSchoolData(selectedSchool);
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao excluir matéria: " + err.message);
        }
    };

    // ---------- GERAÇÃO IA ----------
    const generateForSubject = async (subject, types) => {
        setIsGenerating(true);
        setGeneratingId(types.length === 3 ? subject.id : `${subject.id}-${types[0]}`);
        try {
            let updates = {};
            let step = 0;
            for (const type of types) {
                step++;
                const labels = { study: 'Material Teórico', quiz: 'Simulado', anki: 'Flashcards Anki' };
                setGenStepMessage(`🔄 Etapa ${step}/${types.length}: Gerando ${labels[type]} para "${subject.title}"...`);
                const baseTrail = { ...subject, content: updates.cachedStudy || subject.cachedStudy || subject.content || subject.title };
                const res = await fetchGeneratedStudyContent(baseTrail, type, 'google/gemini-2.5-flash', true);
                if (type === 'study' && res?.studyMaterial) updates.cachedStudy = res.studyMaterial;
                else if (type === 'study' && res?.studyContent) updates.cachedStudy = res.studyContent;
                else if (type === 'quiz' && res?.questions) updates.cachedQuiz = res.questions;
                else if (type === 'anki' && (res?.flashcards || res?.cards)) updates.cachedAnki = res.flashcards || res.cards;
                else throw new Error(`A IA não retornou o conteúdo esperado para ${labels[type]}.`);
            }
            setGenStepMessage('💾 Publicando conteúdo para os alunos...');
            await updateSchoolTrail(selectedSchool.id, subject.id, { ...updates, published: true });
            setActionMessage(`✅ Conteúdo de "${subject.title}" gerado e publicado!`);
            logAdminAction(user, 'teacher_generate_content', `"${subject.title}" [${types.join(', ')}] em ${selectedSchool.name}`);
            await loadSchoolData(selectedSchool);
        } catch (err) {
            console.error("Erro na geração IA:", err);
            setActionMessage("Erro ao gerar conteúdo: " + err.message);
        } finally {
            setIsGenerating(false);
            setGeneratingId(null);
            setGenStepMessage('');
        }
    };

    // ---------- SALVAMENTO MANUAL ----------
    const saveContent = async (subject, field, value, label) => {
        try {
            await updateSchoolTrail(selectedSchool.id, subject.id, { [field]: value });
            setActionMessage(`${label} de "${subject.title}" salvo com sucesso!`);
            logAdminAction(user, 'teacher_edit_content', `${label}: "${subject.title}" em ${selectedSchool.name}`);
            await loadSchoolData(selectedSchool);
            if (reloadTrails) reloadTrails();
        } catch (err) {
            setActionMessage("Erro ao salvar: " + err.message);
            throw err;
        }
    };

    // ---------- DESEMPENHO ----------
    const performanceByStudent = {};
    performance.forEach(p => {
        if (!performanceByStudent[p.studentUid]) {
            performanceByStudent[p.studentUid] = {
                name: p.studentName,
                email: p.studentEmail,
                total: 0,
                correct: 0,
                subjects: []
            };
        }
        performanceByStudent[p.studentUid].total += p.totalAnswers || 0;
        performanceByStudent[p.studentUid].correct += p.correctAnswers || 0;
        performanceByStudent[p.studentUid].subjects.push(p);
    });

    if (!selectedSchool) {
        return (
            <div className="w-full max-w-lg bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl text-center border border-slate-200 dark:border-gray-700">
                <div className="text-5xl mb-4">🧑‍🏫</div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mb-2">Nenhum colégio vinculado</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                    Seu usuário ainda não está cadastrado como professor em nenhum colégio. Peça ao administrador para adicionar seu e-mail em uma escola.
                </p>
                <button onClick={handleReturnHome} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-sm">
                    ← Voltar para Home
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl text-left animate-fade-in pb-10">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-2xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        🧑‍🏫 Painel do Professor
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Gestão com escopo de colégio — você gerencia apenas suas escolas.
                    </p>
                </div>
                <button
                    onClick={handleReturnHome}
                    className="bg-slate-100 dark:bg-gray-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-extrabold text-xs py-2 px-4 rounded-xl transition-colors"
                >
                    ← Voltar para Home
                </button>
            </div>

            {/* Seletor de Colégio (sempre visível; essencial quando leciona em mais de um) */}
            <div className="mb-4">
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1.5">
                    🏫 Colégio em gestão {teacherSchools.length > 1 ? `(${teacherSchools.length} vinculados)` : ''}
                </label>
                {teacherSchools.length > 1 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {teacherSchools.map(s => (
                            <button
                                key={s.id}
                                onClick={() => setSelectedSchool(s)}
                                className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                                    selectedSchool?.id === s.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 shadow-md'
                                        : 'border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-indigo-300'
                                }`}
                            >
                                <span className="text-2xl">🏫</span>
                                <div className="min-w-0">
                                    <p className={`font-extrabold text-sm truncate ${selectedSchool?.id === s.id ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white'}`}>
                                        {s.name}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400">
                                        🔑 {s.code} • 👥 {s.studentUids?.length || 0} aluno(s)
                                    </p>
                                </div>
                                {selectedSchool?.id === s.id && (
                                    <span className="ml-auto text-indigo-500 font-extrabold">✔</span>
                                )}
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="p-3 rounded-2xl border-2 border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 flex items-center gap-3">
                        <span className="text-2xl">🏫</span>
                        <div>
                            <p className="font-extrabold text-sm text-indigo-700 dark:text-indigo-300">{selectedSchool?.name}</p>
                            <p className="text-[10px] font-bold text-slate-400">🔑 {selectedSchool?.code}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Card de informações do colégio */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 mb-5 text-white shadow-lg">
                <h3 className="font-extrabold text-lg">🏫 {selectedSchool.name}</h3>
                <div className="flex flex-wrap gap-4 mt-2 text-xs font-bold">
                    <span className="bg-white/20 px-3 py-1 rounded-full">🔑 Código: {selectedSchool.code}</span>
                    <span className="bg-white/20 px-3 py-1 rounded-full">👥 {students.length} aluno(s)</span>
                    <span className="bg-white/20 px-3 py-1 rounded-full">📚 {subjects.length} matéria(s)</span>
                </div>
                <p className="text-[11px] mt-2 text-indigo-100">
                    Compartilhe o código <strong>{selectedSchool.code}</strong> com seus alunos para eles se matricularem pela Home do app.
                </p>
            </div>

            {/* Mensagem de ação */}
            {actionMessage && (
                <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200 text-xs font-bold p-3 rounded-xl mb-4 flex justify-between items-center">
                    <span>{actionMessage}</span>
                    <button onClick={() => setActionMessage('')} className="text-indigo-400 hover:text-indigo-600 px-2">✕</button>
                </div>
            )}

            {/* Abas */}
            <div className="flex overflow-x-auto no-scrollbar gap-1 bg-slate-100 dark:bg-gray-800 p-1.5 rounded-2xl mb-5 border border-slate-200 dark:border-gray-700">
                {[
                    { id: 'subjects', label: `📚 Matérias (${subjects.length})` },
                    { id: 'students', label: `👥 Alunos (${students.length})` },
                    { id: 'performance', label: '📊 Desempenho' }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 py-2.5 px-3.5 text-xs sm:text-sm font-extrabold rounded-xl whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-gray-700'}`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loadingData ? (
                <LoadingScreen text="Carregando dados do colégio..." />
            ) : (
                <>
                    {/* ============ ABA MATÉRIAS ============ */}
                    {activeTab === 'subjects' && (
                        <div className="space-y-4">
                            {/* Form nova matéria */}
                            <form onSubmit={handleCreateSubject} className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow border border-slate-100 dark:border-gray-700 space-y-3">
                                <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 uppercase">+ Nova Matéria</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <input
                                        type="text"
                                        required
                                        placeholder="Nome da Matéria (Ex: Física II)"
                                        value={subjectForm.title}
                                        onChange={(e) => setSubjectForm(prev => ({ ...prev, title: e.target.value }))}
                                        className="p-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                                    />
                                    <input
                                        type="text"
                                        placeholder="Tópico / Categoria"
                                        value={subjectForm.topic}
                                        onChange={(e) => setSubjectForm(prev => ({ ...prev, topic: e.target.value }))}
                                        className="p-2.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white"
                                    />
                                </div>
                                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-4 rounded-xl text-xs shadow-md">
                                    + Publicar Matéria
                                </button>
                            </form>

                            {/* Lista de matérias */}
                            {subjects.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma matéria criada ainda. Crie a primeira acima! 👆</p>
                            ) : (
                                subjects.map(sub => (
                                    <div key={sub.id} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm space-y-2">
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
                                                onClick={() => handleDeleteSubject(sub)}
                                                className="bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-extrabold px-2.5 py-1 rounded-lg text-[10px] flex-shrink-0"
                                                title="Excluir matéria"
                                            >
                                                🗑️
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5">
                                            <button onClick={() => setEditingTheory(sub)} className="bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-sky-200 transition-colors" title="Visualizar e editar a teoria">📖 Teoria</button>
                                            <button onClick={() => setEditingQuiz(sub)} className="bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-violet-200 transition-colors" title="Visualizar e editar o quiz">📝 Quiz</button>
                                            <button onClick={() => setEditingAnki(sub)} className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-amber-200 transition-colors" title="Visualizar e editar os flashcards">🃏 Anki</button>
                                            <button onClick={() => { if (window.confirm('Regenerar SOMENTE a teoria com IA?')) generateForSubject(sub, ['study']); }} disabled={isGenerating} className="bg-sky-600 disabled:opacity-50 text-white font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-sky-700 transition-colors">{generatingId === `${sub.id}-study` ? '⏳' : '🔄'} Teoria</button>
                                            <button onClick={() => { if (window.confirm('Regenerar SOMENTE o quiz com IA?')) generateForSubject(sub, ['quiz']); }} disabled={isGenerating} className="bg-violet-600 disabled:opacity-50 text-white font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-violet-700 transition-colors">{generatingId === `${sub.id}-quiz` ? '⏳' : '🔄'} Quiz</button>
                                            <button onClick={() => { if (window.confirm('Regenerar SOMENTE os flashcards com IA?')) generateForSubject(sub, ['anki']); }} disabled={isGenerating} className="bg-amber-600 disabled:opacity-50 text-white font-extrabold px-2 py-1.5 rounded-lg text-[10px] hover:bg-amber-700 transition-colors">{generatingId === `${sub.id}-anki` ? '⏳' : '🔄'} Anki</button>
                                        </div>

                                        <button
                                            onClick={() => generateForSubject(sub, ['study', 'quiz', 'anki'])}
                                            disabled={isGenerating}
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold px-3 py-1.5 rounded-lg text-[10px]"
                                        >
                                            {generatingId === sub.id ? '⏳ Gerando Pacote Completo...' : '⚡ Gerar Pacote IA Completo (Teoria + Quiz + Anki)'}
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ============ ABA ALUNOS ============ */}
                    {activeTab === 'students' && (
                        <div className="space-y-2">
                            {students.length === 0 ? (
                                <div className="text-center py-8">
                                    <p className="text-sm text-slate-400 italic mb-2">Nenhum aluno matriculado ainda.</p>
                                    <p className="text-xs text-slate-500">Compartilhe o código <strong className="text-indigo-500">{selectedSchool.code}</strong> para os alunos se matricularem.</p>
                                </div>
                            ) : (
                                students.map(st => {
                                    const perf = performanceByStudent[st.uid];
                                    const accuracy = perf && perf.total > 0 ? Math.round((perf.correct / perf.total) * 100) : null;
                                    return (
                                        <div key={st.uid} className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <h5 className="font-extrabold text-xs text-slate-800 dark:text-white truncate">{st.displayName || 'Aluno'}</h5>
                                                <p className="text-[10px] text-slate-400 truncate">{st.email || st.uid}</p>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0 text-[10px] font-extrabold">
                                                <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-lg">{st.xp || 0} XP</span>
                                                {accuracy !== null ? (
                                                    <span className={`px-2 py-1 rounded-lg ${accuracy >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : accuracy >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'}`}>
                                                        🎯 {accuracy}%
                                                    </span>
                                                ) : (
                                                    <span className="bg-slate-100 dark:bg-gray-700 text-slate-400 px-2 py-1 rounded-lg">sem atividade</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* ============ ABA DESEMPENHO ============ */}
                    {activeTab === 'performance' && (
                        <div className="space-y-3">
                            {performance.length === 0 ? (
                                <p className="text-xs text-slate-400 italic text-center py-6">Nenhuma resposta de quiz registrada ainda. O desempenho aparece automaticamente quando os alunos responderem os quizzes das matérias.</p>
                            ) : (
                                Object.entries(performanceByStudent).map(([uid, data]) => {
                                    const accuracy = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
                                    return (
                                        <div key={uid} className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 shadow-sm p-4 space-y-3">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <h5 className="font-extrabold text-sm text-slate-800 dark:text-white truncate">{data.name}</h5>
                                                    <p className="text-[10px] text-slate-400 truncate">{data.email}</p>
                                                </div>
                                                <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${accuracy >= 70 ? 'bg-emerald-100 text-emerald-700' : accuracy >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                                                    {accuracy}% de acerto
                                                </span>
                                            </div>

                                            {/* Barra geral */}
                                            <div className="w-full bg-slate-100 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                                                <div className={`h-2.5 rounded-full transition-all ${accuracy >= 70 ? 'bg-emerald-500' : accuracy >= 40 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${accuracy}%` }}></div>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-500">✅ {data.correct} acertos • ❌ {data.total - data.correct} erros • 📝 {data.total} respostas</p>

                                            {/* Detalhe por matéria */}
                                            <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-gray-700">
                                                {data.subjects.map(p => {
                                                    const subAcc = p.totalAnswers > 0 ? Math.round(((p.correctAnswers || 0) / p.totalAnswers) * 100) : 0;
                                                    return (
                                                        <div key={p.id} className="flex items-center justify-between text-[11px] font-bold">
                                                            <span className="text-slate-600 dark:text-slate-300 truncate">📚 {p.subjectTitle}</span>
                                                            <span className="text-slate-500 flex-shrink-0">
                                                                ✅ {p.correctAnswers || 0} / ❌ {p.wrongAnswers || 0} <span className="text-indigo-500">({subAcc}%)</span>
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Editores Manuais */}
            {editingTheory && (
                <TheoryEditorModal
                    trail={editingTheory}
                    onClose={() => setEditingTheory(null)}
                    onSave={(content) => saveContent(editingTheory, 'cachedStudy', content, 'Teoria')}
                />
            )}
            {editingQuiz && (
                <QuizEditorModal
                    trail={editingQuiz}
                    onClose={() => setEditingQuiz(null)}
                    onSave={(questions) => saveContent(editingQuiz, 'cachedQuiz', questions, 'Quiz')}
                />
            )}
            {editingAnki && (
                <AnkiEditorModal
                    trail={editingAnki}
                    onClose={() => setEditingAnki(null)}
                    onSave={(cards) => saveContent(editingAnki, 'cachedAnki', cards, 'Anki')}
                />
            )}

            {/* Overlay de geração */}
            {isGenerating && (
                <LoadingScreen
                    text="⚡ Gerando Conteúdo com IA"
                    subtext={genStepMessage || "Aguarde enquanto a IA constrói o material..."}
                />
            )}
        </div>
    );
}
