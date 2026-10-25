import { describe, expect, it } from 'vitest'
import { newestFirst, type MyMessage } from './useMyMessages'

const msg = (id: string, at: string): MyMessage => ({ seen_at: null, message: { id, title: id, body: null, link: null, created_at: at, sender: null } })

describe('newestFirst', () => {
  it('يرتّب الأحدثَ أوّلاً ويُسقط ما لا رسالةَ له', () => {
    const out = newestFirst([msg('a', '2026-10-24T10:00:00Z'), { seen_at: null, message: null }, msg('b', '2026-10-25T09:00:00Z')])
    expect(out.map(m => m.message!.id)).toEqual(['b', 'a'])
  })
})
