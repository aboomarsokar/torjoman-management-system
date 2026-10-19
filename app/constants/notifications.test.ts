/**
 * أنواعُ الإشعارات في الواجهة تطابق قيدَ `kind` في الهجرة — نوعٌ يُضاف هناك ولا يُسمّى هنا
 * يظهر بلا أيقونة.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOTIFICATION_ICONS, NOTIFICATION_KINDS, notificationIcon } from './notifications'

/** قيدُ الأنواع داخل جملةٍ واحدة: `check (kind in (…))`. */
const KIND_IN = /check\s*\(\s*kind in \(([\s\S]*?)\)\s*\)/

/** تعريفُ جدول الإشعارات: من `create table public.notifications (` إلى أوّل `);` في بداية سطر. */
const CREATE_NOTIFICATIONS = /create table public\.notifications\s*\(([\s\S]*?)\n\)\s*;/g

/** إعادةُ القيد: `notifications_kind_check` متبوعاً بـ`check (kind in (…))`. */
const KIND_CHECK_REDEFINED = /notifications_kind_check\s+(check\s*\(\s*kind in \([\s\S]*?\)\s*\))/g

export interface MigrationText { name: string, text: string }

/**
 * قائمةُ أنواع الإشعارات من أحدث هجرةٍ (بترتيب اسم الملف) تعرّف قيدَ جدول الإشعارات وحده:
 * إمّا داخل `create table public.notifications` أو بـ`notifications_kind_check`.
 * قيودُ `kind in (…)` في جداولَ أخرى تُتجاهل.
 */
export function extractNotificationKinds(migrations: MigrationText[]): string[] {
  let block: string | undefined
  for (const m of [...migrations].sort((x, y) => x.name.localeCompare(y.name))) {
    for (const t of m.text.matchAll(CREATE_NOTIFICATIONS)) {
      const hit = t[1]!.match(KIND_IN)
      if (hit?.[1]) block = hit[1]
    }
    for (const c of m.text.matchAll(KIND_CHECK_REDEFINED)) {
      const hit = c[1]!.match(KIND_IN)
      if (hit?.[1]) block = hit[1]
    }
  }
  if (!block) throw new Error('قيد kind الخاصّ بجدول الإشعارات غير موجود في أيّ هجرة')
  return [...block.matchAll(/'([a-z_]+)'/g)].map(m => m[1]!)
}

function migrationKinds(): string[] {
  const dir = join(process.cwd(), 'supabase/migrations')
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  return extractNotificationKinds(files.map(name => ({ name, text: readFileSync(join(dir, name), 'utf8') })))
}

describe('extractNotificationKinds', () => {
  const create = (kinds: string) => `create table public.notifications (\n  id uuid,\n  kind text not null check (kind in (${kinds})),\n  body text\n);`

  it('يتجاهل قيدَ kind في جدولٍ آخر حتى لو جاء أحدث', () => {
    const out = extractNotificationKinds([
      { name: '001_n.sql', text: create('\'a_one\', \'b_two\'') },
      { name: '002_other.sql', text: 'create table public.attendance_absences (\n  kind text not null check (kind in (\'excused\', \'unexcused\')),\n  day date\n);' }
    ])
    expect(out).toEqual(['a_one', 'b_two'])
  })

  it('يأخذ أحدثَ إعادةٍ لقيد notifications_kind_check', () => {
    const out = extractNotificationKinds([
      { name: '001_n.sql', text: create('\'a_one\'') },
      { name: '003_widen.sql', text: 'alter table public.notifications drop constraint notifications_kind_check,\n  add constraint notifications_kind_check check (kind in (\'a_one\', \'c_three\'));' },
      { name: '002_decoy.sql', text: 'alter table public.x add constraint x_kind_check check (kind in (\'z\', \'y\'));' }
    ])
    expect(out).toEqual(['a_one', 'c_three'])
  })

  it('يرفع خطأً إن لم يوجد قيدُ الإشعارات', () => {
    expect(() => extractNotificationKinds([{ name: '001.sql', text: 'create table public.t (kind text check (kind in (\'a\')));' }])).toThrow()
  })
})

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
