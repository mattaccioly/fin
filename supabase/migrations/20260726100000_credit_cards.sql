-- Credit cards and monthly bills (manual amounts)

CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  due_day integer NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  closing_day integer CHECK (closing_day >= 1 AND closing_day <= 31),
  last4 text CHECK (last4 ~ '^[0-9]{4}$'),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER credit_cards_set_updated_at
  BEFORE UPDATE ON public.credit_cards
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.credit_card_bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  credit_card_id uuid NOT NULL REFERENCES public.credit_cards (id) ON DELETE CASCADE,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  paid boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_card_id, year, month)
);

CREATE INDEX credit_card_bills_user_month_idx
  ON public.credit_card_bills (user_id, year, month);

CREATE TRIGGER credit_card_bills_set_updated_at
  BEFORE UPDATE ON public.credit_card_bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_card_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_cards_select_own" ON public.credit_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credit_cards_insert_own" ON public.credit_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_cards_update_own" ON public.credit_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "credit_cards_delete_own" ON public.credit_cards FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "credit_card_bills_select_own" ON public.credit_card_bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "credit_card_bills_insert_own" ON public.credit_card_bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "credit_card_bills_update_own" ON public.credit_card_bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "credit_card_bills_delete_own" ON public.credit_card_bills FOR DELETE USING (auth.uid() = user_id);
