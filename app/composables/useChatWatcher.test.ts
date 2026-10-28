import { describe, expect, it } from 'vitest'
import { openConversationOf } from './useChatWatcher'

describe('openConversationOf', () => {
  it('المحادثةُ المفتوحة من صفحة المحادثات وحدها', () => {
    expect(openConversationOf('/chat', { c: 'x' })).toBe('x')
    expect(openConversationOf('/chat', {})).toBeNull()
    expect(openConversationOf('/dashboard', { c: 'x' })).toBeNull()
  })
})
