import { describe, expect, it } from 'vitest'
import { chatTitle, mergeMessage, totalUnread, type ChatMessage } from './useChat'

describe('chatTitle', () => {
  it('المجموعةُ باسمها والفرديةُ باسم الطرف الآخر', () => {
    expect(chatTitle({ kind: 'group', title: 'الإدارة', other_name: null as never })).toBe('الإدارة')
    expect(chatTitle({ kind: 'direct', title: null as never, other_name: 'أحمد' })).toBe('أحمد')
    expect(chatTitle({ kind: 'direct', title: null as never, other_name: null as never })).toBe('محادثة')
  })
})

describe('totalUnread', () => {
  it('يجمع العدّادات', () => {
    expect(totalUnread([{ unread: 2 }, { unread: 0 }, { unread: 5 }])).toBe(7)
  })
})

describe('mergeMessage', () => {
  const m = (id: string, at: string) => ({ id, created_at: at, body: id, conversation_id: 'c', sender_id: 's' }) as ChatMessage
  it('لا يكرّر ويحفظ الترتيب', () => {
    const list = [m('a', '2026-10-27T10:00:00Z'), m('c', '2026-10-27T10:02:00Z')]
    expect(mergeMessage(list, m('a', '2026-10-27T10:00:00Z'))).toBe(list)
    expect(mergeMessage(list, m('b', '2026-10-27T10:01:00Z')).map(x => x.id)).toEqual(['a', 'b', 'c'])
  })
  it('يستبدل نسخةً بوقتٍ خاطئ بنسخة الخادم فيعود ترتيبُها', () => {
    const list = [m('mine', '2026-10-26T21:54:00Z'), m('a', '2026-10-28T11:24:00Z')]
    expect(mergeMessage(list, m('mine', '2026-10-28T11:30:00Z')).map(x => x.id)).toEqual(['a', 'mine'])
  })
})
