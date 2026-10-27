import { describe, expect, it, vi } from 'vitest'
import type { ReportHeader } from '~/utils/quran/month'
import type { MonthInputs } from '~/utils/quran/monthInputs'
import { offlinePeriod } from './useOfflineQuran'

// تعريفُ الصناديق يحتاج Nuxt — والدالّةُ المختبَرة لا تمسّه
vi.mock('~/utils/offlineQueues', () => ({ QURAN_QUEUE: 'quran' }))

const month = (m: number, status: ReportHeader['status'] | null) => ({
  year: 2026, month: m, inputs: { report: status ? { status } : null } as MonthInputs
})

describe('offlinePeriod', () => {
  it('المسوّدةُ السابقةُ المعلّقة أوّلاً', () => {
    expect(offlinePeriod([month(10, 'draft'), month(11, null)], '2026-11-03')).toEqual({ year: 2026, month: 10 })
  })
  it('وإلا الجاري (أُرسل السابقُ أو لم يبدأ)', () => {
    expect(offlinePeriod([month(10, 'submitted'), month(11, null)], '2026-11-03')).toEqual({ year: 2026, month: 11 })
    expect(offlinePeriod([month(10, null), month(11, null)], '2026-11-03')).toEqual({ year: 2026, month: 11 })
  })
  it('شهرٌ واحدٌ محفوظ، ولا شيء بلا نسخة', () => {
    expect(offlinePeriod([month(10, null)], '2026-10-27')).toEqual({ year: 2026, month: 10 })
    expect(offlinePeriod([], '2026-10-27')).toBeNull()
  })
})
