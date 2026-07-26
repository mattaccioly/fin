-- Multi-currency: main currency preference, per-entry currency, historical FX cache

CREATE DOMAIN public.currency_code AS text
  CHECK (VALUE IN ('BRL', 'EUR', 'USD', 'CLP', 'GBP', 'DKK', 'PEN', 'CNY'));

-- User preferences (main display currency)
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  main_currency public.currency_code NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER user_preferences_set_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_preferences_select_own" ON public.user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert_own" ON public.user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update_own" ON public.user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete_own" ON public.user_preferences FOR DELETE USING (auth.uid() = user_id);

-- Per-entry currency (existing rows are BRL)
ALTER TABLE public.expenses
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'BRL';
ALTER TABLE public.incomes
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'BRL';
ALTER TABLE public.investments
  ADD COLUMN currency public.currency_code NOT NULL DEFAULT 'BRL';

-- Daily FX rates, shared across the instance (reference data, not user-owned)
CREATE TABLE public.fx_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base public.currency_code NOT NULL,
  quote public.currency_code NOT NULL,
  rate_date date NOT NULL,
  rate numeric(20, 10) NOT NULL CHECK (rate > 0),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (base, quote, rate_date)
);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fx_rates_select_authenticated" ON public.fx_rates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "fx_rates_insert_authenticated" ON public.fx_rates
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fx_rates_update_authenticated" ON public.fx_rates
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Main currency of the calling user, for server-side inserts
CREATE OR REPLACE FUNCTION public.main_currency()
RETURNS public.currency_code
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT main_currency FROM public.user_preferences WHERE user_id = auth.uid()),
    'BRL'::public.currency_code
  );
$$;

GRANT EXECUTE ON FUNCTION public.main_currency() TO authenticated;

-- Lesson payments generate incomes in the user's main currency
CREATE OR REPLACE FUNCTION public.mark_lesson_paid(
  p_lesson_id uuid,
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lesson public.lessons%ROWTYPE;
  v_student public.students%ROWTYPE;
  v_income_id uuid;
  v_desc text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT * INTO v_lesson
  FROM public.lessons
  WHERE id = p_lesson_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson not found';
  END IF;

  IF v_lesson.payment_status <> 'pending' THEN
    RAISE EXCEPTION 'lesson is not pending payment';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = v_lesson.student_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  IF v_student.billing_mode <> 'per_class' THEN
    RAISE EXCEPTION 'use close_student_month for monthly students';
  END IF;

  v_desc := format(
    'Aula — %s (%s)',
    v_student.name,
    to_char(v_lesson.date, 'DD/MM')
  );

  INSERT INTO public.incomes (user_id, date, amount, currency, source, description, is_recurring)
  VALUES (v_uid, p_payment_date, v_lesson.amount, public.main_currency(), 'teaching', v_desc, false)
  RETURNING id INTO v_income_id;

  UPDATE public.lessons
  SET
    payment_status = 'paid',
    payment_date = p_payment_date,
    income_id = v_income_id
  WHERE id = v_lesson.id;

  RETURN v_income_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_student_month(
  p_student_id uuid,
  p_lesson_ids uuid[],
  p_payment_date date DEFAULT CURRENT_DATE
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_student public.students%ROWTYPE;
  v_count integer;
  v_total numeric(12, 2);
  v_income_id uuid;
  v_desc text;
  v_month_label text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF p_lesson_ids IS NULL OR cardinality(p_lesson_ids) = 0 THEN
    RAISE EXCEPTION 'no lessons selected';
  END IF;

  SELECT * INTO v_student
  FROM public.students
  WHERE id = p_student_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'student not found';
  END IF;

  IF v_student.billing_mode <> 'monthly' THEN
    RAISE EXCEPTION 'student is not monthly billing';
  END IF;

  SELECT count(*), coalesce(sum(amount), 0)
  INTO v_count, v_total
  FROM public.lessons
  WHERE user_id = v_uid
    AND student_id = p_student_id
    AND id = ANY (p_lesson_ids)
    AND payment_status = 'pending'
    AND status IN (
      'given',
      'cancelled_by_student',
      'cancelled_by_me',
      'rescheduled'
    );

  IF v_count <> cardinality(p_lesson_ids) THEN
    RAISE EXCEPTION 'invalid lesson selection';
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'total must be greater than zero';
  END IF;

  SELECT to_char(min(date), 'MM/YYYY') INTO v_month_label
  FROM public.lessons
  WHERE id = ANY (p_lesson_ids);

  v_desc := format('Aulas — %s (%s)', v_student.name, v_month_label);

  INSERT INTO public.incomes (user_id, date, amount, currency, source, description, is_recurring)
  VALUES (v_uid, p_payment_date, v_total, public.main_currency(), 'teaching', v_desc, false)
  RETURNING id INTO v_income_id;

  UPDATE public.lessons
  SET
    payment_status = 'paid',
    payment_date = p_payment_date,
    income_id = v_income_id
  WHERE id = ANY (p_lesson_ids)
    AND user_id = v_uid;

  RETURN v_income_id;
END;
$$;
