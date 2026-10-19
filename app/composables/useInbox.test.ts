/**
 * دوالّ الصندوق النقيّة: دمجُ الوارد الفوريّ بلا تكرار، والتعليمُ المحلّيّ، والوقتُ النسبيّ.
 */
import { describe, expect, it } from 'vitest'
import { markRowsRead, mergeIncoming, pendingQueue, relativeTimeAr, type InboxRow } from './useInbox'

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
