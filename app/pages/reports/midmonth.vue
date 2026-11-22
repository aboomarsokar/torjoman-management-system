<script setup lang="ts">
/**
 * «رصد منتصف الشهر» (طلب المستخدم 2026-11-21): صورةُ ما رصده المعلمون حتى منتصف الشهر لاتّخاذ القرار قبل نهايته —
 * الحلقاتُ غيرُ المسلِّمة، ثم المسلِّمةُ بالأضعف متوسّطاً مع المتأخّرين (أقلُّ من نصف هدف الشهر) ومن لم يحفظ ومن لم يُرصد.
 * للمدير الإداري والفنيّ والمديرة والمشرف الميدانيّ (كلٌّ بنطاقه — RLS) ومشرفِ المشروع قراءةً. المنطقُ في `useMidmonthFollowup`.
 */
import { midThreshold } from '~/utils/quran/midmonth'
import { periodFromQuery } from '~/utils/quran/screen'
import { gazaToday } from '~/utils/reportWindow'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'رصد منتصف الشهر — ترجمان' })

const { role, isAdmin, isTechnical, isReadOnly, isWomenAdmin, isFieldSupervisor } = usePermissions()
const canView = computed(() => isAdmin.value || isTechnical.value || isReadOnly.value || isWomenAdmin.value || isFieldSupervisor.value)

const today = gazaToday()
const max = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
const route = useRoute()
const linked = periodFromQuery(route.query.y, route.query.m, today)
const year = ref(linked?.year ?? max.year)
const month = ref(linked?.month ?? max.month)
const { data, pending } = useMidmonthFollowup(year, month)

const gender = ref<'all' | 'male' | 'female'>('all')
const genderItems = [{ label: 'البنين والبنات', value: 'all' }, { label: 'البنين', value: 'male' }, { label: 'البنات', value: 'female' }]
const showGender = computed(() => isAdmin.value || isReadOnly.value)
const inGender = (id: string) => gender.value === 'all' || data.value?.genders.get(id) === gender.value
const submitted = computed(() => (data.value?.submitted ?? []).filter(r => inGender(r.id)))
const missing = computed(() => (data.value?.missing ?? []).filter(h => inGender(h.id)))
const threshold = computed(() => midThreshold(data.value?.monthTarget ?? 0))
const lateCount = computed(() => submitted.value.reduce((t, r) => t + r.late.length + r.none.length, 0))
</script>

<template>
  <div class="mm">
    <UiPageHeader
      title="رصد منتصف الشهر"
      :subtitle="`ما رصده المعلمون حتى منتصف الشهر — المتأخّرُ من حفظ أقلَّ من نصف هدف الشهر (${threshold} صفحة)، ومن اختُبر قبل التسليم يُطرح من حدّه تخفيضُ الاختبار كاملاً.`"
    />
    <UiEmptyState
      v-if="role && !canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للإدارة والمشرفين."
    />
    <ClientOnly v-else-if="canView">
      <div class="mm-bar">
        <QuranMonthPicker
          v-model:year="year"
          v-model:month="month"
          :max="max"
        />
        <USelect
          v-if="showGender"
          v-model="gender"
          :items="genderItems"
          class="w-44"
          aria-label="القسم"
        />
      </div>
      <UiSkeletonCard v-if="pending && !data" />
      <template v-else-if="data">
        <div class="mm-stats">
          <div class="stat">
            <b class="num">{{ submitted.length }} / {{ submitted.length + missing.length }}</b><span>حلقة سلّمت</span>
          </div>
          <div class="stat">
            <b class="num">{{ lateCount }}</b><span>طالباً متأخّراً أو لم يحفظ</span>
          </div>
        </div>
        <section
          v-if="missing.length"
          class="card"
        >
          <h2 class="sec">
            لم تسلّم بعد ({{ missing.length }})
          </h2>
          <ul class="miss">
            <li
              v-for="h in missing"
              :key="h.id"
            >
              <b>{{ h.name }}</b><small>{{ h.teacher ?? '—' }}</small>
            </li>
          </ul>
        </section>
        <section class="card">
          <h2 class="sec">
            الحلقاتُ المسلِّمة — الأضعفُ أوّلاً
          </h2>
          <UiEmptyState
            v-if="!submitted.length"
            icon="i-lucide-flag"
            title="لم تسلّم أيُّ حلقةٍ رصدَ المنتصف لهذا الشهر بعد"
          />
          <QuranMidmonthList
            v-else
            :rows="submitted"
            :threshold="threshold"
          />
        </section>
      </template>
    </ClientOnly>
  </div>
</template>

<style scoped>
.mm { display: flex; flex-direction: column; gap: 16px; }
.mm-bar { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.mm-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 14px 16px; display: flex; flex-direction: column; gap: 2px; }
.stat b { font-size: 22px; color: var(--ink); }
.stat span { font-size: 13.5px; color: var(--ink-2); }
.num { font-variant-numeric: tabular-nums; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 8px 20px 12px; }
.sec { margin: 12px 0 6px; font-size: 16px; font-weight: 700; color: var(--ink); }
.miss { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
.miss li { display: flex; flex-direction: column; padding: 8px 12px; border-radius: 12px; background: var(--err-soft); }
.miss b { font-size: 14px; color: var(--ink); }
.miss small { font-size: 12.5px; color: var(--ink-2); }
@media (max-width: 560px) {
  .card { padding: 6px 16px 10px; }
}
</style>
