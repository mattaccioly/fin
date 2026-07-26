import type { CurrencyCode } from "@/lib/currencies";

export type IncomeSource =
  | "salary"
  | "capes_scholarship"
  | "freelance"
  | "teaching"
  | "other";

export type PaymentMethod = "pix" | "debit" | "credit" | "cash";

export type ProjectStatus = "active" | "completed" | "archived";

export type BillingMode = "per_class" | "monthly";

export type LessonStatus =
  | "scheduled"
  | "given"
  | "cancelled_by_student"
  | "cancelled_by_me"
  | "rescheduled";

export type LessonPaymentStatus = "pending" | "paid" | "not_billable";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  monthly_budget: number | null;
  created_at: string;
  updated_at: string;
};

export type Project = {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  target_amount: number | null;
  target_date: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  user_id: string;
  main_currency: CurrencyCode;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  currency: CurrencyCode;
  category_id: string;
  description: string | null;
  payment_method: PaymentMethod;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  categories?: Pick<Category, "id" | "name" | "icon" | "color"> | null;
  projects?: Pick<Project, "id" | "name" | "emoji"> | null;
};

export type Income = {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  currency: CurrencyCode;
  source: IncomeSource;
  description: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
};

export type FixedCost = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  due_day: number;
  active: boolean;
  category: string;
  created_at: string;
  updated_at: string;
};

export type Debt = {
  id: string;
  user_id: string;
  name: string;
  total_amount: number;
  installment_amount: number;
  total_installments: number;
  paid_installments: number;
  first_due_date: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCard = {
  id: string;
  user_id: string;
  name: string;
  due_day: number;
  closing_day: number | null;
  last4: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type CreditCardBill = {
  id: string;
  user_id: string;
  credit_card_id: string;
  year: number;
  month: number;
  amount: number;
  paid: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  credit_cards?: Pick<CreditCard, "id" | "name" | "last4" | "due_day" | "closing_day"> | null;
};

export type Investment = {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  currency: CurrencyCode;
  vehicle: string;
  description: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  projects?: Pick<Project, "id" | "name" | "emoji"> | null;
};

export type Student = {
  id: string;
  user_id: string;
  name: string;
  financial_guardian: string;
  billing_mode: BillingMode;
  default_rate: number;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  user_id: string;
  date: string;
  student_id: string;
  status: LessonStatus;
  amount: number;
  payment_status: LessonPaymentStatus;
  payment_date: string | null;
  income_id: string | null;
  created_at: string;
  updated_at: string;
  students?: Pick<
    Student,
    "id" | "name" | "financial_guardian" | "billing_mode" | "default_rate" | "active"
  > | null;
};

export const INCOME_SOURCE_LABELS: Record<IncomeSource, string> = {
  salary: "Salário",
  capes_scholarship: "Bolsa CAPES",
  freelance: "Freelance",
  teaching: "Aulas",
  other: "Outro",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  debit: "Débito",
  credit: "Crédito",
  cash: "Dinheiro",
};

export const BILLING_MODE_LABELS: Record<BillingMode, string> = {
  per_class: "Por aula",
  monthly: "Mensal",
};

export const LESSON_STATUS_LABELS: Record<LessonStatus, string> = {
  scheduled: "Agendada",
  given: "Dada",
  cancelled_by_student: "Cancelada (aluno)",
  cancelled_by_me: "Cancelada (eu)",
  rescheduled: "Remarcada",
};

export const LESSON_PAYMENT_STATUS_LABELS: Record<LessonPaymentStatus, string> = {
  pending: "A receber",
  paid: "Pago",
  not_billable: "Não cobrável",
};

export const DEFAULT_CATEGORIES: Omit<
  Category,
  "id" | "user_id" | "created_at" | "updated_at" | "monthly_budget"
>[] = [
  { name: "Alimentação", icon: "🍽️", color: "#F59E0B" },
  { name: "Transporte", icon: "🚕", color: "#3B82F6" },
  { name: "Lazer", icon: "🎭", color: "#A855F7" },
  { name: "Mercado", icon: "🛒", color: "#22C55E" },
  { name: "Saúde", icon: "💊", color: "#EF4444" },
  { name: "Educação", icon: "📚", color: "#06B6D4" },
  { name: "Assinaturas", icon: "📱", color: "#EC4899" },
  { name: "Outros", icon: "📦", color: "#94A3B8" },
];
