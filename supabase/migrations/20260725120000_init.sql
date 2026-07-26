-- Personal finance schema: enums, tables, indexes, RLS

-- Enums
CREATE TYPE income_source AS ENUM (
  'salary',
  'capes_scholarship',
  'freelance',
  'teaching',
  'other'
);

CREATE TYPE payment_method AS ENUM (
  'pix',
  'debit',
  'credit',
  'cash'
);

CREATE TYPE project_status AS ENUM (
  'active',
  'completed',
  'archived'
);

-- Updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL,
  color text NOT NULL,
  monthly_budget numeric(12, 2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Projects (before expenses/investments for FKs)
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🎯',
  target_amount numeric(12, 2),
  target_date date,
  status project_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER projects_set_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Expenses
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE RESTRICT,
  description text,
  payment_method payment_method NOT NULL DEFAULT 'pix',
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX expenses_user_date_idx ON public.expenses (user_id, date DESC);
CREATE INDEX expenses_category_idx ON public.expenses (category_id);
CREATE INDEX expenses_project_idx ON public.expenses (project_id);

CREATE TRIGGER expenses_set_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Incomes
CREATE TABLE public.incomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  source income_source NOT NULL,
  description text,
  is_recurring boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX incomes_user_date_idx ON public.incomes (user_id, date DESC);

CREATE TRIGGER incomes_set_updated_at
  BEFORE UPDATE ON public.incomes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Fixed costs
CREATE TABLE public.fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  due_day integer NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  active boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER fixed_costs_set_updated_at
  BEFORE UPDATE ON public.fixed_costs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Debts (installments)
CREATE TABLE public.debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  total_amount numeric(12, 2) NOT NULL CHECK (total_amount > 0),
  installment_amount numeric(12, 2) NOT NULL CHECK (installment_amount > 0),
  total_installments integer NOT NULL CHECK (total_installments > 0),
  paid_installments integer NOT NULL DEFAULT 0 CHECK (paid_installments >= 0),
  first_due_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (paid_installments <= total_installments)
);

CREATE TRIGGER debts_set_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Investments
CREATE TABLE public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  vehicle text NOT NULL,
  description text,
  project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investments_user_date_idx ON public.investments (user_id, date DESC);
CREATE INDEX investments_project_idx ON public.investments (project_id);

CREATE TRIGGER investments_set_updated_at
  BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- No-spend days (streak fairness)
CREATE TABLE public.no_spend_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Month closings (retrospect seen once)
CREATE TABLE public.month_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

-- RLS
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.no_spend_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.month_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_own" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON public.categories FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "projects_select_own" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "expenses_select_own" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "expenses_insert_own" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "expenses_update_own" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "expenses_delete_own" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "incomes_select_own" ON public.incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "incomes_insert_own" ON public.incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "incomes_update_own" ON public.incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "incomes_delete_own" ON public.incomes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "fixed_costs_select_own" ON public.fixed_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fixed_costs_insert_own" ON public.fixed_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fixed_costs_update_own" ON public.fixed_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fixed_costs_delete_own" ON public.fixed_costs FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "debts_select_own" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "debts_insert_own" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "debts_update_own" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "debts_delete_own" ON public.debts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "investments_select_own" ON public.investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "investments_insert_own" ON public.investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "investments_update_own" ON public.investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "investments_delete_own" ON public.investments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "no_spend_days_select_own" ON public.no_spend_days FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "no_spend_days_insert_own" ON public.no_spend_days FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "no_spend_days_update_own" ON public.no_spend_days FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "no_spend_days_delete_own" ON public.no_spend_days FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "month_closings_select_own" ON public.month_closings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "month_closings_insert_own" ON public.month_closings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "month_closings_update_own" ON public.month_closings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "month_closings_delete_own" ON public.month_closings FOR DELETE USING (auth.uid() = user_id);
