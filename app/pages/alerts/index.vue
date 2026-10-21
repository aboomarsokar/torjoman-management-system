<script setup lang="ts">
/**
 * التنبيهات الإدارية (§4.21) — متابعة أداء المعلّمين.
 * المديران (الإداري والفني) يُصدران تنبيهاً لمعلّم (نوع المخالفة + درجة + وصف)،
 * والمعلّم يستقبله ويؤكّد الاطّلاع. مشرف المشروع والمديرة الإدارية للاطّلاع. النطاق محكوم بـ RLS.
 * والمشرفُ الميدانيّ خارجها (قرار 2026-10-21): لا قائمةَ ولا إصدار، ومن فتح الرابط رأى قفلاً.
 */
import type { Database } from '~/types/database.types'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'التنبيهات الإدارية — ترجمان' })

type Severity = Database['public']['Enums']['alert_severity']
const supabase = useSupabaseClient<Database>()
const { profile } = useProfile()
const { handle } = useErrorHandler()
const toast = useToast()

const { role, isTeacher, isManager, isFieldSupervisor } = usePermissions()
/** الإصدار كما يسمح RLS (alerts_insert): الإداري والفني وحدهما — المشرفُ الميدانيّ أُخرج منها (قرار 2026-10-21). */
const canIssue = computed(() => isManager.value)

const SEVERITY: Record<Severity, { label: string, color: 'neutral' | 'warning' | 'error' }> = {
  note: { label: 'ملاحظة', color: 'neutral' },
  first_warning: { label: 'إنذار أول', color: 'warning' },
  final_warning: { label: 'إنذار نهائي', color: 'error' }
}
const severityItems = (Object.keys(SEVERITY) as Severity[]).map(k => ({ label: SEVERITY[k].label, value: k }))

type AlertRow = {
  id: string
  alert_date: string
  violation_type: string
  description: string | null
  severity: Severity
  status: 'new' | 'acknowledged'
  acknowledged_at: string | null
  teacher: { full_name: string } | null
  issuer: { full_name: string } | null
}

// جلب غير حاجز (useLazyAsyncData): الاستعلامان مستقلّان ويعملان بالتوازي تلقائياً
// المعلم لا يرى مُصدِر التنبيه (قرار 2026-10-19): يظهر له «إدارة المشروع»، ولا يُطلب الاسم من القاعدة أصلاً
// فلا يصل إلى متصفّحه. الإدارة ترى المُصدِر صراحةً. الدور شرطٌ للجلب، فيُنتظر (role) ثم يُعاد.
const ISSUER_FOR_TEACHER = 'إدارة المشروع'
const { data: alerts, refresh, pending } = useLazyAsyncData<AlertRow[]>('alerts-list', async () => {
  if (!role.value || isFieldSupervisor.value) return []
  const cols = 'id, alert_date, violation_type, description, severity, status, acknowledged_at, teacher:teacher_id(full_name)'
  const { data } = await supabase
    .from('admin_alerts')
    .select(isTeacher.value ? cols : `${cols}, issuer:issuer_id(full_name)`)
    .order('alert_date', { ascending: false })
    .returns<AlertRow[]>()
  return data ?? []
}, { server: false, default: () => [], watch: [role] })

// المعلم ومعه اسم حلقته (لتمييز المعلمين وتسريع الاختيار) — حلقته النشطة، وإلا «بلا حلقة»
const { data: teachers } = useLazyAsyncData('alert-teachers', async () => {
  if (!canIssue.value) return []
  const [{ data: people }, { data: halqat }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').eq('role', 'teacher').eq('status', 'active').order('full_name'),
    supabase.from('halaqat').select('teacher_id, name').eq('status', 'active')
  ])
  const halqaOf = new Map((halqat ?? []).map(h => [h.teacher_id, h.name]))
  return (people ?? []).map(t => ({ ...t, halqa: halqaOf.get(t.id) ?? null }))
}, { server: false, default: () => [], watch: [canIssue] })
const teacherItems = computed(() => (teachers.value ?? []).map(t => ({
  label: `${t.full_name} (${t.halqa ?? 'بلا حلقة'})`,
  value: t.id
})))

// ── إصدار تنبيه ──
const modalOpen = ref(false)
const saving = ref(false)
const today = new Date().toISOString().slice(0, 10)
const form = reactive({ teacher_id: '', violation_type: '', severity: 'note' as Severity, description: '', alert_date: today })

function openCreate() {
  form.teacher_id = ''
  form.violation_type = ''
  form.severity = 'note'
  form.description = ''
  form.alert_date = today
  modalOpen.value = true
}

async function save() {
  if (!form.teacher_id || !form.violation_type.trim()) {
    toast.add({ title: 'اختر المعلّم واكتب نوع المخالفة.', color: 'error', icon: 'i-lucide-circle-alert' })
    return
  }
  saving.value = true
  try {
    const { error } = await supabase.from('admin_alerts').insert({
      teacher_id: form.teacher_id,
      issuer_id: profile.value?.id ?? '',
      violation_type: form.violation_type.trim(),
      severity: form.severity,
      description: form.description.trim() || null,
      alert_date: form.alert_date
    })
    if (error) throw error
    toast.add({ title: 'صدر التنبيه.', color: 'success', icon: 'i-lucide-circle-check' })
    modalOpen.value = false
    await refresh()
  } catch (err) {
    handle(err)
  } finally {
    saving.value = false
  }
}

// ── تأكيد الاطّلاع (المعلّم) ──
const acking = ref<string | null>(null)
async function acknowledge(a: AlertRow) {
  acking.value = a.id
  try {
    const { error } = await supabase.from('admin_alerts').update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() }).eq('id', a.id)
    if (error) throw error
    a.status = 'acknowledged'
    toast.add({ title: 'تم تأكيد الاطّلاع.', color: 'success', icon: 'i-lucide-check' })
  } catch (err) {
    handle(err)
  } finally {
    acking.value = null
  }
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'short', year: 'numeric' })
const newCount = computed(() => (alerts.value ?? []).filter(a => a.status === 'new').length)
</script>

<template>
  <div class="alerts">
    <UiPageHeader
      title="التنبيهات الإدارية"
      :subtitle="isTeacher ? 'التنبيهات الموجَّهة إليك — أكّد اطّلاعك عليها.' : 'متابعة أداء المعلّمين — أصدِر تنبيهاً وتابع الاطّلاع عليه.'"
    >
      <template
        v-if="canIssue"
        #actions
      >
        <UButton
          label="إصدار تنبيه"
          color="primary"
          size="lg"
          icon="i-lucide-bell-plus"
          :ui="{ base: 'rounded-[13px] font-semibold' }"
          @click="openCreate"
        />
      </template>
    </UiPageHeader>

    <UiEmptyState
      v-if="isFieldSupervisor"
      icon="i-lucide-lock"
      title="التنبيهات الإدارية ليست من شاشات المشرف الميداني."
    />

    <ClientOnly v-else>
      <div
        v-if="pending"
        class="list"
      >
        <UiSkeletonRow
          v-for="i in 4"
          :key="i"
        />
      </div>
      <UiEmptyState
        v-else-if="!alerts || !alerts.length"
        icon="i-lucide-bell-off"
        :title="isTeacher ? 'لا تنبيهات موجَّهة إليك' : 'لا تنبيهات بعد'"
        :description="isTeacher ? 'كل شيء على ما يُرام.' : 'أصدِر أول تنبيه عند الحاجة.'"
      />

      <template v-else>
        <div
          v-if="isTeacher && newCount"
          class="hint"
        >
          <UIcon
            name="i-lucide-info"
            class="size-4"
          />
          لديك <strong>{{ newCount }}</strong> تنبيه جديد بانتظار تأكيد اطّلاعك.
        </div>

        <div class="list">
          <div
            v-for="a in alerts"
            :key="a.id"
            class="card alert"
            :class="`sev-${a.severity}`"
          >
            <div class="alert-main">
              <div class="alert-head">
                <UBadge
                  :label="SEVERITY[a.severity].label"
                  :color="SEVERITY[a.severity].color"
                  variant="soft"
                />
                <span class="vtype">{{ a.violation_type }}</span>
                <UBadge
                  v-if="a.status === 'acknowledged'"
                  label="تمّ الاطّلاع"
                  color="success"
                  variant="soft"
                  size="sm"
                />
                <UBadge
                  v-else
                  label="جديد"
                  color="error"
                  variant="soft"
                  size="sm"
                />
              </div>
              <p
                v-if="a.description"
                class="desc"
              >
                {{ a.description }}
              </p>
              <div class="meta">
                <span v-if="!isTeacher"><UIcon
                  name="i-lucide-user"
                  class="size-[13px]"
                />{{ a.teacher?.full_name || '—' }}</span>
                <span><UIcon
                  name="i-lucide-shield"
                  class="size-[13px]"
                />المُصدِر: {{ isTeacher ? ISSUER_FOR_TEACHER : (a.issuer?.full_name || '—') }}</span>
                <span><UIcon
                  name="i-lucide-calendar"
                  class="size-[13px]"
                />{{ fmtDate(a.alert_date) }}</span>
              </div>
            </div>
            <div
              v-if="isTeacher && a.status === 'new'"
              class="alert-action"
            >
              <UButton
                label="تأكيد الاطّلاع"
                color="primary"
                size="sm"
                icon="i-lucide-check"
                :loading="acking === a.id"
                :ui="{ base: 'rounded-[11px] font-semibold' }"
                @click="acknowledge(a)"
              />
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>

    <!-- نافذة إصدار تنبيه -->
    <UModal
      v-model:open="modalOpen"
      title="إصدار تنبيه إداري"
    >
      <template #body>
        <div class="form">
          <UFormField
            label="المعلّم"
            required
          >
            <UiSelect
              v-model="form.teacher_id"
              :items="teacherItems"
              placeholder="اختر المعلّم"
              size="lg"
            />
          </UFormField>
          <UFormField
            label="نوع المخالفة"
            required
          >
            <UInput
              v-model="form.violation_type"
              placeholder="مثال: تأخّر متكرّر، تقرير ناقص…"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
          <div class="row">
            <UFormField
              label="الدرجة"
              class="f1"
            >
              <UiSelect
                v-model="form.severity"
                :items="severityItems"
                size="lg"
              />
            </UFormField>
            <UFormField
              label="التاريخ"
              class="f1"
            >
              <UInput
                v-model="form.alert_date"
                type="date"
                size="lg"
                class="w-full"
                :ui="{ base: 'rounded-[13px]' }"
              />
            </UFormField>
          </div>
          <UFormField label="الوصف (اختياري)">
            <UTextarea
              v-model="form.description"
              :rows="3"
              size="lg"
              class="w-full"
              :ui="{ base: 'rounded-[13px]' }"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="modal-foot">
          <UButton
            label="إلغاء"
            color="neutral"
            variant="ghost"
            @click="modalOpen = false"
          />
          <UButton
            label="إصدار"
            color="primary"
            icon="i-lucide-bell-plus"
            :loading="saving"
            :ui="{ base: 'rounded-[13px] font-semibold' }"
            @click="save"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.card { background: var(--surface); border: 1px solid var(--line); border-radius: 18px; box-shadow: var(--shadow); }

.hint { display: flex; align-items: center; gap: 8px; font-size: 14.5px; color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line); border-radius: 13px; padding: 12px 16px; margin-bottom: 16px; }
.hint strong { color: var(--ink); }

.list { display: flex; flex-direction: column; gap: 14px; }
.alert { padding: 18px 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-inline-start: 4px solid var(--line-2); }
.alert.sev-first_warning { border-inline-start-color: var(--warn, #d97706); }
.alert.sev-final_warning { border-inline-start-color: var(--err); }
.alert-main { min-width: 0; }
.alert-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.vtype { font-size: 16px; font-weight: 700; color: var(--ink); }
.desc { margin: 9px 0 0; font-size: 14.5px; color: var(--ink-2); line-height: 1.7; }
.meta { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 11px; }
.meta span { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; color: var(--ink-3); }
.alert-action { flex: none; }

.form { display: flex; flex-direction: column; gap: 16px; }
.row { display: flex; gap: 14px; }
.f1 { flex: 1; }
.modal-foot { display: flex; justify-content: flex-end; gap: 10px; }

@media (max-width: 560px) { .alert { flex-direction: column; align-items: stretch; } .row { flex-direction: column; } }
</style>
