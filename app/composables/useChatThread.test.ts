import { describe, expect, it } from 'vitest'
import { CHAT_MAX_BODY, CHAT_PAGE_SIZE } from '~/constants/chat'

// منطقُ المحادثة المفتوحة الصرفُ (الدمجُ والقراءة) مختبَرٌ في useChat.test.ts وutils/chat.test.ts؛
// هنا حدودُها التي تطابق القاعدة.
describe('حدودُ المحادثة', () => {
  it('أطولُ رسالةٍ يطابق قيدَ القاعدة، والصفحةُ معقولة', () => {
    expect(CHAT_MAX_BODY).toBe(2000)
    expect(CHAT_PAGE_SIZE).toBeGreaterThanOrEqual(50)
  })
})
