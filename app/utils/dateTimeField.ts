/**
 * منطق حقل «التاريخ والوقت» (UiDateTimeField) — نقيّ وقابل للاختبار.
 * القيمة نصّ محلّي `YYYY-MM-DDTHH:mm` (كقيمة datetime-local) فلا يتغيّر شيء عند من يستهلكها.
 */

/** يفصل القيمة إلى تاريخ ووقت؛ والفارغ فارغان. */
export function splitDateTime(value: string | null | undefined): { date: string, time: string } {
  if (!value) return { date: '', time: '' }
  const [date = '', time = ''] = value.split('T')
  return { date, time: time.slice(0, 5) }
}

/** يجمعهما — لا قيمة إلا باكتمال الاثنين. */
export function joinDateTime(date: string, time: string): string {
  return date && time ? `${date}T${time}` : ''
}

/** الوقتُ المقترح بصيغة `HH:MM` (وتُقبل الثواني فتُقصّ)؛ وغيرُها — كـ«4:00 م» — فارغ كي لا تفسد القيمة. */
export function normalizeSuggestedTime(value: string | null | undefined): string {
  const t = (value ?? '').slice(0, 5)
  return /^\d{2}:\d{2}$/.test(t) ? t : ''
}

/** «16:30» ← «4:30 م» (اثنتا عشرة ساعة بالعربية، أرقام لاتينية). */
export function timeLabel(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number)
  const period = h < 12 ? 'ص' : 'م'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/**
 * خيارات الوقت كل `step` دقيقة بين `from` و`to` (شاملة)، مع الوقت الحالي والمقترح إن لم يقعا على الشبكة
 * (كي لا يختفي وقتٌ محفوظ مثل 16:10).
 */
export function timeOptions(extra: (string | null | undefined)[] = [], from = 6, to = 22, step = 15) {
  const set = new Set<string>()
  for (let mins = from * 60; mins <= to * 60; mins += step) {
    set.add(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`)
  }
  for (const e of extra) if (e && /^\d{2}:\d{2}$/.test(e)) set.add(e)
  return [...set].sort().map(v => ({ label: timeLabel(v), value: v }))
}
