import { describe, expect, it } from 'vitest'
import { supervisorChoices } from './useAssignSupervisor'

describe('supervisorChoices', () => {
  it('«بلا مشرفة» أولاً ثم المشرفات وحدهنّ', () => {
    const out = supervisorChoices([
      { id: 'a', full_name: 'مها', gender: 'female' },
      { id: 'b', full_name: 'راغد', gender: 'male' }
    ])
    expect(out).toEqual([{ label: 'بلا مشرفة', value: 'none' }, { label: 'مها', value: 'a' }])
  })
})
