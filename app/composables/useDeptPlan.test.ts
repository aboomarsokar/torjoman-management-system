import { describe, expect, it } from 'vitest'
import { goalTitleError, taskDraftError, type TaskDraft } from './useDeptPlan'

const draft = (o: Partial<TaskDraft> = {}): TaskDraft => ({ goalId: 'g', title: 'نشاط', dueOn: '2026-11-05', owners: ['u1'], ...o })

describe('نموذج نشاط الخطة', () => {
  it('يقبل نشاطاً كاملاً داخل الشهر', () => {
    expect(taskDraftError(draft(), 2026, 11)).toBeNull()
    expect(taskDraftError(draft({ dueOn: '2026-12-06' }), 2026, 11)).toBeNull()
  })
  it('يرفض النقص', () => {
    expect(taskDraftError(draft({ title: '  ' }), 2026, 11)).toBe('اكتب النشاط.')
    expect(taskDraftError(draft({ dueOn: '' }), 2026, 11)).toBe('اختر الموعد.')
    expect(taskDraftError(draft({ owners: [] }), 2026, 11)).toBe('اختر مسؤولاً واحداً على الأقل.')
  })
  it('يرفض موعداً خارج الشهر', () => {
    expect(taskDraftError(draft({ dueOn: '2026-10-31' }), 2026, 11)).toBe('الموعد يكون داخل شهر الخطة.')
    expect(taskDraftError(draft({ dueOn: '2026-12-07' }), 2026, 11)).toBe('الموعد يكون داخل شهر الخطة.')
  })
  it('عنوان الهدف', () => {
    expect(goalTitleError('')).toBe('اكتب الهدف.')
    expect(goalTitleError('هدف')).toBeNull()
    expect(goalTitleError('x'.repeat(301))).toBe('الهدف لا يتجاوز 300 حرف.')
  })
})
