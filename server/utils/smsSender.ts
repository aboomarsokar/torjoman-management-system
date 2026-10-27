/**
 * من يرسل SMS (طلب المستخدم 2026-10-27): المديرُ الإداريّ لأيّ رقم، والمديرُ الفنيّ لكادر البنين والمديرةُ الإدارية
 * لكادر البنات وحدهم — فأرقامُهما تُطابَق على جوّالات العاملين النشطين من قسمهما.
 */
import type { H3Event } from 'h3'
import { requireCaller } from './caller'
import { SMS_SENDER_SECTION } from './smsScope'

export async function requireSmsSender(event: H3Event) {
  const { caller, admin } = await requireCaller(event)
  if (!(caller.role in SMS_SENDER_SECTION)) {
    throw createError({ statusCode: 403, statusMessage: 'رسائلُ SMS للإدارة وحدها.' })
  }
  return { caller, admin, section: SMS_SENDER_SECTION[caller.role] ?? null }
}
