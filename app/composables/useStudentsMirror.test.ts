import { describe, expect, it } from 'vitest'
import { studentsMirrorKey } from '~/utils/studentsMirror'

// المنطقُ النقيّ (الترشيحُ وحضورُ الشهر) في utils/studentsMirror.test.ts؛ وهنا مفتاحُ النسخة في مخزن meta
describe('studentsMirrorKey', () => {
  it('نسخةٌ لكلّ معلّمٍ على الجهاز', () => {
    expect(studentsMirrorKey('u1')).toBe('students|u1')
    expect(studentsMirrorKey('u1')).not.toBe(studentsMirrorKey('u2'))
  })
})
