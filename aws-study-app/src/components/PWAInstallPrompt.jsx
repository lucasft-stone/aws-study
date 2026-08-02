import React, { useState, useEffect } from 'react';

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showPrompt, setShowPrompt] = useState(false);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const handleBeforeInstallPrompt = (e) => {
            // Impede que o navegador exiba o prompt padrão imediatamente
            e.preventDefault();
            setDeferredPrompt(e);
            setShowPrompt(true);
        };

        const handleAppInstalled = () => {
            setIsInstalled(true);
            setShowPrompt(false);
            setDeferredPrompt(null);
            console.log('PWA StudyBot instalado com sucesso!');
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.addEventListener('appinstalled', handleAppInstalled);

        // Verifica se a aplicação já está rodando em modo standalone (instalada)
        if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
            setIsInstalled(true);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            window.removeEventListener('appinstalled', handleAppInstalled);
        };
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`Escolha de instalação do usuário: ${outcome}`);
        if (outcome === 'accepted') {
            setShowPrompt(false);
        }
        setDeferredPrompt(null);
    };

    if (!showPrompt || isInstalled) {
        return null;
    }

    return (
        <div className="w-full max-w-2xl my-3 p-4 bg-gradient-to-r from-indigo-600 to-indigo-800 text-white rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-fade-in border border-indigo-400/30">
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                    📲
                </div>
                <div>
                    <h3 className="font-bold text-sm md:text-base">Instalar StudyBot AWS</h3>
                    <p className="text-xs text-indigo-100">Acesse offline e direto da tela inicial do seu dispositivo.</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <button
                    onClick={() => setShowPrompt(false)}
                    className="text-xs text-indigo-200 hover:text-white px-2 py-1 transition-colors"
                >
                    Agora não
                </button>
                <button
                    onClick={handleInstallClick}
                    className="bg-white text-indigo-700 hover:bg-indigo-50 font-bold text-xs md:text-sm py-2 px-4 rounded-xl shadow transition-transform hover:scale-105 active:scale-95"
                >
                    Instalar
                </button>
            </div>
        </div>
    );
}
