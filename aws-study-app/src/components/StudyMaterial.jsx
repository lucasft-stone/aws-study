import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { checkIsAdmin } from '../services/firebaseService';

// Inicialização limpa do Mermaid para gráficos e diagramas sem banners ruidosos de erro
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    suppressErrorRendering: true,
    fontFamily: 'system-ui, -apple-system, sans-serif'
});

const mermaidKeywords = ['graph', 'flowchart', 'sequenceDiagram', 'pie', 'gantt', 'classDiagram', 'stateDiagram-v2', 'stateDiagram', 'erDiagram', 'journey', 'mindmap', 'quadrantChart', 'architecture', 'c4Diagram', 'block-beta', 'block', 'gitGraph', 'timeline', 'sankey-beta', 'kanban'];

export default function StudyMaterial({
    currentTrail,
    userData,
    user,
    studyContent,
    generateContent,
    expandStudyMaterial,
    isExpandingStudy = false,
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

        // 1. Re-formata blocos com cercas ``` convertendo Mermaid em placeholders HTML protegidos (encodeURIComponent)
        text = text.replace(/```\s*([a-zA-Z0-9_-]*)\s*([\s\S]*?)```/gi, (fullMatch, lang, block) => {
            const trimmedLang = lang.trim().toLowerCase();
            const trimmedBlock = block.trim();

            const lines = trimmedBlock.split('\n').map(l => l.trim()).filter(Boolean);
            
            const isMermaidLang = trimmedLang === 'mermaid' || trimmedLang === 'mermaid-js';
            const hasMermaidKeyword = lines.slice(0, 3).some(line => {
                const lower = line.toLowerCase();
                return lower === 'mermaid' || lower === 'mermaid-js' || mermaidKeywords.some(kw => lower.startsWith(kw.toLowerCase()));
            });

            if (isMermaidLang || hasMermaidKeyword) {
                let cleanBlockLines = [...lines];
                while (cleanBlockLines.length > 0 && /^mermaid(-js)?$/i.test(cleanBlockLines[0])) {
                    cleanBlockLines.shift();
                }
                const cleanCode = cleanBlockLines.join('\n');
                if (cleanCode) {
                    const encoded = encodeURIComponent(cleanCode);
                    return `\n\n<div class="mermaid-diagram-placeholder my-6 p-4 sm:p-6 bg-slate-900/95 text-slate-100 rounded-2xl border border-indigo-900/60 shadow-2xl text-center max-w-full overflow-hidden flex justify-center items-center" data-mermaid-code="${encoded}">⚡ Renderizando gráfico visual...</div>\n\n`;
                }
            }

            if (trimmedLang && trimmedLang !== 'json') {
                return fullMatch; // Preserva Python, Bash, JS, SQL intactos
            }

            if (trimmedBlock.startsWith('{') || trimmedBlock.startsWith('[')) {
                if (/def\s+|function|return\s+\{|import\s+|public\s+|func\s+|class\s+/i.test(trimmedBlock)) {
                    return '```code\n' + trimmedBlock + '\n```';
                }
                return '```json\n' + formatJsonBlockString(trimmedBlock) + '\n```';
            }

            return fullMatch;
        });

        // 2. Intercepta trechos soltos que começam com mermaid ou palavras-chave de gráficos sem cercas
        text = text.replace(/(^|\n)(mermaid\s*\n\s*(?:graph|flowchart|sequenceDiagram|pie|gantt|classDiagram|mindmap)[\s\S]*?)(?=\n\n|\n#|$)/gi, (fullMatch, prefix, mermaidBlock) => {
            const lines = mermaidBlock.trim().split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length > 0 && /^mermaid(-js)?$/i.test(lines[0])) {
                lines.shift();
            }
            const cleanCode = lines.join('\n');
            if (cleanCode) {
                const encoded = encodeURIComponent(cleanCode);
                return prefix + `\n\n<div class="mermaid-diagram-placeholder my-6 p-4 sm:p-6 bg-slate-900/95 text-slate-100 rounded-2xl border border-indigo-900/60 shadow-2xl text-center max-w-full overflow-hidden flex justify-center items-center" data-mermaid-code="${encoded}">⚡ Renderizando gráfico visual...</div>\n\n`;
            }
            return fullMatch;
        });

        // 3. Empacota funções Python/Scripts soltos sem cercas em blocos de código
        text = text.replace(/(^|\n)((?:def\s+[a-zA-Z0-9_]+\([\s\S]*?|import\s+[a-zA-Z0-9_]+[\s\S]*?)\n\s*return\s*\{[\s\S]*?\n\s*\})(\n|$)/gi, (fullMatch, prefix, codeBlock, suffix) => {
            return prefix + '\n```python\n' + codeBlock.trim() + '\n```\n' + suffix;
        });

        // 4. Processa apenas JSONs isolados (Políticas IAM, Buckets, Configurações) sem fatiar código de nenhuma linguagem
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
                const precedingSnippet = text.substring(Math.max(0, i - 120), i);
                const isInsideCodeStatement = /def\s+|return\s+|function|class\s+|var\s+|const\s+|let\s+|public\s+|private\s+|void\s+|func\s+|import\s+|export\s+|package\s+|resource\s+|provider\s+|select\s+|insert\s+|update\s+|docker\s+|kubectl\s+|sudo\s+/i.test(precedingSnippet);

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

    // Efeito para adicionar barras de título de linguagem, copiar código e renderizar gráficos Mermaid
    useEffect(() => {
        if (!contentRef.current) return;

        const cleanMermaidSyntax = (rawText) => {
            let text = rawText
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .replace(/&amp;/g, '&')
                .replace(/\\n/g, '\n')
                .trim();

            let lines = text.split('\n').map(l => l.trim()).filter(Boolean);

            // Remove a palavra "mermaid" ou "mermaid-js" se estiver isolada na primeira linha
            if (lines.length > 0 && /^mermaid(-js)?$/i.test(lines[0])) {
                lines.shift();
            }

            const firstKeywordIdx = lines.findIndex(line => {
                return mermaidKeywords.some(kw => line.toLowerCase().startsWith(kw.toLowerCase()));
            });

            if (firstKeywordIdx !== -1) {
                lines = lines.slice(firstKeywordIdx);
            }

            let code = lines.join('\n').trim();

            // Auto-quoting inteligente de rótulos com caracteres especiais como :, =, <, >, (, )
            code = code.replace(/(\[[^"\n]+\]|\{[^"\n]+\}|\([^"\n]+\))/g, (match) => {
                const bracket = match[0];
                const endBracket = match[match.length - 1];
                const content = match.substring(1, match.length - 1);
                
                if (/[:=<>()[\]+*/]/g.test(content) && !content.startsWith('"')) {
                    return `${bracket}"${content}"${endBracket}`;
                }
                return match;
            });

            return code;
        };

        const renderContentElements = async () => {
            // 1. Processa Placeholders de Mermaid protegidos com encodeURIComponent
            const placeholders = Array.from(contentRef.current.querySelectorAll('.mermaid-diagram-placeholder'));
            for (let idx = 0; idx < placeholders.length; idx++) {
                const el = placeholders[idx];
                if (el.dataset.mermaidRendered) continue;
                el.dataset.mermaidRendered = 'true';

                const rawEncoded = el.dataset.mermaidCode;
                if (!rawEncoded) continue;

                const cleanCode = cleanMermaidSyntax(decodeURIComponent(rawEncoded));

                try {
                    const uniqueId = `mermaid_svg_${Date.now()}_${idx}`;
                    const { svg } = await mermaid.render(uniqueId, cleanCode);

                    el.innerHTML = `
                        <div class="w-full flex flex-col items-center gap-2 max-w-full overflow-hidden">
                            <div class="text-[10px] font-extrabold tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60 mb-2">
                                📊 Gráfico / Diagrama Visual
                            </div>
                            <div class="w-full flex justify-center items-center overflow-x-auto max-w-full">${svg}</div>
                        </div>
                    `;
                } catch (err) {
                    console.warn('Sintaxe do diagrama ajustada para exibição limpa:', err);
                    el.className = 'my-6 p-4 sm:p-5 bg-slate-900/90 text-slate-100 rounded-2xl border border-slate-700/80 shadow-lg text-left max-w-full overflow-hidden';
                    el.innerHTML = `
                        <div class="flex items-center justify-between text-xs text-slate-400 mb-2 pb-2 border-b border-slate-800">
                            <span class="font-bold text-amber-400 flex items-center gap-1">📊 Diagrama de Estudo</span>
                            <span class="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 uppercase font-mono">MERMAID</span>
                        </div>
                        <pre class="text-xs text-slate-200 font-mono overflow-x-auto p-3 bg-slate-950/90 rounded-xl border border-slate-800/80 whitespace-pre max-w-full"><code>${cleanCode}</code></pre>
                    `;
                }
            }

            // 2. Varredura Universal em blocos <pre> como segundo nível de garantia
            const preElements = Array.from(contentRef.current.querySelectorAll('pre'));
            
            for (let idx = 0; idx < preElements.length; idx++) {
                const pre = preElements[idx];
                if (pre.dataset.mermaidRendered) continue;

                const codeEl = pre.querySelector('code') || pre;
                const rawCode = (codeEl.innerText || codeEl.textContent || '').trim();
                const classList = Array.from(codeEl.classList || []).concat(Array.from(pre.classList || []));
                const lines = rawCode.split('\n').map(l => l.trim()).filter(Boolean);
                const hasMermaidHeader = classList.some(c => c.includes('mermaid')) || lines.slice(0, 3).some(line => {
                    const lower = line.toLowerCase();
                    return lower === 'mermaid' || lower === 'mermaid-js' || mermaidKeywords.some(kw => lower.startsWith(kw.toLowerCase()));
                });

                const cleanCode = cleanMermaidSyntax(rawCode);
                if (!cleanCode) continue;

                if (hasMermaidHeader) {
                    pre.dataset.mermaidRendered = 'true';
                    try {
                        const uniqueId = `mermaid_chart_${Date.now()}_${idx}`;
                        const { svg } = await mermaid.render(uniqueId, cleanCode);

                        const chartWrapper = document.createElement('div');
                        chartWrapper.className = 'mermaid-chart-container my-6 p-4 sm:p-6 bg-slate-900/95 text-slate-100 rounded-2xl border border-indigo-900/60 shadow-2xl text-center overflow-x-auto flex flex-col justify-center items-center gap-3';
                        chartWrapper.innerHTML = `
                            <div class="text-[10px] font-extrabold tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
                                📊 Gráfico / Diagrama Visual
                            </div>
                            <div class="w-full flex justify-center items-center overflow-x-auto">${svg}</div>
                        `;

                        if (pre.parentNode) {
                            pre.parentNode.replaceChild(chartWrapper, pre);
                        }
                    } catch (err) {
                        console.warn('Erro ao renderizar gráfico Mermaid em pre:', err);
                    }
                }
            }

            // 2. Processa blocos de código regulares APÓS os gráficos
            const codePreElements = contentRef.current.querySelectorAll('pre');
            codePreElements.forEach((pre) => {
                const codeEl = pre.querySelector('code');
                const classList = codeEl ? Array.from(codeEl.classList) : [];

                if (classList.includes('language-mermaid') || pre.dataset.mermaidRendered) {
                    return; // Ignora gráficos Mermaid
                }

                if (pre.querySelector('.copy-code-btn')) return;

                const langMatch = classList.find(c => c.startsWith('language-'));
                const langName = langMatch ? langMatch.replace('language-', '').toUpperCase() : 'CODE';

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
        };

        renderContentElements();
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

                    {/* Botão de Continuar e Aprofundar Estudo */}
                    {expandStudyMaterial && (
                        <button
                            onClick={() => expandStudyMaterial(currentTrail)}
                            disabled={refreshLimitReached || isExpandingStudy}
                            title={refreshLimitReached ? 'Limite de atualizações/expansões atingido' : 'Continuar e aprofundar este estudo com novo módulo da IA'}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs py-2 px-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 flex items-center gap-1 shadow-sm"
                        >
                            {isExpandingStudy ? (
                                <span className="flex items-center gap-1 animate-pulse">⚡ Aprofundando...</span>
                            ) : (
                                <span>⏩ Aprofundar Estudo</span>
                            )}
                        </button>
                    )}

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
            <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-3 flex-shrink-0 pt-4 border-t border-slate-100 dark:border-gray-700">
                <button
                    onClick={() => setAppState('trail_options')}
                    className="w-full sm:w-auto text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline text-sm transition-colors text-center"
                >
                    ← Voltar às Opções
                </button>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    {expandStudyMaterial && (
                        <button
                            onClick={() => expandStudyMaterial(currentTrail)}
                            disabled={refreshLimitReached || isExpandingStudy}
                            className="w-full sm:w-auto bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold py-3 px-5 rounded-2xl border border-indigo-200 dark:border-indigo-800 transition-all text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                            {isExpandingStudy ? (
                                <span className="animate-pulse">⚡ Gerando próximo módulo avançado...</span>
                            ) : (
                                <span>⏩ Continuar & Aprofundar Conteúdo (IA)</span>
                            )}
                        </button>
                    )}

                    <button
                        onClick={handleFinishStudyAndStartQuiz}
                        className="w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white font-extrabold py-3 px-6 rounded-2xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                        <span>{userData.hearts <= 0 ? "Concluir Estudo & Restaurar Corações!" : "Concluir Estudo & Iniciar Quiz →"}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
