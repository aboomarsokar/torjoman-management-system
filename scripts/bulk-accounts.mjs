#!/usr/bin/env node
/**
 * إدخالٌ جماعيّ للموظفين أو الطلاب من جدول (CSV أو نصٌّ ملصوقٌ من Excel مفصولٌ بالجدولة).
 *
 *   node scripts/bulk-accounts.mjs staff    موظفون.csv            ← فحصٌ فقط (لا يكتب شيئاً)
 *   node scripts/bulk-accounts.mjs students طلاب.csv --apply      ← يُنشئ الحسابات
 *
 * الأعمدة (عناوين عربية أو إنجليزية، أيُّ ترتيب):
 *   الموظفون: الاسم، الدور (معلم/معلمة/مشرف ميداني/مختبر…)، الجنس (ذكر/أنثى)، الهاتف (اختياري)
 *   الطلاب:   الاسم، الجنس، رقم الهوية، الحلقة (اسمها كما في المنصّة — اختياري)، تاريخ الميلاد، هاتف وليّ الأمر
 *
 * يتّبع خطوات مسارَي الخادم نفسها (server/api/users.post.ts و students.post.ts) بعميل الخدمة: حسابُ Auth ببريدٍ داخليّ
 * مؤكَّد، وكلمةٌ مؤقّتة يولّدها `generateTempPassword`، و`must_change_password`، والتراجعُ إن فشلت خطوة.
 * `assigned_by`/`created_by` = المدير الإداري صاحب الرقم 1001.
 * ⚠️ الكلماتُ المؤقّتة لا تُطبع: تُكتب في ملفٍّ `*.local` (مستثنى من git، صلاحيته 600) ليوزّعها المدير ثم يحذفه.
 * ⚠️ لا يُشغَّل والمنصّة في بيانات تجريبية ستُحذف — أدخِل البيانات الحقيقية بعد حذفها.
 */
import { readFileSync, writeFileSync, chmodSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, basename } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// jiti تبعيّةٌ لـ nuxt لا لمشروعنا (pnpm لا يرفعها) — تُحلّ من موضع nuxt
const require = createRequire(import.meta.url)
const fromNuxt = createRequire(require.resolve('nuxt/package.json'))
const { createJiti } = await import(pathToFileURL(fromNuxt.resolve('jiti')).href)
const jiti = createJiti(import.meta.url, { alias: { '~': resolve(root, 'app'), '~~': root } })
const { parseTable, tableToRecords, planStaff, planStudents } = await jiti.import('../server/utils/bulkAccounts.ts')
const { generateTempPassword } = await jiti.import('../server/utils/tempPassword.ts')
const { staffEmailFromNumber, studentEmailFromIdentity } = await jiti.import('../app/constants/accounts.ts')
const { roleLabel } = await jiti.import('../app/constants/roles.ts')

const [kind, file, flag] = process.argv.slice(2)
if (!['staff', 'students'].includes(kind) || !file) {
  console.error('الاستعمال: node scripts/bulk-accounts.mjs staff|students <ملف> [--apply]')
  process.exit(1)
}
const apply = flag === '--apply'

// المتغيّرات من .env (بلا مكتبة)
const env = Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8').split('\n')
  .map(l => l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]))
const url = env.SUPABASE_URL
const serviceKey = env.NUXT_SUPABASE_SECRET_KEY
if (!url || !serviceKey) {
  console.error('ينقص SUPABASE_URL أو NUXT_SUPABASE_SECRET_KEY في .env')
  process.exit(1)
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const records = tableToRecords(parseTable(readFileSync(resolve(file), 'utf8')))
if (!records.length) {
  console.error('الملفّ فارغ أو بلا سطر عناوين.')
  process.exit(1)
}

const { data: owner } = await admin.from('profiles').select('id').eq('employee_number', '1001').maybeSingle()
if (!owner) {
  console.error('لم يُعثر على المدير الإداري 1001.')
  process.exit(1)
}

let plan
if (kind === 'staff') {
  plan = planStaff(records)
} else {
  const { data: halaqat, error: hErr } = await admin.from('halaqat').select('id, name, gender')
  const { data: existing, error: sErr } = await admin.from('students').select('national_id').not('national_id', 'is', null)
  if (hErr || sErr) {
    console.error('تعذّرت قراءة الحلقات أو الطلاب:', (hErr ?? sErr).message)
    process.exit(1)
  }
  plan = planStudents(records, halaqat ?? [], new Set((existing ?? []).map(s => s.national_id)))
}

console.log(`\n${kind === 'staff' ? 'الموظفون' : 'الطلاب'} — الأسطر: ${records.length} · الصالحة: ${plan.rows.length} · الأخطاء: ${plan.errors.length}`)
for (const e of plan.errors) console.log(`  ✗ السطر ${e.line}: ${e.message}`)
if (plan.errors.length) {
  console.log('\nصحّح الأخطاء في الملفّ ثم أعد الفحص. لم يُكتب شيء.')
  process.exit(2)
}
if (!apply) {
  console.log('\nالفحصُ سليم. لم يُكتب شيء — أعد الأمر مع --apply لإنشاء الحسابات.')
  process.exit(0)
}

const outFile = resolve(root, `bulk-credentials-${kind}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.local`)
if (existsSync(outFile)) {
  console.error('ملفّ الكلمات موجودٌ سلفاً — انتظر ثانيةً وأعد.')
  process.exit(1)
}
const out = [kind === 'staff' ? 'السطر,الاسم,المسمّى,الرقم الوظيفي,الكلمة المؤقّتة' : 'السطر,الاسم,رقم الهوية,الكلمة المؤقّتة']
const failures = []

async function createStaff(r) {
  const password = generateTempPassword()
  const { data: employeeNumber, error: seqErr } = await admin.rpc('claim_employee_number')
  if (seqErr || !employeeNumber) throw new Error('تعذّر توليد الرقم الوظيفي')
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: staffEmailFromNumber(employeeNumber), password, email_confirm: true, user_metadata: { full_name: r.fullName }
  })
  if (authErr || !created.user) throw new Error(authErr?.message ?? 'تعذّر إنشاء الحساب')
  const { error: profErr } = await admin.from('profiles').insert({
    id: created.user.id, full_name: r.fullName, role: r.role, gender: r.gender, employee_number: employeeNumber,
    phone: r.phone, status: 'active', must_change_password: true, assigned_by: owner.id
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    throw new Error(profErr.code === '23505' ? 'يوجد شاغلٌ نشطٌ لهذا الدور' : profErr.message)
  }
  return [r.line, r.fullName, roleLabel(r.role, r.gender), employeeNumber, password]
}

async function createStudent(r) {
  const password = generateTempPassword()
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email: studentEmailFromIdentity(r.nationalId), password, email_confirm: true, user_metadata: { full_name: r.fullName }
  })
  if (authErr || !created.user) throw new Error(authErr?.message ?? 'تعذّر إنشاء الحساب')
  const uid = created.user.id
  const { error: profErr } = await admin.from('profiles').insert({
    id: uid, full_name: r.fullName, role: 'student', gender: r.gender, status: 'active', must_change_password: true, assigned_by: owner.id
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(uid)
    throw new Error(profErr.message)
  }
  const { error: stuErr } = await admin.from('students').insert({
    full_name: r.fullName, gender: r.gender, national_id: r.nationalId, user_id: uid, halaqa_id: r.halaqaId,
    birth_date: r.birthDate, guardian_phone: r.guardianPhone, created_by: owner.id, status: 'active'
  })
  if (stuErr) {
    await admin.from('profiles').delete().eq('id', uid)
    await admin.auth.admin.deleteUser(uid)
    throw new Error(stuErr.message)
  }
  return [r.line, r.fullName, r.nationalId, password]
}

for (const r of plan.rows) {
  try {
    out.push((await (kind === 'staff' ? createStaff(r) : createStudent(r))).join(','))
    process.stdout.write('.')
  } catch (err) {
    failures.push({ line: r.line, message: err.message })
    process.stdout.write('✗')
  }
}

writeFileSync(outFile, '\uFEFF' + out.join('\n') + '\n', { mode: 0o600 })
chmodSync(outFile, 0o600)
console.log(`\n\nأُنشئ ${out.length - 1} حساباً من ${plan.rows.length}. الكلماتُ المؤقّتة في: ${basename(outFile)} (يُفتح في Excel)`)
for (const f of failures) console.log(`  ✗ السطر ${f.line}: ${f.message}`)
console.log('وزّع الكلمات ثم احذف الملفّ. كلٌّ يغيّر كلمته عند أوّل دخول.')
