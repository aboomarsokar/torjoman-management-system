/**
 * دوالّ الصندوق النقيّة: دمجُ الوارد الفوريّ بلا تكرار، والتعليمُ المحلّيّ، والوقتُ النسبيّ.
 */
import { describe, expect, it } from 'vitest'
import { markRowsRead, mergeIncoming, mergeRows, newUnreadIds, pendingQueue, relativeTimeAr, type InboxRow } from './useInbox'

function row(id: string, created_at: string, read_at: string | null = null, source_id: string | null = null): InboxRow {
  return { id, kind: 'alert_issued', title: 't', body: null, link: '/alerts', source_id, read_at, created_at }
}

describe('mergeIncoming', () => {
  it('يضع الجديدَ أوّلاً بترتيب الوقت النازل', () => {
    const out = mergeIncoming([row('a', '2026-10-19T08:00:00Z')], row('b', '2026-10-19T09:00:00Z'))
    expect(out.map(r => r.id)).toEqual(['b', 'a'])
  })

  it('لا يكرّر صفّاً وصل مرّتين (Realtime ثم الاستطلاع)', () => {
    const r = row('a', '2026-10-19T08:00:00Z')
    expect(mergeIncoming([r], { ...r })).toHaveLength(1)
  })

  it('يقصّ عند الحدّ', () => {
    const rows = [row('a', '2026-10-19T08:00:00Z'), row('b', '2026-10-19T07:00:00Z')]
    expect(mergeIncoming(rows, row('c', '2026-10-19T09:00:00Z'), 2).map(r => r.id)).toEqual(['c', 'a'])
  })

  it('يرتّب بالقيمة الزمنية لا بالنصّ (صيغٌ مختلفة: Z و+00:00 و+03:00)', () => {
    const rows = [row('a', '2026-10-19T08:00:00.5+00:00'), row('b', '2026-10-19T08:00:00Z')]
    const out = mergeIncoming(rows, row('c', '2026-10-19T09:00:00+03:00'))
    expect(out.map(r => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mergeRows', () => {
  it('يُبقي صفّاً فوريّاً أحدثَ لم تلتقطه قراءةٌ بدأت قبله', () => {
    const current = [row('new', '2026-10-19T09:00:00Z'), row('a', '2026-10-19T08:00:00Z')]
    const fetched = [row('a', '2026-10-19T08:00:00Z')]
    expect(mergeRows(current, fetched).map(r => r.id)).toEqual(['new', 'a'])
  })

  it('يضيف ما جاء بالقراءة ولا يكرّر المشترك', () => {
    const out = mergeRows([row('a', '2026-10-19T08:00:00Z')], [row('a', '2026-10-19T08:00:00Z'), row('b', '2026-10-19T07:00:00Z')])
    expect(out.map(r => r.id)).toEqual(['a', 'b'])
  })

  it('القراءةُ لا تتراجع: قراءةٌ قديمة تحمل الصفّ غيرَ مقروء لا تُلغي تعليمَه محلّياً', () => {
    const readLocally = row('a', '2026-10-19T08:00:00Z', '2026-10-19T08:30:00Z')
    const out = mergeRows([readLocally], [row('a', '2026-10-19T08:00:00Z')])
    expect(out[0]!.read_at).toBe('2026-10-19T08:30:00Z')
  })

  it('وتأتي القراءةُ بالتعليم من خادمٍ آخر فتعلّم الصفّ', () => {
    const out = mergeRows([row('a', '2026-10-19T08:00:00Z')], [row('a', '2026-10-19T08:00:00Z', '2026-10-19T08:30:00Z')])
    expect(out[0]!.read_at).toBe('2026-10-19T08:30:00Z')
  })

  it('يقصّ عند الحدّ', () => {
    const out = mergeRows([row('a', '2026-10-19T08:00:00Z')], [row('b', '2026-10-19T09:00:00Z'), row('c', '2026-10-19T07:00:00Z')], 2)
    expect(out.map(r => r.id)).toEqual(['b', 'a'])
  })
})

describe('newUnreadIds', () => {
  const read = '2026-10-19T09:00:00Z'

  it('أوّل قراءة وفيها غير مقروء: كلُّ غير المقروء جديد', () => {
    const out = newUnreadIds(null, [row('a', '2026-10-19T08:00:00Z'), row('b', '2026-10-19T07:00:00Z', read)])
    expect(out.fresh).toEqual(['a'])
    expect([...out.seen].sort()).toEqual(['a', 'b'])
  })

  it('أوّل قراءة كلُّها مقروءة: لا جديد', () => {
    const out = newUnreadIds(null, [row('a', '2026-10-19T08:00:00Z', read)])
    expect(out.fresh).toEqual([])
    expect(out.seen.has('a')).toBe(true)
  })

  it('أوّل قراءة فارغة: لا جديد، والأساس لم يعد null', () => {
    const out = newUnreadIds(null, [])
    expect(out.fresh).toEqual([])
    expect(out.seen.size).toBe(0)
  })

  it('صفٌّ فوريّ جديد غيرُ مقروء: هو الجديد', () => {
    const out = newUnreadIds(new Set(['a']), [row('b', '2026-10-19T09:00:00Z'), row('a', '2026-10-19T08:00:00Z')])
    expect(out.fresh).toEqual(['b'])
    expect(out.seen.has('b')).toBe(true)
  })

  it('الصفوفُ نفسُها بعد استطلاعٍ جديد: لا جديد', () => {
    const rows = [row('a', '2026-10-19T08:00:00Z')]
    const first = newUnreadIds(null, rows)
    expect(newUnreadIds(first.seen, rows).fresh).toEqual([])
  })

  it('صفٌّ صار مقروءاً: لا جديد', () => {
    expect(newUnreadIds(new Set(['a']), [row('a', '2026-10-19T08:00:00Z', read)]).fresh).toEqual([])
  })

  it('صفٌّ جديدٌ وصل مقروءاً: لا جديد (لا يرنّ على ما قُرئ)', () => {
    expect(newUnreadIds(new Set(['a']), [row('b', '2026-10-19T09:00:00Z', read)]).fresh).toEqual([])
  })

  it('نزولُ العدّ لا يعني جديداً، ولا يُنسى ما رُئي: صفٌّ خرج من النافذة ثم عاد لا يرنّ', () => {
    const seen = newUnreadIds(null, [row('a', '2026-10-19T08:00:00Z')]).seen
    const gone = newUnreadIds(seen, [])
    expect(gone.seen.has('a')).toBe(true)
    expect(newUnreadIds(gone.seen, [row('a', '2026-10-19T08:00:00Z')]).fresh).toEqual([])
  })

  it('لا يعدّل المجموعةَ المُمرَّرة', () => {
    const seen = new Set(['a'])
    newUnreadIds(seen, [row('b', '2026-10-19T09:00:00Z')])
    expect([...seen]).toEqual(['a'])
  })
})

describe('markRowsRead', () => {
  const rows = [row('a', '2026-10-19T08:00:00Z'), row('b', '2026-10-19T07:00:00Z', '2026-10-19T07:30:00Z')]

  it('يعلّم المحدَّد وحده ولا يمسّ المقروء سابقاً', () => {
    const out = markRowsRead(rows, ['a'], '2026-10-19T10:00:00Z')
    expect(out[0]!.read_at).toBe('2026-10-19T10:00:00Z')
    expect(out[1]!.read_at).toBe('2026-10-19T07:30:00Z')
  })

  it('null = الكلّ', () => {
    expect(markRowsRead(rows, null, 'X').every(r => r.read_at)).toBe(true)
  })
})

describe('pendingQueue', () => {
  const queue = [{ id: 'al-1' }, { id: 'graded' }]

  it('يخفي بندَ الطابور الذي يمثّله خبرٌ غيرُ مقروء', () => {
    const rows = [row('n1', '2026-10-19T08:00:00Z', null, 'al-1')]
    expect(pendingQueue(queue, rows).map(q => q.id)).toEqual(['graded'])
  })

  it('يُبقيه إذا قُرئ الخبر (العملُ ما زال منتظراً)', () => {
    const rows = [row('n1', '2026-10-19T08:00:00Z', '2026-10-19T09:00:00Z', 'al-1')]
    expect(pendingQueue(queue, rows).map(q => q.id)).toEqual(['al-1', 'graded'])
  })

  it('يُبقي البنودَ غيرَ المتصلة بأيّ خبر', () => {
    const rows = [row('n1', '2026-10-19T08:00:00Z', null, 'other')]
    expect(pendingQueue(queue, rows).map(q => q.id)).toEqual(['al-1', 'graded'])
  })

  it('خبرٌ بلا source_id لا يخفي شيئاً', () => {
    const rows = [row('n1', '2026-10-19T08:00:00Z', null, null)]
    expect(pendingQueue(queue, rows)).toEqual(queue)
  })
})

describe('relativeTimeAr', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  it.each([
    ['2026-10-19T11:59:30Z', 'الآن'],
    ['2026-10-19T11:55:00Z', 'منذ 5 د'],
    ['2026-10-19T09:00:00Z', 'منذ 3 س'],
    ['2026-10-17T09:00:00Z', '17-10'],
    // 22:30 بالتوقيت العالمي = 01:30 يوم 18 في غزة (UTC+3) — يحرس خيار Asia/Gaza
    ['2026-10-17T22:30:00Z', '18-10']
  ])('%s ← %s', (iso, expected) => {
    expect(relativeTimeAr(iso, now)).toBe(expected)
  })
})
