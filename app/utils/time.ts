/**
 * عرضُ الوقت بصيغة 12 ساعة بالعربية — «4:00 م» لا «16:00» (طلب المستخدم 2026-10-21). يُخزَّن الوقتُ في
 * القاعدة `time` (`HH:MM[:SS]`) ويُحوَّل عند العرض وحده؛ حقولُ الإدخال تبقى على قيمة `HH:MM`.
 */
import { HALAQA_DURATION_MINUTES } from '~/constants/halqat'

const MINUTES_PER_DAY = 24 * 60

/** `HH:MM[:SS]` ← «h:MM ص/م»؛ الفارغُ أو غيرُ المفهوم ← ''. */
export function formatTime12(value: string | null | undefined): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(value ?? '')
  if (!m) return ''
  const h = Number(m[1])
  if (h > 23) return ''
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m[2]} ${h < 12 ? 'ص' : 'م'}`
}

/**
 * موعدُ الحلقة «من … إلى …»: وقتُ البدء ثم البدءُ مضافاً إليه مدّتُها (`HALAQA_DURATION_MINUTES`) —
 * «5:00 م – 7:00 م». الفارغُ أو غيرُ المفهوم ← ''.
 */
export function formatHalaqaTime(value: string | null | undefined, minutes = HALAQA_DURATION_MINUTES): string {
  const start = formatTime12(value)
  if (!start) return ''
  const [h, m] = (value as string).split(':').map(Number) as [number, number]
  const end = (h * 60 + m + minutes) % MINUTES_PER_DAY
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${start} – ${formatTime12(`${pad(Math.floor(end / 60))}:${pad(end % 60)}`)}`
}
