# Relatório de Revisão do Projeto: StudyBot (aws-study)

Fiz uma revisão detalhada do código-fonte e da estrutura do projeto `aws-study-app`. O projeto é uma aplicação de estudos voltada para conceitos de AWS, utilizando **React 19**, **Tailwind CSS v4**, **Vite**, **Firebase** e o novo SDK oficial do Google (**@google/genai**).

Abaixo estão os pontos analisados, divididos por arquitetura, bugs encontrados, oportunidades de melhoria e experiência do usuário.

---

## 1. Arquitetura e Estrutura do Código

> [!NOTE]
> O arquivo [App.jsx](file:///workspaces/aws-study/aws-study-app/src/App.jsx) concentra toda a aplicação: componentes de UI, gerenciamento de estado global, lógica do Firebase, integração com Gemini, estilos CSS customizados e controle das telas de estudo.

### Recomendações de Arquitetura:
*   **Modularização de Componentes**: O arquivo principal tem quase 1000 linhas de código. Recomenda-se mover componentes reutilizáveis para arquivos separados dentro de `src/components/`:
    *   [StudyBot.jsx](file:///workspaces/aws-study/aws-study-app/src/components/StudyBot.jsx): Apenas a lógica e o SVG do mascote animado.
    *   [CardButton.jsx](file:///workspaces/aws-study/aws-study-app/src/components/CardButton.jsx): Botões de seleção de trilhas/opções.
    *   [LoadingScreen.jsx](file:///workspaces/aws-study/aws-study-app/src/components/LoadingScreen.jsx) e [ErrorBoundary.jsx](file:///workspaces/aws-study/aws-study-app/src/components/ErrorBoundary.jsx).
*   **Divisão de Páginas/Telas**: Mover as telas do switch `renderContent` (como `Home`, `Login`, `Quiz`, `Anki`, `StudyMaterial`) para `src/pages/` ou subcomponentes dedicados, melhorando consideravelmente a legibilidade e a manutenção.

---

## 2. Bugs Identificados 🐛

### A. Exclusão de Trilhas no Modo de Teste
No método [handleDeleteTrail](file:///workspaces/aws-study/aws-study-app/src/App.jsx#L357-L365):
```javascript
const handleDeleteTrail = async (trailId) => {
    if (!ENABLE_FIREBASE_AUTH || !user) return; // <-- BUG: Retorna antes de atualizar o estado local
    const userConfirmed = confirm("Tem certeza que deseja apagar esta trilha?");
    if (userConfirmed) {
        const trailRef = doc(db, 'users', user.uid, 'customTrails', trailId);
        await deleteDoc(trailRef);
        setCustomTrails(prev => prev.filter(t => t.id !== trailId));
    }
};
```
*   **Problema**: Se o Firebase estiver desativado (`ENABLE_FIREBASE_AUTH = false`), a função retorna imediatamente e o usuário não consegue excluir trilhas personalizadas criadas localmente.
*   **Correção**: Mudar a verificação para executar a exclusão local independentemente do Firebase estar ativo.

### B. Condições de Corrida no Estado `userData`
No método [updateUserData](file:///workspaces/aws-study/aws-study-app/src/App.jsx#L316-L322):
```javascript
const updateUserData = async (newData) => {
    if (!ENABLE_FIREBASE_AUTH || !user) return;
    const userRef = doc(db, 'users', user.uid);
    const updatedData = { ...userData, ...newData }; // <-- Dependência do estado assíncrono anterior
    await setDoc(userRef, updatedData, { merge: true });
    setUserData(updatedData);
};
```
*   **Problema**: Chamar `updateUserData` sucessivamente (como responder rápido no quiz) pode sobrescrever dados devido à dependência do estado `userData` anterior, que pode não ter sido atualizado no React ainda.
*   **Correção**: Utilizar atualizações funcionais ou ler os dados diretamente do snapshot do banco de dados quando aplicável.

---

## 3. Integração com Gemini e Inteligência Artificial

> [!TIP]
> A integração com a API Gemini está bem implementada, utilizando a nova biblioteca `@google/genai` e prevendo fallbacks elegantes para modelos sem suporte nativo a JSON (como Gemma 3).

*   **Ponto Positivo**: A limpeza de blocos markdown em `jsonText.replace(/```json\n?|```/g, '').trim()` previne falhas de parser JSON se a IA retornar markdown acidentalmente.
*   **Sugestão de Modelo**: O modelo padrão no código é o `gemini-3-flash-preview`. Como o Gemini 2.5 Flash ou Gemini 3.5 Flash possuem melhor desempenho/velocidade em produção, certifique-se de que a API Key no `.env` tem acesso ao modelo selecionado.

---

## 4. Experiência de Usuário e Estética

*   **Eruda no index.html**: O script de depuração mobile `eruda.init()` está ativo por padrão no [index.html](file:///workspaces/aws-study/aws-study-app/index.html#L12-L13). Isso cria um botão flutuante permanente na tela, o que prejudica a estética do aplicativo em produção. Recomenda-se carregá-lo condicionalmente apenas em ambiente de desenvolvimento.
*   **CSS Embutido**: Há um grande bloco `<style>` em [App.jsx](file:///workspaces/aws-study/aws-study-app/src/App.jsx#L845-L908). Parte deste CSS de markdown e customizações poderia ser movido para o [index.css](file:///workspaces/aws-study/aws-study-app/src/index.css) ou [App.css](file:///workspaces/aws-study/aws-study-app/src/App.css), mantendo o JSX mais limpo.

---

## Próximos Passos Sugeridos:
1. Corrigir o bug do `handleDeleteTrail` no modo de testes.
2. Refatorar o `App.jsx` extraindo os componentes menores e páginas.
3. Ajustar a inicialização do `eruda` para ambiente de desenvolvimento.
