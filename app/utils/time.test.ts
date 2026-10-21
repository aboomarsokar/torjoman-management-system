import { describe, expect, it } from 'vitest'
import { formatTime12 } from './time'

describe('الوقت بصيغة 12 ساعة', () => {
  it('العصرُ والصباح', () => {
    expect(formatTime12('16:00:00')).toBe('4:00 م')
    expect(formatTime12('07:30')).toBe('7:30 ص')
  })

  it('الظهرُ ومنتصفُ الليل 12', () => {
    expect(formatTime12('12:15')).toBe('12:15 م')
    expect(formatTime12('00:05:00')).toBe('12:05 ص')
  })

  it('الفارغُ وغيرُ المفهوم ← نصٌّ فارغ', () => {
    expect(formatTime12(null)).toBe('')
    expect(formatTime12('')).toBe('')
    expect(formatTime12('25:00')).toBe('')
  })
})
