import { useState, useEffect } from 'react';

export function useThemeManager() {
    // Opções: 'system' | 'light' | 'dark'
    const [themeMode, setThemeMode] = useState(() => {
        return localStorage.getItem('app_theme_mode') || 'system';
    });

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        localStorage.setItem('app_theme_mode', themeMode);

        const applyTheme = () => {
            root.classList.remove('light', 'dark');
            body.classList.remove('light', 'dark');
            
            if (themeMode === 'dark') {
                root.classList.add('dark');
                body.classList.add('dark');
                root.style.colorScheme = 'dark';
            } else if (themeMode === 'light') {
                root.classList.add('light');
                body.classList.add('light');
                root.style.colorScheme = 'light';
            } else {
                // Preferência do Navegador/Sistema
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (systemPrefersDark) {
                    root.classList.add('dark');
                    body.classList.add('dark');
                    root.style.colorScheme = 'dark';
                } else {
                    root.classList.add('light');
                    body.classList.add('light');
                    root.style.colorScheme = 'light';
                }
            }
        };

        applyTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (themeMode === 'system') {
                applyTheme();
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [themeMode]);

    const toggleTheme = () => {
        setThemeMode(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    return { themeMode, setThemeMode, toggleTheme };
}
