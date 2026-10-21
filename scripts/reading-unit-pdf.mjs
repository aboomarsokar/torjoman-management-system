#!/usr/bin/env node
/**
 * رفعُ ملفّ PDF لمقرّرٍ من البرامج المصاحبة (بديلٌ من سطر الأوامر لصفحة المدير).
 *
 *   node scripts/reading-unit-pdf.mjs <رقم المقرّر> <ملف.pdf> [--cover-only]
 *
 * يرفع إلى المستودع الخاصّ `reading-books` باسم `units/<id>.pdf` (استبدالاً إن وُجد) ويثبّت `pdf_path`،
 * ويستخرج الصفحةَ الأولى غلافاً (`sips` على macOS، JPEG بعرض 600) فيرفعه `covers/<id>.jpg` ويثبّت `cover_path`.
 * `--cover-only`: الغلافُ وحده بلا إعادة رفع الملفّ.
 * يقرأ SUPABASE_URL وNUXT_SUPABASE_SECRET_KEY من .env (مفتاحُ الخدمة لا يُطبع).
 */
import { readFileSync, statSync, mkdtempSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [order, file] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const coverOnly = process.argv.includes('--cover-only')
if (!order || !file) {
  console.error('الاستعمال: node scripts/reading-unit-pdf.mjs <رقم المقرّر> <ملف.pdf>')
  process.exit(1)
}

const env = Object.fromEntries(readFileSync(resolve(root, '.env'), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]))
const supabase = createClient(env.SUPABASE_URL, env.NUXT_SUPABASE_SECRET_KEY, { auth: { persistSession: false } })

const bytes = readFileSync(resolve(file))
if (bytes.subarray(0, 5).toString() !== '%PDF-') {
  console.error('الملفّ ليس PDF.')
  process.exit(1)
}

const { data: unit, error } = await supabase.from('reading_units').select('id, title').eq('sort_order', Number(order)).maybeSingle()
if (error || !unit) {
  console.error(`المقرّر ${order} غير موجود.`)
  process.exit(1)
}

/** يرفع إلى المستودع ويثبّت العمود، أو يخرج برسالة. */
async function put(path, body, contentType, column) {
  const { error: upError } = await supabase.storage.from('reading-books').upload(path, body, { contentType, upsert: true })
  if (upError) {
    console.error('فشل الرفع:', upError.message)
    process.exit(1)
  }
  const { error: setError } = await supabase.from('reading_units').update({ [column]: path }).eq('id', unit.id)
  if (setError) {
    console.error('رُفع الملفّ وتعذّر تثبيت مساره:', setError.message)
    process.exit(1)
  }
}

if (!coverOnly) {
  await put(`units/${unit.id}.pdf`, bytes, 'application/pdf', 'pdf_path')
  console.log(`رُفع ملفّ ${unit.title} (${(statSync(resolve(file)).size / 1048576).toFixed(1)} م.ب) ← units/${unit.id}.pdf`)
}

// الغلاف: الصفحةُ الأولى بـsips (macOS) — JPEG بعرض 600
const dir = mkdtempSync(join(tmpdir(), 'reading-cover-'))
try {
  const out = join(dir, 'cover.jpg')
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80', '--resampleWidth', '600', resolve(file), '--out', out], { stdio: 'ignore' })
  await put(`covers/${unit.id}.jpg`, readFileSync(out), 'image/jpeg', 'cover_path')
  console.log(`رُفع غلاف ${unit.title} ← covers/${unit.id}.jpg`)
} catch (err) {
  console.error('تعذّر استخراج الغلاف (يحتاج macOS):', err.message)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
