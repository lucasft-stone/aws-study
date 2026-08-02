import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { checkIsAdmin } from '../services/firebaseService';

export default function StudyMaterial({
    currentTrail,
    userData,
    user,
    studyContent,
    generateContent,
    setAppState,
    handleFinishStudyAndStartQuiz,
    MAX_DAILY_REFRESHES
}) {
    const isRoot = checkIsAdmin(user);
    const refreshLimitReached = userData.dailyRefreshes >= MAX_DAILY_REFRESHES && !isRoot;
    
    // Controle de Tamanho de Fonte para leitura confortável (0: P, 1: M, 2: G, 3: GG)
    const [fontSizeLevel, setFontSizeLevel] = useState(1);
    const [copiedToast, setCopiedToast] = useState(false);
    const contentRef = useRef(null);

    const fontClasses = ['text-sm', 'text-base', 'text-lg', 'text-xl'];

    // Estimativa de tempo de leitura (média de 200 palavras por minuto)
    const wordCount = studyContent ? studyContent.split(/\s+/).length : 0;
    const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));

    // Função para renderizar equações e fórmulas matemáticas em LaTeX ($...$ e $$...$$)
    const renderLatexMathFormulas = (text) => {
        if (!text) return '';

        // 1. Equações em bloco $$ ... $$ ou \[ ... \]
        let processed = text.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, (match, open, formula) => {
            try {
                return '<div class="katex-display-block my-4 text-center overflow-x-auto py-3 px-4 bg-slate-900/60 text-slate-100 rounded-2xl border border-slate-700/60 shadow-inner font-mono">' +
                       katex.renderToString(formula.trim(), { displayMode: true, throwOnError: false }) +
                       '</div>';
            } catch {
                return match;
            }
        });

        // 2. Equações em linha $ ... $ ou \( ... \)
        processed = processed.replace(/(\$|\\\()([^$\n]+?)(\$|\\\))/g, (match, open, formula) => {
            try {
                return katex.renderToString(formula.trim(), { displayMode: false, throwOnError: false });
            } catch {
                return match;
            }
        });

        return processed;
    };

    // Função inteligente para formatar JSON, preservar scripts Python/JS e formatar blocos de código
    const fixAndFormatAllJsonInMarkdown = (rawText) => {
        if (!rawText) return '';
        let text = rawText.replace(/\\n/g, '\n');

        const manualIndentJson = (code) => {
            const lines = code.split('\n');
            let indentLevel = 0;
            const result = [];

            for (let line of lines) {
                let trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith('}') || trimmed.startsWith(']')) {
                    indentLevel = Math.max(0, indentLevel - 1);
                }

                const indent = '    '.repeat(indentLevel);
                result.push(indent + trimmed);

                const opens = (trimmed.match(/[{[]/g) || []).length;
                const closes = (trimmed.match(/[:}\]]/g) || []).filter(c => c === '}' || c === ']').length;
                indentLevel += (opens - closes);
                if (indentLevel < 0) indentLevel = 0;
            }

            return result.join('\n');
        };

        const formatJsonBlockString = (str) => {
            let code = str.trim();
            try {
                const obj = JSON.parse(code);
                return JSON.stringify(obj, null, 4);
            } catch {
                try {
                    let sanitized = code
                        .replace(/([{,]\s*)([a-zA-Z0-9_$]+)\s*:/g, '$1"$2":')
                        .replace(/:\s*([a-zA-Z0-9_./-]+)(?=[,\s}\]])/g, (m, val) => {
                            if (val === 'true' || val === 'false' || val === 'null' || !isNaN(val)) {
                                return `: ${val}`;
                            }
                            return `: "${val}"`;
                        });
                    const obj = JSON.parse(sanitized);
                    return JSON.stringify(obj, null, 4);
                } catch {
                    return manualIndentJson(code);
                }
            }
        };

        // 1. Re-formata blocos com cercas ``` preservando linguagens específicas como python, bash, javascript, sql
        text = text.replace(/```([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/gi, (fullMatch, lang, block) => {
            const trimmedLang = lang.trim().toLowerCase();
            const trimmedBlock = block.trim();

            if (trimmedLang && trimmedLang !== 'json') {
                return fullMatch; // Preserva Python, Bash, JS, SQL intactos
            }

            if (trimmedBlock.startsWith('{') || trimmedBlock.startsWith('[')) {
                if (/def\s+|function|return\s+\{|import\s+/i.test(trimmedBlock)) {
                    return '```python\n' + trimmedBlock + '\n```';
                }
                return '```json\n' + formatJsonBlockString(trimmedBlock) + '\n```';
            }

            return fullMatch;
        });

        // 2. Empacota funções Python/Scripts soltos sem cercas em blocos de código ```python
        text = text.replace(/(^|\n)((?:def\s+[a-zA-Z0-9_]+\([\s\S]*?|import\s+[a-zA-Z0-9_]+[\s\S]*?)\n\s*return\s*\{[\s\S]*?\n\s*\})(\n|$)/gi, (fullMatch, prefix, codeBlock, suffix) => {
            return prefix + '\n```python\n' + codeBlock.trim() + '\n```\n' + suffix;
        });

        // 3. Processa apenas JSONs isolados (Políticas IAM, Buckets, Configurações) sem fatiar código Python/JS
        let result = '';
        let i = 0;

        while (i < text.length) {
            if (text.substr(i, 3) === '```') {
                const endFence = text.indexOf('```', i + 3);
                if (endFence !== -1) {
                    result += text.substring(i, endFence + 3);
                    i = endFence + 3;
                    continue;
                }
            }

            if ((text[i] === '{' || text[i] === '[') && (i === 0 || text[i - 1] === '\n' || text[i - 1] === ' ' || text[i - 1] === ':')) {
                const precedingSnippet = text.substring(Math.max(0, i - 80), i);
                const isInsideCodeStatement = /def\s+|return\s+|function|class\s+|var\s+|const\s+/i.test(precedingSnippet);

                if (!isInsideCodeStatement) {
                    const startChar = text[i];
                    const endChar = startChar === '{' ? '}' : ']';
                    let depth = 0;
                    let j = i;
                    let foundEnd = false;

                    while (j < text.length) {
                        if (text[j] === startChar) depth++;
                        else if (text[j] === endChar) {
                            depth--;
                            if (depth === 0) {
                                j++;
                                foundEnd = true;
                                break;
                            }
                        }
                        j++;
                    }

                    if (foundEnd && depth === 0) {
                        const jsonCandidate = text.substring(i, j);
                        if (jsonCandidate.length > 5 && (jsonCandidate.includes(':') || jsonCandidate.includes('"')) && !jsonCandidate.includes('def ')) {
                            result += '\n```json\n' + formatJsonBlockString(jsonCandidate) + '\n```\n';
                            i = j;
                            continue;
                        }
                    }
                }
            }

            result += text[i];
            i++;
        }

        return result;
    };

    // Formata o conteúdo Markdown + JSON Indentado + Fórmulas KaTeX
    const processedJson = fixAndFormatAllJsonInMarkdown(studyContent || '');
    const processedMath = renderLatexMathFormulas(processedJson);
    const formattedContent = marked.parse(processedMath, { breaks: true, gfm: true });

    // Efeito para adicionar barras de título de linguagem e botões de copiar em todos os blocos de código
    useEffect(() => {
        if (!contentRef.current) return;
        const preElements = contentRef.current.querySelectorAll('pre');

        preElements.forEach((pre) => {
            if (pre.querySelector('.copy-code-btn')) return; // Evita duplicar

            // Detecta linguagem a partir da tag code (ex: language-python -> PYTHON)
            const codeEl = pre.querySelector('code');
            const classList = codeEl ? Array.from(codeEl.classList) : [];
            const langMatch = classList.find(c => c.startsWith('language-'));
            const langName = langMatch ? langMatch.replace('language-', '').toUpperCase() : 'CODE';

            // Cria barra de topo do bloco de código com ícones estilo macOS + Badge + Botão de Copiar
            const topBar = document.createElement('div');
            topBar.className = 'code-header-bar flex justify-between items-center bg-slate-950/80 px-4 py-2 rounded-t-2xl border-b border-slate-800 text-xs text-slate-400 select-none -mt-5 -mx-5 mb-3';
            topBar.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="inline-flex gap-1.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block"></span>
                        <span class="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block"></span>
                    </span>
                    <span class="font-extrabold text-[10px] tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-800/60 ml-2">
                        ${langName}
                    </span>
                </div>
            `;

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-code-btn bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold py-1 px-2.5 rounded-lg border border-slate-600 transition-all flex items-center gap-1 cursor-pointer';
            copyBtn.innerHTML = '📋 Copiar';

            copyBtn.onclick = () => {
                const codeText = codeEl?.innerText || pre.innerText;
                navigator.clipboard.writeText(codeText).then(() => {
                    copyBtn.innerHTML = '✅ Copiado!';
                    setCopiedToast(true);
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋 Copiar';
                        setCopiedToast(false);
                    }, 2500);
                });
            };

            topBar.appendChild(copyBtn);
            pre.insertBefore(topBar, pre.firstChild);
        });
    }, [formattedContent]);

    return (
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[88vh] border border-slate-100 dark:border-gray-700 animate-fade-in relative">
            
            {/* Toast de código copiado */}
            {copiedToast && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg border border-slate-700 animate-bounce">
                    ⚡ Código copiado para a área de transferência!
                </div>
            )}

            {/* Cabeçalho de Leitura */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4 pb-4 border-b border-slate-100 dark:border-gray-700 flex-shrink-0">
                <div>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                        📖 Material de Estudo
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mt-1.5">
                        {currentTrail?.title}
                    </h1>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                    {/* Badge de Tempo de Leitura */}
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-gray-700/60 px-3 py-1.5 rounded-xl flex items-center gap-1">
                        ⏱️ ~{readingTimeMinutes} min de leitura
                    </span>

                    {/* Controles de Zoom de Fonte */}
                    <div className="flex items-center bg-slate-100 dark:bg-gray-700/60 p-1 rounded-xl gap-1">
                        <button
                            onClick={() => setFontSizeLevel(prev => Math.max(0, prev - 1))}
                            disabled={fontSizeLevel === 0}
                            title="Diminuir tamanho da fonte"
                            className="w-7 h-7 font-bold text-xs rounded-lg hover:bg-white dark:hover:bg-gray-600 disabled:opacity-30 transition-colors text-slate-700 dark:text-slate-200"
                        >
                            A-
                        </button>
                        <span className="text-[11px] font-bold text-slate-400 px-1">
                            {fontSizeLevel === 0 ? 'P' : fontSizeLevel === 1 ? 'M' : fontSizeLevel === 2 ? 'G' : 'GG'}
                        </span>
                        <button
                            onClick={() => setFontSizeLevel(prev => Math.min(3, prev + 1))}
                            disabled={fontSizeLevel === 3}
                            title="Aumentar tamanho da fonte"
                            className="w-7 h-7 font-bold text-xs rounded-lg hover:bg-white dark:hover:bg-gray-600 disabled:opacity-30 transition-colors text-slate-700 dark:text-slate-200"
                        >
                            A+
                        </button>
                    </div>

                    {/* Botão de Regerar Material com IA */}
                    <button
                        onClick={() => generateContent(currentTrail, 'study', true)}
                        disabled={refreshLimitReached}
                        title={refreshLimitReached ? 'Limite de atualizações diárias atingido' : 'Regerar este material de estudo com IA'}
                        className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 p-2 rounded-xl transition-colors disabled:opacity-40 border border-indigo-100 dark:border-indigo-900/50"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </button>
                </div>
            </div>

            {/* Container do Conteúdo Formatado */}
            <div
                ref={contentRef}
                className={`markdown-content flex-grow overflow-y-auto pr-3 sm:pr-5 custom-scrollbar ${fontClasses[fontSizeLevel]}`}
                dangerouslySetInnerHTML={{ __html: formattedContent }}
            />

            {/* Rodapé de Ações */}
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 flex-shrink-0 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                    onClick={() => setAppState('trail_options')}
                    className="w-full sm:w-auto text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline text-sm transition-colors"
                >
                    ← Voltar às Opções
                </button>
                
                <button
                    onClick={handleFinishStudyAndStartQuiz}
                    className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-extrabold py-3.5 px-7 rounded-2xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] text-sm flex items-center justify-center gap-2"
                >
                    <span>{userData.hearts <= 0 ? "Concluir Estudo & Restaurar Corações!" : "Concluir Estudo & Iniciar Quiz →"}</span>
                </button>
            </div>
        </div>
    );
}
