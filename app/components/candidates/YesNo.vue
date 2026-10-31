<script setup lang="ts">
/** سؤالُ نعم/لا في نموذج الالتحاق — زرّان متجاوران، والقيمةُ null حتى يُجاب. */
const model = defineModel<boolean | null>({ required: true })
defineProps<{ label: string }>()
</script>

<template>
  <div
    class="yn"
    role="radiogroup"
    :aria-label="label"
  >
    <span class="yn-q">{{ label }} <b aria-hidden="true">*</b></span>
    <div class="yn-opts">
      <button
        v-for="o in [{ v: true, t: 'نعم' }, { v: false, t: 'لا' }]"
        :key="o.t"
        type="button"
        role="radio"
        :aria-checked="model === o.v"
        :class="{ on: model === o.v }"
        @click="model = o.v"
      >
        {{ o.t }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.yn { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
.yn-q { font-size: 14px; font-weight: 500; color: var(--ink); }
.yn-q b { color: var(--err); font-weight: 500; }
.yn-opts { display: inline-flex; gap: 6px; }
.yn-opts button {
  min-width: 72px; min-height: 44px; padding: 0 16px; border-radius: 12px; border: 1px solid var(--line-2); background: var(--surface);
  font: inherit; font-weight: 600; color: var(--ink-2); cursor: pointer;
}
.yn-opts button.on { background: var(--navy); border-color: var(--navy); color: var(--on-primary); }
.yn-opts button:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
</style>
