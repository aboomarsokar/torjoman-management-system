<script setup lang="ts">
/**
 * «مسارات المعلمين» (نظامُ المسارين — قرار المستخدم 2026-11-16): ثلاثةُ تبويبات — الطلباتُ المعلّقة (اعتمادٌ/رفض)،
 * والحلقاتُ بمسار الشهر ومسار الفصل التالي (وتعيينٌ مباشر بسبب)، والطلباتُ المحسومة مؤخراً. الكتابةُ للمدير الإداري
 * وحده، ومشرفُ المشروع والمدير الفنيّ يقرآن (نطاقُه البنين — RLS). المنطقُ في `useTracksAdmin`.
 */
import { TRACKS, type TrackNo } from '~/constants/tracks'
import { asTrack } from '~/utils/tracks'
import type { TrackHalaqaRow, TrackRequestRow } from '~/composables/useTracksAdmin'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'مسارات المعلمين — ترجمان' })

const { isAdmin } = usePermissions()
const { data, pending, busy, now, term, decide, assign } = useTracksAdmin()

type View = 'requests' | 'halaqat' | 'history'
const view = ref<View>('requests')
const tabs = computed(() => [
  { key: 'requests' as const, label: 'الطلبات', icon: 'i-lucide-inbox', count: data.value?.pending.length ?? 0 },
  { key: 'halaqat' as const, label: 'الحلقات', icon: 'i-lucide-book-open' },
  { key: 'history' as const, label: 'المحسومة', icon: 'i-lucide-history' }
])
const termLabel = `${String(term.month).padStart(2, '0')}-${term.year}`
const two = computed(() => (data.value?.halaqat ?? []).filter(h => h.current === 2).length)

const deciding = ref<TrackRequestRow | null>(null)
const decideOpen = computed({
  get: () => !!deciding.value,
  set: (v) => {
    if (!v) deciding.value = null
  }
})
async function onDecide(approve: boolean, note: string) {
  if (deciding.value && await decide(deciding.value.id, approve, note)) deciding.value = null
}

const assigning = ref<TrackHalaqaRow | null>(null)
const assignOpen = computed({
  get: () => !!assigning.value,
  set: (v) => {
    if (!v) assigning.value = null
  }
})
async function onAssign(track: TrackNo, y: number, m: number, reason: string) {
  if (assigning.value && await assign(assigning.value.id, track, y, m, reason)) assigning.value = null
}

const STATUS: Record<string, string> = { approved: 'اعتُمد', rejected: 'رُفض', cancelled: 'سحبه المعلم' }
const ym = (y: number | null, m: number | null) => (y && m ? `${String(m).padStart(2, '0')}-${y}` : '')
const date = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '')
</script>

<template>
  <div class="tk">
    <UiPageHeader
      title="مسارات المعلمين"
      :subtitle="`المسار الأول ${TRACKS[1].quota} طالباً · ${TRACKS[1].amount} — والثاني ${TRACKS[2].quota} · ${TRACKS[2].amount}. التغييرُ يسري من أوّل الفصل التالي (${termLabel}).`"
    />
    <UiSegmentTabs
      v-model="view"
      :tabs="tabs"
      label="عروض المسارات"
    />
    <div
      v-if="pending && !data"
      aria-busy="true"
    >
      <UiSkeletonCard />
    </div>
    <template v-else-if="data">
      <section
        v-if="view === 'requests'"
        class="card"
      >
        <UiEmptyState
          v-if="!data.pending.length"
          icon="i-lucide-inbox"
          title="لا طلباتٍ معلّقة"
        />
        <ul
          v-else
          class="tk-list"
        >
          <li
            v-for="r in data.pending"
            :key="r.id"
          >
            <span class="tk-main">
              <b>{{ r.halaqa?.name ?? '—' }}</b>
              <small>{{ r.requester?.full_name ?? '' }} · {{ date(r.created_at) }} · طلبُ {{ TRACKS[asTrack(r.requested_track)].label }}<template v-if="r.note"> — {{ r.note }}</template></small>
            </span>
            <UButton
              v-if="isAdmin"
              label="حسم"
              color="primary"
              :ui="{ base: 'min-h-11 rounded-[13px]' }"
              @click="deciding = r"
            />
          </li>
        </ul>
      </section>

      <section
        v-else-if="view === 'halaqat'"
        class="card"
      >
        <p class="tk-sum">
          {{ data.halaqat.length }} حلقة — على المسار الثاني هذا الشهر {{ two }}.
        </p>
        <ul class="tk-list">
          <li
            v-for="h in data.halaqat"
            :key="h.id"
          >
            <span class="tk-main">
              <b>{{ h.name }}</b>
              <small>{{ h.teacher ?? '—' }}<template v-if="h.next !== h.current"> · من <bdi dir="ltr">{{ termLabel }}</bdi>: {{ TRACKS[h.next].label }}</template></small>
            </span>
            <span
              class="tk-chip"
              :class="`t${h.current}`"
            >{{ TRACKS[h.current].label }}</span>
            <UButton
              v-if="isAdmin"
              label="تعيين"
              color="neutral"
              variant="outline"
              :ui="{ base: 'min-h-11 rounded-[13px]' }"
              @click="assigning = h"
            />
          </li>
        </ul>
      </section>

      <section
        v-else
        class="card"
      >
        <UiEmptyState
          v-if="!data.decided.length"
          icon="i-lucide-history"
          title="لا طلباتٍ محسومة بعد"
        />
        <ul
          v-else
          class="tk-list"
        >
          <li
            v-for="r in data.decided"
            :key="r.id"
          >
            <span class="tk-main">
              <b>{{ r.halaqa?.name ?? '—' }} — {{ TRACKS[asTrack(r.requested_track)].label }}</b>
              <small>{{ STATUS[r.status] ?? r.status }} {{ date(r.decided_at) }}<template v-if="r.status === 'approved'"> · يسري من <bdi dir="ltr">{{ ym(r.effective_year, r.effective_month) }}</bdi></template><template v-if="r.decision_note"> — {{ r.decision_note }}</template></small>
            </span>
          </li>
        </ul>
      </section>
    </template>

    <TracksDecideModal
      v-if="deciding"
      v-model:open="decideOpen"
      :halaqa="deciding.halaqa?.name ?? ''"
      :track="asTrack(deciding.requested_track)"
      :request-note="deciding.note"
      :busy="busy"
      @decide="onDecide"
    />
    <TracksAssignModal
      v-if="assigning"
      v-model:open="assignOpen"
      :halaqa="assigning.name"
      :current="assigning.current"
      :min="now"
      :busy="busy"
      @assign="onAssign"
    />
  </div>
</template>

<style scoped>
.tk { display: flex; flex-direction: column; gap: 16px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); padding: 8px 20px; }
.tk-sum { margin: 12px 0 4px; font-size: 14.5px; color: var(--ink-2); }
.tk-list { list-style: none; margin: 0; padding: 0; }
.tk-list li { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 0; border-top: 1px solid var(--line); }
.tk-list li:first-child { border-top: none; }
.tk-main { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.tk-main b { font-size: 15.5px; color: var(--ink); }
.tk-main small { font-size: 13.5px; color: var(--ink-2); line-height: 1.7; }
.tk-chip { font-size: 13px; font-weight: 700; padding: 4px 12px; border-radius: 999px; }
.tk-chip.t1 { background: var(--blue-soft); color: var(--blue-ink); }
.tk-chip.t2 { background: var(--green-soft); color: var(--green-ink); }
@media (max-width: 560px) {
  .card { padding: 6px 16px; }
}
</style>
