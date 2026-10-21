import { describe, expect, it } from 'vitest'
import { PRINTING_CLASS, createSheetPrinter, type PrintEnv } from './usePrintSheet'

function fakeEnv() {
  const classes = new Set<string>()
  const listeners = new Set<() => void>()
  let printed = 0
  const env: PrintEnv = {
    doc: { title: 'ترجمان', documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } } },
    win: {
      print: () => {
        printed++
      },
      addEventListener: (_e, f) => listeners.add(f),
      removeEventListener: (_e, f) => listeners.delete(f)
    }
  }
  const afterprint = () => [...listeners].forEach(f => f())
  return { env, classes, listeners, afterprint, printed: () => printed }
}

describe('createSheetPrinter', () => {
  it('يطبع بالعنوان المقترح وصنف الإخفاء، ثم يعيدهما بعد الطباعة ويستدعي onDone', () => {
    const f = fakeEnv()
    let done = 0
    createSheetPrinter(f.env).print('سجل — المعلم — 09-2026', () => {
      done++
    })
    expect(f.printed()).toBe(1)
    expect(f.env.doc.title).toBe('سجل — المعلم — 09-2026')
    expect(f.classes.has(PRINTING_CLASS)).toBe(true)
    f.afterprint()
    expect(f.env.doc.title).toBe('ترجمان')
    expect(f.classes.has(PRINTING_CLASS)).toBe(false)
    expect(f.listeners.size).toBe(0)
    expect(done).toBe(1)
  })

  it('مغادرةٌ قبل اكتمال الطباعة تعيد العنوانَ والصنف', () => {
    const f = fakeEnv()
    const p = createSheetPrinter(f.env)
    p.print('x')
    p.dispose()
    expect(f.env.doc.title).toBe('ترجمان')
    expect(f.classes.size).toBe(0)
  })
})
