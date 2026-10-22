/**
 * إدخالٌ جماعيّ للموظفين والطلاب من جدولٍ (CSV أو لصقٌ من Excel) — منطقٌ نقيٌّ بلا شبكة، يستعمله
 * `scripts/bulk-accounts.mjs`. يقرأ الجدول بعناوين عربية أو إنجليزية، ويحوّل «ذكر/أنثى» والمسمّيات العربية،
 * ويتحقّق من كلّ سطرٍ بدوالّ الخادم نفسها (`parseStaffInput` / `parseStudentInput`) فلا تختلف القواعد عن الشاشة،
 * ويكشف الهوياتِ المكرّرة في الملفّ وفي القاعدة، والحلقةَ غيرَ الموجودة أو المخالفةَ لجنس الطالب.
 * لا كلمات مرور هنا: يولّدها السكربت بـ`generateTempPassword` عند التنفيذ.
 */
import { parseStaffInput, parseStudentInput, studentHalaqaError, type AccountGender, type StaffInput, type StudentInput } from './accountInput'
import { STAFF_ROLES, roleLabel, type Role } from '~/constants/roles'

export interface LineError { line: number, message: string }
export interface Plan<T> { rows: (T & { line: number })[], errors: LineError[] }

/** يقسم الجدول إلى صفوف: يكشف الفاصل (فاصلة أو جدولة أو فاصلة منقوطة) من سطر العناوين، ويحترم الاقتباس. */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const header = clean.split('\n', 1)[0] ?? ''
  const sep = header.includes('\t') ? '\t' : header.includes(';') && !header.includes(',') ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]!
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') {
        quoted = false
      } else {
        cell += ch
      }
    } else if (ch === '"' && cell === '') {
      quoted = true
    } else if (ch === sep) {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      if (row.some(c => c !== '')) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += ch
    }
  }
  row.push(cell.trim())
  if (row.some(c => c !== '')) rows.push(row)
  return rows
}

/** العناوين المقبولة لكلّ حقل (عربيةٌ أو إنجليزية، بلا حساسيةٍ للمسافات). */
const HEADERS: Record<string, string[]> = {
  full_name: ['full_name', 'الاسم', 'الاسم الكامل', 'اسم الطالب', 'اسم الموظف'],
  gender: ['gender', 'الجنس'],
  role: ['role', 'الدور', 'المسمى', 'المسمّى', 'الوظيفة'],
  phone: ['phone', 'الهاتف', 'الجوال', 'رقم الهاتف', 'رقم الجوال'],
  national_id: ['national_id', 'الهوية', 'رقم الهوية'],
  halaqa: ['halaqa', 'الحلقة', 'اسم الحلقة'],
  birth_date: ['birth_date', 'تاريخ الميلاد', 'الميلاد'],
  guardian_phone: ['guardian_phone', 'هاتف ولي الأمر', 'هاتف وليّ الأمر', 'جوال ولي الأمر'],
  // حقولٌ اختياريّةٌ للطالب يقرؤها سكربت الإدخال الجماعيّ مباشرةً من السجلّ
  tajweed_level: ['tajweed_level', 'دورة الأحكام', 'آخر دورة أحكام'],
  residence: ['residence', 'السكن', 'السكن الحالي'],
  nearest_mosque: ['nearest_mosque', 'أقرب مسجد']
}
const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** صفوف الجدول ← كائناتٌ بمفاتيح الحقول، مع رقم سطرها في الملفّ (السطر 1 للعناوين). */
export function tableToRecords(table: string[][]): { line: number, record: Record<string, string> }[] {
  const [head, ...body] = table
  if (!head) return []
  const keys = head.map((h) => {
    const n = norm(h)
    return Object.entries(HEADERS).find(([, names]) => names.some(x => norm(x) === n))?.[0] ?? null
  })
  return body.map((cells, i) => {
    const record: Record<string, string> = {}
    keys.forEach((k, j) => {
      if (k) record[k] = cells[j] ?? ''
    })
    return { line: i + 2, record }
  })
}

export function genderFrom(value: string): AccountGender | null {
  const v = norm(value)
  if (['ذكر', 'male', 'm', 'بنين', 'ذ'].includes(v)) return 'male'
  if (['أنثى', 'انثى', 'female', 'f', 'بنات', 'أ', 'ا'].includes(v)) return 'female'
  return null
}

/** المسمّى العربي (مذكّراً أو مؤنّثاً) أو مفتاح الدور ← الدور. */
export function roleFrom(value: string): Role | null {
  const v = norm(value).replace(/[ًٌٍَُِّْ]/g, '')
  for (const role of STAFF_ROLES) {
    if (v === role) return role
    for (const g of ['male', 'female'] as const) {
      if (norm(roleLabel(role, g)).replace(/[ًٌٍَُِّْ]/g, '') === v) return role
    }
  }
  return null
}

export function planStaff(records: { line: number, record: Record<string, string> }[]): Plan<StaffInput> {
  const plan: Plan<StaffInput> = { rows: [], errors: [] }
  for (const { line, record } of records) {
    const role = roleFrom(record.role ?? '')
    if (!role) {
      plan.errors.push({ line, message: `الدور «${record.role ?? ''}» غير معروف.` })
      continue
    }
    const parsed = parseStaffInput({ full_name: record.full_name, role, gender: genderFrom(record.gender ?? ''), phone: record.phone })
    if (!parsed.ok) plan.errors.push({ line, message: parsed.message })
    else plan.rows.push({ ...parsed.value, line })
  }
  return plan
}

export interface HalaqaRef { id: string, name: string, gender: AccountGender | null }

/**
 * الطلاب: الحلقةُ بالاسم (تطابقٌ تامّ بعد توحيد المسافات)، والهويةُ لا تتكرّر في الملفّ ولا تكون مسجّلةً في القاعدة.
 * `existingIds`: هوياتُ الطلاب الموجودين.
 */
export function planStudents(
  records: { line: number, record: Record<string, string> }[],
  halaqat: HalaqaRef[],
  existingIds: Set<string>
): Plan<StudentInput> {
  const plan: Plan<StudentInput> = { rows: [], errors: [] }
  const byName = new Map(halaqat.map(h => [norm(h.name), h]))
  const seen = new Map<string, number>()
  for (const { line, record } of records) {
    const gender = genderFrom(record.gender ?? '')
    const halaqaName = (record.halaqa ?? '').trim()
    const halaqa = halaqaName ? byName.get(norm(halaqaName)) ?? null : null
    if (halaqaName && !halaqa) {
      plan.errors.push({ line, message: `الحلقة «${halaqaName}» غير موجودة.` })
      continue
    }
    const parsed = parseStudentInput({
      full_name: record.full_name, gender, national_id: record.national_id, halaqa_id: halaqa?.id,
      birth_date: record.birth_date, guardian_phone: record.guardian_phone
    })
    if (!parsed.ok) {
      plan.errors.push({ line, message: parsed.message })
      continue
    }
    const v = parsed.value
    if (halaqa) {
      const mismatch = studentHalaqaError(v.gender, halaqa)
      if (mismatch) {
        plan.errors.push({ line, message: mismatch })
        continue
      }
    }
    if (existingIds.has(v.nationalId)) {
      plan.errors.push({ line, message: `الهوية ${v.nationalId} مسجّلةٌ لطالبٍ في المنصّة.` })
      continue
    }
    const first = seen.get(v.nationalId)
    if (first) {
      plan.errors.push({ line, message: `الهوية ${v.nationalId} مكرّرةٌ في الملفّ (السطر ${first}).` })
      continue
    }
    seen.set(v.nationalId, line)
    plan.rows.push({ ...v, line })
  }
  return plan
}
