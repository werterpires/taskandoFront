# Taskando Web

Interface Angular standalone do Taskando. Ela recria a experiência visual da exportação em `Taskando-completo` e consome os mesmos contratos da nova API NestJS.

```bash
npm install
npm run dev
```

O servidor local abre em `http://localhost:4200` e encaminha `/api` e `/mcp` para `http://127.0.0.1:3000`. Antes de entrar com Google, inicie a API, o PostgreSQL e aplique as migrations descritas no README de `taskando-back`.

```bash
npm run build
```

A interface cobre tarefas e seus nove tipos, subtarefas, checklist, comentários, listas pessoais, calendário, Kanban, quadrante, estrutura, projetos, frentes, produtos, processos, fases, dependências, templates, recorrência, cíclicas, lembretes, notificações, papéis, transferências de Owner, configurações e MCP.
