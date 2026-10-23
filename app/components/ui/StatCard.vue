<script setup lang="ts">
/**
 * بطاقة إحصائية: أيقونة ملوّنة + رقم + تسمية. stacked = الأيقونة فوق الرقم.
 * الرقمُ يُعدّ تصاعدياً من 0 عند الظهور ومن السابق عند التغيّر (`UiCountUp`)؛ والقيمةُ النصّية تُعرض كما هي.
 */
const props = defineProps<{
  icon: string
  value: string | number
  label: string
  tone?: 'blue' | 'green' | 'neutral' | 'err'
  stacked?: boolean
  /** سطرٌ ثانٍ تحت التسمية بخطٍّ أصغر، وأرقامُه بارزة. */
  sub?: string
}>()

/** السطرُ الثاني قِطعاً: الأرقامُ (ومعها الكسر) تُميَّز عن الكلام. */
const subParts = computed(() => (props.sub ?? '').split(/(\d+(?:[.,]\d+)?٪?%?)/).filter(Boolean)
  .map(text => ({ text, num: /^\d/.test(text) })))
</script>

<template>
  <div
    class="stat"
    :class="{ stacked }"
  >
    <div
      class="ico"
      :class="`ico-${tone || 'blue'}`"
    >
      <UIcon
        :name="icon"
        class="size-6"
      />
    </div>
    <div class="txt">
      <div class="num">
        <UiCountUp
          v-if="typeof value === 'number'"
          :value="value"
        />
        <template v-else>
          {{ value }}
        </template>
      </div>
      <div class="lbl">
        {{ label }}
      </div>
      <!-- سطرٌ ثانٍ اختياريّ (مثل «4 من 4 مطلوبة»)، وأرقامُه بارزة -->
      <div
        v-if="sub"
        class="sub"
      >
        <template
          v-for="(p, i) in subParts"
          :key="i"
        >
          <b
            v-if="p.num"
            class="sub-n"
          >{{ p.text }}</b>
          <template v-else>
            {{ p.text }}
          </template>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: 20px; padding: 22px; box-shadow: var(--shadow); display: flex; align-items: center; gap: 15px; }
.stat.stacked { flex-direction: column; align-items: flex-start; gap: 0; padding: 24px; }
.ico { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex: none; }
.stat.stacked .ico { margin-bottom: 18px; }
.ico-blue { background: var(--blue-soft); color: var(--blue-ink); }
.ico-green { background: var(--green-soft); color: var(--green-ink); }
.ico-neutral { background: var(--surface-3); color: var(--ink); }
.ico-err { background: var(--err-soft); color: var(--err); }
.num { font-size: 28px; font-weight: 700; color: var(--ink); line-height: 1; }
.stat.stacked .num { font-size: 34px; }
.txt { min-width: 0; }
.lbl { font-size: 14px; color: var(--ink-2); margin-top: 6px; }
.stat.stacked .lbl { font-size: 15px; margin-top: 8px; }
.sub { margin-top: 6px; font-size: 13px; color: var(--ink-2); line-height: 1.9; }
/* الرقمُ في السطر الثاني على خلفيّةٍ مصمتة (طلب المستخدم 2026-10-21) */
.sub-n {
  display: inline-block; min-width: 22px; padding: 0 7px; border-radius: 7px; text-align: center;
  background: var(--navy); color: var(--on-primary); font-weight: 700; line-height: 1.6; font-variant-numeric: tabular-nums;
}
</style>
