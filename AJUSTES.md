# Ajustes no App de Finanças — Layout Desktop + UX

O app atual tem três problemas que precisam ser corrigidos:

1. **No desktop, ele abre como um app de celular esticado.** Responsividade não é só o layout mobile caber em tela grande — é o app ter **layouts diferentes e adequados a cada dispositivo**.
2. **O desktop precisa de mais densidade de informação** (tabelas, visão ampla), não os mesmos cards do mobile ocupando a tela inteira.
3. **A navegação/fluxo está confusa.** Precisa ficar óbvio onde estou e o que cada tela faz.

Trate isso como uma **refatoração de layout e navegação**, sem alterar o modelo de dados nem a lógica de negócio já implementada.

---

## 1. Dois layouts distintos por breakpoint

Usar os breakpoints do Tailwind com `lg` (1024px) como divisor:

### Mobile (< 1024px) — otimizado para registrar
- Mantém o conceito atual: registro rápido como tela principal, bottom nav fixa, cards empilhados, botões grandes de toque.
- Conteúdo com largura fluida, sem max-width artificial.

### Desktop (≥ 1024px) — otimizado para analisar e gerenciar
- **Sidebar lateral fixa à esquerda** (substitui a bottom nav): Dashboard · Gastos · Entradas · Fixos & Parcelas · Investimentos · Projetos.
- Conteúdo principal usando a largura disponível (max-width ~1280–1440px, centralizado), **nunca** uma coluna estreita de celular no meio da tela.
- Layouts em grid: dashboard com múltiplos cards lado a lado (2–3 colunas), não empilhados.
- O registro rápido no desktop **não é a tela principal** — vira um botão "+ Novo gasto" sempre visível (na sidebar ou no topo) que abre um **modal/dialog** de registro. No desktop, a tela principal é o Dashboard.

A decisão de layout deve ser via CSS/Tailwind responsivo (classes `lg:`), não via detecção de user-agent. Componentes compartilham a lógica; muda a apresentação.

---

## 2. Funcionalidades de visibilidade no desktop

### Tabela de transações (novidade principal)
Criar uma visão em **tabela** para gastos (e análoga para entradas e investimentos), disponível no desktop:

- Colunas: Data · Categoria (com emoji) · Descrição · Método de pagamento · Projeto (se houver) · Valor.
- **Ordenação** clicando no cabeçalho das colunas (data e valor no mínimo).
- **Filtros** acima da tabela: período (mês/intervalo), categoria (multi-select), método de pagamento, projeto.
- **Busca** por texto na descrição.
- Linha de **total** do que está filtrado no rodapé da tabela.
- **Edição inline ou por clique na linha** (abre o modal de edição).
- Paginação ou scroll com carregamento — o que for mais simples e performático.
- No mobile, essa mesma tela vira a lista de cards atual (mesma rota, apresentação diferente).

### Dashboard desktop mais rico
- Grid com: resumo do mês (entradas/saídas/investido/saldo) em cards horizontais no topo · gráfico por categoria · barras de orçamento por categoria · lista dos últimos gastos · widget de comprometido do mês (fixos + parcelas) · progresso dos projetos ativos.
- Seletor de mês visível e persistente no topo.

### Fixos & Parcelas no desktop
- Também em formato tabela, com colunas de progresso das parcelas e data de quitação.

---

## 3. Correções de UX e navegação

- **Hierarquia clara de telas.** Cada item da navegação leva a UMA tela com UM propósito óbvio. Título da página sempre visível. Nada de telas que misturam registro + análise + configuração.
- **Estrutura de rotas explícita:** `/` (dashboard no desktop, registro no mobile — ou redirecionar conforme o caso), `/gastos`, `/entradas`, `/fixos`, `/investimentos`, `/projetos`, `/projetos/[id]`.
- **Indicador de tela ativa** na navegação (destaque no item atual, tanto na bottom nav quanto na sidebar).
- **Fluxo de registro consistente:** registrar gasto, entrada ou investimento deve seguir o mesmo padrão visual (mesmo estilo de formulário/modal), mudando só os campos.
- **Feedback claro em toda ação:** toast de sucesso/erro, estados de loading nos botões, confirmação antes de excluir.
- **Reduzir ruído:** se uma tela tem elementos que não ajudam o objetivo dela, remover. Menos é mais.
- Revisar textos dos botões e labels: verbos diretos em pt-BR ("Registrar gasto", "Nova entrada"), sem jargão.

---

## Processo

1. Antes de codar, me mostre um **plano rápido** de como vai estruturar: (a) o layout desktop com sidebar, (b) a tabela de transações, (c) o mapa de rotas final. Aguarde meu OK.
2. Implemente na ordem: layout desktop (sidebar + grid do dashboard) → tabela de gastos com filtros/ordenação → tabelas das demais telas → revisão de navegação e feedbacks.
3. Ao final, teste visualmente nos dois modos (viewport mobile ~390px e desktop ~1440px) e me mostre screenshots ou descreva o resultado de cada tela nos dois tamanhos.