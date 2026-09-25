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
  groupStart?: number // 捕获组边界：进入该状态表示组开始
  groupEnd?: number   // 捕获组边界：到达该状态表示组结束
}

// 前瞻断言 (?=…) / (?!…)：作为独立子 NFA，在主匹配相应位置做前缀校验
interface Lookahead {
  index: number        // 断言挂在主链上的位置（主模式字符下标，0 表示紧跟 ^ 之后）
  negative: boolean
  states: StateNode[]
  startState: number
  acceptStates: number[]
}

function buildNFA(pattern: string): { states: StateNode[]; startState: number; acceptStates: number[]; lookaheads: Lookahead[]; groupCount: number } {
  const states: StateNode[] = []
  let stateCounter = 0
  let pos = 0
  let groupCount = 0
  const lookaheads: Lookahead[] = []

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

  // 区间重复 {min,max}：串联 min 份必需片段 + (max-min) 份可选片段；{n,} 末尾以自环表示无限重复
  function applyRepeat(fromStart: number, fromEnd: number, min: number, max: number): [number, number] {
    const chainStart = newState()
    let cursor = chainStart

    // 必需的 min 份
    for (let i = 0; i < min; i++) {
      const [copyStart, copyEnd] = duplicateFragment(fromStart, fromEnd)
      addEpsilon(cursor, copyStart)
      cursor = copyEnd
    }

    if (max === Infinity) {
      // 再附一份可自环重复的片段，并允许直接结束
      const [loopStart, loopEnd] = duplicateFragment(fromStart, fromEnd)
      addEpsilon(cursor, loopStart)
      addEpsilon(loopEnd, loopStart)
      const chainEnd = newState()
      addEpsilon(loopEnd, chainEnd)
      addEpsilon(cursor, chainEnd)
      return [chainStart, chainEnd]
    }

    // 可选的 (max-min) 份：消费或跳过
    for (let i = min; i < max; i++) {
      const [copyStart, copyEnd] = duplicateFragment(fromStart, fromEnd)
      addEpsilon(cursor, copyStart)
      addEpsilon(cursor, copyEnd)
      cursor = copyEnd
    }
    const chainEnd = newState()
    addEpsilon(cursor, chainEnd)
    return [chainStart, chainEnd]
  }

  // 深拷贝一个 NFA 片段（含字符转移、字符类 matcher 与 ε 转移），返回新片段的 [起点, 终点]
  function duplicateFragment(srcStart: number, srcEnd: number): [number, number] {
    // 量化时片段尚未与外层链接，从起点沿全部边可达的状态即片段全集
    const oldIds: number[] = []
    const seen = new Set<number>([srcStart])
    const queue = [srcStart]
    while (queue.length) {
      const id = queue.shift()!
      oldIds.push(id)
      for (const e of states[id].epsilonTransitions) {
        if (!seen.has(e)) { seen.add(e); queue.push(e) }
      }
      for (const targets of states[id].transitions.values()) {
        for (const t of targets) if (!seen.has(t)) { seen.add(t); queue.push(t) }
      }
    }

    const remap = new Map<number, number>()
    for (const id of oldIds) {
      const newId = newState()
      states[newId].groupStart = states[id].groupStart
      states[newId].groupEnd = states[id].groupEnd
      remap.set(id, newId)
    }

    for (const id of oldIds) {
      const newId = remap.get(id)!
      const s = states[id]
      s.transitions.forEach((targets, symbol) => {
        for (const t of targets) {
          addTransition(newId, symbol, remap.get(t)!)
          if (symbol.startsWith('__class_')) (states[newId] as any)._matcher = (s as any)._matcher
          if (symbol === '__backref') (states[newId] as any)._backref = (s as any)._backref
        }
      })
      for (const e of s.epsilonTransitions) addEpsilon(newId, remap.get(e)!)
    }
    return [remap.get(srcStart)!, remap.get(srcEnd)!]
  }

  function parseCharClass(): (ch: string) => boolean {
    const negative = pattern[pos] === '^'
    if (negative) pos++
    const ranges: [string, string][] = []
    const chars: string[] = []
    const predicates: ((ch: string) => boolean)[] = []

    const readEscape = (): string => {
      const e = pattern[pos]
      if (e === 'u' && /^[0-9a-fA-F]{4}$/.test(pattern.substring(pos + 1, pos + 5))) {
        const code = parseInt(pattern.substring(pos + 1, pos + 5), 16)
        pos += 5
        return String.fromCharCode(code)
      }
      pos += 2
      return e
    }
    const nextAtom = (): { type: 'char'; ch: string; pred?: (ch: string) => boolean } => {
      if (pattern[pos] === '\\') {
        pos++
        const e = pattern[pos]
        if (e === 'd') { pos++; return { type: 'char', ch: '', pred: c => /\d/.test(c) } }
        if (e === 'w') { pos++; return { type: 'char', ch: '', pred: c => /\w/.test(c) } }
        if (e === 's') { pos++; return { type: 'char', ch: '', pred: c => /\s/.test(c) } }
        return { type: 'char', ch: readEscape() }
      }
      const c = pattern[pos]
      pos++
      return { type: 'char', ch: c }
    }

    while (pos < pattern.length && pattern[pos] !== ']') {
      const atom = nextAtom()
      if (pattern[pos] === '-' && pattern[pos + 1] && pattern[pos + 1] !== ']') {
        pos++ // consume -
        const endAtom = nextAtom()
        if (atom.ch && endAtom.ch) ranges.push([atom.ch, endAtom.ch])
        else if (atom.pred) predicates.push(atom.pred)
      } else if (atom.pred) {
        predicates.push(atom.pred)
      } else {
        chars.push(atom.ch)
      }
    }
    pos++ // skip ]
    const matchOne = (ch: string) =>
      chars.includes(ch) || ranges.some(([s, e]) => ch >= s && ch <= e) || predicates.some(p => p(ch))
    return negative ? (ch: string) => !matchOne(ch) : matchOne
  }

  function parseConcat(): [number, number] {
    let start = newState()
    let end = start
    while (pos < pattern.length && !['|', ')'].includes(pattern[pos])) {
      let segStart: number, segEnd: number
      const ch = pattern[pos]
      if (ch === '(') {
        pos++
        if (pattern[pos] === '?') {
          pos++
          if (pattern[pos] === ':') {
            // 非捕获组 (?:…)
            pos++
            const [s, e] = parseOr()
            segStart = s; segEnd = e
            pos++ // skip )
          } else if (pattern[pos] === '=' || pattern[pos] === '!') {
            // 前瞻断言 (?=…) / (?!…)：零宽，不进入主 NFA；仅支持锚点处（位置 0）断言
            const negative = pattern[pos] === '!'
            pos++
            const sub = buildSubNFA()
            lookaheads.push({ index: 0, negative, ...sub })
            segStart = end
            segEnd = end
            pos++ // skip )
          } else {
            const [s, e] = parseOr()
            segStart = s; segEnd = e
            pos++ // skip )
          }
        } else {
          // 捕获组：用边界状态包住片段，运行时据此记录组起止
          groupCount++
          const gIndex = groupCount
          const [s, e] = parseOr()
          const gStart = newState()
          const gEnd = newState()
          states[gStart].groupStart = gIndex
          states[gEnd].groupEnd = gIndex
          addEpsilon(gStart, s)
          addEpsilon(e, gEnd)
          segStart = gStart; segEnd = gEnd
          pos++ // skip )
        }
      } else if (ch === '[') {
        pos++
        segStart = newState()
        segEnd = newState()
        const matcher = parseCharClass()
        addTransition(segStart, '__class_' + segStart, segEnd)
        // matcher 必须挂在转移的源状态上，匹配时才能从当前状态取到
        ;(states[segStart] as any)._matcher = matcher
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
        if (escaped === 'd') { addTransition(segStart, '__digit', segEnd); pos++ }
        else if (escaped === 'w') { addTransition(segStart, '__word', segEnd); pos++ }
        else if (escaped === 's') { addTransition(segStart, '__space', segEnd); pos++ }
        else if (escaped === 'u' && /^[0-9a-fA-F]{4}$/.test(pattern.substring(pos + 1, pos + 5))) {
          addTransition(segStart, String.fromCharCode(parseInt(pattern.substring(pos + 1, pos + 5), 16)), segEnd)
          pos += 5
        } else if (escaped && /[1-9]/.test(escaped)) {
          // 反向引用 \1：运行时按已捕获组文本逐字符推进
          ;(states[segStart] as any)._backref = Number(escaped)
          addTransition(segStart, '__backref', segEnd)
          pos++
        } else { addTransition(segStart, escaped, segEnd); pos++ }
      } else if (ch === '^' || ch === '$') {
        // 锚点不消耗字符：复用当前链端点，避免产生断链孤立状态
        segStart = end
        segEnd = end
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
          // 解析 {n} / {n,} / {n,m}；非法时回退为普通字符，不当作量词
          const braceEnd = pattern.indexOf('}', pos + 1)
          if (braceEnd === -1) break
          const spec = pattern.substring(pos + 1, braceEnd)
          const parts = spec.split(',')
          let min: number, max: number
          if (parts.length === 1 && /^\d+$/.test(parts[0])) {
            min = max = Number(parts[0])
          } else if (parts.length === 2 && /^\d+$/.test(parts[0])) {
            min = Number(parts[0])
            max = parts[1] === '' ? Infinity : Number(parts[1])
          } else {
            break
          }
          pos = braceEnd + 1
          ;[segStart, segEnd] = applyRepeat(segStart, segEnd, min, max)
        } else {
          pos++
          const qStart = newState()
          const qEnd = newState()
          addEpsilon(qStart, segStart)
          if (q === '*') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
          else if (q === '+') { addEpsilon(segEnd, qEnd); addEpsilon(segEnd, segStart) }
          else if (q === '?') { addEpsilon(qStart, qEnd); addEpsilon(segEnd, qEnd) }
          segStart = qStart; segEnd = qEnd
        }
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

  // 前瞻子表达式：递归构建独立 NFA（独立状态空间，避免与主图冲突）
  function buildSubNFA(): { states: StateNode[]; startState: number; acceptStates: number[] } {
    const subPatternStart = pos
    let depth = 1
    while (pos < pattern.length && depth > 0) {
      if (pattern[pos] === '\\') { pos += 2; continue }
      if (pattern[pos] === '(') depth++
      if (pattern[pos] === ')') depth--
      if (depth === 0) break
      pos++
    }
    const subPattern = pattern.substring(subPatternStart, pos)
    const sub = buildNFA(subPattern)
    return { states: sub.states, startState: sub.startState, acceptStates: sub.acceptStates }
  }

  const [startState, acceptState] = parseOr()
  states[acceptState].isAccept = true
  return { states, startState, acceptStates: [acceptState], lookaheads, groupCount }
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

function matchTransition(state: StateNode, symbol: string, captured: Map<number, string>): number[] {
  const results: number[] = []
  for (const [sym, targets] of state.transitions) {
    if (sym === symbol) { results.push(...targets); continue }
    if (sym === '__dot' && symbol !== '\n') { results.push(...targets); continue }
    if (sym === '__digit' && /\d/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__word' && /\w/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__space' && /\s/.test(symbol)) { results.push(...targets); continue }
    if (sym === '__backref') {
      // \n：当前字符须等于已捕获组 n 的首字符；逐字符消费在 runMatch 中处理
      const g = (state as any)._backref as number
      const cap = captured.get(g)
      if (cap && cap[0] === symbol) results.push(...targets)
      continue
    }
    if (sym.startsWith('__class_')) {
      const matcher = (state as any)._matcher
      if (matcher && matcher(symbol)) results.push(...targets)
    }
  }
  return results
}

// 统一的零状态：空结果与失败解析均使用此口径，旧数字不残留
export function emptyMatchResult(): MatchResult {
  return {
    matched: false,
    matchText: '',
    groups: [],
    steps: [],
    backtracks: 0,
    totalSteps: 0,
    duration: 0
  }
}

function runMatch(
  states: StateNode[],
  startState: number,
  input: string,
  lookaheads: Lookahead[] = [],
  groupCount = 0
): MatchResult {
  // 每次执行先归零，再累计；steps 是唯一统计来源
  const steps: MatchStep[] = []
  const startTime = performance.now()

  // 前瞻断言：在给定起点做一次独立子 NFA 前缀匹配
  function checkLookaheads(startPos: number): boolean {
    for (const la of lookaheads) {
      if (la.index !== 0) continue
      const ok = prefixMatch(la.states, la.startState, la.acceptStates, input, startPos)
      if (la.negative ? ok : !ok) return false
    }
    return true
  }

  // 沿 ε 闭包寻找含接受态的线程：贪心量词的“跳过”路径会让接受态持续保留在状态集中
  const hasAccept = (set: Iterable<number>) => {
    for (const id of set) if (states[id].isAccept) return true
    return false
  }

  const finish = (matched: boolean, matchText: string, groups: string[] = []): MatchResult => {
    // 所有统计数字统一从 steps 派生，保证回溯次数、总步数与步骤列表口径一致
    return {
      matched,
      matchText,
      groups: matched ? [matchText, ...groups] : [],
      steps,
      backtracks: steps.filter(s => s.isBacktrack).length,
      totalSteps: steps.length,
      // 零结果（未尝试任何步骤）统一展示零耗时，不残留本次测量值
      duration: steps.length === 0 ? 0 : Math.round((performance.now() - startTime) * 100) / 100
    }
  }

  // Try to match from each position
  for (let startPos = 0; startPos <= input.length; startPos++) {
    if (!checkLookaheads(startPos)) continue

    // 该起点的捕获组记录：groupIndex -> [起始下标, 结束下标)
    const capturedRanges = new Map<number, [number, number]>()
    const capturedText = new Map<number, string>()
    let currentStates = Array.from(epsilonClosure(states, startState))
    // 贪心语义：记录状态集曾含接受态的最远位置（零宽接受时为 startPos）
    let bestAcceptPos = -1
    let bestRanges: Map<number, [number, number]> | null = null
    const rememberAccept = (endPos: number) => {
      if (endPos > bestAcceptPos) {
        bestAcceptPos = endPos
        bestRanges = new Map(capturedRanges)
      }
    }
    const applyBoundaries = (set: Set<number>, charIdx: number, entering: boolean) => {
      for (const id of set) {
        const s = states[id]
        if (entering && s.groupStart !== undefined && !capturedRanges.has(s.groupStart)) {
          capturedRanges.set(s.groupStart, [charIdx, charIdx])
        }
        if (!entering && s.groupEnd !== undefined) {
          const r = capturedRanges.get(s.groupEnd)
          if (r) capturedRanges.set(s.groupEnd, [r[0], charIdx])
        }
      }
    }
    applyBoundaries(new Set(currentStates), startPos, true)
    if (hasAccept(currentStates)) rememberAccept(startPos)

    // 起始即接受且输入为空（如空模式 / a* 对零长输入）
    if (startPos === input.length && hasAccept(currentStates)) {
      const groups = finalizeGroups(capturedRanges, input, groupCount)
      return finish(true, input.substring(startPos, startPos), groups)
    }

    for (let i = startPos; i < input.length; i++) {
      const char = input[i]
      const nextStates: number[] = []
      const seen = new Set<number>()
      let liveThreads = false   // 本字符是否有转移成功的并行线程
      let backrefConsume = 0   // 反向引用本次消费的额外字符数

      for (const s of currentStates) {
        const targets = matchTransition(states[s], char, capturedText)
        if (targets.length === 0) continue
        liveThreads = true

        for (const t of targets) {
          // 反向引用：要求捕获文本逐字符完整匹配，一次消费多个字符
          if ((states[s] as any)._backref !== undefined) {
            const g = (states[s] as any)._backref as number
            const cap = capturedText.get(g)
            if (cap && input.startsWith(cap, i)) {
              for (let k = 0; k < cap.length; k++) {
                steps.push({
                  stepIndex: steps.length, charIndex: i + k, char: cap[k],
                  currentState: k === 0 ? s : t, nextState: t,
                  transition: '\\' + g, isBacktrack: false, isMatch: true
                })
              }
              const closure = epsilonClosure(states, t)
              for (const c of closure) if (!seen.has(c)) { seen.add(c); nextStates.push(c) }
              backrefConsume = Math.max(backrefConsume, cap.length - 1)
            }
            continue
          }

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

      // 部分线程死亡但仍有存活线程：剪枝继续推进（贪心回溯由并行线程承担），不计回溯步骤
      if (!liveThreads) {
        // 全部线程走进死路：用本起点曾到达的最远接受位置作为贪心命中
        if (bestAcceptPos >= 0) {
          const groups = finalizeGroups(bestRanges!, input, groupCount)
          return finish(true, input.substring(startPos, bestAcceptPos), groups)
        }
        steps.push({
          stepIndex: steps.length,
          charIndex: i,
          char,
          currentState: currentStates[0] || -1,
          nextState: -1,
          transition: 'FAIL',
          isBacktrack: true,
          isMatch: false
        })
        break
      }

      // 用新一轮状态集更新捕获边界并刷新捕获文本
      applyBoundaries(seen, i + 1, true)
      currentStates = nextStates
      applyBoundaries(new Set(currentStates), i + backrefConsume + 1, false)
      capturedRanges.forEach(([a, b], g) => capturedText.set(g, input.substring(a, b)))

      i += backrefConsume // 反向引用已跨过多个字符

      // 记录当前可达的最远接受位置；输入耗尽时即为最终命中
      if (hasAccept(currentStates)) {
        rememberAccept(i + 1)
        if (i >= input.length - 1) {
          const groups = finalizeGroups(capturedRanges, input, groupCount)
          return finish(true, input.substring(startPos, i + 1), groups)
        }
      }
    }

    // 循环正常结束（零步推进等）：若曾有接受态，按最远位置返回
    if (bestAcceptPos >= 0) {
      const groups = finalizeGroups(bestRanges!, input, groupCount)
      return finish(true, input.substring(startPos, bestAcceptPos), groups)
    }
  }

  return finish(false, '')
}

// 按组序号输出捕获文本；未参与本轮捕获的组用空串占位
function finalizeGroups(ranges: Map<number, [number, number]>, input: string, groupCount: number): string[] {
  const out: string[] = []
  for (let g = 1; g <= groupCount; g++) {
    const r = ranges.get(g)
    out.push(r ? input.substring(r[0], r[1]) : '')
  }
  return out
}

// 前瞻子 NFA 的前缀匹配：不记录步骤，仅判定从 startPos 起能否到达接受态（取曾到达的最远接受位置）
function prefixMatch(
  subStates: StateNode[], startState: number, acceptStates: number[],
  input: string, startPos: number
): boolean {
  const accepts = new Set(acceptStates)
  let current = Array.from(epsilonClosure(subStates, startState))
  if (current.some(s => accepts.has(s))) return true
  for (let i = startPos; i < input.length; i++) {
    const next: number[] = []
    const seen = new Set<number>()
    let live = false
    for (const s of current) {
      const targets = matchTransition(subStates[s], input[i], new Map())
      if (targets.length > 0) live = true
      for (const t of targets) {
        for (const c of epsilonClosure(subStates, t)) {
          if (!seen.has(c)) { seen.add(c); next.push(c) }
        }
      }
    }
    if (next.some(c => accepts.has(c))) return true
    if (!live) return false
    current = next
  }
  return false
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

// 播放速度档位（倍数 → 每步间隔 ms），播放/暂停/调速共用同一口径
export const PLAYBACK_SPEEDS = [0.5, 1, 2, 4]
const SPEED_INTERVAL_MS: Record<number, number> = { 0.5: 400, 1: 200, 2: 100, 4: 50 }

export const useRegexStore = defineStore('regex', () => {
  const pattern = ref('^([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+)\\.([a-zA-Z]{2,})$')
  const testString = ref('user@example.com admin@mail.org invalid-email')
  const currentStep = ref(0)
  const isPlaying = ref(false)
  const playbackSpeed = ref(1)
  const nfa = ref<NFA | null>(null)
  const matchResult = ref<MatchResult>(emptyMatchResult())
  const ast = ref<ASTNode | null>(null)
  const error = ref('')
  const selectedTemplate = ref<string>('')

  const groupColors = GROUP_COLORS

  let playTimer: ReturnType<typeof setInterval> | null = null

  function clearPlayTimer() {
    if (playTimer !== null) {
      clearInterval(playTimer)
      playTimer = null
    }
  }

  const matchHighlight = computed(() => {
    if (!matchResult.value || !matchResult.value.matched) return null
    const matchText = matchResult.value.matchText
    const idx = testString.value.indexOf(matchText)
    if (idx === -1) return null
    return {
      before: testString.value.substring(0, idx),
      match: matchText,
      after: testString.value.substring(idx + matchText.length)
    }
  })

  // 每次执行先归零再累计；空输入、空结果、失败解析统一显示零状态
  function execute() {
    clearPlayTimer()
    isPlaying.value = false
    currentStep.value = 0
    error.value = ''

    const trimmedPattern = pattern.value.trim()
    if (!trimmedPattern) {
      nfa.value = null
      ast.value = null
      matchResult.value = emptyMatchResult()
      return
    }

    try {
      const built = buildNFA(trimmedPattern)
      nfa.value = computeNFA(built)
      ast.value = parseAST(trimmedPattern)
      matchResult.value = runMatch(
        built.states, built.startState, testString.value,
        built.lookaheads, built.groupCount
      )
    } catch (e: any) {
      error.value = e?.message || '正则表达式解析错误'
      nfa.value = null
      ast.value = null
      matchResult.value = emptyMatchResult()
    }
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
    pattern.value = t.pattern
    testString.value = t.testString
    selectedTemplate.value = t.name
    execute()
  }

  // 单步只在真实有步骤可推进时变化；无结果（零状态）时不增长
  function stepForward() {
    clearPlayTimer()
    isPlaying.value = false
    if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
      currentStep.value++
    }
  }

  function stepBackward() {
    clearPlayTimer()
    isPlaying.value = false
    if (currentStep.value > 0) currentStep.value--
  }

  function resetStep() {
    clearPlayTimer()
    isPlaying.value = false
    currentStep.value = 0
  }

  // 播放自然结束后归零，暂停/停止期间统计不增长
  function startTimer() {
    clearPlayTimer()
    playTimer = setInterval(() => {
      if (matchResult.value && currentStep.value < matchResult.value.steps.length - 1) {
        currentStep.value++
      } else {
        clearPlayTimer()
        isPlaying.value = false
        currentStep.value = 0
      }
    }, SPEED_INTERVAL_MS[playbackSpeed.value] ?? 200)
  }

  function play() {
    if (!matchResult.value || matchResult.value.steps.length === 0) return
    isPlaying.value = true
    startTimer()
  }

  function stop() {
    clearPlayTimer()
    isPlaying.value = false
  }

  // 播放中调速：仅重置节拍，步骤位置与统计保持不变
  function setPlaybackSpeed(speed: number) {
    if (!PLAYBACK_SPEEDS.includes(speed)) return
    playbackSpeed.value = speed
    if (isPlaying.value) startTimer()
  }

  return {
    pattern, testString, currentStep, isPlaying, playbackSpeed, nfa, matchResult, ast, error,
    selectedTemplate, groupColors, matchHighlight,
    execute, setPattern, setTestString, applyTemplate,
    stepForward, stepBackward, resetStep, play, stop, setPlaybackSpeed
  }
})
