/**
 * أنواعُ الإشعارات في الواجهة تطابق قيدَ `kind` في الهجرة — نوعٌ يُضاف هناك ولا يُسمّى هنا
 * يظهر بلا أيقونة.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_ICONS, NOTIFICATION_KINDS, notificationIcon } from './notifications'

/** يلتقط قائمةَ الأنواع من قيد الجدول: التعريفُ الأوّل `kind text not null check (kind in (…))` أو إعادةُ القيد `notifications_kind_check … check (kind in (…))`. */
const KIND_CHECK = /(?:kind\s+text not null check|notifications_kind_check\s+check)\s*\(kind in \(([\s\S]*?)\)\)/

/** القائمةُ من أحدث هجرةٍ (بترتيب اسم الملف) تعيد تعريف القيد — فهجرةٌ تُوسّعه لاحقاً تُلتقط. */
function migrationKinds(): string[] {
  const dir = join(process.cwd(), 'supabase/migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  let block: string | undefined
  for (const f of files) {
    const hit = readFileSync(join(dir, f), 'utf8').match(KIND_CHECK)
    if (hit?.[1]) block = hit[1]
  }
  if (!block) throw new Error('قيد kind غير موجود في أيّ هجرة')
  return [...block.matchAll(/'([a-z_]+)'/g)].map(m => m[1]!)
}

describe('NOTIFICATION_KINDS', () => {
  it('تطابق قيدَ kind في الهجرة حرفاً وترتيباً', () => {
    expect([...NOTIFICATION_KINDS]).toEqual(migrationKinds())
  })

  it('لكلّ نوعٍ أيقونة', () => {
    for (const k of NOTIFICATION_KINDS) expect(NOTIFICATION_ICONS[k]).toMatch(/^i-lucide-/)
  })

  it('النوعُ المجهول يأخذ أيقونة الجرس', () => {
    expect(notificationIcon('unknown_kind')).toBe('i-lucide-bell')
    expect(notificationIcon('alert_issued')).toBe(NOTIFICATION_ICONS.alert_issued)
  })
})
