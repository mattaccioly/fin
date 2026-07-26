# Fin — finanças pessoais

App web single-user para organizar finanças com foco em **registrar um gasto em menos de 10 segundos**.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + Auth + RLS)
- Deploy na Vercel

## 1. Criar o projeto no Supabase

1. Crie um projeto em [https://supabase.com](https://supabase.com).
2. Em **Project Settings → API**, copie:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Em **Authentication → Users**, clique em **Add user** e crie seu usuário (e-mail + senha). Não há cadastro público no app.
4. Em **SQL Editor**, rode o conteúdo de [`supabase/migrations/20260725120000_init.sql`](supabase/migrations/20260725120000_init.sql) (ou use a CLI do Supabase: `supabase db push` se o projeto estiver linkado).

## 2. Configurar o ambiente local

```bash
cp .env.example .env.local
# edite .env.local com as chaves do Supabase
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000) e faça login.

## 3. Deploy na Vercel

1. Conecte o repositório à Vercel.
2. Defina as mesmas variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Em Supabase → Authentication → URL Configuration, adicione a URL da Vercel em **Site URL** / **Redirect URLs** se necessário.

## Telas

| Rota | Função |
|------|--------|
| `/` | Registro rápido de gasto + streak |
| `/dashboard` | Resumo do mês |
| `/projects` | Projetos financeiros |
| `/more` | Entradas, fixos, parcelas, investimentos, orçamentos, sair |
| `/month-wrap` | Retrospectiva ao virar o mês |

## Notas

- Categorias padrão são criadas no primeiro login autenticado.
- Valores em BRL (`numeric(12,2)`), interface em pt-BR.
- RLS ativo em todas as tabelas (`auth.uid() = user_id`).
