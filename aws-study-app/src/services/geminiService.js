/**
 * Serviço de IA unificado via OpenRouter (API compatível com OpenAI Chat Completions).
 * Permite trocar entre modelos de múltiplos provedores (Google, OpenAI, Meta, DeepSeek, etc.)
 * usando uma única chave de API (VITE_OPENROUTER_API_KEY).
 */
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const DEFAULT_MODEL = 'google/gemini-2.5-flash';

export const AI_MODELS = [
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)' },
    { id: 'google/gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite (Rápido/Barato)' },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)' },
    { id: 'openai/gpt-4o', name: 'GPT-4o (OpenAI Premium)' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Anthropic)' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (Meta)' },
    { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3' },
    { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
    { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Grátis)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Grátis)' },
];

// Alias mantido para retrocompatibilidade com imports existentes
export const GEMINI_MODELS = AI_MODELS;

// Cadeia de fallbacks caso o modelo principal falhe ou esteja indisponível
const FALLBACK_CHAIN = [
    'google/gemini-2.5-flash',
    'meta-llama/llama-3.3-70b-instruct',
    'google/gemini-2.0-flash-exp:free',
];

/**
 * Executa a chamada à API (OpenRouter) com suporte a fallback de modelos.
 * Mantém a assinatura original (payload no formato Gemini) para não quebrar os consumidores.
 */
export const callGeminiAPI = async (payload, selectedModel = DEFAULT_MODEL, isRoot = false) => {
    if (!OPENROUTER_API_KEY) {
        throw new Error("VITE_OPENROUTER_API_KEY não configurada no arquivo .env");
    }

    // Converte o payload do formato Gemini para mensagens no formato OpenAI/OpenRouter
    const userText = payload.contents
        ?.map(c => (c.parts || []).map(p => p.text).join('\n'))
        .join('\n\n') || '';

    const attemptApiCall = async (model) => {
        try {
            const response = await fetch(OPENROUTER_URL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'StudyBot - Plataforma de Estudos',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [{ role: 'user', content: userText }],
                    response_format: { type: 'json_object' },
                }),
            });

            if (!response.ok) {
                const errBody = await response.text().catch(() => '');
                throw new Error(`OpenRouter HTTP ${response.status}: ${errBody.slice(0, 300)}`);
            }

            const data = await response.json();
            let jsonText = data?.choices?.[0]?.message?.content;

            if (jsonText && typeof jsonText === 'string') {
                // Remove formatação markdown se houver
                jsonText = jsonText.replace(/```json\n?|```/g, '').trim();
            }

            if (!jsonText) {
                throw new Error("A resposta da IA está vazia ou em formato inválido.");
            }
            return JSON.parse(jsonText);
        } catch (error) {
            console.error(`Falha na chamada da API com o modelo ${model}:`, error);
            throw error;
        }
    };

    // Tenta primeiro o modelo selecionado pelo usuário (se for Root/Admin)
    if (isRoot && selectedModel) {
        try {
            console.log(`Usuário root executando modelo customizado: ${selectedModel}`);
            return await attemptApiCall(selectedModel);
        } catch (error) {
            console.warn(`Falha no modelo selecionado ${selectedModel}. Utilizando modelo fallback.`, error);
        }
    }

    // Tenta a cadeia de fallbacks em ordem
    let lastError = null;
    for (const model of FALLBACK_CHAIN) {
        try {
            return await attemptApiCall(model);
        } catch (error) {
            lastError = error;
        }
    }
    throw new Error(`Não foi possível obter resposta da IA: ${lastError?.message || 'erro desconhecido'}`);
};

/**
 * Gera conteúdo rico (Material de Estudo, Quiz de Simulados ou Flashcards Anki).
 * Detecta se o tópico é específico de AWS ou se é um assunto genérico/customizado pelo usuário.
 */
export const fetchGeneratedStudyContent = async (trail, type, selectedModel = 'gemini-2.5-flash', isRoot = false) => {
    let prompt = '';
    let responseSchema = null;

    const topicTitle = trail.title || '';
    const topicContent = trail.content || '';
    const isAwsTopic = topicTitle.toLowerCase().includes('aws') || 
                       topicContent.toLowerCase().includes('aws') || 
                       (trail.id && trail.id.startsWith('level-'));

    const systemRole = isAwsTopic
        ? 'Você é um Instrutor especialista certificado AWS (AWS Certified Solutions Architect & DevOps Professional).'
        : `Você é um Instrutor e Professor especialista altamente qualificado no assunto "${topicTitle || 'Estudos'}".`;

    switch (type) {
        case 'study':
            if (isAwsTopic) {
                prompt = `${systemRole}
Crie um material de estudo didático, estruturado e aprofundado sobre o tema abaixo.
Diretrizes Obrigatórias:
- Use analogias do mundo real e cenários práticos de arquitetura de nuvem.
- Inclua dicas específicas para os exames de certificação AWS (AWS Certified Cloud Practitioner / Solutions Architect).
- Destaque boas práticas da AWS (AWS Well-Architected Framework: Segurança, Resiliência, Eficiência de Custos).
- REGRA CRÍTICA DE FORMATAÇÃO DE CÓDIGO, JSON, GRÁFICOS E MATEMÁTICA:
  - Todo e qualquer exemplo de JSON (como políticas de IAM, Buckets, Payloads ou configurações) DEVE ser formatado dentro de blocos de código Markdown (\`\`\`json ... \`\`\`).
  - O JSON DEVE ser um JSON VÁLIDO com aspas duplas em TODAS as chaves e valores string (ex: "Version": "2012-10-17", "Effect": "Allow").
  - Para trechos de código (Python, Bash, SQL, Terraform, etc.), especifique a linguagem após as três crases (ex: \`\`\`python, \`\`\`bash, \`\`\`sql) e use indentação perfeita de 4 espaços.
  - Para GRÁFICOS, DIAGRAMAS DE ARQUITETURA, FLUXOGRAMAS OU COMPARATIVOS VISUAIS: Use obrigatoriamente a sintaxe Mermaid em blocos \`\`\`mermaid (ex: graph TD, sequenceDiagram, pie, bar, mindmap). O app possui renderizador de gráficos nativo!
  - Se houver fórmulas matemáticas ou cálculos (ex: cálculo de SLA de disponibilidade, ROI, transferência de dados, equações), use sintaxe LaTeX entre cifrões (ex: $E = mc^2$ para em linha ou $$ \\int_0^\\infty e^{-x^2} dx $$ para blocos de equação).

Conteúdo base do tópico:
"""${topicContent}"""

Retorne um JSON com a chave "studyMaterial" contendo o texto formatado em Markdown rico.`;
            } else {
                prompt = `${systemRole}
Crie um material de estudo didático e aprofundado estritamente sobre o conteúdo fornecido pelo usuário.
Diretrizes Obrigatórias:
- Foque EXCLUSIVAMENTE no assunto fornecido (${topicTitle}). NÃO mencione AWS ou nuvem AWS a menos que o conteúdo explicitamente peça.
- Use analogias claras, exemplos práticos e explicações didáticas passo a passo.
- REGRA CRÍTICA DE FORMATAÇÃO DE CÓDIGO, JSON, GRÁFICOS E MATEMÁTICA:
  - Todo e qualquer exemplo de código, comando ou JSON DEVE ser formatado dentro de blocos de código Markdown com a linguagem especificada (ex: \`\`\`json, \`\`\`python, \`\`\`bash, \`\`\`javascript).
  - O JSON DEVE ser um JSON VÁLIDO com aspas duplas obrigatoriamente em TODAS as chaves e valores string e indentação de 4 espaços.
  - Para GRÁFICOS OU DIAGRAMAS VISUAIS: Use obrigatoriamente a sintaxe Mermaid em blocos \`\`\`mermaid (ex: graph TD, sequenceDiagram, pie, bar, mindmap). O app possui renderizador de gráficos nativo!
  - Se houver fórmulas matemáticas ou equações no assunto, formate em LaTeX entre $ ... $ para equações em linha ou $$ ... $$ para blocos de equação centralizados.

Conteúdo base fornecido pelo usuário:
"""${topicContent}"""

Retorne um JSON com a chave "studyMaterial" contendo o texto formatado em Markdown rico.`;
            }

            responseSchema = {
                type: "OBJECT",
                properties: {
                    studyMaterial: { type: "STRING" }
                },
                required: ["studyMaterial"]
            };
            break;

        case 'expand_study':
            if (isAwsTopic) {
                prompt = `${systemRole}
O aluno já estudou o seguinte conteúdo base sobre "${topicTitle}":
"""
${topicContent}
"""

O aluno solicitou CONTINUAR E APROFUNDAR O ESTUDO sobre "${topicTitle}".
Crie um MÓDULO DE APROFUNDAMENTO (Continuação Avançada).
Diretrizes Obrigatórias:
- NÃO repita o que já foi explicado no conteúdo base acima.
- Traga novos conceitos avançados, cenários práticos de arquitetura de nuvem em produção, estudos de caso reais e dicas de nível profissional/DevOps.
- Inclua novos comandos de CLI, diagramas Mermaid ou códigos bem indentados.
- Comece o texto diretamente com um título claro de nível 2 (ex: ## 🚀 Módulo de Aprofundamento: Arquitetura & Práticas Avançadas).

Retorne um JSON com a chave "studyMaterial" contendo o texto da continuação formatado em Markdown rico.`;
            } else {
                prompt = `${systemRole}
O aluno já estudou o seguinte conteúdo base sobre "${topicTitle}":
"""
${topicContent}
"""

O aluno solicitou CONTINUAR E APROFUNDAR O ESTUDO.
Crie um MÓDULO DE APROFUNDAMENTO (Continuação Avançada) focado no assunto "${topicTitle}".
Diretrizes Obrigatórias:
- NÃO repita conceitos já explicados no conteúdo base fornecido.
- Traga tópicos avançados, exemplos práticos do mundo real, detalhamento passo a passo e códigos/diagramas complementares.
- Comece o texto diretamente com um título claro de nível 2 (ex: ## 🚀 Módulo Avançado: Aprofundamento Prático).

Retorne um JSON com a chave "studyMaterial" contendo o texto da continuação formatado em Markdown rico.`;
            }

            responseSchema = {
                type: "OBJECT",
                properties: {
                    studyMaterial: { type: "STRING" }
                },
                required: ["studyMaterial"]
            };
            break;

        case 'quiz':
            if (isAwsTopic) {
                prompt = `Você é um examinador oficial de certificações AWS.
Com base no material fornecido, gere 5 questões de simulado no padrão dos exames reais da AWS (baseadas em cenários práticos de empresas/arquitetura).
Para cada pergunta, forneça:
1. "question": A pergunta contextualizada em um cenário prático.
2. "options": 4 alternativas (A, B, C, D).
3. "correctAnswer": A alternativa exatamente igual a uma das opções em "options".
4. "explanation": Explicação detalhada explicando POR QUE a resposta correta está certa E por que as outras alternativas seriam incorretas ou subótimas na AWS.

Material base:
"""${topicContent}"""

Retorne o resultado estritamente no esquema JSON especificado.`;
            } else {
                prompt = `Você é um professor especialista criando um quiz de avaliação sobre o tema "${topicTitle}".
Com base no material fornecido pelo usuário, gere 5 questões de múltipla escolha focadas estritamente no assunto. NÃO mencione AWS se o assunto for outro.
Para cada pergunta, forneça:
1. "question": A pergunta contextualizada e objetiva.
2. "options": 4 alternativas (A, B, C, D).
3. "correctAnswer": A alternativa exatamente igual a uma das opções em "options".
4. "explanation": Explicação didática explicando por que a resposta correta está certa e por que as demais estão incorretas.

Material base:
"""${topicContent}"""

Retorne o resultado estritamente no esquema JSON especificado.`;
            }

            responseSchema = {
                type: "OBJECT",
                properties: {
                    questions: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                question: { type: "STRING" },
                                options: { type: "ARRAY", items: { type: "STRING" } },
                                correctAnswer: { type: "STRING" },
                                explanation: { type: "STRING" }
                            },
                            required: ["question", "options", "correctAnswer", "explanation"]
                        }
                    }
                },
                required: ["questions"]
            };
            break;

        case 'anki':
            if (isAwsTopic) {
                prompt = `Com base no material a seguir, gere 10 flashcards no estilo Anki (Repetição Espaçada) focado nos conceitos-chave de AWS.
Cada cartão deve conter:
- "front": Uma pergunta concisa ou conceito chave.
- "back": A resposta exata e objetiva com uma breve justificativa técnica.

Material base:
"""${topicContent}"""

Retorne o resultado no esquema JSON especificado.`;
            } else {
                prompt = `Com base no material fornecido sobre "${topicTitle}", gere 10 flashcards no estilo Anki (Repetição Espaçada) focados nos conceitos principais do tema. NÃO envolva AWS se o assunto for outro.
Cada cartão deve conter:
- "front": Uma pergunta concisa ou conceito chave.
- "back": A resposta objetiva e clara.

Material base:
"""${topicContent}"""

Retorne o resultado no esquema JSON especificado.`;
            }

            responseSchema = {
                type: "OBJECT",
                properties: {
                    cards: {
                        type: "ARRAY",
                        items: {
                            type: "OBJECT",
                            properties: {
                                front: { type: "STRING" },
                                back: { type: "STRING" }
                            },
                            required: ["front", "back"]
                        }
                    }
                },
                required: ["cards"]
            };
            break;

        default:
            throw new Error(`Tipo de conteúdo inválido: ${type}`);
    }

    const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: responseSchema
        }
    };

    return await callGeminiAPI(payload, selectedModel, isRoot);
};
