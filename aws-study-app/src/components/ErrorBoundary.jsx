import React from 'react';
import StudyBot from './StudyBot';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-center">
                    <StudyBot status="incorrect" />
                    <h2 className="text-2xl font-bold text-red-500 mt-4">Ops! Algo deu errado.</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6">Tente recarregar a página.</p>
                    <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-2xl shadow-lg hover:scale-105 transition-transform">Recarregar</button>
                </div>
            );
        }

        return this.props.children;
    }
}
