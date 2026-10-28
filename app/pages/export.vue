<script setup lang="ts">
/**
 * «تصدير البيانات» (طلب المستخدم 2026-10-28) — للمدير الإداريّ وحده: ملفّاتُ Excel عربيةٌ من اليمين لليسار
 * للعاملين والطلاب والحلقات، والحضورِ والإنجازِ القرآنيّ لشهرٍ يُختار، ونتائجِ الاختبارات، وتصديرٌ شاملٌ في ملفٍّ واحد
 * (ورقةٌ لكلّ جدول) يصلح نسخةً احتياطية. رقمُ الهوية كامل (الصفحةُ للمدير الإداريّ).
 */
import type { ExportKind } from '~/composables/useDataExport'
import { gazaToday } from '~/utils/reportWindow'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'تصدير البيانات — ترجمان' })

const { role, isAdmin } = usePermissions()
const { busy, run } = useDataExport()
const [ty, tm] = gazaToday().split('-').map(Number) as [number, number]
const max = { year: ty, month: tm }
const year = ref(ty)
const month = ref(tm)

interface Item { kind: ExportKind, title: string, desc: string, icon: string, monthly?: boolean }
const ITEMS: Item[] = [
  { kind: 'staff', title: 'العاملون', desc: 'الأدوار والجوالات والبيانات الشخصية والحلقات المسندة.', icon: 'i-lucide-id-card' },
  { kind: 'students', title: 'الطلاب', desc: 'الهوية والميلاد والحلقة والمعلّم ووليّ الأمر وهل له حساب.', icon: 'i-lucide-graduation-cap' },
  { kind: 'halaqat', title: 'الحلقات', desc: 'القسم والموعد والمعلّم والمشرف والمختبِر وعدد الطلاب.', icon: 'i-lucide-book-open' },
  { kind: 'attendance', title: 'الحضور', desc: 'طالبٌ × يوم للشهر المختار: ✓ حاضر · غ بلا عذر · ع بعذر · — لم تُفتح الحلقة.', icon: 'i-lucide-calendar-check', monthly: true },
  { kind: 'quran', title: 'الإنجاز القرآني', desc: 'سجلّ كلّ طالبٍ للشهر المختار: من/إلى وصفحات الحفظ والمراجعة وحالة الرصد.', icon: 'i-lucide-book-marked', monthly: true },
  { kind: 'exams', title: 'نتائج الاختبارات', desc: 'كلّ النتائج بالدورة والدرجات والمختبِر.', icon: 'i-lucide-clipboard-check' }
]
</script>

<template>
  <div class="ex">
    <UiPageHeader
      title="تصدير البيانات"
      subtitle="ملفّات Excel عربية جاهزة للطباعة والأرشفة — للمدير الإداري وحده."
    />
    <ClientOnly>
      <UiEmptyState
        v-if="role && !isAdmin"
        icon="i-lucide-lock"
        title="هذه الصفحة للمدير الإداري فقط."
      />
      <template v-else-if="isAdmin">
        <section class="ex-all">
          <div class="ex-all-text">
            <h2>تصدير شامل</h2>
            <p>ملفٌّ واحد فيه ورقةٌ لكلّ جدول: العاملون والطلاب والحلقات والاختبارات، والحضور والإنجاز للشهر المختار — يصلح نسخةً احتياطية.</p>
          </div>
          <div class="ex-month">
            <span>الشهر</span>
            <QuranMonthPicker
              v-model:year="year"
              v-model:month="month"
              :max="max"
              :disabled="!!busy"
            />
          </div>
          <UButton
            label="تصدير شامل"
            icon="i-lucide-download"
            color="primary"
            size="lg"
            :loading="busy === 'all'"
            :disabled="!!busy && busy !== 'all'"
            :ui="{ base: 'rounded-[12px] min-h-11 font-semibold' }"
            @click="run('all', year, month)"
          />
        </section>
        <ul class="ex-grid">
          <li
            v-for="it in ITEMS"
            :key="it.kind"
          >
            <span class="ex-ic"><UIcon
              :name="it.icon"
              class="size-5"
            /></span>
            <div class="ex-text">
              <h3>{{ it.title }}<small v-if="it.monthly"> · {{ String(month).padStart(2, '0') }}-{{ year }}</small></h3>
              <p>{{ it.desc }}</p>
            </div>
            <UButton
              label="تصدير"
              icon="i-lucide-file-spreadsheet"
              color="neutral"
              variant="outline"
              :loading="busy === it.kind"
              :disabled="!!busy && busy !== it.kind"
              :ui="{ base: 'rounded-[11px] min-h-11' }"
              @click="run(it.kind, year, month)"
            />
          </li>
        </ul>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.ex { display: flex; flex-direction: column; gap: 16px; }
.ex-all { display: flex; align-items: center; gap: 16px 20px; flex-wrap: wrap; padding: 18px 20px; border-radius: 20px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.ex-all-text { flex: 1 1 280px; min-width: 0; }
.ex-all-text h2 { margin: 0 0 4px; font-size: 18px; font-weight: 600; color: var(--navy); }
.ex-all-text p { margin: 0; font-size: 14px; color: var(--ink-2); line-height: 1.7; }
.ex-month { display: flex; align-items: center; gap: 10px; color: var(--ink-2); font-size: 14px; flex-wrap: wrap; }
@media (max-width: 640px) { .ex-month { width: 100%; } .ex-month > :last-child { flex: 1; } }
.ex-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
.ex-grid li { display: flex; align-items: center; gap: 14px; padding: 14px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); }
.ex-ic { flex: none; width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center; background: var(--blue-soft); color: var(--blue-ink); }
.ex-text { flex: 1; min-width: 0; }
.ex-text h3 { margin: 0; font-size: 15px; font-weight: 600; color: var(--ink); }
.ex-text h3 small { font-weight: 500; color: var(--ink-3); font-size: 13px; }
.ex-text p { margin: 2px 0 0; font-size: 13px; color: var(--ink-3); line-height: 1.6; }
</style>
