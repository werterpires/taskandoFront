# Formatação de Datas no Padrão Brasileiro

Status: F

## Dispatch log

| Attempt | Status | Agent | Runner | Session ID | Outcome |
|---------|--------|-------|--------|------------|---------|
| 1 | W | implementer-ai-tools | Gemini 3.8 Flash | 996e9308-32bb-4fb4-ab36-5d4ba2bb2b40 | V → accepted |

## Goal

Padronizar a exibição de todas as datas no frontend para o formato brasileiro (pt-BR: `dd/MM/yyyy` e `dd/MM/yyyy HH:mm`), registrando a localização pt-BR no Angular para traduzir meses e dias da semana, e formatando prazos e carimbos de data/hora em todas as telas e componentes.

## Base branch

`main` — the branch current when the user requested the task; create the work branch from it and target the pull request to it.

## Scope

- Modify: `src/main.ts` — registrar locale pt-BR (`LOCALE_ID` e `registerLocaleData(localePt)`)
- Modify: `src/app/shared/date-br.pipe.ts` e `date-br.pipe.spec.ts` — criar pipe standalone e testes
- Modify: `src/app/task-view/task-view.component.html` — formatar datas de prazo (`dueDate`) e prazos de subtarefas como `dd/MM/yyyy`
- Modify: `src/app/phase-view/phase-view.component.html` — formatar datas de prazo (`dueDate`) como `dd/MM/yyyy`
- Modify: `src/app/process-view/process-view.component.html` — formatar datas de prazo (`dueDate`) como `dd/MM/yyyy`
- Modify: `src/app/app.component.html` — formatar datas nos cards do Kanban, na lista de tarefas, no Drawer de detalhes e na tabela de relatórios
- Modify: testes unitários correspondentes
- Out of scope: inputs de formulário (`<input type="date">` permanece com valor ISO internamente para a API) e exportação de relatórios em CSV (permanece ISO `aaaa-mm-dd` conforme decisão do usuário)

## Steps

1. Registrar locale pt-BR no bootstrap da aplicação, formatar a exibição de datas em todos os componentes e telas, e atualizar os testes unitários.

## Tests

- Assert locale `pt-BR` configurado no bootstrap e pipes formatando datas em português.
- Assert que prazos exibidos em TaskViewComponent, PhaseViewComponent, ProcessViewComponent e AppComponent são formatados no padrão `dd/MM/yyyy`.
- Executar e passar toda a suíte de testes unitários (`npm test`).

## Docs

Atualizar `CLAUDE.md` se aplicável.

## Acceptance criteria

- [x] Topbar exibe mês e ano em português (ex: "outubro de 2026").
- [x] Prazo em TaskViewComponent exibe formato "dd/MM/yyyy" (ex: "13/10/2026").
- [x] Subtarefas em TaskViewComponent exibem prazo no formato "dd/MM/yyyy".
- [x] Listas de tarefas em PhaseViewComponent e ProcessViewComponent exibem prazo no formato "dd/MM/yyyy".
- [x] Kanban, lista e drawer em AppComponent exibem prazos no formato "dd/MM/yyyy".
- [x] Todos os testes unitários (`npm test`) passam (55 testes em 10 arquivos).
- [x] Build de produção (`npm run build`) executa sem erros.

## Implementation log

- Criado `src/app/shared/date-br.pipe.ts` com pipe e função pura `formatDateBr` para tratar `YYYY-MM-DD` sem desvio de fuso horário, formatos curtos `dd/MM`, mês/ano e ISO datetimes em horário local.
- Adicionada suíte de testes em `src/app/shared/date-br.pipe.spec.ts`.
- Registrado `registerLocaleData(localePt)` e `LOCALE_ID = 'pt-BR'` em `src/main.ts`.
- Atualizado `TaskViewComponent` (`task-view.component.ts` e `task-view.component.html`) para aplicar `dateBr` no prazo da tarefa, prazos de subtarefas e carimbos de comentários e auditoria.
- Atualizado `PhaseViewComponent` (`phase-view.component.ts` e `phase-view.component.html`) para aplicar `dateBr` no prazo de tarefas da fase.
- Atualizado `ProcessViewComponent` (`process-view.component.ts` e `process-view.component.html`) para aplicar `dateBr` no prazo de tarefas diretas do processo.
- Atualizado `AppComponent` (`app.component.ts` e `app.component.html`) para aplicar `dateBr` no topbar (`monthYear`), agenda curta (`short`), kanban, lista/cíclicas, drawer de detalhes e tabela de relatórios.
- Atualizados testes de integração e componentes (`task-view.component.spec.ts` e `app.component.spec.ts`), validando a presença das datas e meses formatados no DOM.
- Executados `npm test` (55 testes aprovados) e `npm run build` (build de produção concluído com sucesso).
