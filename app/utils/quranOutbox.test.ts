import { describe, expect, it } from 'vitest'
import type { QuranRecordRow } from '~/utils/quran/month'
import { entryAsRecord, newQuranEntry, offlineSubmitBlock, overlayRecords, quranMirrorKey, recordsCount } from './quranOutbox'

const input = { from: { surah: 78, ayah: 1 }, to: { surah: 78, ayah: 40 }, pagesMemorized: 2, pagesReviewed: 5, notes: ' جيّد ' }
const at = new Date('2026-10-27T08:00:00Z')
const row = (student: string): QuranRecordRow => ({
  id: `r-${student}`, report_id: 'rep', student_id: student, from_surah: 1, from_ayah: 1, to_surah: 1, to_ayah: 7,
  pages_memorized: 1, pages_reviewed: null, notes: null, recorded_at: null, recorded_by: 'u', created_at: 'c', updated_at: 'u'
})

describe('newQuranEntry', () => {
  it('مفتاحٌ واحدٌ للطالب في الشهر', () => {
    const e = newQuranEntry('u', 'h', 2026, 10, 's', input, at)
    expect(e.key).toBe('u|h|2026-10|s')
    expect(e.recordedAt).toBe('2026-10-27T08:00:00.000Z')
    expect(e.status).toBe('pending')
  })
  it('مفتاحُ النسخة', () => {
    expect(quranMirrorKey('u', 2026, 9)).toBe('u|2026-09')
  })
})

describe('overlayRecords', () => {
  it('يستبدل سجلَّ الطالب ويُبقي معرّفَه ورأسَه', () => {
    const e = newQuranEntry('u', 'h', 2026, 10, 'a', input, at)
    const [r] = overlayRecords([row('a')], [e])
    expect(r).toMatchObject({ id: 'r-a', report_id: 'rep', to_surah: 78, to_ayah: 40, pages_memorized: 2, notes: 'جيّد' })
  })
  it('يضيف سجلَّ طالبٍ لم يُرصد بمعرّفٍ محلّيّ', () => {
    const e = newQuranEntry('u', 'h', 2026, 10, 'b', input, at)
    const out = overlayRecords([row('a')], [e])
    expect(out.map(r => r.id)).toEqual(['r-a', 'local:b'])
  })
  it('المرفوضُ لا يُدمج', () => {
    const e = { ...newQuranEntry('u', 'h', 2026, 10, 'a', input, at), status: 'rejected' as const }
    expect(overlayRecords([row('a')], [e])[0]!.to_ayah).toBe(7)
  })
  it('«لم يحفظ جديداً»: لا مواضع', () => {
    const e = newQuranEntry('u', 'h', 2026, 10, 'a', { from: null, to: null, pagesMemorized: 0, pagesReviewed: null, notes: '' }, at)
    expect(entryAsRecord(e, undefined, 'new')).toMatchObject({ id: 'new', from_surah: null, to_ayah: null, notes: null })
  })
})

describe('offlineSubmitBlock', () => {
  it('الاتصالُ ثمّ الصندوقُ ثمّ نافذةُ الإرسال', () => {
    expect(offlineSubmitBlock({ online: false, pending: 0, windowBlock: null })).toBe('الإرسالُ يحتاج اتصالاً.')
    expect(offlineSubmitBlock({ online: true, pending: 2, windowBlock: null })).toBe('ينتظر سجلّان الرفعَ قبل الإرسال.')
    expect(offlineSubmitBlock({ online: true, pending: 0, windowBlock: 'لاحقاً' })).toBe('لاحقاً')
    expect(offlineSubmitBlock({ online: true, pending: 0, windowBlock: null })).toBeNull()
  })
  it('عددُ السجلّات', () => {
    expect([1, 2, 3, 11].map(recordsCount)).toEqual(['سجلٌّ واحد', 'سجلّان', '3 سجلّات', '11 سجلّاً'])
  })
})
