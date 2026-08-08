import React from 'react';
import StudyBot from './StudyBot';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null });
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-gray-900 p-4 text-center">
                    <StudyBot status="incorrect" />
                    <h2 className="text-2xl font-bold text-red-500 mt-4">Ops! Algo deu errado.</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">
                        Ocorreu uma falha inesperada na renderização da interface.
                    </p>

                    {this.state.error?.message && (
                        <div className="max-w-md w-full p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-mono mb-6 text-left overflow-x-auto">
                            {this.state.error.message}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={this.handleReset} 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-2xl shadow-lg transition-transform hover:scale-105"
                        >
                            🔄 Recarregar Página
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
