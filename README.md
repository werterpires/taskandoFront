# Taskando Web

Interface Angular standalone do Taskando. Ela recria a experiência visual da exportação em `Taskando-completo` e consome os mesmos contratos da nova API NestJS.

```bash
npm install
npm run dev
```

O servidor local abre em `http://localhost:4200` e encaminha `/api` e `/mcp` para `http://127.0.0.1:3000`. Antes de entrar com e-mail e senha, inicie a API, o PostgreSQL, aplique as migrations e crie o usuário inicial com a seed descrita no README de `taskando-back`. Novos usuários são criados por alguém autenticado na tela de configurações, respeitando a cota de convite único por conta.

```bash
npm run build
npm test
```

## Navegação por URL

A aplicação usa rotas hash estáveis. A URL é a fonte de verdade da tela ou do contexto aberto: recarregar a página e usar voltar/avançar restaura a mesma visão, e um link acessado antes da autenticação é retomado depois do login. `#/` e caminhos desconhecidos redirecionam para `#/inicio`.

| Tela | Rota |
| --- | --- |
| Início | `#/inicio` |
| Minhas tarefas | `#/minhas-tarefas` |
| Cíclicas | `#/ciclicas` |
| Lembretes | `#/lembretes` |
| Calendário | `#/calendario` |
| Quadrante | `#/quadrante` |
| Painel | `#/painel` |
| Relatórios | `#/relatorios` |
| Listas | `#/listas` |
| Projetos | `#/projetos` |
| Produtos | `#/produtos` |
| Processos | `#/processos` |
| Séries | `#/series` |
| Templates | `#/templates` |
| Estrutura | `#/estrutura` |
| Lixeira | `#/lixeira` |
| Configurações | `#/configuracoes` |

Contextos identificados pelo backend têm rotas próprias:

| Contexto | Rota |
| --- | --- |
| Lista pessoal | `#/listas/:id` |
| Organização | `#/estrutura/organizacao/:id` |
| Departamento | `#/estrutura/departamento/:id` |
| Time | `#/estrutura/time/:id` |
| Detalhe de processo | `#/processos/:id` |
| Termos de Uso (público) | `#/termos` |
| Política de Privacidade (público) | `#/privacidade` |

Listas, organizações, departamentos e times recuperam seus metadados pela API ao abrir a rota, sem depender dos dados já carregados no menu; isso também preserva a identificação de listas vazias. Ao trocar de rota, respostas assíncronas pendentes da visão anterior são descartadas. Se um contexto dinâmico falhar, a URL permanece para permitir nova tentativa e o conteúdo antigo é removido. Na página de processo, a ação de voltar retorna para `#/processos`.

A interface cobre tarefas e seus nove tipos, subtarefas, checklist, comentários, listas pessoais, calendário, Kanban, quadrante, estrutura, projetos, frentes, produtos, processos, fases, dependências, templates, recorrência, cíclicas, lembretes, notificações, papéis, transferências de Owner, configurações e MCP.

Processos abrem dentro do shell autenticado na rota hash `#/processos/:id`. A página reúne metadados, progresso, fases, tarefas diretas e a projeção completa de dependências, com estados explícitos de carregamento, acesso negado, não encontrado, falha temporária, vazio e somente leitura. Os filtros de concluídos, cancelados e arquivados são enviados à API; busca textual e recortes de prazo refinam localmente o resultado carregado. Tanto `ProcessViewComponent` quanto `PhaseViewComponent` oferecem abas mutuamente exclusivas de visualização (`WorkViewMode`: **Lista**, **Grafo** e **Linha do tempo**). As demais entidades continuam usando o painel de detalhes existente.

O grafo de dependências é compartilhado entre a página de processo e a visão de fase (aba **Grafo**, com a projeção completa para edição). Ele separa fases e tarefas diretas em faixas, mostra simultaneamente o status do trabalho e a disponibilidade por dependências e permite criar ou remover ligações conforme as capacidades devolvidas pela API. A interação funciona por ponteiro e teclado, anuncia erros de forma acessível e recarrega a projeção do backend depois de cada mutação.

## Linha do tempo analítica (Gantt)

- **Motor de layout (`src/app/shared/timeline-gantt/timeline-layout.ts`)**: módulo TypeScript puro (`buildTimelineLayout`) que opera em dias UTC para determinismo entre ambientes. Ordena nós topologicamente (algoritmo de Kahn), deriva intervalos de barra ou marco (`date` como marco; `event`, `commitment`, `dueDate`, predecessoras ou `createdAt` como barra), mapeia durações por porte (`xs`: 1, `s`: 2, `m`: 4, `l`: 7, `xl`: 14, padrão `3` dias), calcula escalas de zoom (`day`, `week`, `month`), linha **Hoje**, curvas Bézier das dependências, atraso (`isOverdue`) e conflitos de data (`hasDateConflict`, quando a predecessora termina após o prazo ou no/após o início da sucessora).
- **Componente e sincronização de filtros (`src/app/shared/timeline-gantt/`)**: `TimelineGanttComponent` (`<app-timeline-gantt>`, standalone `OnPush`, com `zoom = model<TimelineZoom>('day')`) renderiza faixas por tipo, setas SVG interativas, badges de status/conflito/bloqueio/atraso, gaveta recolhível para itens **Sem prazo definido** (auto-expandida quando todos os itens estão sem prazo) e navegação para `/fases/:id` ou `/tarefas/:id`. Na aba **Linha do tempo** de `ProcessViewComponent` e `PhaseViewComponent`, `filterTimelineGraph` (`timeline-filter.ts`) sincroniza o grafo exibido (`timelineGraph()`) com `includeClosed`, busca textual e filtro temporal sem alterar a projeção completa da aba **Grafo**.

## Configurações e cota de convite único

`AppComponent` (`src/app/app.component.ts` e `src/app/app.component.html`) armazena o signal `inviteQuota` a partir de `GET /api/auth/me` e `POST /api/auth/login` e o limpa no logout ou em HTTP `401`. Na seção `#/configuracoes`, o painel **Criar usuário** (`data-testid="create-user-panel"`) exibe a cota restante (`remaining de limit`) ou, quando esgotada (`remaining === 0`), oculta o formulário de criação e mostra os dados da pessoa convidada (`displayName`, `email` e `createdAt` formatado via `dateBr`). Após `POST /api/auth/users`, `refreshInviteQuota` atualiza imediatamente a cota via `auth/me`, mantendo um fallback local consistente em caso de falha transitória.

## Documentos legais e gate de aceite (LGPD)

- **Rotas públicas (`src/app/legal/legal-document.component.ts`)**: `#/termos` e `#/privacidade` renderizam os documentos vigentes carregados de `GET /api/legal/documents` via `LegalMarkdownComponent`, com links na tela de login (`data-testid="login-legal-links"`), em **Configurações → Seu perfil** (`data-testid="settings-legal-links"`) e no rodapé (`data-testid="footer-legal-links"`). Quando não há usuário autenticado, `AppComponent` exibe o shell público sem exigir sessão.
- **Gate bloqueante e recuperação HTTP 428 (`LegalGateService` + `TermsAcceptanceModalComponent`)**: `AppComponent` sincroniza `legalStatus` em `auth/me` e `auth/login`, retendo o `bootstrap()` até a aceitação quando `requiresAcceptance === true`. Além disso, `ApiService.request` (`src/app/api.service.ts`) intercepta respostas HTTP `428` com `code === 'LEGAL_ACCEPTANCE_REQUIRED'` via `legalGate.intercept428(details)`, abrindo `app-terms-acceptance-modal` para confirmação via `POST /api/legal/accept` (`channel: 'web'`, com suporte a atualização de versão em HTTP `409` e opção de sair). Após o aceite, `AppComponent.onLegalAccepted()` executa `legalGate.notifyRecovered()` para retomar o `bootstrap()` ou recarregar o shell e as visões standalone (`ProcessViewComponent`, `PhaseViewComponent` e `TaskViewComponent`).

## Sistema global de toasts, editor de itens, filtros e paleta de comandos (`Ctrl+K`)

- **Toasts globais (`src/app/shared/toast/`)**: `ToastService` e `ToastContainerComponent` (`<app-toast-container />` em `AppComponent`) centralizam o feedback não bloqueante (`success` e `info` com `4500 ms`, `error` com `6000 ms`, pausa ao passar o mouse ou focar e fechamento manual), substituindo os banners globais de aviso/erro nas visões principais e standalone (`AppComponent`, `ProcessViewComponent`, `PhaseViewComponent` e `TaskViewComponent`). Erros inline permanecem no login, nos formulários de modais/drawers e no modal de devolução de aprovação (`actionError`).
- **Editor global de itens (`src/app/shared/item-editor-modal/`)**: `ItemEditorService` e `ItemEditorModalComponent` (`<app-item-editor-modal />` em `AppComponent`, com `CdkTrapFocus` de `@angular/cdk/a11y`) permitem criar e editar itens independentemente da rota ativa, tratando HTTP `428` via `LegalGateService`, exibindo toast de confirmação e propagando atualizações via `lastSaved` e `DrawerService.notifyMutation`.
- **Filtro de trabalho compartilhado (`src/app/shared/work-filter.service.ts`)**: `WorkFilterService` mantém o estado `includeClosed` (na ordem canônica `completed,cancelled,archived`) e `syncTick` sincronizados entre `AppComponent`, `ProcessViewComponent`, `PhaseViewComponent` e a paleta de comandos.
- **Paleta de comandos (`src/app/shared/command-palette/`)**: `CommandPaletteService` e `CommandPaletteComponent` (`<app-command-palette [enabled]="!!user() && !legalGate.requiresAcceptance()" />`, aberta via `Ctrl+K` / `Cmd+K` ou pelo botão `⌕ Buscar Ctrl+K` no cabeçalho de `AppComponent`) combinam busca global autorizada em `GET /api/search?q=...` (debounce de `220 ms`, mínimo de `2` e máximo de `160` caracteres, fechamento automático em HTTP `428`), ações rápidas (`+ Nova Tarefa`, `+ Novo Processo`, `+ Novo Projeto`, `+ Novo Lembrete` via `ItemEditorService`, e `Alternar Concluídos` via `WorkFilterService`) e navegação entre seções. Resultados abrem a rota dedicada (`#/estrutura/...`, `#/listas/:id`, `#/processos/:id`, `#/fases/:id`, `#/tarefas/:id`) ou o painel de detalhes via `DrawerService` (`project`, `front`, `product`).
