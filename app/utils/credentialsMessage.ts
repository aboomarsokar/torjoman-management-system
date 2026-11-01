/**
 * رسالةُ بيانات دخول الطالب للمعلّم على واتساب (طلب المستخدم 2026-10-27): بعد إضافة الطالب من طلب معلّمه
 * يُفتح واتساب المعلّم برسالةٍ جاهزة فيها الرابطُ والهويةُ والكلمةُ المؤقّتة.
 */
import { OWNED_DOMAIN } from '~/constants/accounts'
import { whatsappLink } from '~/utils/halaqatAchievement'

export const LOGIN_LINK = `${OWNED_DOMAIN}/login`

export interface CredentialsMessageInput {
  teacherName: string | null
  studentName: string
  nationalId: string
  password: string
  female: boolean
}

/**
 * نصُّ الرسالة بالعربية — بلا رموزِ قلوب (أسلوبُ رسائل المستخدم). `plain` لمحادثة المنصّة: بلا نجومِ واتساب
 * (تُعرض فيها حرفاً)، ومعه تنبيهُ أنّ الكلمةَ مؤقّتة (2026-10-28).
 */
export function teacherCredentialsMessage(m: CredentialsMessageInput, plain = false): string {
  const greeting = m.teacherName ? `السلام عليكم أ. ${m.teacherName.split(' ')[0]} 🌿` : 'السلام عليكم 🌿'
  return [
    greeting,
    `بيانات دخول ${m.female ? 'الطالبة' : 'الطالب'} ${plain ? m.studentName : `*${m.studentName}*`} على منصة ترجمان القرآنية:`,
    '',
    `🔗 الرابط: ${LOGIN_LINK}`,
    `👤 اسم المستخدم (رقم الهوية): ${m.nationalId}`,
    `🔑 كلمة المرور المؤقّتة: ${m.password}`,
    '',
    `${m.female ? 'تختار' : 'يختار'} كلمةَ مرورٍ جديدة عند أوّل دخول.`
  ].join('\n') + (plain ? '\n⚠️ الكلمةُ مؤقّتة وتبطل بعد أوّل دخول.' : '')
}

/** رابطُ واتساب برسالةٍ جاهزة، أو null إن لم يكن للمعلّم رقمٌ صالح. */
export function whatsappMessageLink(phone: string | null | undefined, text: string): string | null {
  const base = whatsappLink(phone)
  return base ? `${base}?text=${encodeURIComponent(text)}` : null
}

/** ما يلزم زرَّي الإرسال للمعلّم: الطالبُ وكلمتُه المؤقّتة ومعلّمُ حلقته (ردُّ الموافقة على الطلب أو إعادة التعيين). */
export interface TeacherShareInput {
  teacher_id: string | null
  teacher_name: string | null
  teacher_phone: string | null
  full_name: string
  national_id: string
  temp_password: string
  female: boolean
}

function messageFor(res: TeacherShareInput, plain = false) {
  return teacherCredentialsMessage({
    teacherName: res.teacher_name, studentName: res.full_name, nationalId: res.national_id, password: res.temp_password, female: res.female
  }, plain)
}

/** زرُّ «أرسلها للمعلّم على واتساب» برسالة بيانات الدخول، أو null إن لم يكن للمعلّم رقم. */
export function whatsappFor(res: TeacherShareInput) {
  const url = whatsappMessageLink(res.teacher_phone, messageFor(res))
  return url ? { label: res.female ? 'أرسلها للمعلّمة على واتساب' : 'أرسلها للمعلّم على واتساب', url } : null
}

/** زرُّ «أرسلها عبر المحادثة» — الرسالةُ نفسها بلا تنسيق واتساب، أو null إن لم يكن للحلقة معلّم. */
export function chatFor(res: Omit<TeacherShareInput, 'teacher_phone'>) {
  if (!res.teacher_id) return null
  return { label: res.female ? 'أرسلها للمعلّمة عبر المحادثة' : 'أرسلها للمعلّم عبر المحادثة', recipientId: res.teacher_id, text: messageFor({ ...res, teacher_phone: null }, true) }
}
