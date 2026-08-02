import { GoogleGenAI } from "@google/genai";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const GEMINI_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Recomendado)' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash' },
    { id: 'gemma-3-27b-it', name: 'Gemma 3.27B IT' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite' },
];

/**
 * Executa a chamada à API Gemini com suporte a fallback de modelos.
 */
export const callGeminiAPI = async (payload, selectedModel = 'gemini-2.5-flash', isRoot = false) => {
    if (!genAI) {
        throw new Error("VITE_GEMINI_API_KEY não configurada no arquivo .env");
    }

    const attemptApiCall = async (model) => {
        try {
            let config = payload.generationConfig;
            // O modelo Gemma 3 não suporta responseMimeType nem responseSchema estruturado
            if (model.includes('gemma')) {
                config = { ...config };
                delete config.responseMimeType;
                delete config.responseSchema;
            }

            const response = await genAI.models.generateContent({
                model: model,
                contents: payload.contents,
                config: config,
            });
            
            let jsonText = response.text;

            if (jsonText && typeof jsonText === 'string') {
                // Remove formatação markdown se houver
                jsonText = jsonText.replace(/```json\n?|```/g, '').trim();
            }

            if (!jsonText) {
                throw new Error("A resposta da IA está vazia ou em formato inválido.");
            }
            return JSON.parse(jsonText);
        } catch (error) {
            console.error(`Falha na chamada da API Gemini com o modelo ${model}:`, error);
            throw error;
        }
    };

    // Tenta primeiro o modelo selecionado pelo usuário se for Root ou tentar a ordem
    if (isRoot && selectedModel) {
        try {
            console.log(`Usuário root executando modelo customizado: ${selectedModel}`);
            return await attemptApiCall(selectedModel);
        } catch (error) {
            console.warn(`Falha no modelo selecionado ${selectedModel}. Utilizando modelo fallback.`, error);
        }
    }

    // Tenta o modelo padrão
    try {
        return await attemptApiCall('gemini-2.5-flash');
    } catch {
        // Segundo fallback caso o 2.5 flash oscile
        try {
            return await attemptApiCall('gemini-3-flash-preview');
        } catch (fallbackError) {
            throw new Error(`Não foi possível obter resposta da IA: ${fallbackError.message}`);
        }
    }
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
- REGRA CRÍTICA DE FORMATAÇÃO DE CÓDIGO E JSON:
  - Todo e qualquer exemplo de JSON (como políticas de IAM, Buckets, Payloads ou configurações) DEVE ser formatado dentro de blocos de código Markdown (\`\`\`json ... \`\`\`).
  - O JSON DEVE ser um JSON VÁLIDO com aspas duplas em TODAS as chaves e valores string (ex: "Version": "2012-10-17", "Effect": "Allow"). Jamais envie chaves ou valores sem aspas!
  - O JSON DEVE ter indentação perfeita de 2 espaços por nível e quebras de linha em cada propriedade.

Conteúdo base do tópico:
"""${topicContent}"""

Retorne um JSON com a chave "studyMaterial" contendo o texto formatado em Markdown rico.`;
            } else {
                prompt = `${systemRole}
Crie um material de estudo didático e aprofundado estritamente sobre o conteúdo fornecido pelo usuário.
Diretrizes Obrigatórias:
- Foque EXCLUSIVAMENTE no assunto fornecido (${topicTitle}). NÃO mencione AWS ou nuvem AWS a menos que o conteúdo explicitamente peça.
- Use analogias claras, exemplos práticos e explicações didáticas passo a passo.
- REGRA CRÍTICA DE FORMATAÇÃO DE CÓDIGO E JSON:
  - Todo e qualquer exemplo de código, comando ou JSON DEVE ser formatado dentro de blocos de código Markdown (\`\`\`json ... \`\`\` ou \`\`\`bash ... \`\`\`).
  - Todo JSON DEVE ser um JSON VÁLIDO com aspas duplas obrigatoriamente em TODAS as chaves e valores string (ex: "key": "value") com indentação perfeita de 2 espaços.

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
