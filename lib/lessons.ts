import { monthRange, parseLocalDate } from "@/lib/format";
import type {
  Lesson,
  LessonPaymentStatus,
  LessonStatus,
  Student,
} from "@/lib/types";

export type LessonTotals = {
  given: number;
  receivable: number;
  received: number;
};

export function defaultPaymentStatusForLessonStatus(
  status: LessonStatus,
): LessonPaymentStatus {
  if (
    status === "cancelled_by_student" ||
    status === "cancelled_by_me" ||
    status === "rescheduled"
  ) {
    return "not_billable";
  }
  return "pending";
}

export function lessonTotals(
  lessons: Pick<Lesson, "status" | "payment_status" | "amount">[],
): LessonTotals {
  let given = 0;
  let receivable = 0;
  let received = 0;

  for (const lesson of lessons) {
    const amount = Number(lesson.amount);
    if (lesson.status === "given") given += amount;
    if (lesson.payment_status === "pending") receivable += amount;
    if (lesson.payment_status === "paid") received += amount;
  }

  return { given, receivable, received };
}

/** True when a monthly student has given+pending lessons in a month that has already ended. */
export function isMonthClosedAwaitingPayment(
  student: Pick<Student, "billing_mode">,
  lessons: Pick<Lesson, "date" | "status" | "payment_status" | "student_id">[],
  year: number,
  month: number,
  today: Date = new Date(),
): boolean {
  if (student.billing_mode !== "monthly") return false;

  const { end } = monthRange(year, month);
  const monthEnd = parseLocalDate(end);
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (todayStart <= monthEnd) return false;

  return lessons.some(
    (l) =>
      l.status === "given" &&
      l.payment_status === "pending" &&
      l.date >= monthRange(year, month).start &&
      l.date <= end,
  );
}

export type ReceivableGroup = {
  key: string;
  label: string;
  total: number;
  count: number;
  studentIds: string[];
  awaitingClosedMonth: boolean;
};

export function groupReceivableByGuardian(
  lessons: (Pick<
    Lesson,
    "amount" | "payment_status" | "status" | "date" | "student_id"
  > & {
    students?: Pick<
      Student,
      "id" | "name" | "financial_guardian" | "billing_mode"
    > | null;
  })[],
  today: Date = new Date(),
): ReceivableGroup[] {
  const pending = lessons.filter((l) => l.payment_status === "pending");
  const map = new Map<string, ReceivableGroup>();

  for (const lesson of pending) {
    const student = lesson.students;
    const guardian = (student?.financial_guardian || student?.name || "Sem nome").trim();
    const key = guardian.toLowerCase();
    const existing = map.get(key);
    const amount = Number(lesson.amount);

    const lessonDate = parseLocalDate(lesson.date);
    const y = lessonDate.getFullYear();
    const m = lessonDate.getMonth() + 1;
    const awaiting =
      !!student &&
      isMonthClosedAwaitingPayment(
        student,
        [lesson],
        y,
        m,
        today,
      );

    if (existing) {
      existing.total += amount;
      existing.count += 1;
      if (student && !existing.studentIds.includes(student.id)) {
        existing.studentIds.push(student.id);
      }
      existing.awaitingClosedMonth = existing.awaitingClosedMonth || awaiting;
    } else {
      map.set(key, {
        key,
        label: guardian,
        total: amount,
        count: 1,
        studentIds: student ? [student.id] : [],
        awaitingClosedMonth: awaiting,
      });
    }
  }

  return [...map.values()].sort((a, b) => b.total - a.total);
}
