-- Expenses paid from a project's reserved (invested) amount.
-- These draw down the project's reserve and are excluded from monthly
-- outflows, category charts, and budgets — they already left the
-- spendable pool when the investment was recorded.

ALTER TABLE public.expenses
  ADD COLUMN paid_from_reserve boolean NOT NULL DEFAULT false;
