#!/usr/bin/env node
/**
 * إدخالُ بنك أسئلة القراءة من ملفّ Excel (.xlsx) أو CSV.
 *
 *   node scripts/reading-bank.mjs <ملف> [--apply] [--replace] [--unit=<رقم>]
 *
 * · بلا --apply: فحصٌ فقط — يطبع أخطاءَ كلّ سطرٍ وعددَ أسئلة كلّ مقرّر، ولا يكتب شيئاً.
 * · --apply: يُدخل الأسئلة إن صحّ الملفّ كلّه. يرفض مقرّراً له أسئلةٌ قائمة إلا مع --replace،
 *   وعندها تُعطَّل القديمةُ (active=false) لا تُحذف — فتبقى درجاتُ المحاولات السابقة صحيحة.
 *
 * · --unit=<رقم>: يُدخل الأسئلةَ كلَّها في هذا المقرّر متجاهلاً عمودَ «رقم المقرّر» — للملفّ المرقَّم داخل كتابه
 *   (مثل بنك «البناء العقدي» المرقَّم 1 وهو المقرّر 4 في المنصّة).
 *
 * الأعمدة: المقرّر، السؤال، أ، ب، ج، د، الإجابة (المنطقُ والفحصُ في server/utils/readingBank.ts).
 * يقرأ SUPABASE_URL وNUXT_SUPABASE_SECRET_KEY من .env (مفتاحُ الخدمة لا يُطبع).
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve, extname } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// jiti تبعيّةٌ لـ nuxt لا لمشروعنا (pnpm لا يرفعها) — تُحلّ من موضع nuxt
const require = createRequire(import.meta.url)
const fromNuxt = createRequire(require.resolve('nuxt/package.json'))
const { createJiti } = await import(pathToFileURL(fromNuxt.resolve('jiti')).href)
const jiti = createJiti(import.meta.url, { alias: { '~': resolve(root, 'app'), '~~': root } })
const { parseTable } = await jiti.import('../server/utils/bulkAccounts.ts')
const { bankRecords, planBank } = await jiti.import('../server/utils/readingBank.ts')

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--'))
const apply = args.includes('--apply')
const replace = args.includes('--replace')
const unitArg = args.find(a => a.startsWith('--unit='))
const forcedUnit = unitArg ? Number(unitArg.slice('--unit='.length)) : null
if (unitArg && !(Number.isInteger(forcedUnit) && forcedUnit > 0)) {
  console.error('--unit يحتاج رقمَ مقرّرٍ صحيحاً، مثل --unit=4')
  process.exit(1)
}
if (!file) {
  console.error('الاستعمال: node scripts/reading-bank.mjs <ملف.xlsx|csv> [--apply] [--replace]')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const supabase = createClient(env.SUPABASE_URL, env.NUXT_SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

/** الملفّ ← جدولُ نصوص (الورقةُ الأولى في Excel). */
async function readTable(path) {
  if (extname(path).toLowerCase() === '.xlsx') {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(path)
    const ws = wb.worksheets[0]
    const table = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells = []
      for (let c = 1; c <= ws.columnCount; c++) cells.push(String(row.getCell(c).text ?? '').trim())
      table.push(cells)
    })
    return table
  }
  return parseTable(readFileSync(path, 'utf8'))
}

const { data: units, error: unitsError } = await supabase.from('reading_units').select('id, sort_order, title').order('sort_order')
if (unitsError) {
  console.error('تعذّر جلب المقرّرات:', unitsError.message)
  process.exit(1)
}

const records = bankRecords(await readTable(resolve(file)))
const plan = planBank(forcedUnit ? records.map(r => ({ ...r, record: { ...r.record, unit: String(forcedUnit) } })) : records, units.map(u => u.sort_order))

console.log(`\nالأسطر الصحيحة: ${plan.rows.length} · الأخطاء: ${plan.errors.length}`)
for (const [order, count] of [...plan.perUnit].sort((a, b) => a[0] - b[0])) {
  const note = count < 20 ? ' ⚠️ أقلّ من 20 — لا يُختبر به' : count !== 100 ? ' (المطلوب 100)' : ''
  console.log(`  المقرّر ${order}: ${count} سؤالاً${note}`)
}
if (plan.errors.length) {
  console.log('\nالأخطاء:')
  for (const e of plan.errors) console.log(`  السطر ${e.line}: ${e.message}`)
  console.log('\nلم يُكتب شيء — صحّح الملفّ وأعد الفحص.')
  process.exit(2)
}
if (!apply) {
  console.log('\nفحصٌ فقط — أضف --apply للإدخال.')
  process.exit(0)
}

const unitId = new Map(units.map(u => [u.sort_order, u.id]))
for (const order of plan.perUnit.keys()) {
  const id = unitId.get(order)
  const { count, error } = await supabase.from('reading_questions').select('id', { count: 'exact', head: true }).eq('unit_id', id).eq('active', true)
  if (error) {
    console.error('تعذّر فحص الأسئلة القائمة:', error.message)
    process.exit(1)
  }
  if (count && !replace) {
    console.error(`المقرّر ${order} له ${count} سؤالاً قائماً — أضف --replace لتعطيلها وإدخال الجديدة.`)
    process.exit(3)
  }
  if (count && replace) {
    const { error: offError } = await supabase.from('reading_questions').update({ active: false }).eq('unit_id', id).eq('active', true)
    if (offError) {
      console.error('تعذّر تعطيل القديمة:', offError.message)
      process.exit(1)
    }
    console.log(`  عُطّلت ${count} من أسئلة المقرّر ${order} القديمة.`)
  }
}

const CHUNK = 200
const payload = plan.rows.map(q => ({ unit_id: unitId.get(q.unitOrder), body: q.body, options: q.options, correct: q.correct }))
for (let i = 0; i < payload.length; i += CHUNK) {
  const { error } = await supabase.from('reading_questions').insert(payload.slice(i, i + CHUNK))
  if (error) {
    console.error(`فشل الإدخال بعد ${i} سؤالاً:`, error.message)
    process.exit(1)
  }
}
console.log(`\nأُدخل ${payload.length} سؤالاً.`)
