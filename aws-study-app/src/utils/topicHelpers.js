export const TOPIC_ICON_OPTIONS = [
    { icon: '📐', label: 'Matemática & Geometria' },
    { icon: '🧮', label: 'Cálculo & Estatística' },
    { icon: '💻', label: 'Programação & Código' },
    { icon: '☁️', label: 'AWS & Cloud Computing' },
    { icon: '🚀', label: 'DevOps & Infraestrutura' },
    { icon: '🔬', label: 'Física & Ciências' },
    { icon: '📚', label: 'Humanas & Literatura' },
    { icon: '⚖️', label: 'Direito & Legislação' },
    { icon: '🎨', label: 'Design & Artes' },
    { icon: '🌐', label: 'Redes & Web' },
    { icon: '🧠', label: 'Psicologia & Mente' },
    { icon: '⚡', label: 'Engenharia & Eletricidade' },
    { icon: '💡', label: 'Inovação & Gestão' },
    { icon: '🇬🇧', label: 'Idiomas & Inglês' },
    { icon: '🏆', label: 'Certificações & Exames' },
    { icon: '📌', label: 'Geral / Outros' }
];

/**
 * Retorna o ícone mais apropriado para o tópico.
 * Se o usuário/admin selecionou um ícone customizado manualmente, usa ele.
 * Caso contrário, detecta automaticamente com base em palavras-chave do nome do tópico.
 */
export const resolveTopicIcon = (topicName = '', customIcon = '') => {
    if (customIcon && customIcon.trim()) {
        return customIcon.trim();
    }
    
    const name = (topicName || '').toLowerCase().trim();
    if (!name) return '📌';

    if (name.includes('matemát') || name.includes('geomet') || name.includes('trigono')) return '📐';
    if (name.includes('cálcul') || name.includes('álgebr') || name.includes('somat') || name.includes('deriv') || name.includes('integral')) return '🧮';
    if (name.includes('aws') || name.includes('cloud') || name.includes('nuvem')) return '☁️';
    if (name.includes('program') || name.includes('dev') || name.includes('code') || name.includes('python') || name.includes('react') || name.includes('java') || name.includes('javascript') || name.includes('node')) return '💻';
    if (name.includes('infra') || name.includes('docker') || name.includes('kube') || name.includes('devops') || name.includes('linux')) return '🚀';
    if (name.includes('físic') || name.includes('químic') || name.includes('ciênc') || name.includes('biolo')) return '🔬';
    if (name.includes('direito') || name.includes('lei') || name.includes('juríd') || name.includes('constituc')) return '⚖️';
    if (name.includes('inglê') || name.includes('idioma') || name.includes('english') || name.includes('espanho')) return '🇬🇧';
    if (name.includes('design') || name.includes('arte') || name.includes('ui/ux') || name.includes('figma')) return '🎨';
    if (name.includes('redes') || name.includes('web') || name.includes('internet') || name.includes('http')) return '🌐';
    if (name.includes('certific') || name.includes('prov') || name.includes('concurs')) return '🏆';
    if (name.includes('psico') || name.includes('filoso') || name.includes('mente') || name.includes('histór')) return '🧠';
    if (name.includes('engenh') || name.includes('eletri') || name.includes('mecanic')) return '⚡';
    if (name.includes('negóci') || name.includes('finan') || name.includes('gestã') || name.includes('marketing')) return '💡';
    
    return '📌';
};

/**
 * Funções auxiliares para configuração da Trilha Exemplo AWS (visibilidade controlada pelo Admin)
 */
export const getHideAwsTopicSetting = () => {
    try {
        return localStorage.getItem('aws_study_hide_aws_topic') === 'true';
    } catch {
        return false;
    }
};

export const setHideAwsTopicSetting = (hide) => {
    try {
        localStorage.setItem('aws_study_hide_aws_topic', hide ? 'true' : 'false');
    } catch (e) {
        console.warn("Erro ao salvar preferencia de ocultar AWS:", e);
    }
};
