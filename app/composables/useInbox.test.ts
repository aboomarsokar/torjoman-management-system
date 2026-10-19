/**
 * دوالّ الصندوق النقيّة: دمجُ الوارد الفوريّ بلا تكرار، والتعليمُ المحلّيّ، والوقتُ النسبيّ.
 */
import { describe, expect, it } from 'vitest'
import { markRowsRead, mergeIncoming, relativeTimeAr, type InboxRow } from './useInbox'

function row(id: string, created_at: string, read_at: string | null = null): InboxRow {
  return { id, kind: 'alert_issued', title: 't', body: null, link: '/alerts', read_at, created_at }
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

describe('relativeTimeAr', () => {
  const now = new Date('2026-10-19T12:00:00Z')
  it.each([
    ['2026-10-19T11:59:30Z', 'الآن'],
    ['2026-10-19T11:55:00Z', 'منذ 5 د'],
    ['2026-10-19T09:00:00Z', 'منذ 3 س'],
    ['2026-10-17T09:00:00Z', '17-10']
  ])('%s ← %s', (iso, expected) => {
    expect(relativeTimeAr(iso, now)).toBe(expected)
  })
})
