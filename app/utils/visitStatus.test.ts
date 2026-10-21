/**
 * «متأخّرة» تُشتقّ من موعدٍ فات يومُه بتوقيت غزة بلا تنفيذ، و«تمّت» كلُّ منفّذة، والالتزامُ ما تمّ ÷ المستحقّة.
 */
import { describe, expect, it } from 'vitest'
import { executedAtFromDay, formatVisitMoment, gazaDayOf, visitCommitment, visitDisplayStatus } from './visitStatus'

describe('gazaDayOf', () => {
  it('منتصف الليل بتوقيت غزة يسبق غرينتش بيوم', () => {
    // 23:12 غرينتش يوم 3 = 02:12 في غزة يوم 4 (صيفاً +3)
    expect(gazaDayOf('2026-10-03T23:12:00Z')).toBe('2026-10-04')
  })
})

describe('visitDisplayStatus', () => {
  const today = '2026-10-19'
  it('مجدولةٌ يومُها اليوم تبقى مجدولة', () => {
    expect(visitDisplayStatus({ status: 'scheduled', scheduled_at: '2026-10-19T15:00:00Z' }, today)).toBe('scheduled')
  })
  it('مجدولةٌ فات يومُها بلا تنفيذ = متأخّرة', () => {
    expect(visitDisplayStatus({ status: 'scheduled', scheduled_at: '2026-10-18T09:00:00Z' }, today)).toBe('late')
  })
  it('المنفّذةُ «تمّت» في موعدها أو بعده (late في القاعدة لا يُعرض متأخّراً)', () => {
    expect(visitDisplayStatus({ status: 'late', scheduled_at: '2026-10-01T09:00:00Z' }, today)).toBe('done')
    expect(visitDisplayStatus({ status: 'done', scheduled_at: '2026-10-01T09:00:00Z' }, today)).toBe('done')
  })
})

describe('visitCommitment', () => {
  const today = '2026-10-19'
  it('القادمةُ لا تدخل المقام', () => {
    expect(visitCommitment([{ status: 'scheduled', scheduled_at: '2026-10-25T09:00:00Z' }], today)).toBeNull()
  })
  it('ما تمّ بأيّ تأخير ÷ (تمّت + متأخّرة لم تُنفَّذ)', () => {
    const visits = [
      { status: 'done', scheduled_at: '2026-10-02T09:00:00Z' },
      { status: 'done', scheduled_at: '2026-10-05T09:00:00Z' },
      { status: 'late', scheduled_at: '2026-10-08T09:00:00Z' }, // نُفّذت بعد موعدها = تمّت
      { status: 'scheduled', scheduled_at: '2026-10-10T09:00:00Z' }, // متأخّرة
      { status: 'scheduled', scheduled_at: '2026-10-30T09:00:00Z' } // قادمة
    ]
    expect(visitCommitment(visits, today)).toBe(75)
  })
})

describe('formatVisitMoment', () => {
  it('اليومُ والساعة بتوقيت غزة والشهرُ بالرقم', () => {
    expect(formatVisitMoment('2026-10-03T23:12:00Z')).toBe('04-10-2026 · 02:12')
  })
})

describe('executedAtFromDay', () => {
  it('يبقى في اليوم المختار بتوقيت غزة', () => {
    expect(gazaDayOf(executedAtFromDay('2026-10-19'))).toBe('2026-10-19')
    expect(gazaDayOf(executedAtFromDay('2026-01-05'))).toBe('2026-01-05')
  })
})
