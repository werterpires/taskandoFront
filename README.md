# Taskando Web

Interface Angular standalone do Taskando. Ela recria a experiência visual da exportação em `Taskando-completo` e consome os mesmos contratos da nova API NestJS.

```bash
npm install
npm run dev
```

O servidor local abre em `http://localhost:4200` e encaminha `/api` e `/mcp` para `http://127.0.0.1:3000`. Antes de entrar com e-mail e senha, inicie a API, o PostgreSQL, aplique as migrations e crie o usuário inicial com a seed descrita no README de `taskando-back`. Novos usuários são criados por alguém autenticado na tela de configurações.

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

Listas, organizações, departamentos e times recuperam seus metadados pela API ao abrir a rota, sem depender dos dados já carregados no menu; isso também preserva a identificação de listas vazias. Ao trocar de rota, respostas assíncronas pendentes da visão anterior são descartadas. Se um contexto dinâmico falhar, a URL permanece para permitir nova tentativa e o conteúdo antigo é removido. Na página de processo, a ação de voltar retorna para `#/processos`.

A interface cobre tarefas e seus nove tipos, subtarefas, checklist, comentários, listas pessoais, calendário, Kanban, quadrante, estrutura, projetos, frentes, produtos, processos, fases, dependências, templates, recorrência, cíclicas, lembretes, notificações, papéis, transferências de Owner, configurações e MCP.

Processos abrem dentro do shell autenticado na rota hash `#/processos/:id`. A página reúne metadados, progresso, fases, tarefas diretas e a projeção completa de dependências, com estados explícitos de carregamento, acesso negado, não encontrado, falha temporária, vazio e somente leitura. Os filtros de concluídos, cancelados e arquivados são enviados à API; busca textual e recortes de prazo refinam localmente o resultado carregado. As demais entidades continuam usando o painel de detalhes existente.

O grafo de dependências é compartilhado entre a página de processo e a visão de fase. Ele separa fases e tarefas diretas em faixas, mostra simultaneamente o status do trabalho e a disponibilidade por dependências e permite criar ou remover ligações conforme as capacidades devolvidas pela API. A interação funciona por ponteiro e teclado, anuncia erros de forma acessível e recarrega a projeção do backend depois de cada mutação.
