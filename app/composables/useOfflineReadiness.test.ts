import { afterEach, describe, expect, it, vi } from 'vitest'
import { isOfflineShellCached } from './useOfflineReadiness'

afterEach(() => vi.unstubAllGlobals())

describe('isOfflineShellCached', () => {
  it('بلا خبيئةٍ في البيئة: غيرُ مخزَّن', async () => {
    vi.stubGlobal('caches', undefined)
    expect(await isOfflineShellCached('/t')).toBe(false)
  })

  it('يطابق بلا معامل المراجعة', async () => {
    const match = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('caches', { match })
    expect(await isOfflineShellCached('/t')).toBe(true)
    expect(match).toHaveBeenCalledWith('/t', { ignoreSearch: true })
  })
})
