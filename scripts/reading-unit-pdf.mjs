#!/usr/bin/env node
/**
 * رفعُ ملفّ PDF لمقرّرٍ من البرامج المصاحبة (بديلٌ من سطر الأوامر لصفحة المدير).
 *
 *   node scripts/reading-unit-pdf.mjs <رقم المقرّر> <ملف.pdf>
 *
 * يرفع إلى المستودع الخاصّ `reading-books` باسم `units/<id>.pdf` (استبدالاً إن وُجد) ويثبّت `pdf_path`.
 * يقرأ SUPABASE_URL وNUXT_SUPABASE_SECRET_KEY من .env (مفتاحُ الخدمة لا يُطبع).
 */
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [order, file] = process.argv.slice(2)
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

const path = `units/${unit.id}.pdf`
const { error: upError } = await supabase.storage.from('reading-books').upload(path, bytes, { contentType: 'application/pdf', upsert: true })
if (upError) {
  console.error('فشل الرفع:', upError.message)
  process.exit(1)
}
const { error: setError } = await supabase.from('reading_units').update({ pdf_path: path }).eq('id', unit.id)
if (setError) {
  console.error('رُفع الملفّ وتعذّر تثبيت مساره:', setError.message)
  process.exit(1)
}
console.log(`رُفع ملفّ ${unit.title} (${(statSync(resolve(file)).size / 1048576).toFixed(1)} م.ب) ← ${path}`)
