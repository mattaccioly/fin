# Prompt para Claude Code — App de Finanças Pessoais

## Contexto

Quero construir um app web pessoal (single-user, uso interno) para organizar minhas finanças. Já tentei apps de mercado (complicados demais) e planilhas (que abandono por atrito de atualização). O maior problema hoje é que **eu não mapeio meus gastos variáveis** — então o app precisa tornar o registro de um gasto tão rápido e sem fricção que eu realmente faça isso todo dia, do celular.

**Filosofia do produto:** o app vence se registrar um gasto levar menos de 10 segundos. Tudo o mais é secundário.

## Stack técnica

- **Frontend:** Next.js 14+ (App Router) com TypeScript
- **Estilo:** Tailwind CSS, mobile-first
- **Banco de dados e auth:** Supabase (Postgres + Supabase Auth)
- **Deploy:** Vercel
- **Auth:** login simples por e-mail/senha via Supabase Auth (apenas eu vou usar; sem cadastro público, sem fluxo de convites). Proteger todas as rotas.
- Usar Row Level Security (RLS) no Supabase mesmo sendo single-user (boa prática).
- Gerar as migrations SQL do Supabase como arquivos versionados no repositório (`supabase/migrations/`).

## Modelo de dados

Criar as seguintes tabelas (nomes em inglês, valores monetários em `numeric(12,2)`, moeda padrão BRL):

1. **`incomes`** — entradas
   - `id`, `date`, `amount`, `source` (enum: `salary`, `capes_scholarship`, `freelance`, `teaching`, `other`), `description` (opcional), `is_recurring` (bool)

2. **`categories`** — categorias de gastos variáveis
   - `id`, `name`, `icon` (emoji), `color`, `monthly_budget` (opcional, para metas)
   - Seed inicial: Alimentação 🍽️, Transporte 🚕, Lazer 🎭, Mercado 🛒, Saúde 💊, Educação 📚, Assinaturas 📱, Outros 📦

3. **`expenses`** — gastos variáveis (o coração do app)
   - `id`, `date`, `amount`, `category_id`, `description` (opcional), `payment_method` (enum: `pix`, `debit`, `credit`, `cash`), `project_id` (opcional, FK para projects)

4. **`fixed_costs`** — custos fixos mensais
   - `id`, `name`, `amount`, `due_day` (dia do mês), `active` (bool), `category` (livre)

5. **`debts`** — parcelamentos
   - `id`, `name`, `total_amount`, `installment_amount`, `total_installments`, `paid_installments`, `first_due_date`, `active` (bool)
   - O app calcula automaticamente: parcelas restantes, valor restante, data prevista de quitação

6. **`investments`** — aportes
   - `id`, `date`, `amount`, `vehicle` (texto livre, ex.: "Tesouro Selic", "CDB liquidez diária"), `description` (opcional), `project_id` (opcional)

7. **`projects`** — projetos financeiros (ex.: Viagem Europa, Morar Sozinho)
   - `id`, `name`, `emoji`, `target_amount` (opcional), `target_date` (opcional), `status` (`active`, `completed`, `archived`)
   - Gastos e investimentos podem ser vinculados a um projeto via `project_id` (ex.: compra de euros = investimento do projeto; reserva de hotel = gasto do projeto)

## Telas e funcionalidades

### 1. Registro rápido (tela principal / home)
- Ao abrir o app, a primeira coisa visível é o **formulário de registro rápido de gasto**: campo de valor grande (teclado numérico no mobile), grade de categorias como botões com emoji, seleção de método de pagamento, descrição opcional, data padrão = hoje.
- Um toque em "Salvar" e pronto. Feedback visual imediato (toast + animação).
- Abaixo do formulário: lista dos últimos gastos do dia/semana, com opção de editar/excluir por swipe ou botão.
- Toggle opcional: "vincular a um projeto".

### 2. Dashboard (visão do mês)
- Resumo do mês corrente: total de entradas, total de saídas (fixos + parcelas + variáveis), total investido, saldo do mês.
- Gráfico simples de gastos variáveis por categoria (barras ou donut).
- Barra de progresso do orçamento por categoria (se `monthly_budget` estiver definido): verde/amarelo/vermelho.
- Comparativo simples com o mês anterior (setinha ↑↓ e percentual).
- Navegação entre meses.

### 3. Entradas
- Lista e formulário simples. Entradas recorrentes (salário, bolsa CAPES) podem ser lançadas com um toque ("repetir do mês passado").

### 4. Custos fixos e parcelamentos
- Lista dos custos fixos ativos com valor total mensal comprometido.
- Lista de parcelamentos com barra de progresso (ex.: "7/12 parcelas — quita em fev/2027").
- Widget no dashboard: "comprometido do mês" = fixos + parcelas do mês.

### 5. Investimentos
- Registro simples de aportes (data, valor, veículo). Sem cotação, sem rentabilidade, sem integração com corretora — apenas o registro do que foi aportado.
- Total aportado no mês e acumulado.

### 6. Projetos
- Cards de projetos com: meta (se houver), total já gasto, total já investido/reservado, prazo, barra de progresso.
- Ao abrir um projeto: timeline de transações vinculadas (gastos + investimentos).
- Exemplo de uso: projeto "Viagem Europa" com meta de valor e data, compras de euro registradas como investimento vinculado, reservas de hotel como gasto vinculado.

### 7. Gamificação (leve, não infantil)
- **Streak de registro:** contador de dias consecutivos em que registrei pelo menos 1 gasto (ou marquei explicitamente "dia sem gastos" — botão dedicado para isso, para não quebrar o streak injustamente). Exibir o streak com destaque na home (🔥 + número).
- **Melhor streak histórico.**
- **Fechamento do mês:** ao virar o mês, uma tela de "resumo do mês" estilo retrospectiva (total registrado, categoria campeã, comparação com mês anterior, streak mantido).
- **Metas de categoria:** ficar dentro do orçamento da categoria no mês gera um selo simples no fechamento.
- Nada de pontos, moedas ou níveis — só streaks, selos e o resumo mensal.

## Requisitos de UX/UI

- **Mobile-first e 100% responsivo.** O caso de uso principal é: estou na rua, gastei, abro no celular, registro em segundos. Desktop é secundário (consulta do dashboard).
- Interface em **português (pt-BR)**, valores formatados como R$ com `Intl.NumberFormat('pt-BR')`.
- Datas no formato brasileiro (dd/mm/aaaa).
- Navegação inferior fixa no mobile (bottom nav): Registrar · Dashboard · Projetos · Mais.
- Dark mode como padrão (ou respeitar preferência do sistema).
- Zero onboarding, zero telas intermediárias. Abrir = registrar.
- Estados vazios amigáveis com instrução de primeiro uso.

## Fora de escopo (NÃO implementar)

- Integração bancária / Open Finance
- Multiusuário, compartilhamento, permissões
- Notificações push (talvez no futuro)
- OCR de notas fiscais
- Multi-moeda automática (compras de euro são registradas em BRL pelo valor pago)
- Relatórios em PDF/Excel

## Plano de execução sugerido

Implementar em fases, com o app funcional ao fim de cada uma:

1. **Fase 1 — Fundação:** setup Next.js + Supabase + auth + migrations de todas as tabelas + RLS + deploy inicial na Vercel.
2. **Fase 2 — Núcleo:** tela de registro rápido de gastos + lista/edição + categorias com seed.
3. **Fase 3 — Visão:** dashboard mensal com totais, gráfico por categoria e navegação entre meses.
4. **Fase 4 — Estrutura:** entradas, custos fixos, parcelamentos, investimentos.
5. **Fase 5 — Projetos:** CRUD de projetos + vinculação de transações + cards de progresso.
6. **Fase 6 — Gamificação:** streak, botão "dia sem gastos", fechamento do mês, selos de orçamento.

Ao final de cada fase, me mostre o que foi feito e aguarde meu OK antes de seguir.

## Configuração e entrega

- Criar `.env.example` com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e instruções.
- README com: passos para criar o projeto no Supabase, rodar as migrations, rodar localmente e fazer deploy na Vercel.
- Código organizado, componentes reutilizáveis, sem over-engineering — este é um app pessoal, priorize simplicidade e manutenibilidade sobre abstrações.