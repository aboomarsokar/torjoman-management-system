/**
 * عرضُ المحادثات (طلب المستخدم 2026-10-27): «متصلٌ الآن / آخرُ ظهور»، وأوقاتُ الرسائل وفواصلُ الأيام بتوقيت غزة،
 * وعلامةُ «قُرئت». منطقٌ صرفٌ مختبَر.
 */
import { CHAT_ONLINE_WINDOW_MS, CHAT_TIME_ZONE } from '~/constants/chat'
import { formatTime12 } from '~/utils/time'

const DAY_MS = 86_400_000

/** «2026-10-27» بتوقيت غزة. */
export function gazaDayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CHAT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** «14:05» بتوقيت غزة. */
function gazaHourMinute(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: CHAT_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date)
}

/** متصلٌ إن ظهر في نافذة الاتصال. */
export function isOnline(lastSeen: string | null | undefined, now = Date.now()): boolean {
  if (!lastSeen) return false
  return now - new Date(lastSeen).getTime() <= CHAT_ONLINE_WINDOW_MS
}

/** «اليوم» / «أمس» / «27/10/2026». */
export function dayLabel(iso: string, now = Date.now()): string {
  const d = new Date(iso)
  const key = gazaDayKey(d)
  if (key === gazaDayKey(new Date(now))) return 'اليوم'
  if (key === gazaDayKey(new Date(now - DAY_MS))) return 'أمس'
  const [y, m, day] = key.split('-')
  return `${Number(day)}/${Number(m)}/${y}`
}

/** وقتُ الرسالة «2:15 م». */
export function messageTime(iso: string): string {
  return formatTime12(gazaHourMinute(new Date(iso)))
}

/** «متصل الآن» أو «آخر ظهور: اليوم 2:15 م» أو «لم يظهر بعد». */
export function lastSeenLabel(lastSeen: string | null | undefined, now = Date.now()): string {
  if (!lastSeen) return 'لم يظهر بعد'
  if (isOnline(lastSeen, now)) return 'متصل الآن'
  return `آخر ظهور: ${dayLabel(lastSeen, now)} ${messageTime(lastSeen)}`
}

/** وقتُ آخر رسالةٍ في القائمة: الساعةُ لليوم، وإلا «أمس» أو التاريخ. */
export function listTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return ''
  const day = dayLabel(iso, now)
  return day === 'اليوم' ? messageTime(iso) : day
}

/** قرأها الآخرون كلُّهم (للمحادثة الفردية: الطرفُ الآخر). */
export function readByOthers(createdAt: string, members: { id: string, last_read_at: string | null }[], me: string): boolean {
  const others = members.filter(m => m.id !== me)
  return others.length > 0 && others.every(m => !!m.last_read_at && m.last_read_at >= createdAt)
}

/** يحتاج الفاصلَ قبل الرسالة: أوّلُها أو يومٌ غيرُ يوم سابقتها. */
export function startsNewDay(prev: string | undefined, current: string): boolean {
  return !prev || gazaDayKey(new Date(prev)) !== gazaDayKey(new Date(current))
}

/** «3 أعضاء» / «24 عضواً» — جمعُ العدد العربيّ. */
export function membersLabel(n: number): string {
  return n >= 3 && n <= 10 ? `${n} أعضاء` : n === 2 ? 'عضوان' : `${n} عضواً`
}
