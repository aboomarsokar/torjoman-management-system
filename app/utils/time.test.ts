import { describe, expect, it } from 'vitest'
import { formatHalaqaTime, formatTime12, gazaClock12 } from './time'

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

describe('موعدُ الحلقة من … إلى …', () => {
  it('ساعتان بعد البدء', () => {
    expect(formatHalaqaTime('17:00:00')).toBe('5:00 م – 7:00 م')
    expect(formatHalaqaTime('11:30')).toBe('11:30 ص – 1:30 م')
  })

  it('يعبر منتصفَ الليل', () => {
    expect(formatHalaqaTime('23:00', 120)).toBe('11:00 م – 1:00 ص')
  })

  it('الفارغُ ← نصٌّ فارغ', () => {
    expect(formatHalaqaTime(null)).toBe('')
    expect(formatHalaqaTime('25:00')).toBe('')
  })
})

describe('gazaClock12', () => {
  it('وقتُ اللحظة في غزة بنظام 12 ساعة', () => {
    expect(gazaClock12('2026-10-28T12:06:00Z')).toBe('2:06 م')
    expect(gazaClock12('2026-10-28T07:05:00Z')).toBe('9:05 ص')
    expect(gazaClock12(new Date('2026-10-28T10:00:00Z'))).toBe('12:00 م')
  })
})
