<script setup lang="ts">
/**
 * دليل المشرفين (§4.14أ) — للمدير الإداري والمدير الفني (ومشرف المشروع اطّلاعاً).
 * يعرض المشرفين الميدانيين + عدد حلقاتهم + نسبة الالتزام بالزيارات.
 * الالتزام = الزيارات في وقتها ÷ (في وقتها + متأخرة + لم تتم) × 100.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'المشرفون — ترجمان' })

const supabase = useSupabaseClient<Database>()
const { isManager, isReadOnly } = usePermissions()
const canView = computed(() => isManager.value || isReadOnly.value)

type Row = { id: string, name: string, employeeNumber: string | null, halqat: number, commitment: number | null }

const { data: rows, pending } = useLazyAsyncData<Row[]>('supervisors-dir', async () => {
  if (!canView.value) return []
  const { data: sups } = await supabase.from('profiles').select('id, full_name, employee_number')
    .eq('role', 'field_supervisor').eq('status', 'active').order('full_name')
  const ids = (sups ?? []).map(s => s.id)
  if (!ids.length) return []

  const [{ data: halqat }, { data: visits }] = await Promise.all([
    supabase.from('halaqat').select('supervisor_id').in('supervisor_id', ids),
    supabase.from('supervision_visits').select('supervisor_id, status').in('supervisor_id', ids)
  ])
  const halqaCount: Record<string, number> = {}
  for (const h of halqat ?? []) if (h.supervisor_id) halqaCount[h.supervisor_id] = (halqaCount[h.supervisor_id] ?? 0) + 1
  const vAgg: Record<string, { done: number, due: number }> = {}
  for (const v of visits ?? []) {
    const a = (vAgg[v.supervisor_id] ??= { done: 0, due: 0 })
    if (v.status === 'done') {
      a.done++
      a.due++
    } else if (v.status === 'late' || v.status === 'missed') {
      a.due++
    }
  }
  return (sups ?? []).map((s) => {
    const a = vAgg[s.id]
    return {
      id: s.id, name: s.full_name, employeeNumber: s.employee_number,
      halqat: halqaCount[s.id] ?? 0,
      commitment: a && a.due > 0 ? Math.round(a.done / a.due * 100) : null
    }
  })
  // يُعاد الجلب حين يصل الدور: عند التحميل الكامل يُستدعى قبل الملف فيردّ [] (كانت الصفحة تقول «لا مشرفين»)
}, { server: false, default: () => [], watch: [canView] })

const commitColor = (c: number | null) => c == null ? 'neutral' : c >= 85 ? 'success' : c >= 70 ? 'info' : 'error'
</script>

<template>
  <div class="sups">
    <UiPageHeader
      title="المشرفون"
      subtitle="المشرفون الميدانيون وحلقاتهم ومدى التزامهم بالزيارات."
    />

    <UiEmptyState
      v-if="!canView"
      icon="i-lucide-lock"
      title="هذه الصفحة للمدير الإداري والمدير الفني."
    />

    <ClientOnly v-else>
      <div
        v-if="pending"
        class="grid"
      >
        <UiSkeletonCard
          v-for="i in 6"
          :key="i"
          :lines="1"
        />
      </div>
      <UiEmptyState
        v-else-if="!rows || !rows.length"
        icon="i-lucide-users-round"
        title="لا مشرفين في نطاقك"
      />
      <div
        v-else
        class="grid"
      >
        <NuxtLink
          v-for="s in rows"
          :key="s.id"
          :to="`/supervisors/${s.id}`"
          class="card scard"
        >
          <div class="shead">
            <div class="av">
              {{ s.name.trim().charAt(0) || '؟' }}
            </div>
            <div class="sinfo">
              <h3>{{ s.name }}</h3>
              <span
                v-if="s.employeeNumber"
                class="email"
              >الرقم الوظيفي <bdi dir="ltr">{{ s.employeeNumber }}</bdi></span>
            </div>
          </div>
          <div class="smeta">
            <div class="m">
              <span class="mv">{{ s.halqat }}</span>
              <span class="ml">حلقة</span>
            </div>
            <UBadge
              :label="s.commitment != null ? `الالتزام ${s.commitment}%` : 'لا زيارات'"
              :color="commitColor(s.commitment)"
              variant="soft"
            />
          </div>
        </NuxtLink>
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.scard { padding: 18px 20px; display: block; transition: border-color .15s, transform .1s; }
.scard:hover { border-color: var(--blue); transform: translateY(-2px); }
.shead { display: flex; align-items: center; gap: 13px; margin-bottom: 16px; }
.av { width: 48px; height: 48px; border-radius: 14px; background: var(--navy); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; flex: none; }
.sinfo { min-width: 0; }
.sinfo h3 { margin: 0; font-size: 16.5px; font-weight: 700; color: var(--ink); }
.email { font-size: 12.5px; color: var(--ink-3); }
.smeta { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 14px; border-top: 1px solid var(--line); }
.m { display: flex; align-items: baseline; gap: 6px; }
.mv { font-size: 22px; font-weight: 700; color: var(--ink); }
.ml { font-size: 13px; color: var(--ink-3); }
</style>
