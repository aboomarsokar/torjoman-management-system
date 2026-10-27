import { describe, expect, it } from 'vitest'
import { rewriteAudience, sameDraft } from './useAiRewrite'

describe('rewriteAudience', () => {
  it('القسمُ أوّلاً ثمّ جنسُ المستلم', () => {
    expect(rewriteAudience('female')).toBe('female')
    expect(rewriteAudience('male', 'female')).toBe('male')
    expect(rewriteAudience(undefined, 'female')).toBe('female')
  })
  it('القسمان أو المجهول مختلط', () => {
    expect(rewriteAudience('all')).toBe('mixed')
    expect(rewriteAudience(null, null)).toBe('mixed')
  })
})

describe('sameDraft', () => {
  it('التراجعُ متاحٌ ما لم يُعدَّل النصّ', () => {
    expect(sameDraft({ title: 'أ', body: 'ب' }, { title: 'أ', body: 'ب' })).toBe(true)
    expect(sameDraft({ title: 'أ', body: 'ب' }, { title: 'أ', body: 'بـ' })).toBe(false)
    expect(sameDraft(null, { title: '', body: '' })).toBe(false)
  })
})
