import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { NFA, MatchResult, MatchStep, RegexTemplate, ASTNode } from '../types'

const GROUP_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

export const TEMPLATES: RegexTemplate[] = [
  { name: '邮箱地址', pattern: '^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$', description: '匹配标准邮箱格式：用户名@域名.顶级域', testString: 'user@example.com admin@mail.org test.user+tag@sub.domain.co.uk', category: '常用' },
  { name: 'URL链接', pattern: '^(https?)://([^/:]+)(?::(\\d+))?(.*)$', description: '匹配HTTP/HTTPS URL：协议://主机:端口/路径', testString: 'https://www.example.com:8080/path/to/page http://localhost:3000/api', category: '常用' },
  { name: 'IPv4地址', pattern: '^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$', description: '匹配IPv4地址四段数字', testString: '192.168.1.1 10.0.0.1 255.255.255.0', category: '常用' },
  { name: '日期格式', pattern: '^(\\d{4})-(\\d{2})-(\\d{2})$', description: '匹配YYYY-MM-DD日期', testString: '2024-01-15 1999-12-31 2025-06-06', category: '常用' },
  { name: '手机号码', pattern: '^1[3-9]\\d{9}$', description: '匹配中国大陆手机号', testString: '13800138000 15912345678 18600000000', category: '常用' },
  { name: '身份证号', pattern: '^(\\d{6})(\\d{4})(\\d{2})(\\d{2})(\\d{3})([0-9Xx])$', description: '18位身份证：地区码+出生日期+顺序码+校验码', testString: '11010119900101001X 440304200512120039', category: '常用' },
  { name: '十六进制颜色', pattern: '^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$', description: '匹配#RGB或#RRGGBB格式', testString: '#FF5733 #abc #1A2B3C ff0000', category: '前端' },
  { name: '邮政编码', pattern: '^\\d{6}$', description: '6位中国邮编', testString: '100000 518000 200120', category: '常用' },
  { name: '浮点数', pattern: '^-?\\d+\\.\\d+$', description: '匹配带小数点的数字', testString: '3.14 -0.5 100.0', category: '数字' },
  { name: '科学计数法', pattern: '^-?\\d+(\\.\\d+)?[eE][+-]?\\d+$', description: '匹配科学计数法数字', testString: '1.5e10 -2.3E-4 6.022e23', category: '数字' },
  { name: 'MAC地址', pattern: '^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$', description: '匹配MAC地址XX:XX:XX:XX:XX:XX', testString: '00:1A:2B:3C:4D:5E AA-BB-CC-DD-EE-FF', category: '网络' },
  { name: 'UUID', pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', description: '标准UUID格式', testString: '550e8400-e29b-41d4-a716-446655440000', category: '网络' },
  { name: 'QQ号', pattern: '^[1-9]\\d{4,10}$', description: '5-11位QQ号', testString: '12345 10000 1234567890', category: '常用' },
  { name: '密码强度', pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$', description: '至少8位含大小写字母数字特殊字符', testString: 'Passw0rd! Str0ng@Pass', category: '安全' },
  { name: '中文姓名', pattern: '^[\\u4e00-\\u9fa5]{2,4}$', description: '2-4位中文字符', testString: '张三 李世明 王小明', category: '常用' },
  { name: '车牌号', pattern: '^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤川青藏琼宁][A-Z][A-HJ-NP-Z0-9]{5}$', description: '中国车牌格式', testString: '京A12345 沪B6789X', category: '常用' },
  { name: 'HTML标签', pattern: '<(\\w+)(\\s[^>]*)?>(.*?)</\\1>', description: '匹配HTML开闭标签对', testString: '<div class="x">content</div> <span>text</span>', category: '前端' },
  { name: '文件扩展名', pattern: '^.+\\.(\\w+)$', description: '提取文件扩展名', testString: 'image.png doc.pdf index.html', category: '前端' },
  { name: '经纬度', pattern: '^(\\-?\\d{1,3}\\.\\d+)\\s*,\\s*(\\-?\\d{1,3}\\.\\d+)$', description: '匹配经纬度坐标', testString: '116.404,39.915 -73.9857,40.7484', category: '地理' },
  { name: '版本号', pattern: '^(\\d+)\\.(\\d+)\\.(\\d+)(?:-(\\w+))?$', description: '语义化版本号x.y.z-tag', testString: '1.0.0 2.3.1-beta 10.20.30', category: '常用' },
  { name: '时间格式', pattern: '^([01]?\\d|2[0-3]):([0-5]\\d)(?::([0-5]\\d))?$', description: 'HH:MM或HH:MM:SS', testString: '14:30 23:59:59 00:00', category: '常用' }
]

interface StateNode {
  id: number
  isAccept: boolean
  transitions: Map<string, number[]>
  epsilonTransitions: number[]
}

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[] } {
  const states: StateNode[] = []
  let stateCounter = 0
  let pos = 0
  let groupCount = 0

  function newState(): number {
    const id = stateCounter++
    states.push({ id, isAccept: false, transitions: new Map(), epsilonTransitions: [] })
    return id
  }

  function addTransition(from: number, symbol: string, to: number) {
    if (!states[from].transitions.has(symbol)) {
      states[from].transitions.set(symbol, [])
    }
    states[from].transitions.get(symbol)!.push(to)
  }

  function addEpsilon(from: number, to: number) {
    states[from].epsilonTransitions.push(to)
  }

  function parseCharClass(): (ch: string) => boolean {
    const negative = pattern[pos] === '^'
    if (negative) pos++
    const ranges: [string, string][] = []
    const chars: string[] = []
    while (pos < pattern.length && pattern[pos] !== ']') {
      if (pattern[pos + 1] === '-' && pattern[pos + 2] && pattern[pos + 2] !== ']') {
        ranges.push([pattern[pos], pattern[pos + 2]])
        pos += 3
      } else {
        chars.push(pattern[pos])
        pos++
      }
    }
    pos++ // skip ]
    return (ch: string) => {
      if (negative) {
        return !chars.includes(ch) && !ranges.some(([s, e]) => ch >= s && ch <= e)
      }
      return chars.includes(ch) || ranges.some(([s, e]) => ch >= s && ch <= e)
    }
  }

  function parseConcat(): [number, number] {
    let start = newState()
    let end = start
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      let segStart: number, segEnd: number
      const ch = pattern[pos]
      if (ch === '(') {
        pos++
        groupCount++
        if (pattern[pos] === '?') {
          pos++
          if (pattern[pos] === ':') { pos++; }
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        } else {
          const [s, e] = parseOr()
          segStart = s; segEnd = e
        }
        pos++ // skip )
      } else if (ch === '[') {
        pos++
        segStart = newState()
        segEnd = newState()
        const matcher = parseCharClass()
        addTransition(segStart, '__class_' + segStart, segEnd)
        ;(states[segEnd] as any)._matcher = matcher
      } else if (ch === '.') {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, '__dot', segEnd)
        pos++
      } else if (ch === '\\') {
        pos++
        const escaped = pattern[pos]
        segStart = newState()
        segEnd = newState()
        if (escaped === 'd') addTransition(segStart, '__digit', segEnd)
        else if (escaped === 'w') addTransition(segStart, '__word', segEnd)
        else if (escaped === 's') addTransition(segStart, '__space', segEnd)
        else addTransition(segStart, escaped, segEnd)
        pos++
      } else if (ch === '^' || ch === '$') {
        segStart = newState()
        segEnd = segStart
        pos++
      } else {
        segStart = newState()
        segEnd = newState()
        addTransition(segStart, ch, segEnd)
        pos++
      }

      // Handle quantifiers
      while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
        const q = pattern[pos]
        if (q === '{') {
          while (pos < pattern.length && pattern[pos] !== '}') pos++
          pos++
        } else {
          pos++
        }
        const qStart = newState()
        const qEnd = newState()
        addEpsilon(qStart, segStart)
        if (q === '*') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '+') { addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
        else if (q === '?') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd) }
        segStart = qStart; segEnd = qEnd
        if (pos < pattern.length && pattern[pos] === '?') pos++ // lazy
      }

      if (end !== segStart) addEpsilon(end, segStart)
      end = segEnd
    }
    return [start, end]
  }

  function parseOr(): [number, number] {
    const [s1, e1] = parseConcat()
    let start = s1, end = e1
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const [s2, e2] = parseConcat()
      const ns = newState(), ne = newState()
      addEpsilon(ns, start); addEpsilon(ns, s2)
      addEpsilon(end, ne); addEpsilon(e2, ne)
      start = ns; end = ne
    }
    return [start, end]
  }

  const [startState, acceptState] = parseOr()
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState] }
}

function epsilonClosure(states: StateNode[], stateId: number): Set<number> {
  const closure = new Set<number>([stateId])
  const stack = [stateId]
  while (stack.length) {
    const s = stack.pop()!
    for (const next of states[s].epsilonTransitions) {
      if (!closure.has(next)) {
        closure.add(next)
        stack.push(next)
      }
    }
  }
  return closure
}

function matchTransition(state: StateNode, symbol: string): number[] {
  const results: number[] = []
  for (const [sym, targets] of state.transitions) {
    if (sym === symbol) { results.push(...targets); continue }
    if (sym === '__dot' && symbol !== '\n') { results.push(...targets); continue }
    if (sym === '__digit' && /\d/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__word' && /\w/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__space' && /\s/.test(symbol)) { results.push(...targets); continue }
    if (sym.startsWith('__class_')) {
      const matcher = (state as any)._matcher
      if (matcher && matcher(symbol)) results.push(...targets)
    }
  }
  return results
}

function runMatch(states: StateNode[], startState: number, input: string): MatchResult {
  const startTime = performance.now()
  const steps: MatchStep[] = []

  // 统一口径：总步数 = 步骤列表长度；回溯次数 = 列表中回溯步骤数。
  // 二者均由 steps 派生，保证统计卡与步骤列表永远一致。
  function finish(matched: boolean, matchStart: number, matchEnd: number): MatchResult {
    return {
      matched,
      matchText: matched ? input.substring(matchStart, matchEnd) : '',
      groups: matched ? [input.substring(matchStart, matchEnd)] : [],
      steps,
      backtracks: steps.reduce((n, s) => n + (s.isBacktrack ? 1 : 0), 0),
      totalSteps: steps.length,
      duration: Math.round((performance.now() - startTime) * 100) / 100
    }
  }

  // Try to match from each position
  for (let startPos = 0; startPos <= input.length; startPos++) {
    let currentStates = Array.from(epsilonClosure(states, startState))
    let matched = false
    let matchEnd = startPos

    for (let i = startPos; i < input.length; i++) {
      const char = input[i]
      const nextStates: number[] = []
      const seen = new Set<number>()

      for (const s of currentStates) {
        const targets = matchTransition(states[s], char)
        for (const t of targets) {
          const closure = epsilonClosure(states, t)
          for (const c of closure) {
            if (!seen.has(c)) {
              seen.add(c)
              nextStates.push(c)
              steps.push({
                stepIndex: steps.length,
                charIndex: i,
                char,
                currentState: s,
                nextState: c,
                transition: char,
                isBacktrack: false,
                isMatch: true
              })
            }
          }
        }
      }

      if (nextStates.length === 0) {
        if (currentStates.some(s => states[s].isAccept)) { matched = true; matchEnd = i; break }
        steps.push({
          stepIndex: steps.length,
          charIndex: i,
          char,
          currentState: currentStates[0] ?? -1,
          nextState: -1,
          transition: 'FAIL',
          isBacktrack: true,
          isMatch: false
        })
        break
      }
      currentStates = nextStates
      if (currentStates.some(s => states[s].isAccept)) { matched = true; matchEnd = i + 1 }
    }

    if (matched || (startPos === input.length && currentStates.some(s => states[s].isAccept))) {
      return finish(true, startPos, matchEnd)
    }
  }

  return finish(false, 0, 0)
}

export function computeNFA(nfaResult: ReturnType<typeof buildNFA>): NFA {
  const nodes = nfaResult.states.map((s, i) => ({
    id: s.id,
    isStart: i === nfaResult.startState,
    isAccept: nfaResult.acceptStates.includes(s.id),
    x: 0, y: 0
  }))

  // Layout: circular
  const cx = 400, cy = 300, radius = 200
  nodes.forEach((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2
    n.x = cx + Math.cos(angle) * radius
    n.y = cy + Math.sin(angle) * radius
  })

  const transitions: any[] = []
  nfaResult.states.forEach(s => {
    s.transitions.forEach((targets, symbol) => {
      targets.forEach(t => {
        transitions.push({ from: s.id, to: t, symbol: symbol.startsWith('__') ? symbol.replace('__', '') : symbol, label: symbol.startsWith('__') ? symbol.replace('__', '') : symbol })
      })
    })
    s.epsilonTransitions.forEach(t => {
      transitions.push({ from: s.id, to: t, symbol: null, label: 'ε' })
    })
  })

  return { states: nodes, transitions, startState: nfaResult.startState, acceptStates: nfaResult.acceptStates }
}

export function parseAST(pattern: string): ASTNode {
  let pos = 0
  let groupIdx = 0

  function parseAtom(): ASTNode {
    const ch = pattern[pos]
    if (ch === '(') {
      pos++
      if (pattern[pos] === '?') { pos++; if (pattern[pos] === ':') pos++ }
      else groupIdx++
      const node = parseOr()
      if (pattern[pos] === ')') pos++
      return { type: 'group', children: [node], groupIndex: groupIdx }
    }
    if (ch === '[') {
      pos++
      let cls = ''
      while (pos < pattern.length && pattern[pos] !== ']') { cls += pattern[pos]; pos++ }
      pos++
      return { type: 'charclass', value: cls }
    }
    if (ch === '.') { pos++; return { type: 'dot' } }
    if (ch === '\\') {
      pos++
      const e = pattern[pos]; pos++
      if (e === 'd') return { type: 'digit' }
      if (e === 'w') return { type: 'word' }
      if (e === 's') return { type: 'space' }
      return { type: 'char', value: e }
    }
    if (ch === '^' || ch === '$') { pos++; return { type: 'anchor', value: ch } }
    pos++
    return { type: 'char', value: ch }
  }

  function parseQuantifier(): ASTNode {
    let node = parseAtom()
    while (pos < pattern.length && ['*', '+', '?', '{'].includes(pattern[pos])) {
      const q = pattern[pos]
      if (q === '{') {
        while (pos < pattern.length && pattern[pos] !== '}') pos++
        pos++
      } else {
        pos++
      }
      const type = q === '*' ? 'star' : q === '+' ? 'plus' : 'question'
      node = { type, children: [node] }
      if (pos < pattern.length && pattern[pos] === '?') pos++
    }
    return node
  }

  function parseConcat(): ASTNode {
    const nodes: ASTNode[] = []
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      nodes.push(parseQuantifier())
    }
    if (nodes.length === 1) return nodes[0]
    return { type: 'concat', children: nodes }
  }

  function parseOr(): ASTNode {
    let left = parseConcat()
    while (pos < pattern.length && pattern[pos] === '|') {
      pos++
      const right = parseConcat()
      left = { type: 'or', children: [left, right] }
    }
    return left
  }

  return parseOr()
}

// 空结果/解析失败的零状态：数字一律为 0、步骤列表为空，旧数据不残留。
const EMPTY_RESULT: MatchResult = {
  matched: false,
  matchText: '',
  groups: [],
  steps: [],
  backtracks: 0,
  totalSteps: 0,
  duration: 0
}

// 播放速度档位（倍数 -> 单步间隔 ms），为唯一口径，UI 与定时器共用
export const PLAYBACK_SPEEDS = [
  { label: '0.5x', value: 0.5, delay: 400 },
  { label: '1x', value: 1, delay: 200 },
  { label: '2x', value: 2, delay: 100 },
  { label: '4x', value: 4, delay: 50 }
]
const DEFAULT_SPEED = 1

export const useRegexStore = defineStore('regex', () => {
  const pattern = ref('^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$')
  const testString = ref('user@example.com admin@mail.org invalid-email')
  const currentStep = ref(0)
  const isPlaying = ref(false)
  const playSpeed = ref(DEFAULT_SPEED)
  const nfa = ref<NFA | null>(null)
  const matchResult = ref<MatchResult>({ ...EMPTY_RESULT, steps: [] })
  const ast = ref<ASTNode | null>(null)
  const error = ref('')
  const selectedTemplate = ref<string>('')

  // 全程只允许存在一个播放定时器，避免暂停后统计继续增长
  let playTimer: ReturnType<typeof setInterval> | null = null

  const groupColors = GROUP_COLORS

  const totalSteps = computed(() => matchResult.value.steps.length)
  const hasSteps = computed(() => totalSteps.value > 0)
  const canStepForward = computed(() => hasSteps.value && currentStep.value < totalSteps.value - 1)
  const canStepBackward = computed(() => currentStep.value > 0)
  const activeStep = computed(() => matchResult.value.steps[currentStep.value] ?? null)

  const matchHighlight = computed(() => {
    if (!matchResult.value.matched) return null
    const matchText = matchResult.value.matchText
    const idx = testString.value.indexOf(matchText)
    if (idx === -1) return null
    return {
      before: testString.value.substring(0, idx),
      match: matchText,
      after: testString.value.substring(idx + matchText.length)
    }
  })

  function clearPlayTimer() {
    if (playTimer !== null) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  // 每次执行：先停止播放并重置全部统计，再从零累计
  function execute() {
    clearPlayTimer()
    isPlaying.value = false
    currentStep.value = 0
    error.value = ''
    nfa.value = null
    ast.value = null
    matchResult.value = { ...EMPTY_RESULT, steps: [] }

    let built: ReturnType<typeof buildNFA>
    try {
      built = buildNFA(pattern.value)
    } catch (e: any) {
      error.value = e?.message || '正则表达式解析错误'
      return
    }
    try {
      nfa.value = computeNFA(built)
      matchResult.value = runMatch(built.states, built.startState, testString.value)
      ast.value = parseAST(pattern.value)
    } catch {
      // 计算/解析失败同样落零状态，不保留上一轮数字
      nfa.value = null
      ast.value = null
      matchResult.value = { ...EMPTY_RESULT, steps: [] }
      error.value = error.value || '正则表达式解析错误'
    }
  }

  // 统一入口：两个输入都落库后只执行一次，保证结果面板与编辑器入口一致
  function setInputs(p: string, s: string) {
    pattern.value = p
    testString.value = s
    execute()
  }

  function setPattern(p: string) {
    pattern.value = p
    execute()
  }

  function setTestString(s: string) {
    testString.value = s
    execute()
  }

  function applyTemplate(t: RegexTemplate) {
    selectedTemplate.value = t.name
    setInputs(t.pattern, t.testString)
  }

  function stepForward() {
    if (canStepForward.value) currentStep.value++
  }

  function stepBackward() {
    if (canStepBackward.value) currentStep.value--
  }

  function resetStep() {
    clearPlayTimer()
    isPlaying.value = false
    currentStep.value = 0
  }

  // 仅在真实推进时 currentStep +1；到末位立即停止，数字不再变化
  function startTimer() {
    clearPlayTimer()
    const speed = PLAYBACK_SPEEDS.find(s => s.value === playSpeed.value) ?? PLAYBACK_SPEEDS[1]
    playTimer = setInterval(() => {
      if (currentStep.value < totalSteps.value - 1) {
        currentStep.value++
      } else {
        pause()
      }
    }, speed.delay)
  }

  function play() {
    if (isPlaying.value || !hasSteps.value) return
    isPlaying.value = true
    startTimer()
  }

  function pause() {
    isPlaying.value = false
    clearPlayTimer()
  }

  // 调整速度不重置进度；播放中即时按新速度推进，暂停中仅记录档位
  function setSpeed(value: number) {
    playSpeed.value = value
    if (isPlaying.value) startTimer()
  }

  return {
    pattern, testString, currentStep, isPlaying, playSpeed, nfa, matchResult, ast, error,
    selectedTemplate, groupColors, matchHighlight,
    totalSteps, hasSteps, canStepForward, canStepBackward, activeStep,
    execute, setInputs, setPattern, setTestString, applyTemplate,
    stepForward, stepBackward, resetStep, play, pause, setSpeed
  }
})
