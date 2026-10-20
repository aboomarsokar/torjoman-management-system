import { describe, expect, it } from 'vitest'
import { canEditTrip, formatAmount, groupByEmployee, isolateLtr, monthBounds, normalizeAmount, numberTrips, payAllText, sumAmount, unpaid, validateTrip } from './transport'
import type { Trip } from './transport'

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: 't1', profile_id: 'p1', trip_date: '2026-10-05', description: 'زيارة حلقة', amount: 20,
  notes: null, paid: false, paid_at: null, created_at: '2026-10-05T08:00:00Z', ...over
})

describe('monthBounds', () => {
  it('الشهر 10 ← من 1 إلى أوّل 11 حصرياً', () => {
    expect(monthBounds(2026, 10)).toEqual({ from: '2026-10-01', to: '2026-11-01' })
  })
  it('الشهر 12 يعبر السنة', () => {
    expect(monthBounds(2026, 12)).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })
})

describe('numberTrips', () => {
  it('يرقّم بالتاريخ ثم وقت الإنشاء', () => {
    const rows = numberTrips([
      trip({ id: 'b', trip_date: '2026-10-07' }),
      trip({ id: 'a2', trip_date: '2026-10-03', created_at: '2026-10-03T10:00:00Z' }),
      trip({ id: 'a1', trip_date: '2026-10-03', created_at: '2026-10-03T09:00:00Z' })
    ])
    expect(rows.map(r => [r.id, r.serial])).toEqual([['a1', 1], ['a2', 2], ['b', 3]])
  })
})

describe('sumAmount / formatAmount', () => {
  it('يجمع بلا أخطاء كسور', () => {
    expect(sumAmount([{ amount: 0.1 }, { amount: 0.2 }])).toBe(0.3)
  })
  it('الصحيح بلا كسور، والكسريّ بخانتين', () => {
    expect(formatAmount(120)).toBe('120 ₪')
    expect(formatAmount(125.5)).toBe('125.50 ₪')
  })
})

describe('groupByEmployee', () => {
  it('مجموعةٌ لكلّ موظف بالاسم، بمجموعها وغير المسدَّد منه', () => {
    const groups = groupByEmployee([
      trip({ id: '1', profile_id: 'p2', amount: 10 }),
      trip({ id: '2', profile_id: 'p1', amount: 15, paid: true, paid_at: 'x' }),
      trip({ id: '3', profile_id: 'p1', amount: 5 })
    ], { p1: 'بلال', p2: 'أحمد' })
    expect(groups.map(g => [g.name, g.total, g.unpaidTotal, g.trips.length])).toEqual([
      ['أحمد', 10, 10, 1], ['بلال', 20, 5, 2]
    ])
  })
  it('موظفٌ بلا اسمٍ معروف ← «—»', () => {
    expect(groupByEmployee([trip()], {})[0]!.name).toBe('—')
  })
})

describe('payAllText', () => {
  it('صيغُ العدد', () => {
    expect(payAllText([trip({ amount: 20 })])).toBe('تسديد رحلة واحدة بمبلغ 20 ₪؟')
    expect(payAllText([trip(), trip()])).toBe('تسديد رحلتين بمبلغ 40 ₪؟')
    expect(payAllText(Array.from({ length: 3 }, () => trip({ amount: 10 })))).toBe('تسديد 3 رحلات بمبلغ 30 ₪؟')
    expect(payAllText(Array.from({ length: 11 }, () => trip({ amount: 1 })))).toBe('تسديد 11 رحلة بمبلغ 11 ₪؟')
  })
})

describe('unpaid / canEditTrip', () => {
  it('غيرُ المسدَّد وحده', () => {
    expect(unpaid([trip({ id: 'a' }), trip({ id: 'b', paid: true, paid_at: 'x' })]).map(t => t.id)).toEqual(['a'])
  })
  it('صاحبُها ما دامت غيرَ مسدَّدة، والمدير الإداري دائماً', () => {
    expect(canEditTrip({ paid: false }, { isOwner: true, isAdmin: false })).toBe(true)
    expect(canEditTrip({ paid: true }, { isOwner: true, isAdmin: false })).toBe(false)
    expect(canEditTrip({ paid: true }, { isOwner: false, isAdmin: true })).toBe(true)
    expect(canEditTrip({ paid: false }, { isOwner: false, isAdmin: false })).toBe(false)
  })
})

describe('validateTrip', () => {
  const ok = { trip_date: '2026-10-05', description: 'زيارة', amount: '20', notes: '' }
  it('سليمٌ ← لا أخطاء', () => {
    expect(validateTrip(ok, '2026-10-20')).toEqual([])
  })
  it('تاريخٌ بعد اليوم، وبيانٌ فارغ، ومبلغٌ غيرُ موجب أو بأكثر من خانتين', () => {
    const names = (i: typeof ok) => validateTrip(i, '2026-10-20').map(e => e.name)
    expect(names({ ...ok, trip_date: '2026-10-21' })).toEqual(['trip_date'])
    expect(names({ ...ok, trip_date: '' })).toEqual(['trip_date'])
    expect(names({ ...ok, description: '   ' })).toEqual(['description'])
    expect(names({ ...ok, amount: '0' })).toEqual(['amount'])
    expect(names({ ...ok, amount: '12.345' })).toEqual(['amount'])
    expect(names({ ...ok, amount: '10001' })).toEqual(['amount'])
    expect(names({ ...ok, notes: 'x'.repeat(501) })).toEqual(['notes'])
  })
})

describe('normalizeAmount والمبلغ بلوحة المفاتيح العربية', () => {
  const ok = { trip_date: '2026-10-05', description: 'زيارة', amount: '20', notes: '' }
  const check = (amount: string, today = '2026-10-20') => validateTrip({ ...ok, amount }, today).map(e => e.name)
  it('الأرقام الهندية والفارسية والفاصلتان والفراغ', () => {
    expect(normalizeAmount('٢٠')).toBe('20')
    expect(normalizeAmount('۱۲۳')).toBe('123')
    expect(normalizeAmount('١٢٫٥')).toBe('12.5')
    expect(normalizeAmount('20,5')).toBe('20.5')
    expect(normalizeAmount(' 20 ')).toBe('20')
  })
  it('٢٠ سليمٌ ويُرسَل 20', () => {
    expect(check('٢٠')).toEqual([])
    expect(Number(normalizeAmount('٢٠'))).toBe(20)
  })
  it('١٢٫٥ سليمٌ ويُرسَل 12.5', () => {
    expect(check('١٢٫٥')).toEqual([])
    expect(Number(normalizeAmount('١٢٫٥'))).toBe(12.5)
  })
  it('20,5 سليمٌ ويُرسَل 20.5', () => {
    expect(check('20,5')).toEqual([])
    expect(Number(normalizeAmount('20,5'))).toBe(20.5)
  })
  it(' 20 سليمٌ', () => {
    expect(check(' 20 ')).toEqual([])
  })
  it('1e3 والفارغ غيرُ سليمين', () => {
    expect(check('1e3')).toEqual(['amount'])
    expect(check('')).toEqual(['amount'])
  })
  it('تاريخٌ يساوي اليوم سليم', () => {
    expect(validateTrip({ ...ok, trip_date: '2026-10-20' }, '2026-10-20')).toEqual([])
  })
})

describe('isolateLtr', () => {
  it('يلفّ النصَّ بعازلَي الاتجاه اللاتينيّ', () => {
    expect(isolateLtr('315 ₪')).toBe('\u2066315 ₪\u2069')
  })
})
