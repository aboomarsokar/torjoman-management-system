import { describe, expect, it } from 'vitest'
import { missingKeys, parsePrecacheEntries, precacheCacheKey, updatePercent } from './appUpdate'

const SW = 'define(["./workbox-e2df0ce0"],(function(e){e.precacheAndRoute([{url:"og-image.png",revision:"376e58"},{url:"/",revision:"fd9281"},{url:"_nuxt/zMBei75F.js",revision:null}],{})}));'
const BASE = 'https://torjoman.vercel.app/sw.js'

describe('appUpdate', () => {
  it('يقرأ قائمةَ ملفّات النسخة من sw.js', () => {
    expect(parsePrecacheEntries(SW)).toEqual([
      { url: 'og-image.png', revision: '376e58' },
      { url: '/', revision: 'fd9281' },
      { url: '_nuxt/zMBei75F.js', revision: null }
    ])
  })

  it('مفتاحُ الخبيئة كمفتاح workbox: برقم المراجعة إن وُجد', () => {
    expect(precacheCacheKey({ url: '/', revision: 'fd9281' }, BASE)).toBe('https://torjoman.vercel.app/?__WB_REVISION__=fd9281')
    expect(precacheCacheKey({ url: '_nuxt/a.js', revision: null }, BASE)).toBe('https://torjoman.vercel.app/_nuxt/a.js')
  })

  it('ما يُنزَّل = ما ليس على الجهاز وحده', () => {
    const cached = new Set(['https://torjoman.vercel.app/og-image.png?__WB_REVISION__=376e58'])
    expect(missingKeys(parsePrecacheEntries(SW), BASE, cached)).toEqual([
      'https://torjoman.vercel.app/?__WB_REVISION__=fd9281',
      'https://torjoman.vercel.app/_nuxt/zMBei75F.js'
    ])
  })

  it('النسبةُ لا تبلغ 100 قبل الاكتمال', () => {
    expect(updatePercent(0, 40)).toBe(0)
    expect(updatePercent(39, 40)).toBe(97)
    expect(updatePercent(40, 40)).toBe(100)
    expect(updatePercent(0, 0)).toBe(100)
  })
})
