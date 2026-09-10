# Taskando Web

Interface Angular standalone do Taskando. Ela recria a experiência visual da exportação em `Taskando-completo` e consome os mesmos contratos da nova API NestJS.

```bash
npm install
npm run dev
```

O servidor local abre em `http://localhost:4200` e encaminha `/api` e `/mcp` para `http://127.0.0.1:3000`. Antes de entrar com e-mail e senha, inicie a API, o PostgreSQL, aplique as migrations e crie o usuário inicial com a seed descrita no README de `taskando-back`. Novos usuários são criados por alguém autenticado na tela de configurações.

```bash
npm run build
```

A interface cobre tarefas e seus nove tipos, subtarefas, checklist, comentários, listas pessoais, calendário, Kanban, quadrante, estrutura, projetos, frentes, produtos, processos, fases, dependências, templates, recorrência, cíclicas, lembretes, notificações, papéis, transferências de Owner, configurações e MCP.
