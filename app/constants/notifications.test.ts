/**
 * أنواعُ الإشعارات في الواجهة تطابق قيدَ `kind` في الهجرة — نوعٌ يُضاف هناك ولا يُسمّى هنا
 * يظهر بلا أيقونة.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_ICONS, NOTIFICATION_KINDS, notificationIcon } from './notifications'

function migrationKinds(): string[] {
  const dir = join(process.cwd(), 'supabase/migrations')
  const file = readdirSync(dir).find(f => f.endsWith('_notifications.sql'))
  if (!file) throw new Error('هجرة الإشعارات غير موجودة')
  const sql = readFileSync(join(dir, file), 'utf8')
  const block = sql.match(/kind\s+text not null check \(kind in \(([\s\S]*?)\)\)/)
  if (!block?.[1]) throw new Error('قيد kind غير موجود')
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map(m => m[1]!)
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
