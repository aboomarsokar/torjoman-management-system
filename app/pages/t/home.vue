<script setup lang="ts">
/**
 * لوحةُ المعلّم — تعمل بلا إنترنت والتطبيقُ يُقلع عليها (البند 14 — نمطُ الصحابة، طلب المستخدم 2026-10-27).
 * تُصيَّر في المتصفّح وتُخزَّن في عامل الخدمة؛ والبياناتُ آخرُ ما جُلب متّصلاً (`useTeacherDashboard` يحفظه على الجهاز)
 * وفيه ما سجّله المعلّمُ بعده على جهازه. غيرُ المعلّم يُحوَّل إلى `/dashboard`.
 */
import { offlineStartFor } from '~/constants/offline'
import { isOnlineNow } from '~/utils/reachability'
import { offlineOwnerRole } from '~/utils/offlineSnapshot'

definePageMeta({ layout: 'dashboard' })
useSeoMeta({ title: 'لوحة التحكم — ترجمان', robots: 'noindex' })

const { role, fullName, profile, pending } = useProfile()
watch(role, (r) => {
  if (!r || r === 'teacher') return
  // بلا اتصال: المشرفُ الميدانيّ والمختبِر إلى شاشتيهما المخزَّنتين (لا `/dashboard` فتُحوَّل ثانيةً) — 2026-10-29
  navigateTo(isOnlineNow() ? '/dashboard' : offlineStartFor(offlineOwnerRole()), { replace: true })
}, { immediate: true })

// متّصلاً: نُسخُ الحضور والإنجاز والطلاب تُحدَّث في الخلفية — فتعمل شاشاتُها بلا إنترنت ولو لم تُفتح قبلُ
const { warm } = useWarmTeacherMirrors()
watch(() => profile.value?.role === 'teacher' ? profile.value.id : null, (id) => {
  if (id && import.meta.client) void warm(id, fullName.value)
}, { immediate: true })
</script>

<template>
  <div class="dash">
    <h2
      v-if="fullName"
      class="welcome"
    >
      أهلاً، {{ fullName }} 👋
    </h2>
    <DashboardTeacherSkeleton v-if="pending && !profile" />
    <UiEmptyState
      v-else-if="!profile"
      icon="i-lucide-wifi-off"
      title="افتح التطبيق مرّةً وأنت متّصل"
      description="تُحفظ لوحتُك وحلقتُك على جهازك عند أوّل دخولٍ متّصل، ثمّ تعمل بلا إنترنت."
    >
      <UButton
        to="/login"
        label="تسجيل الدخول"
        color="primary"
        :ui="{ base: 'rounded-xl min-h-11' }"
      />
    </UiEmptyState>
    <DashboardTeacherHome v-else-if="role === 'teacher'" />
  </div>
</template>

<style scoped>
.dash { display: flex; flex-direction: column; gap: 16px; }
/* كترحيب `/dashboard` الذي كان المعلّمُ يراه */
.welcome { margin: 0 0 12px; font-size: 28px; font-weight: 700; color: var(--ink); }
</style>
