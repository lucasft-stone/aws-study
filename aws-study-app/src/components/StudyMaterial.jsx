import React, { useState, useEffect, useRef } from 'react';
import { marked } from 'marked';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { checkIsAdmin, updateProgressCache } from '../services/firebaseService';

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
    MAX_DAILY_REFRESHES,
    updateStudyContent
}) {
    const isRoot = checkIsAdmin(user);
    const refreshLimitReached = userData.dailyRefreshes >= MAX_DAILY_REFRESHES && !isRoot;
    
    // Controle de Tamanho de Fonte para leitura confortável (0: P, 1: M, 2: G, 3: GG)
    const [fontSizeLevel, setFontSizeLevel] = useState(1);
    const [copiedToast, setCopiedToast] = useState(false);
    const [isEditingFullMaterial, setIsEditingFullMaterial] = useState(false);
    const [isFocusMode, setIsFocusMode] = useState(false); // Modo Foco Zen / Fullscreen
    const [mobileEditorTab, setMobileEditorTab] = useState('edit'); // 'edit' ou 'preview' para mobile
    const [editableText, setEditableText] = useState(studyContent || '');
    const contentRef = useRef(null);
    const toolbarScrollRef = useRef(null);

    // Permite rolar a barra de opções na horizontal usando a roda do mouse (wheel)
    const handleToolbarWheel = (e) => {
        if (toolbarScrollRef.current && e.deltaY !== 0) {
            toolbarScrollRef.current.scrollLeft += e.deltaY * 0.8;
        }
    };

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
            if (!rawText) return '';
            let text = rawText
                .replace(/&gt;/g, '>')
                .replace(/&lt;/g, '<')
                .replace(/&amp;/g, '&')
                .replace(/\\n/g, '\n')
                .trim();

            text = text.replace(/["'}\s]+$/g, '').trim();

            let lines = text.split('\n').filter(Boolean);

            // Remove a palavra "mermaid" ou "mermaid-js" se estiver isolada na primeira linha
            if (lines.length > 0 && /^mermaid(-js)?$/i.test(lines[0].trim())) {
                lines.shift();
            }

            const firstKeywordIdx = lines.findIndex(line => {
                const trimmed = line.trim().toLowerCase();
                return mermaidKeywords.some(kw => trimmed.startsWith(kw.toLowerCase()));
            });

            if (firstKeywordIdx !== -1) {
                lines = lines.slice(firstKeywordIdx);
            }

            let code = lines.join('\n').trim();

            // Auto-identação e sanitização avançada de nós para mindmaps
            if (code.toLowerCase().startsWith('mindmap')) {
                let mLines = code.split('\n').map(l => l.trimRight()).filter(Boolean);
                if (mLines.length > 1) {
                    // Sanitiza o nó raiz do mindmap
                    mLines[1] = mLines[1].trim()
                        .replace(/^root\s*\(\s*"([^"]+)"\s*\)$/gi, 'root["$1"]')
                        .replace(/^root\s*\(\s*([^)]+)\s*\)$/gi, 'root["$1"]')
                        .replace(/^root\s*\("([^"]+)"\)$/gi, 'root["$1"]');

                    if (mLines[1].startsWith('root') && !mLines[1].includes('[') && !mLines[1].includes('(')) {
                        const rootVal = mLines[1].replace(/^root\s*/, '').trim();
                        if (rootVal) mLines[1] = `root["${rootVal}"]`;
                    }

                    // Se os nós filhos não possuem recuo de espaços, aplica identação automática de 2 espaços
                    const hasIndent = mLines.slice(2).some(l => l.startsWith(' ') || l.startsWith('\t'));
                    if (!hasIndent) {
                        mLines = mLines.map((line, idx) => {
                            if (idx <= 1) return line.trim();
                            return '  ' + line.trim();
                        });
                    }
                }
                code = mLines.join('\n');
            }

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
                // Se o elemento já possui um gráfico SVG renderizado com sucesso, não precisa refazer
                if (el.querySelector('.mermaid-svg-display svg')) continue;
                el.dataset.diagramIndex = idx;

                const rawEncoded = el.dataset.mermaidCode;
                if (!rawEncoded) continue;

                const cleanCode = cleanMermaidSyntax(decodeURIComponent(rawEncoded));

                let svgResult = null;

                try {
                    const uniqueId = `mermaid_svg_${Date.now()}_${idx}`;
                    const res = await mermaid.render(uniqueId, cleanCode);
                    svgResult = res.svg;
                } catch {
                    try {
                        // Tentativa de Auto-Reparo 2: Converte notações de mindmap com parênteses e aspas duplas misturadas
                        const autoRepaired = cleanCode
                            .replace(/root\("([^"]+)"\)/gi, 'root["$1"]')
                            .replace(/\("([^"]+)"\)/g, '["$1"]')
                            .replace(/["'}\s]+$/g, '')
                            .trim();
                        const uniqueId2 = `mermaid_svg_rep_${Date.now()}_${idx}`;
                        const res2 = await mermaid.render(uniqueId2, autoRepaired);
                        svgResult = res2.svg;
                    } catch (err2) {
                        console.warn('Sintaxe do diagrama ajustada para exibição limpa:', err2);
                    }
                }

                if (svgResult) {
                    el.innerHTML = `
                        <div class="w-full flex flex-col items-center gap-2 max-w-full overflow-hidden">
                            <div class="w-full flex items-center justify-between gap-2 border-b border-indigo-900/60 pb-2 mb-1">
                                <span class="text-[10px] font-extrabold tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
                                    📊 Gráfico / Diagrama Visual
                                </span>
                                <button class="toggle-mermaid-editor-btn text-xs font-bold text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 px-3 py-1 rounded-xl transition-all border border-indigo-800/80 flex items-center gap-1 shadow-sm">
                                    ✏️ Editar Código
                                </button>
                            </div>

                            <div class="mermaid-svg-display w-full flex justify-center items-center overflow-x-auto max-w-full py-2">
                                ${svgResult}
                            </div>

                            <div class="mermaid-editor-form hidden w-full flex-col gap-3 text-left bg-slate-950/90 p-4 rounded-2xl border border-indigo-900/60 mt-2">
                                <label class="text-[11px] text-indigo-300 font-bold">Edite o código Mermaid abaixo para atualizar o gráfico:</label>
                                <textarea class="mermaid-editor-textarea w-full h-36 p-3 bg-slate-900 font-mono text-xs text-indigo-200 rounded-xl border border-indigo-800/80 focus:outline-none focus:border-indigo-500 resize-y">${cleanCode}</textarea>
                                <div class="flex items-center justify-between gap-2">
                                    <div class="mermaid-editor-error-msg hidden text-[11px] font-bold text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-xl border border-rose-800/60"></div>
                                    <button class="render-edited-mermaid-btn bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 ml-auto">
                                        ⚡ Atualizar Gráfico
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                } else {
                    el.className = 'mermaid-diagram-placeholder my-6 p-4 sm:p-5 bg-slate-900/95 text-slate-100 rounded-2xl border border-amber-500/40 shadow-2xl text-left max-w-full overflow-hidden flex flex-col gap-3';
                    el.innerHTML = `
                        <div class="flex flex-wrap items-center justify-between gap-2 text-xs border-b border-slate-800 pb-2">
                            <span class="font-extrabold text-amber-400 flex items-center gap-1.5">
                                ⚠️ Diagrama de Estudo (Ajuste de Sintaxe)
                            </span>
                            <button class="toggle-mermaid-editor-btn bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1 rounded-xl text-xs transition-colors flex items-center gap-1 shadow-sm">
                                ✏️ Editar e Renderizar
                            </button>
                        </div>

                        <div class="mermaid-code-view">
                            <pre class="text-xs text-slate-200 font-mono overflow-x-auto p-3 bg-slate-950/90 rounded-xl border border-slate-800/80 whitespace-pre max-w-full"><code>${cleanCode}</code></pre>
                        </div>

                        <div class="mermaid-editor-form hidden flex-col gap-3">
                            <label class="text-[11px] text-slate-400 font-bold">Ajuste o código Mermaid abaixo e clique em Renderizar:</label>
                            <textarea class="mermaid-editor-textarea w-full h-36 p-3 bg-slate-950 font-mono text-xs text-indigo-300 rounded-xl border border-indigo-900/80 focus:outline-none focus:border-indigo-500 resize-y">${cleanCode}</textarea>
                            <div class="flex items-center justify-between gap-2">
                                <div class="mermaid-editor-error-msg hidden text-[11px] font-bold text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-xl border border-rose-800/60"></div>
                                <button class="render-edited-mermaid-btn bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 ml-auto">
                                    ⚡ Renderizar Gráfico
                                </button>
                            </div>
                        </div>
                    `;
                }
            }

            // Atribui manipuladores de eventos para os botões de edição de Mermaid
            const toggleBtns = contentRef.current.querySelectorAll('.toggle-mermaid-editor-btn');
            toggleBtns.forEach(btn => {
                if (btn.dataset.editorBound) return;
                btn.dataset.editorBound = 'true';
                btn.addEventListener('click', (e) => {
                    const container = e.target.closest('.mermaid-diagram-placeholder');
                    if (!container) return;
                    const form = container.querySelector('.mermaid-editor-form');
                    if (form) {
                        form.classList.toggle('hidden');
                        form.classList.toggle('flex');
                    }
                });
            });

            const renderBtns = contentRef.current.querySelectorAll('.render-edited-mermaid-btn');
            renderBtns.forEach(btn => {
                if (btn.dataset.renderBound) return;
                btn.dataset.renderBound = 'true';
                btn.addEventListener('click', async (e) => {
                    const container = e.target.closest('.mermaid-diagram-placeholder');
                    if (!container) return;

                    const textarea = container.querySelector('.mermaid-editor-textarea');
                    const errorMsg = container.querySelector('.mermaid-editor-error-msg');
                    if (!textarea) return;

                    const diagramIdx = parseInt(container.dataset.diagramIndex || '0', 10);
                    const editedCode = textarea.value.trim();
                    if (!editedCode) return;

                    const codeToRender = cleanMermaidSyntax(editedCode);

                    try {
                        const newId = `mermaid_edited_${Date.now()}`;
                        const { svg } = await mermaid.render(newId, codeToRender);

                        container.className = 'mermaid-diagram-placeholder my-6 p-4 sm:p-6 bg-slate-900/95 text-slate-100 rounded-2xl border border-indigo-900/60 shadow-2xl text-center max-w-full overflow-hidden flex justify-center items-center';
                        container.dataset.mermaidCode = encodeURIComponent(codeToRender);
                        container.innerHTML = `
                            <div class="w-full flex flex-col items-center gap-2 max-w-full overflow-hidden">
                                <div class="w-full flex items-center justify-between gap-2 border-b border-indigo-900/60 pb-2 mb-1">
                                    <span class="text-[10px] font-extrabold tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60">
                                        📊 Gráfico / Diagrama Visual
                                    </span>
                                    <button class="toggle-mermaid-editor-btn text-xs font-bold text-indigo-300 hover:text-white bg-indigo-950/80 hover:bg-indigo-900 px-3 py-1 rounded-xl transition-all border border-indigo-800/80 flex items-center gap-1 shadow-sm">
                                        ✏️ Editar Código
                                    </button>
                                </div>

                                <div class="mermaid-svg-display w-full flex justify-center items-center overflow-x-auto max-w-full py-2">
                                    ${svg}
                                </div>

                                <div class="mermaid-editor-form hidden w-full flex-col gap-3 text-left bg-slate-950/90 p-4 rounded-2xl border border-indigo-900/60 mt-2">
                                    <label class="text-[11px] text-indigo-300 font-bold">Edite o código Mermaid abaixo para atualizar o gráfico:</label>
                                    <textarea class="mermaid-editor-textarea w-full h-36 p-3 bg-slate-900 font-mono text-xs text-indigo-200 rounded-xl border border-indigo-800/80 focus:outline-none focus:border-indigo-500 resize-y">${editedCode}</textarea>
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="mermaid-editor-error-msg hidden text-[11px] font-bold text-rose-400 bg-rose-950/80 px-3 py-1.5 rounded-xl border border-rose-800/60"></div>
                                        <button class="render-edited-mermaid-btn bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 ml-auto">
                                            ⚡ Atualizar Gráfico
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;

                        // Persiste a edição do gráfico pelo seu índice ordinal no texto do material e no Firestore/localStorage
                        if (studyContent && editedCode) {
                            const replaceNthDiagramInContent = (fullText, targetIdx, codeToInsert) => {
                                if (!fullText) return fullText;

                                const fencedRegex = /```\s*(?:mermaid|mermaid-js)?\s*([\s\S]*?)```/gi;
                                let matchCount = 0;
                                const replaced = fullText.replace(fencedRegex, (fullMatch, block) => {
                                    const lower = (block || '').trim().toLowerCase();
                                    if (lower.startsWith('mermaid') || lower.startsWith('graph') || lower.startsWith('flowchart') || lower.startsWith('sequencediagram') || lower.startsWith('mindmap') || lower.startsWith('classdiagram') || lower.startsWith('erdiagram') || lower.startsWith('gantt') || lower.startsWith('pie')) {
                                        if (matchCount === targetIdx) {
                                            matchCount++;
                                            return '```mermaid\n' + codeToInsert + '\n```';
                                        }
                                        matchCount++;
                                    }
                                    return fullMatch;
                                });

                                if (matchCount > targetIdx) {
                                    return replaced;
                                }

                                const unfencedRegex = /(?:^|\n)(?:mermaid\s*\n)?\s*(?:graph|flowchart|sequenceDiagram|pie|gantt|classDiagram|mindmap)[\s\S]*?(?=\n\n|\n#|$)/gi;
                                let unfencedCount = 0;

                                return fullText.replace(unfencedRegex, () => {
                                    if (unfencedCount === targetIdx) {
                                        unfencedCount++;
                                        return '\n```mermaid\n' + codeToInsert + '\n```\n';
                                    }
                                    unfencedCount++;
                                });
                            };

                            const updatedFullText = replaceNthDiagramInContent(studyContent, diagramIdx, codeToRender);

                            container.dataset.renderedCode = encodeURIComponent(codeToRender);

                            if (updateStudyContent) {
                                updateStudyContent(updatedFullText);
                            }

                            if (user?.uid && currentTrail?.id) {
                                updateProgressCache(user.uid, currentTrail.id, 'cachedStudy', updatedFullText).catch(e =>
                                    console.warn('Erro ao salvar edição de gráfico no Firestore:', e)
                                );
                            }
                        }

                        // Re-bind dos botões recém-injetados no DOM
                        const newToggleBtn = container.querySelector('.toggle-mermaid-editor-btn');
                        if (newToggleBtn) {
                            newToggleBtn.addEventListener('click', () => {
                                const form = container.querySelector('.mermaid-editor-form');
                                if (form) {
                                    form.classList.toggle('hidden');
                                    form.classList.toggle('flex');
                                }
                            });
                        }
                    } catch (err) {
                        console.warn("Erro na edição live do Mermaid:", err);
                        if (errorMsg) {
                            errorMsg.textContent = '❌ Erro de sintaxe: Verifique aspas, parênteses ou delimitadores.';
                            errorMsg.classList.remove('hidden');
                        }
                    }
                });
            });

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

        let isSubscribed = true;
        const safeRender = () => {
            if (isSubscribed) renderContentElements();
        };

        requestAnimationFrame(safeRender);
        const timer1 = setTimeout(safeRender, 30);
        const timer2 = setTimeout(safeRender, 150);
        const timer3 = setTimeout(safeRender, 400);

        return () => {
            isSubscribed = false;
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }, [formattedContent, studyContent, currentTrail?.id, updateStudyContent, user?.uid]);

    return (
        <div className="w-full max-w-4xl bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-4 sm:p-8 flex flex-col h-[91vh] sm:h-[88vh] border border-slate-100 dark:border-gray-700 animate-fade-in relative">
            
            {/* Toast de código copiado */}
            {copiedToast && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-bold py-2 px-4 rounded-full shadow-lg border border-slate-700 animate-bounce">
                    ⚡ Código copiado para a área de transferência!
                </div>
            )}

            {/* Cabeçalho de Leitura Responsivo com Barra Deslizante Horizontal */}
            <div className="flex flex-col gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-gray-700/80 flex-shrink-0">
                <div className="flex justify-between items-center gap-2">
                    <span className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                        📖 Material de Estudo
                    </span>
                    <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-gray-700/60 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        ⏱️ ~{readingTimeMinutes} min de leitura
                    </span>
                </div>

                <h1 className="text-lg sm:text-2xl font-extrabold text-slate-800 dark:text-white text-left leading-tight">
                    {currentTrail?.title}
                </h1>

                {/* Barra de Ações 100% Rolante na Horizontal (Suporta Gestos Touch, Trackpad e Roda do Mouse) */}
                <div 
                    ref={toolbarScrollRef}
                    onWheel={handleToolbarWheel}
                    className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 w-full flex-nowrap flex-shrink-0 mt-1 touch-pan-x scroll-smooth select-none"
                >
                    {/* Controles de Zoom de Fonte */}
                    <div className="flex items-center bg-slate-100 dark:bg-gray-700/60 p-0.5 rounded-xl gap-0.5 flex-shrink-0">
                        <button
                            onClick={() => setFontSizeLevel(prev => Math.max(0, prev - 1))}
                            disabled={fontSizeLevel === 0}
                            title="Diminuir tamanho da fonte"
                            className="w-6 h-6 sm:w-7 sm:h-7 font-bold text-xs rounded-lg hover:bg-white dark:hover:bg-gray-600 disabled:opacity-30 transition-colors text-slate-700 dark:text-slate-200"
                        >
                            A-
                        </button>
                        <span className="text-[10px] font-bold text-slate-400 px-1">
                            {fontSizeLevel === 0 ? 'P' : fontSizeLevel === 1 ? 'M' : fontSizeLevel === 2 ? 'G' : 'GG'}
                        </span>
                        <button
                            onClick={() => setFontSizeLevel(prev => Math.min(3, prev + 1))}
                            disabled={fontSizeLevel === 3}
                            title="Aumentar tamanho da fonte"
                            className="w-6 h-6 sm:w-7 sm:h-7 font-bold text-xs rounded-lg hover:bg-white dark:hover:bg-gray-600 disabled:opacity-30 transition-colors text-slate-700 dark:text-slate-200"
                        >
                            A+
                        </button>
                    </div>

                    {/* Botão de Modo Foco Zen (Fullscreen) */}
                    <button
                        onClick={() => setIsFocusMode(true)}
                        title="Expandir o material para tela cheia sem distrações (Modo Foco)"
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[11px] sm:text-xs py-1.5 px-3 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1 shadow-sm whitespace-nowrap flex-shrink-0"
                    >
                        🔍 Modo Foco
                    </button>

                    {/* Botão de Modo Edição Completa do Material */}
                    <button
                        onClick={() => {
                            setEditableText(studyContent || '');
                            setIsEditingFullMaterial(true);
                        }}
                        title="Editar o material completo, fórmulas e gráficos com visualização ao vivo em tempo real"
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-[11px] sm:text-xs py-1.5 px-3 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1 shadow-sm whitespace-nowrap flex-shrink-0"
                    >
                        ✏️ Editar Material
                    </button>

                    {/* Botão de Continuar e Aprofundar Estudo */}
                    {expandStudyMaterial && (
                        <button
                            onClick={() => expandStudyMaterial(currentTrail)}
                            disabled={refreshLimitReached || isExpandingStudy}
                            title={refreshLimitReached ? 'Limite de atualizações/expansões atingido' : 'Continuar e aprofundar este estudo com novo módulo da IA'}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[11px] sm:text-xs py-1.5 px-3 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-40 flex items-center gap-1 shadow-sm whitespace-nowrap flex-shrink-0"
                        >
                            {isExpandingStudy ? (
                                <span className="flex items-center gap-1 animate-pulse">⚡ Aprofundando...</span>
                            ) : (
                                <span>⏩ Aprofundar (IA)</span>
                            )}
                        </button>
                    )}

                    {/* Botão de Regerar Material com IA */}
                    <button
                        onClick={() => generateContent(currentTrail, 'study', true)}
                        disabled={refreshLimitReached}
                        title={refreshLimitReached ? 'Limite de atualizações diárias atingido' : 'Regerar este material de estudo com IA'}
                        className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 py-1.5 px-3 rounded-xl transition-colors disabled:opacity-40 border border-indigo-100 dark:border-indigo-900/50 flex items-center gap-1 text-[11px] sm:text-xs font-extrabold whitespace-nowrap flex-shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                        <span>🔄 Regerar</span>
                    </button>
                </div>
            </div>

            {/* Container do Conteúdo Formatado */}
            {studyContent ? (
                <div
                    ref={contentRef}
                    className={`markdown-content flex-grow overflow-y-auto pr-2 sm:pr-5 custom-scrollbar ${fontClasses[fontSizeLevel]}`}
                    dangerouslySetInnerHTML={{ __html: formattedContent }}
                />
            ) : (
                <div className="flex-grow flex flex-col items-center justify-center p-8 text-center text-slate-400 gap-3">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-bold text-sm">Carregando material de estudo...</p>
                </div>
            )}

            {/* Rodapé de Ações Limpo e Responsivo */}
            <div className="mt-3 sm:mt-6 flex flex-col sm:flex-row justify-between items-center gap-2.5 flex-shrink-0 pt-3 border-t border-slate-100 dark:border-gray-700">
                <button
                    onClick={() => setAppState('trail_options')}
                    className="w-full sm:w-auto text-indigo-600 dark:text-indigo-400 font-extrabold hover:underline text-xs sm:text-sm transition-colors text-center py-1"
                >
                    ← Voltar às Opções
                </button>
                
                <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => {
                            setEditableText(studyContent || '');
                            setIsEditingFullMaterial(true);
                        }}
                        className="sm:hidden flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold py-2.5 px-3 rounded-xl transition-all text-xs flex items-center justify-center gap-1 shadow-sm"
                    >
                        <span>✏️ Editar</span>
                    </button>

                    <button
                        onClick={handleFinishStudyAndStartQuiz}
                        className="w-full sm:w-auto flex-1 bg-green-500 hover:bg-green-600 text-white font-extrabold py-2.5 sm:py-3 px-4 sm:px-6 rounded-xl sm:rounded-2xl shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                        <span>{userData.hearts <= 0 ? "Concluir & Restaurar!" : "Concluir & Iniciar Quiz →"}</span>
                    </button>
                </div>
            </div>

            {/* Modal Overlay de Edição Completa do Material com Live Preview */}
            {isEditingFullMaterial && (
                <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col p-3 sm:p-6 animate-fade-in">
                    {/* Cabeçalho do Editor Completo */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 pb-3 mb-3 border-b border-slate-800 flex-shrink-0">
                        <div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2.5 py-0.5 rounded-full border border-amber-800/60">
                                ✏️ Modo Edição Completa & Live Preview
                            </span>
                            <h2 className="text-base sm:text-xl font-extrabold text-white mt-1 line-clamp-1">
                                {currentTrail?.title}
                            </h2>
                        </div>
                        
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                                onClick={async () => {
                                    if (user?.uid && currentTrail?.id) {
                                        try {
                                            await updateProgressCache(user.uid, currentTrail.id, 'cachedStudy', editableText);
                                        } catch (e) {
                                            console.warn('Erro ao salvar no Firestore:', e);
                                        }
                                    }
                                    if (updateStudyContent) {
                                        updateStudyContent(editableText);
                                    }
                                    setIsEditingFullMaterial(false);
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs transition-all shadow-lg flex items-center gap-1.5"
                            >
                                💾 Salvar Estudo
                            </button>
                            <button
                                onClick={() => setIsEditingFullMaterial(false)}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs transition-colors"
                            >
                                ❌ Sair
                            </button>
                        </div>
                    </div>

                    {/* Alternador de Abas apenas no Mobile */}
                    <div className="flex lg:hidden bg-slate-900 p-1 rounded-xl mb-2.5 border border-slate-800 flex-shrink-0">
                        <button
                            onClick={() => setMobileEditorTab('edit')}
                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all ${mobileEditorTab === 'edit' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            📝 Editar Conteúdo
                        </button>
                        <button
                            onClick={() => setMobileEditorTab('preview')}
                            className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all ${mobileEditorTab === 'preview' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
                        >
                            👁️ Live Preview
                        </button>
                    </div>

                    {/* Layout Split no Desktop (lg), Alternado por Abas no Mobile */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-grow overflow-hidden">
                        {/* Painel Esquerdo: Textarea de Edição Completa */}
                        <div className={`flex flex-col bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-800 overflow-hidden ${mobileEditorTab === 'edit' ? 'flex' : 'hidden lg:flex'}`}>
                            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 text-xs text-slate-400 flex-shrink-0">
                                <span className="font-bold text-amber-400">📝 Código Markdown / Math / Mermaid</span>
                                <span className="text-[10px] text-slate-500 font-mono">{editableText.length} chars</span>
                            </div>

                            {/* Barra de Ferramentas de Inserção Rápida */}
                            <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-slate-800/80 overflow-x-auto no-scrollbar flex-shrink-0">
                                <button
                                    onClick={() => setEditableText(prev => prev + '\n\n```mermaid\ngraph TD\nA["Início"] --> B["Resultado"]\n```\n')}
                                    className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-1 rounded-lg hover:bg-indigo-900 whitespace-nowrap flex-shrink-0"
                                >
                                    + Diagrama Mermaid
                                </button>
                                <button
                                    onClick={() => setEditableText(prev => prev + '\n\n$$ \\sum_{i=1}^{n} a_i $$\n')}
                                    className="text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800 px-2 py-1 rounded-lg hover:bg-purple-900 whitespace-nowrap flex-shrink-0"
                                >
                                    + Fórmula LaTeX
                                </button>
                                <button
                                    onClick={() => setEditableText(prev => prev + '\n\n```python\ndef lambda_handler(event, context):\n    return {"status": 200}\n```\n')}
                                    className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-1 rounded-lg hover:bg-emerald-900 whitespace-nowrap flex-shrink-0"
                                >
                                    + Bloco Python
                                </button>
                                <button
                                    onClick={() => setEditableText(prev => prev + '\n\n### Novo Tópico de Estudo\n')}
                                    className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-1 rounded-lg hover:bg-amber-900 whitespace-nowrap flex-shrink-0"
                                >
                                    + Título ###
                                </button>
                            </div>

                            <textarea
                                value={editableText}
                                onChange={(e) => setEditableText(e.target.value)}
                                className="w-full flex-grow p-3 bg-slate-950 font-mono text-xs text-slate-100 rounded-xl border border-slate-800 focus:outline-none focus:border-amber-500 resize-none custom-scrollbar leading-relaxed"
                            />
                        </div>

                        {/* Painel Direito: Visualização em Tempo Real (Live Preview) */}
                        <div className={`flex flex-col bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-800 overflow-hidden ${mobileEditorTab === 'preview' ? 'flex' : 'hidden lg:flex'}`}>
                            <div className="pb-2 mb-2 border-b border-slate-800 text-xs font-bold text-emerald-400 flex-shrink-0">
                                👁️ Visualização em Tempo Real (Live Preview)
                            </div>
                            
                            <LiveMaterialPreview
                                text={editableText}
                                fixAndFormatAllJsonInMarkdown={fixAndFormatAllJsonInMarkdown}
                                renderLatexMathFormulas={renderLatexMathFormulas}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Fullscreen de Modo Foco Zen Minimalista */}
            {isFocusMode && (
                <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 p-4 sm:p-8 flex flex-col h-full w-full animate-fade-in">
                    {/* Cabeçalho Minimalista Discreto */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 flex-shrink-0 max-w-4xl mx-auto w-full">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-400">
                                Modo Leitura Minimalista
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Zoom da Fonte Minimalista */}
                            <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-lg gap-0.5">
                                <button onClick={() => setFontSizeLevel(prev => Math.max(0, prev - 1))} disabled={fontSizeLevel === 0} className="w-6 h-6 font-bold text-xs rounded text-slate-400 hover:text-white">A-</button>
                                <span className="text-[10px] font-bold text-slate-500 px-1">{fontSizeLevel === 0 ? 'P' : fontSizeLevel === 1 ? 'M' : fontSizeLevel === 2 ? 'G' : 'GG'}</span>
                                <button onClick={() => setFontSizeLevel(prev => Math.min(3, prev + 1))} disabled={fontSizeLevel === 3} className="w-6 h-6 font-bold text-xs rounded text-slate-400 hover:text-white">A+</button>
                            </div>

                            <button
                                onClick={() => setIsFocusMode(false)}
                                className="text-xs font-bold text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-800 transition-colors"
                            >
                                ✕ Sair (Esc)
                            </button>
                        </div>
                    </div>

                    {/* Leitura Focada Totalmente Limpa e Centrada */}
                    <div
                        ref={contentRef}
                        className={`markdown-content flex-grow overflow-y-auto pr-2 sm:pr-6 custom-scrollbar max-w-3xl mx-auto w-full ${fontClasses[fontSizeLevel]} leading-relaxed`}
                        dangerouslySetInnerHTML={{ __html: formattedContent }}
                    />
                </div>
            )}
        </div>
    );
}

// Subcomponente de Visualização em Tempo Real (Live Preview)
function LiveMaterialPreview({ text, fixAndFormatAllJsonInMarkdown, renderLatexMathFormulas }) {
    const previewRef = useRef(null);
    const processedJson = fixAndFormatAllJsonInMarkdown(text || '');
    const processedMath = renderLatexMathFormulas(processedJson);
    const html = marked.parse(processedMath, { breaks: true, gfm: true });

    useEffect(() => {
        if (!previewRef.current) return;
        const timer = setTimeout(() => {
            const placeholders = Array.from(previewRef.current.querySelectorAll('.mermaid-diagram-placeholder'));
            placeholders.forEach(async (el, idx) => {
                if (el.dataset.mermaidRendered) return;
                el.dataset.mermaidRendered = 'true';
                const rawEncoded = el.dataset.mermaidCode || '';
                const code = decodeURIComponent(rawEncoded);
                try {
                    const uniqueId = `mermaid_live_prev_${Date.now()}_${idx}`;
                    const { svg } = await mermaid.render(uniqueId, code);
                    el.innerHTML = `
                        <div class="w-full flex flex-col items-center gap-2 max-w-full overflow-hidden">
                            <div class="text-[10px] font-extrabold tracking-wider uppercase text-indigo-400 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800/60 mb-1">
                                📊 Gráfico / Diagrama Visual
                            </div>
                            <div class="w-full flex justify-center items-center overflow-x-auto max-w-full py-2">${svg}</div>
                        </div>
                    `;
                } catch {
                    el.innerHTML = `<pre class="text-xs text-slate-200 font-mono p-3 bg-slate-950 rounded-xl"><code>${code}</code></pre>`;
                }
            });
        }, 50);
        return () => clearTimeout(timer);
    }, [html, text]);

    return (
        <div
            ref={previewRef}
            className="markdown-content flex-grow overflow-y-auto pr-3 custom-scrollbar text-slate-100 text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
