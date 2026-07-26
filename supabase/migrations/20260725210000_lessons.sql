-- Lessons module: students, lessons, payment RPCs

CREATE TYPE billing_mode AS ENUM (
  'per_class',
  'monthly'
);

CREATE TYPE lesson_status AS ENUM (
  'scheduled',
  'given',
  'cancelled_by_student',
  'cancelled_by_me',
  'rescheduled'
);

CREATE TYPE lesson_payment_status AS ENUM (
  'pending',
  'paid',
  'not_billable'
);

-- Students
CREATE TABLE public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  financial_guardian text NOT NULL DEFAULT '',
  billing_mode billing_mode NOT NULL DEFAULT 'per_class',
  default_rate numeric(12, 2) NOT NULL CHECK (default_rate > 0),
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX students_user_idx ON public.students (user_id);
CREATE INDEX students_user_active_idx ON public.students (user_id, active);

CREATE TRIGGER students_set_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lessons
CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  student_id uuid NOT NULL REFERENCES public.students (id) ON DELETE RESTRICT,
  status lesson_status NOT NULL DEFAULT 'scheduled',
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  payment_status lesson_payment_status NOT NULL DEFAULT 'pending',
  payment_date date,
  income_id uuid REFERENCES public.incomes (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX lessons_user_date_idx ON public.lessons (user_id, date DESC);
CREATE INDEX lessons_student_idx ON public.lessons (student_id);
CREATE INDEX lessons_payment_status_idx ON public.lessons (payment_status);
CREATE INDEX lessons_income_idx ON public.lessons (income_id);
CREATE INDEX lessons_user_student_date_idx ON public.lessons (user_id, student_id, date);

CREATE TRIGGER lessons_set_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "students_select_own" ON public.students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "students_insert_own" ON public.students FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "students_update_own" ON public.students FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "students_delete_own" ON public.students FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "lessons_select_own" ON public.lessons FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "lessons_insert_own" ON public.lessons FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "lessons_update_own" ON public.lessons FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "lessons_delete_own" ON public.lessons FOR DELETE USING (auth.uid() = user_id);

-- RPCs: payment flows (atomic income + lesson updates)

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

  INSERT INTO public.incomes (user_id, date, amount, source, description, is_recurring)
  VALUES (v_uid, p_payment_date, v_lesson.amount, 'teaching', v_desc, false)
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

  INSERT INTO public.incomes (user_id, date, amount, source, description, is_recurring)
  VALUES (v_uid, p_payment_date, v_total, 'teaching', v_desc, false)
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

CREATE OR REPLACE FUNCTION public.undo_lesson_payment(p_lesson_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_income_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT income_id INTO v_income_id
  FROM public.lessons
  WHERE id = p_lesson_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lesson not found';
  END IF;

  IF v_income_id IS NULL THEN
    RAISE EXCEPTION 'lesson has no linked income';
  END IF;

  UPDATE public.lessons
  SET
    payment_status = 'pending',
    payment_date = NULL,
    income_id = NULL
  WHERE income_id = v_income_id
    AND user_id = v_uid;

  DELETE FROM public.incomes
  WHERE id = v_income_id
    AND user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_lesson_billable(
  p_lesson_id uuid,
  p_billable boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_lesson public.lessons%ROWTYPE;
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

  IF v_lesson.payment_status = 'paid' THEN
    RAISE EXCEPTION 'cannot change billable on paid lesson';
  END IF;

  IF v_lesson.status NOT IN ('cancelled_by_student', 'cancelled_by_me', 'rescheduled') THEN
    RAISE EXCEPTION 'billable override only for cancelled or rescheduled lessons';
  END IF;

  UPDATE public.lessons
  SET payment_status = CASE WHEN p_billable THEN 'pending'::lesson_payment_status ELSE 'not_billable'::lesson_payment_status END
  WHERE id = v_lesson.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_lesson_paid(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_student_month(uuid, uuid[], date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_lesson_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_lesson_billable(uuid, boolean) TO authenticated;
