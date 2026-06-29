import React from 'react';
import StudyBot from './StudyBot';

export default function LoadingScreen({ text }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-center">
            <StudyBot status="loading" />
            <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-200 mt-4">{text || "Carregando..."}</h2>
        </div>
    );
}
