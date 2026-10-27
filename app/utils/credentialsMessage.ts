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

/** نصُّ الرسالة بالعربية — بلا رموزِ قلوب (أسلوبُ رسائل المستخدم). */
export function teacherCredentialsMessage(m: CredentialsMessageInput): string {
  const greeting = m.teacherName ? `السلام عليكم أ. ${m.teacherName.split(' ')[0]} 🌿` : 'السلام عليكم 🌿'
  return [
    greeting,
    `بيانات دخول ${m.female ? 'الطالبة' : 'الطالب'} *${m.studentName}* على منصة ترجمان القرآنية:`,
    '',
    `🔗 الرابط: ${LOGIN_LINK}`,
    `👤 اسم المستخدم (رقم الهوية): ${m.nationalId}`,
    `🔑 كلمة المرور المؤقّتة: ${m.password}`,
    '',
    `${m.female ? 'تختار' : 'يختار'} كلمةَ مرورٍ جديدة عند أوّل دخول.`
  ].join('\n')
}

/** رابطُ واتساب برسالةٍ جاهزة، أو null إن لم يكن للمعلّم رقمٌ صالح. */
export function whatsappMessageLink(phone: string | null | undefined, text: string): string | null {
  const base = whatsappLink(phone)
  return base ? `${base}?text=${encodeURIComponent(text)}` : null
}
