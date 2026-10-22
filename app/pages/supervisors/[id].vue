<script setup lang="ts">
/**
 * تفاصيل المشرف (§4.14ب) — للمديرَين الإداري والفني (ومشرف المشروع اطّلاعاً).
 * ترويسة المشرف + حلقاته (ومعلّموها) + التزام الزيارات + آخر الزيارات.
 */
import type { Database } from '~/types/database.types'
import type { VisitRow } from '~/types/visits'

/** ما يُعرض هنا من كلٍّ، والباقي بـ«عرض الكل» (طلب المستخدم 2026-10-22). */
const PREVIEW = 5

definePageMeta({ layout: 'dashboard' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const supabase = useSupabaseClient<Database>()
const today = gazaToday()

type Sup = { id: string, full_name: string, employee_number: string | null, role: string, gender: string | null }
type Halqa = { id: string, name: string, status: string, teacher: { full_name: string } | null }

const { data, pending } = useLazyAsyncData(() => `supervisor-${id.value}`, async () => {
  const { data: sup } = await supabase.from('profiles').select('id, full_name, employee_number, role, gender').eq('id', id.value).maybeSingle<Sup>()
  if (!sup) return null

  const [{ data: halqat }, { data: visits }] = await Promise.all([
    supabase.from('halaqat').select('id, name, status, teacher:teacher_id(full_name)').eq('supervisor_id', id.value).order('name').returns<Halqa[]>(),
    supabase.from('supervision_visits')
      .select('*, halaqa:halaqa_id(name, teacher:teacher_id(full_name)), supervisor:supervisor_id(full_name, role, gender)')
      .eq('supervisor_id', id.value).order('scheduled_at', { ascending: false }).returns<VisitRow[]>()
  ])

  const vs = visits ?? []
  // «إنجازُ الزيارات» لشهر اليوم: المنفّذةُ ÷ (الحلقاتُ النشطة × 2)
  const month = today.slice(0, 7)
  const active = (halqat ?? []).filter(h => h.status === 'active').length
  const commitment = visitCompletion(vs.filter(v => gazaDayOf(v.scheduled_at).slice(0, 7) === month), active).pct

  return { sup, halqat: halqat ?? [], visits: vs, commitment }
}, { server: false, default: () => null })

useSeoMeta({ title: () => data.value?.sup ? `${data.value.sup.full_name} — ترجمان` : 'تفاصيل المشرف — ترجمان' })

// الشهرُ بالرقم (قرار المستخدم) والحالةُ بحَكَم شاشة الزيارات (المتأخّرةُ مشتقّة)
const fmtDate = (iso: string) => formatDay(gazaDayOf(iso))
// المشرفةُ بالمؤنّث (قسمُ البنات — 2026-10-22)
const female = computed(() => data.value?.sup?.gender === 'female')
const commitColor = (c: number | null) => c == null ? 'neutral' : c >= 85 ? 'success' : c >= 70 ? 'info' : 'error'

// نتيجةُ الزيارة للاطّلاع (والفتحُ للمديرَين داخل النافذة نفسها)
const resultOpen = ref(false)
const resultVisit = ref<VisitRow | null>(null)
function openResult(v: VisitRow) {
  resultVisit.value = v
  resultOpen.value = true
}
</script>

<template>
  <div class="sd">
    <UButton
      to="/supervisors"
      :label="female ? 'المشرفات' : 'المشرفون'"
      color="neutral"
      variant="ghost"
      size="sm"
      icon="i-lucide-arrow-right"
      class="back"
    />

    <ClientOnly>
      <template v-if="pending">
        <UiSkeletonBand :actions="1" />
        <div class="stats">
          <UiSkeletonLines :fields="1" />
          <UiSkeletonLines :fields="1" />
        </div>
        <div class="cols">
          <UiSkeletonRow
            :desc="false"
            :action="false"
          />
          <UiSkeletonRow
            :desc="false"
            :action="false"
          />
        </div>
      </template>
      <UiEmptyState
        v-else-if="!data?.sup"
        icon="i-lucide-user-x"
        :title="'المشرف غير موجود'"
      />

      <template v-else>
        <div class="band">
          <div class="band-id">
            <div class="av">
              {{ data.sup.full_name.trim().charAt(0) || '؟' }}
            </div>
            <div>
              <h1>{{ data.sup.full_name }}</h1>
              <div class="band-sub">
                <UBadge
                  :label="female ? 'المشرفة' : 'المشرف'"
                  color="info"
                  variant="soft"
                />
                <span v-if="data.sup.employee_number"><UIcon
                  name="i-lucide-id-card"
                  class="size-4"
                /><bdi dir="ltr">{{ data.sup.employee_number }}</bdi></span>
              </div>
            </div>
          </div>
          <UButton
            :to="`/profile/${data.sup.id}`"
            label="الملف الشخصي"
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-id-card"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
          />
        </div>

        <!-- بطاقات -->
        <div class="stats">
          <div class="card stat">
            <div class="sv">
              {{ data.halqat.length }}
            </div>
            <div class="sl">
              الحلقات المُسندة
            </div>
          </div>
          <div class="card stat">
            <div
              class="sv"
              :class="`c-${commitColor(data.commitment)}`"
            >
              {{ data.commitment != null ? `${data.commitment}%` : '—' }}
            </div>
            <div class="sl">
              إنجاز الزيارات هذا الشهر
            </div>
          </div>
        </div>

        <div class="cols">
          <!-- الحلقات -->
          <div class="card sec">
            <div class="sec-head">
              <h3>{{ female ? 'حلقاتها' : 'حلقاته' }} <span class="count">{{ data.halqat.length }}</span></h3>
              <UButton
                :to="`/halqat?supervisor=${data.sup.id}`"
                label="عرض الكل"
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-chevron-left"
                :ui="{ base: 'rounded-[12px] font-semibold min-h-11' }"
              />
            </div>
            <UiEmptyState
              v-if="!data.halqat.length"
              icon="i-lucide-book-open"
              title="لا حلقات مُسندة"
            />
            <ul
              v-else
              class="rows"
            >
              <li
                v-for="h in data.halqat.slice(0, PREVIEW)"
                :key="h.id"
                class="row"
              >
                <NuxtLink
                  :to="`/halqat/${h.id}`"
                  class="row-link"
                >
                  <span class="row-title">{{ h.name }}</span>
                  <span class="row-sub">{{ female ? 'المعلّمة' : 'المعلّم' }}: {{ h.teacher?.full_name || '—' }}</span>
                </NuxtLink>
                <UIcon
                  name="i-lucide-chevron-left"
                  class="size-4 chev"
                />
              </li>
            </ul>
          </div>

          <!-- آخر الزيارات -->
          <div class="card sec">
            <div class="sec-head">
              <h3>الزيارات <span class="count">{{ data.visits.length }}</span></h3>
              <UButton
                :to="`/visits?supervisor=${data.sup.id}`"
                label="عرض الكل"
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-chevron-left"
                :ui="{ base: 'rounded-[12px] font-semibold min-h-11' }"
              />
            </div>
            <UiEmptyState
              v-if="!data.visits.length"
              icon="i-lucide-clipboard-check"
              title="لا زيارات بعد"
            />
            <ul
              v-else
              class="rows"
            >
              <li
                v-for="v in data.visits.slice(0, PREVIEW)"
                :key="v.id"
                class="row"
              >
                <button
                  type="button"
                  class="row-btn"
                  @click="openResult(v)"
                >
                  <span class="row-main">
                    <span class="row-title">{{ v.halaqa?.name || '—' }}</span>
                    <span class="row-sub">{{ fmtDate(v.executed_at || v.scheduled_at) }}<template v-if="v.score != null"> · النتيجة <b>{{ v.score }}</b>/{{ VISIT_MAX }}</template></span>
                  </span>
                  <UBadge
                    :label="VISIT_STATUS[visitDisplayStatus(v, today)]?.label"
                    :color="VISIT_STATUS[visitDisplayStatus(v, today)]?.color"
                    variant="soft"
                    size="sm"
                  />
                  <UIcon
                    name="i-lucide-chevron-left"
                    class="size-4 chev"
                  />
                </button>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </ClientOnly>

    <VisitsResultModal
      v-model:open="resultOpen"
      :visit="resultVisit"
      :can-edit="false"
    />
  </div>
</template>

<style scoped>
.back { margin-bottom: 14px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }

.band { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; box-shadow: var(--shadow); padding: 24px; display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap; margin-bottom: 18px; }
.band-id { display: flex; align-items: center; gap: 16px; min-width: 0; }
.av { width: 60px; height: 60px; border-radius: 18px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; flex: none; }
.band h1 { margin: 0 0 8px; font-size: 23px; font-weight: 700; color: var(--ink); }
.band-sub { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
.band-sub span { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; color: var(--ink-2); }

.stats { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
.stat { padding: 18px 20px; }
.sv { font-size: 26px; font-weight: 700; color: var(--ink); line-height: 1; }
.sv.c-success { color: var(--green-ink); }
.sv.c-info { color: var(--blue-ink); }
.sv.c-error { color: var(--err); }
.sl { font-size: 13px; color: var(--ink-3); margin-top: 7px; }

.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
.sec { padding: 20px 22px; }
.sec-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.sec-head h3 { margin: 0; font-size: 16.5px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 9px; }
.count { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 28px; padding: 0 10px; border-radius: 999px; background: var(--navy); color: #fff; font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
.row-btn { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 0; background: none; border: 0; font: inherit; color: inherit; text-align: start; cursor: pointer; min-height: 44px; }
.row-btn .row-main { flex: 1; }
.row-btn:hover .row-title { color: var(--blue-ink); }
.row-btn:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; border-radius: 8px; }
.row-sub b { color: var(--ink); }
.rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 11px 0; border-top: 1px solid var(--line); }
.row:first-child { border-top: none; }
.row-link { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
.row-main { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.row-title { font-weight: 600; color: var(--ink); }
.row-sub { font-size: 12.5px; color: var(--ink-3); }
.chev { color: var(--ink-3); flex: none; }

@media (max-width: 760px) { .cols, .stats { grid-template-columns: 1fr; } }
</style>
