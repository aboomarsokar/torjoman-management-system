/**
 * رسائلُ جاهزةٌ تُفتح بها المحادثةُ مع المعلّم من صفحات الطلبات (طلب المستخدم 2026-10-28) — مسوّدةٌ في خانة الكتابة
 * يعدّلها المرسِل قبل أن يرسلها، لا تُرسَل وحدها. بلا رموز قلوب (أسلوبُ رسائل المستخدم).
 */
import { BOOKLETS } from '~/constants/booklets'

/** «السلام عليكم أ. محمود» من الاسم الكامل (الاسمُ الأوّل وحده). */
export function greetTeacher(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0]
  return first ? `السلام عليكم أ. ${first}` : 'السلام عليكم'
}

/** «نسخة واحدة» · «نسختان» · «3 نسخ» · «15 نسخة». */
export function copiesLabel(n: number): string {
  if (n === 1) return 'نسخة واحدة'
  if (n === 2) return 'نسختان'
  return n >= 3 && n <= 10 ? `${n} نسخ` : `${n} نسخة`
}

/** «ملزمة الجزء 27 + 28 (3 نسخ) جاهزة، تفضّل للاستلام.» */
export function bookletReadyDraft(teacher: string | null | undefined, booklet: number, copies: number, female: boolean): string {
  const label = BOOKLETS.find(b => b.no === booklet)?.label ?? `الملزمة ${booklet}`
  return `${greetTeacher(teacher)}، ملزمة ${label} (${copiesLabel(copies)}) جاهزة، ${female ? 'تفضّلي' : 'تفضّل'} للاستلام.`
}

/** «بخصوص طلب إضافة الطالب فلان: » — يكمل المرسِلُ سؤالَه. */
export function studentRequestDraft(teacher: string | null | undefined, student: string, female: boolean, kind: 'add' | 'remove' = 'add'): string {
  return `${greetTeacher(teacher)}، بخصوص طلب ${kind === 'remove' ? 'حذف' : 'إضافة'} ${female ? 'الطالبة' : 'الطالب'} ${student}: `
}
