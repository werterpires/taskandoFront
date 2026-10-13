# Formatação de Datas no Padrão Brasileiro

Status: 

## Goal

Padronizar a exibição de todas as datas no frontend para o formato brasileiro (pt-BR: `dd/MM/yyyy` e `dd/MM/yyyy HH:mm`), registrando a localização pt-BR no Angular para traduzir meses e dias da semana, e formatando prazos e carimbos de data/hora em todas as telas e componentes.

## Base branch

`main` — the branch current when the user requested the task; create the work branch from it and target the pull request to it.

## Scope

- Modify: `src/main.ts` — registrar locale pt-BR (`LOCALE_ID` e `registerLocaleData(localePt)`)
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

- [ ] Topbar exibe mês e ano em português (ex: "outubro de 2026").
- [ ] Prazo em TaskViewComponent exibe formato "dd/MM/yyyy" (ex: "13/10/2026").
- [ ] Subtarefas em TaskViewComponent exibem prazo no formato "dd/MM/yyyy".
- [ ] Listas de tarefas em PhaseViewComponent e ProcessViewComponent exibem prazo no formato "dd/MM/yyyy".
- [ ] Kanban, lista e drawer em AppComponent exibem prazos no formato "dd/MM/yyyy".
- [ ] Todos os testes unitários (`npm test`) passam.
- [ ] Build de produção (`npm run build`) executa sem erros.

## Implementation log

(Append-only, added during execution.)
