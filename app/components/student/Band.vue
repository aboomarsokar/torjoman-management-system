<script setup lang="ts">
/**
 * الشريطُ العلويّ للطالب — مشتركٌ بين «صفحتي» (`/me`) وملفّ الطالب عند العاملين (`/students/[id]`) فلا
 * يتشعّب الشكلان (طلبُ المستخدم 2026-10-20: «تعرض صفحة الطالب كما تعرض في حساب الطالب نفسه»).
 * الصورةُ وأزرارُ الإجراءات من الموضع (فتحتا `avatar` و`actions`): الطالبُ يغيّر صورته وكلمته، والعاملُ ينسخ
 * رابطَ الاطّلاع. على الجوال: الصورةُ والاسم في سطر، والأزرارُ سطرٌ كاملٌ تحتهما — كان الاسمُ ينكسر كلمةً كلمة.
 */
import { STUDENT_STATUS } from '~/utils/statusMeta'

interface Props {
  name: string
  status: string
  gender: string | null
  halaqa: { name: string, teacher: string | null, time: string | null } | null
}

const props = defineProps<Props>()
const teacherLabel = computed(() => (props.gender === 'female' ? 'المعلّمة' : 'المعلّم'))
</script>

<template>
  <div class="band">
    <div class="av">
      <slot name="avatar" />
    </div>
    <div class="band-info">
      <h2>{{ name }}</h2>
      <div class="band-sub">
        <UBadge
          :label="STUDENT_STATUS[status]?.label"
          :color="STUDENT_STATUS[status]?.color"
          variant="soft"
          class="band-badge"
        />
        <span class="bi">{{ halaqa?.name || 'بلا حلقة' }}</span>
        <span
          v-if="halaqa?.teacher"
          class="bi"
        >{{ teacherLabel }} {{ halaqa.teacher }}</span>
        <span
          v-if="halaqa?.time"
          class="bi"
        >{{ halaqa.time }}</span>
      </div>
    </div>
    <div
      v-if="$slots.actions"
      class="band-actions"
    >
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.band { background: var(--band); border-radius: 22px; padding: 26px 28px; box-shadow: var(--shadow-lg); margin-bottom: 20px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 20px; }
.av { width: 72px; height: 72px; border-radius: 20px; background: rgba(255, 255, 255, .16); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; flex: none; }
.band-info { min-width: 0; }
.band-info h2 { margin: 0; font-size: 25px; font-weight: 700; line-height: 1.35; color: #fff; text-wrap: balance; }
.band-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; font-size: 14.5px; color: var(--band-sub); }
/* الفاصلُ بين بنود النصّ وحدها — الشارةُ عنصرٌ من النوع نفسه فلا تُعدّ */
.bi + .bi::before { content: '·'; margin-inline-end: 14px; opacity: .7; }
.band-badge { margin-inline-end: 2px; }
.band-actions { display: flex; align-items: center; gap: 8px; }

@media (max-width: 640px) {
  .band { grid-template-columns: auto minmax(0, 1fr); padding: 20px 18px; gap: 16px 14px; border-radius: 20px; }
  .av { width: 62px; height: 62px; border-radius: 18px; font-size: 24px; }
  .band-info h2 { font-size: 20px; }
  .band-sub { font-size: 13.5px; gap: 4px 10px; }
  .bi + .bi::before { margin-inline-end: 10px; }
  .band-actions { grid-column: 1 / -1; }
  .band-actions > :deep(*) { flex: 1 1 0; }
}
</style>
