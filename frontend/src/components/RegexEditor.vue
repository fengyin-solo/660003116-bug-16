<template>
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700">
    <h3 class="text-sm font-bold text-slate-400 mb-3">正则表达式输入</h3>
    <div class="relative">
      <span class="absolute left-3 top-2 text-cyan-500 font-bold text-lg">/</span>
      <input
        v-model="localPattern"
        @input="onInput"
        @keyup.enter="execute"
        type="text"
        placeholder="输入正则表达式..."
        class="w-full bg-slate-900 border border-slate-600 rounded-lg pl-8 pr-12 py-2 text-cyan-400 font-mono text-sm focus:outline-none focus:border-cyan-500"
      />
      <span class="absolute right-3 top-2 text-cyan-500 font-bold text-lg">/g</span>
    </div>
    <div v-if="store.error" class="mt-2 text-red-400 text-sm">⚠ {{ store.error }}</div>
    <textarea
      v-model="localTestString"
      @input="onTestInput"
      placeholder="输入测试字符串..."
      rows="3"
      class="w-full mt-3 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 font-mono text-sm focus:outline-none focus:border-cyan-500 resize-none"
    ></textarea>
    <button @click="execute" class="w-full mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-bold text-sm">执行匹配</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRegexStore } from '../store/regex'

const store = useRegexStore()
const localPattern = ref(store.pattern)
const localTestString = ref(store.testString)

// 模板库等其他入口修改后同步输入框，保持两个入口展示一致
watch(() => store.pattern, v => { if (v !== localPattern.value) localPattern.value = v })
watch(() => store.testString, v => { if (v !== localTestString.value) localTestString.value = v })

let patternTimer: ReturnType<typeof setTimeout>
let testTimer: ReturnType<typeof setTimeout>
function onInput() {
  clearTimeout(patternTimer)
  patternTimer = setTimeout(() => { store.setPattern(localPattern.value) }, 300)
}
function onTestInput() {
  clearTimeout(testTimer)
  testTimer = setTimeout(() => { store.setTestString(localTestString.value) }, 300)
}
// 显式入口：两个输入一次性落库，只执行一次，与模板入口口径一致
function execute() {
  clearTimeout(patternTimer)
  clearTimeout(testTimer)
  store.setInputs(localPattern.value, localTestString.value)
}
</script>
