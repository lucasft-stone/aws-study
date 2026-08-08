export const ACHIEVEMENTS = [
    {
        id: 'first_trail',
        title: '🚀 Primeiros Passos',
        description: 'Crie sua primeira trilha de estudos personalizada com IA.',
        icon: '🚀',
        xpReward: 50,
        condition: (userData, customTrails) => (customTrails && customTrails.length > 0)
    },
    {
        id: 'study_master',
        title: '📖 Devorador de Conteúdo',
        description: 'Estude seu primeiro material teórico completo.',
        icon: '📖',
        xpReward: 50,
        condition: (userData) => (userData.xp >= 50)
    },
    {
        id: 'quiz_ace',
        title: '🎯 Gênio do Simulado',
        description: 'Alcance mais de 100 XP respondendo a exercícios.',
        icon: '🎯',
        xpReward: 100,
        condition: (userData) => (userData.xp >= 150)
    },
    {
        id: 'anki_scholar',
        title: '🧠 Mestre da Memorização',
        description: 'Estude cartões no modo Anki.',
        icon: '🧠',
        xpReward: 75,
        condition: (userData) => (userData.xp >= 200)
    },
    {
        id: 'xp_legend',
        title: '👑 Lenda do Aprendizado',
        description: 'Acumule 500 XP em sua jornada de estudos.',
        icon: '👑',
        xpReward: 150,
        condition: (userData) => (userData.xp >= 500)
    },
    {
        id: 'full_hearts',
        title: '❤️ Inabalável',
        description: 'Mantenha todos os seus 5 corações de energia intocados.',
        icon: '❤️',
        xpReward: 30,
        condition: (userData) => (userData.hearts >= 5)
    }
];

export const getUnlockedAchievements = (userData = {}, customTrails = []) => {
    return ACHIEVEMENTS.filter(badge => badge.condition(userData, customTrails));
};
