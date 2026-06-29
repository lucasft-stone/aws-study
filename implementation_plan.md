# Plano de Implementação: Refatoração e Correções do StudyBot

Este plano propõe a modularização do arquivo [App.jsx](file:///workspaces/aws-study/aws-study-app/src/App.jsx) (que atualmente centraliza toda a lógica e interface da aplicação) e a correção de bugs de usabilidade e funcionalidade.

## User Review Required

> [!IMPORTANT]
> A refatoração dividirá o código em arquivos menores estruturados na pasta `src/components/`. A lógica de estado principal e os hooks de autenticação/banco de dados do Firebase permanecerão no [App.jsx](file:///workspaces/aws-study/aws-study-app/src/App.jsx) para manter a simplicidade de passagem de dados, mas toda a renderização visual e controles específicos de cada tela serão isolados.

---

## Proposed Changes

### Componentes de UI Gerais (Novos)

#### [NEW] [StudyBot.jsx](file:///workspaces/aws-study/aws-study-app/src/components/StudyBot.jsx)
Isolar o mascote animado em SVG que reage às respostas do quiz.

#### [NEW] [CardButton.jsx](file:///workspaces/aws-study/aws-study-app/src/components/CardButton.jsx)
Componente de botão em card com suporte a exclusão.

#### [NEW] [LoadingScreen.jsx](file:///workspaces/aws-study/aws-study-app/src/components/LoadingScreen.jsx)
Tela de carregamento padrão com o mascote StudyBot.

#### [NEW] [ErrorBoundary.jsx](file:///workspaces/aws-study/aws-study-app/src/components/ErrorBoundary.jsx)
Componente React para captura de erros e tela de recuperação (fallback).

---

### Páginas / Telas do Aplicativo (Novos)

#### [NEW] [Login.jsx](file:///workspaces/aws-study/aws-study-app/src/components/Login.jsx)
Tela de autenticação com o Google.

#### [NEW] [Home.jsx](file:///workspaces/aws-study/aws-study-app/src/components/Home.jsx)
Painel principal que exibe o XP, limite diário, seletor de modelos do Gemini e as trilhas (guiadas e personalizadas).

#### [NEW] [CreateTrail.jsx](file:///workspaces/aws-study/aws-study-app/src/components/CreateTrail.jsx)
Formulário para criar novas trilhas informando título e conteúdo.

#### [NEW] [TrailOptions.jsx](file:///workspaces/aws-study/aws-study-app/src/components/TrailOptions.jsx)
Tela de opções da trilha selecionada (Estudar material, Anki/Flashcards ou Quiz).

#### [NEW] [StudyMaterial.jsx](file:///workspaces/aws-study/aws-study-app/src/components/StudyMaterial.jsx)
Tela de leitura do material de estudo gerado por IA, com suporte a renderização de Markdown e destaque de código.

#### [NEW] [StudyAnki.jsx](file:///workspaces/aws-study/aws-study-app/src/components/StudyAnki.jsx)
Interface de flashcards estilo Anki com animação de flip 3D.

#### [NEW] [Quiz.jsx](file:///workspaces/aws-study/aws-study-app/src/components/Quiz.jsx)
Fluxo completo de quiz com barra de progresso, vidas (corações), feedback imediato e explicações sobre a resposta correta/incorreta.

#### [NEW] [Completed.jsx](file:///workspaces/aws-study/aws-study-app/src/components/Completed.jsx)
Tela final de conclusão do Quiz com exibição de XP obtido ou feedback de falha por falta de corações.

---

### Componente Principal e Ajustes (Modificações)

#### [MODIFY] [App.jsx](file:///workspaces/aws-study/aws-study-app/src/App.jsx)
*   Remover todo o HTML embutido e os subcomponentes (`StudyBot`, `CardButton`, etc.).
*   Importar as novas telas e componentes modulares.
*   Corrigir o método `handleDeleteTrail` para deletar a trilha localmente mesmo quando `ENABLE_FIREBASE_AUTH` for falso.
*   Simplificar o switch de estados da aplicação delegando para os novos componentes de página.

#### [MODIFY] [index.html](file:///workspaces/aws-study/aws-study-app/index.html)
*   Alterar a inicialização do `eruda` para ser condicional: carregar apenas se a URL contiver o parâmetro `?debug=true` ou em ambiente de desenvolvimento local (`localhost`), garantindo que não prejudique o design na versão estável.

---

## Verification Plan

### Automated Tests
- Executar `npm run build` na pasta do aplicativo para garantir que o TypeScript/JSX compila sem nenhum erro após a refatoração.
- Executar `npm run dev` para validar o funcionamento do servidor de desenvolvimento.

### Manual Verification
- Testar a exclusão de trilhas no modo local (Firebase desativado) e confirmar que o card desaparece da tela.
- Simular o fluxo de estudo: criar trilha -> ler material -> virar cartas do Anki -> responder quiz -> concluir quiz, validando a integridade dos estados e animações.
