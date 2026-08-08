import React, { useState } from 'react';
import { enrollStudentInSchoolByCode } from '../services/firebaseService';

export default function SchoolEnrollModal({ user, onClose, onEnrolled }) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleEnroll = async (e) => {
        e.preventDefault();
        if (!code.trim() || !user?.uid) return;

        setLoading(true);
        setErrorMsg('');
        try {
            const school = await enrollStudentInSchoolByCode(user.uid, code);
            alert(`🎉 Matriculado com sucesso no colégio "${school.name || 'Instituição'}"!`);
            if (onEnrolled) onEnrolled(school);
            onClose();
        } catch (err) {
            setErrorMsg(err.message || 'Código de colégio inválido.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-md p-6 flex flex-col gap-4 border border-slate-100 dark:border-gray-700">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-gray-700">
                    <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                        <span>🏫 Matricular em um Colégio / Professor</span>
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white text-lg font-bold">
                        ✕
                    </button>
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Digite o código de 6 caracteres fornecido pelo seu colégio ou professor particular para ter acesso a matérias exclusivas.
                </p>

                {errorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs font-bold rounded-xl">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleEnroll} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                            Código de Acesso do Colégio
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={8}
                            placeholder="Ex: CV2025"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="w-full p-3.5 bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-2xl text-center font-mono font-black text-xl tracking-widest text-indigo-600 dark:text-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                        />
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-xl text-xs"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow-md disabled:opacity-50"
                        >
                            {loading ? '⚡ Verificando...' : '🏫 Matricular'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
