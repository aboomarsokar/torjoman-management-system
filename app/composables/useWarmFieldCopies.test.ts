import { beforeEach, describe, expect, it, vi } from 'vitest'

// بيئةُ الاختبار بلا Nuxt: الاستيراداتُ التلقائيّة محاكاة، والجهازُ (مخزن `meta`) والتخزينُ المحلّيّ والاتصالُ والدورُ
// محاكَاة — فالمختبَرُ هنا قرارُ التسخين: من، ومتى، وماذا يُحفظ، وبأيّ مفتاح
const supabase = { tag: 'client' }
vi.stubGlobal('useSupabaseClient', () => supabase)
const load = vi.fn(async () => undefined)
vi.stubGlobal('useQuranReference', () => ({ load }))

let online = true
let role: string | null = 'field_supervisor'
let uid: string | null = 'u'
const meta = new Map<string, unknown>()
const local = new Map<string, unknown>()
vi.mock('~/utils/reachability', () => ({ isOnlineNow: () => online }))
vi.mock('~/utils/offlineCache', () => ({
  WARMED_FIELD_CACHE_KEY: 'warmed-field',
  readCache: (key: string) => local.get(key) ?? null,
  writeCache: (key: string, value: unknown) => void local.set(key, value)
}))
vi.mock('~/utils/offlineDb', () => ({
  idbPut: async (_store: string, value: unknown, key: string) => void meta.set(key, value)
}))
vi.mock('~/utils/offlineSnapshot', () => ({
  offlineOwnerRole: () => role,
  offlineOwnerUid: () => uid,
  writeSnapshot: async (u: string, key: string, data: unknown) => void meta.set(`snap|${u}|${key}`, data)
}))
vi.mock('~/composables/useWarmTeacherMirrors', () => ({
  warmDue: (last: { uid: string, at: number } | null, u: string, now: number) => !last || last.uid !== u || now - last.at >= 3_600_000
}))
const impl = {
  visits: vi.fn(async () => ['visit']),
  halqat: vi.fn(async () => ['halqa']),
  items: vi.fn(async () => ['item']),
  queue: vi.fn(async () => ['row']),
  pass: vi.fn(async () => 70)
}
vi.mock('~/utils/teacherScreens', () => ({
  SCREEN_KEYS: { visits: 'visits', visitHalqat: 'visit-halqat' },
  fetchVisits: () => impl.visits(),
  fetchVisitHalqat: () => impl.halqat()
}))
vi.mock('~/utils/fieldScreens', () => ({
  VISIT_ITEMS_KEY: 'items', EXAMS_QUEUE_KEY: 'queue', EXAMS_PASSMARK_KEY: 'pass',
  fetchDeductionItems: () => impl.items(),
  fetchExamQueue: () => impl.queue(),
  fetchPassMark: () => impl.pass()
}))
const { useWarmFieldCopies } = await import('./useWarmFieldCopies')

const snaps = () => [...meta.keys()].filter(k => k.startsWith('snap|u|')).sort()

beforeEach(() => {
  meta.clear()
  local.clear()
  load.mockClear()
  Object.values(impl).forEach(f => f.mockClear())
  online = true
  role = 'field_supervisor'
  uid = 'u'
})

describe('useWarmFieldCopies', () => {
  it('المشرف يحفظ نسخَ الزيارات والحلقات والبنود ويعلّم الجهاز', async () => {
    await useWarmFieldCopies().warm()
    expect(snaps()).toEqual(['snap|u|items', 'snap|u|visit-halqat', 'snap|u|visits'])
    expect(meta.get('snap|u|visits')).toEqual(['visit'])
    expect(meta.get('current')).toBe('u')
    expect(load).not.toHaveBeenCalled()
  })

  it('المختبِر يحفظ الطابور ودرجة النجاح ومرجع المصحف', async () => {
    role = 'examiner'
    await useWarmFieldCopies().warm()
    expect(snaps()).toEqual(['snap|u|pass', 'snap|u|queue'])
    expect(meta.get('snap|u|pass')).toBe(70)
    expect(load).toHaveBeenCalledTimes(1)
    expect(meta.get('current')).toBe('u')
  })

  it('المدير الإداري لا يُحفظ له شيء', async () => {
    role = 'admin_manager'
    await useWarmFieldCopies().warm()
    expect(meta.size).toBe(0)
    expect(local.size).toBe(0)
  })

  it('بلا اتصال أو بلا صاحبٍ للجهاز (النيابة) لا شيء', async () => {
    online = false
    await useWarmFieldCopies().warm()
    online = true
    uid = null
    await useWarmFieldCopies().warm()
    expect(meta.size).toBe(0)
    expect(impl.visits).not.toHaveBeenCalled()
  })

  it('لا يُعاد قبل ساعة', async () => {
    const { warm } = useWarmFieldCopies()
    await warm()
    await warm()
    expect(impl.visits).toHaveBeenCalledTimes(1)
    local.set('warmed-field', { uid: 'u', at: Date.now() - 61 * 60_000 })
    await warm()
    expect(impl.visits).toHaveBeenCalledTimes(2)
  })

  it('فشلُ نسخةٍ لا يوقف ما بعدها ولا يمنع تعليمَ الوقت', async () => {
    impl.visits.mockRejectedValueOnce(new Error('500'))
    await useWarmFieldCopies().warm()
    expect(snaps()).toEqual(['snap|u|items', 'snap|u|visit-halqat'])
    expect(local.get('warmed-field')).toMatchObject({ uid: 'u' })
  })

  it('نداءان متزامنان يجلبان مرّةً واحدة', async () => {
    const { warm } = useWarmFieldCopies()
    await Promise.all([warm(), warm()])
    expect(impl.visits).toHaveBeenCalledTimes(1)
  })
})
