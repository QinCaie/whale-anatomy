/**
 * Ayu骨架 · host 半
 *
 * 把「她现在由什么组成、哪些正在跑、哪里已经对不上」采成一份 JSON，
 * 由 client 半画成一张可点开的解剖图。
 *
 * 只读：不启停任何插件，不改任何配置。
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

export const name = 'whale-anatomy'
export const inject = ['webServer']

const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const PROFILE = process.env.DSH_PROFILE || 'desktop'
const PROFILE_DIR = process.env.DSH_PROFILE_DIR || path.join(HOME, 'profiles', PROFILE)
const ROOT = 'D:\\Ayu'

const CHANNELS = [
  { id: 'gateway', label: 'DSH 网关', port: 11497, what: '这页面本身' },
  { id: 'snowluma-http', label: 'SnowLuma HTTP', port: 3000, what: 'QQ 收发（HTTP）' },
  { id: 'snowluma-ws', label: 'SnowLuma WS', port: 3001, what: 'QQ 收发（WS）' },
  { id: 'qq-console', label: 'QQ 桥接控制台', port: 3100, what: '桥接面板' },
  { id: 'gsv', label: 'GSV 语音', port: 8769, what: '说话' },
  { id: 'petbrain', label: '桌宠大脑', port: 8899, what: '桌宠动作/气泡' },
  { id: 'stage', label: 'Live2D 舞台', port: 61942, what: '身体画面' },
]

const MCP_PORT = {
  snowluma: 3001,
  phone: null,
  meme: null,
  members: null,
  sandbox: null,
  sing: null,
  vision: null,
  fish: null,
}

function tryGet(ctx, key) {
  try {
    return ctx.get ? ctx.get(key) : undefined
  } catch {
    return undefined
  }
}

function probePort(port, timeout = 450) {
  return new Promise((resolve) => {
    const started = Date.now()
    let done = false
    const finish = (up) => {
      if (done) return
      done = true
      try { socket.destroy() } catch {}
      resolve({ up, ms: Date.now() - started })
    }
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.setTimeout(timeout)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))
  })
}

async function statOf(p) {
  try {
    const st = await fsp.stat(p)
    return {
      exists: true,
      size: st.size,
      mtime: st.mtime.toISOString(),
      ageHours: Math.round(((Date.now() - st.mtime.getTime()) / 3600e3) * 10) / 10,
    }
  } catch {
    return { exists: false }
  }
}

async function dirStats(p, cap = 4000) {
  const out = { exists: false, files: 0, bytes: 0, capped: false }
  let queue = [p]
  let seen = 0
  while (queue.length) {
    const dir = queue.shift()
    let items
    try {
      items = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    out.exists = true
    for (const item of items) {
      if (seen++ > cap) {
        out.capped = true
        return out
      }
      const full = path.join(dir, item.name)
      if (item.isDirectory()) queue.push(full)
      else if (item.isFile()) {
        try {
          const st = await fsp.stat(full)
          out.files += 1
          out.bytes += st.size
        } catch {}
      }
    }
  }
  return out
}

function kb(bytes) {
  if (!bytes) return '0'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function countLines(text) {
  return text.split(/\r?\n/).filter((line) => line.trim() && !line.trim().startsWith('#')).length
}

async function readText(p, limit = 200000) {
  try {
    const text = await fsp.readFile(p, 'utf8')
    return text.length > limit ? text.slice(0, limit) : text
  } catch {
    return ''
  }
}

function groupTools(defs) {
  const builtin = []
  const mcp = new Map()
  for (const def of defs) {
    const toolName = String(def?.name ?? '')
    if (!toolName) continue
    const hit = /^mcp__([a-z0-9_-]+)__/i.exec(toolName)
    if (hit) {
      const server = hit[1]
      if (!mcp.has(server)) mcp.set(server, [])
      mcp.get(server).push(toolName)
    } else {
      builtin.push(toolName)
    }
  }
  return { builtin, mcp }
}

function promptBlocks(sections) {
  const blocks = []
  for (const section of sections) {
    const label = String(section?.name ?? section?.id ?? section?.kind ?? section?.label ?? 'block')
    const body = section?.text ?? section?.content ?? section?.body ?? section?.value ?? section?.prompt
    const text = typeof body === 'string' ? body : JSON.stringify(body ?? '')
    blocks.push({ label, chars: text.length, head: text.slice(0, 70) })
  }
  blocks.sort((a, b) => b.chars - a.chars)
  return blocks
}

function summarizePrompt(assembly) {
  if (!assembly || typeof assembly !== 'object') return null
  const groups = []
  for (const key of ['sections', 'context', 'blocks', 'prompt', 'persona', 'tools']) {
    const value = assembly[key]
    if (!Array.isArray(value) || !value.length) continue
    const blocks = promptBlocks(value)
    groups.push({
      key,
      count: blocks.length,
      total: blocks.reduce((sum, block) => sum + block.chars, 0),
      blocks: blocks.slice(0, 24),
    })
  }
  if (!groups.length) {
    return { error: '拿不到固定块', keys: Object.keys(assembly).slice(0, 16) }
  }
  groups.sort((a, b) => b.total - a.total)
  return {
    groups,
    total: groups.reduce((sum, group) => sum + group.total, 0),
    assemblyKeys: Object.keys(assembly).slice(0, 16),
  }
}

export function apply(ctx) {
  let cache = null
  let cacheAt = 0

  async function collect() {
    const started = Date.now()
    const layers = []
    const conflicts = []
    const push = (layer) => layers.push(layer)

    // ---- 工具 ----
    const toolsSvc = tryGet(ctx, 'tools')
    let defs = []
    try {
      defs = toolsSvc?.definitions?.() ?? []
    } catch {}
    const { builtin, mcp } = groupTools(defs)
    const toolTotal = builtin.length + [...mcp.values()].reduce((n, list) => n + list.length, 0)

    // ---- 插件 ----
    const editor = tryGet(ctx, 'configEditor')
    let entries = []
    try {
      entries = editor?.entries?.() ?? []
    } catch {}
    const plugins = entries.map((entry) => {
      const o = entry?.options ?? entry ?? {}
      return {
        id: String(o.id ?? o.key ?? '?'),
        name: String(o.name ?? o.package ?? '?'),
        disabled: o.disabled === true,
        configKeys: o.config && typeof o.config === 'object' ? Object.keys(o.config) : [],
      }
    })
    const disabledPlugins = plugins.filter((p) => p.disabled)
    const isCore = (plugin) => plugin.name.startsWith('@deepseek-ai/')
    const minePlugins = plugins.filter((plugin) => !isCore(plugin))
    const corePlugins = plugins.filter(isCore)
    const deadSwitches = disabledPlugins.filter((p) => p.configKeys.length > 0 && !isCore(p))

    // ---- 人设 ----
    const presetSvc = tryGet(ctx, 'agentPresets')
    let presets = []
    try {
      presets = (await presetSvc?.list?.()) ?? []
    } catch {}
    const presetIds = presets.map((p) => String(p?.id ?? p?.name ?? ''))
    const profilePatch = await readText(path.join(PROFILE_DIR, 'cordis.patch.yml'))
    const selected = /selectedDefault:\s*([\w.@/-]+)/.exec(profilePatch)?.[1] ?? null
    const defaultPreset = /^\s*default:\s*([\w.@/-]+)/m.exec(profilePatch)?.[1] ?? null

    // ---- 通道 ----
    const channelRows = await Promise.all(
      CHANNELS.map(async (channel) => {
        const probe = await probePort(channel.port)
        return { ...channel, up: probe.up, ms: probe.ms }
      }),
    )
    const upCount = channelRows.filter((c) => c.up).length

    // ---- 记忆 / 文件 ----
    const fishData = await dirStats(path.join(ROOT, 'fish', 'data'))
    const meowHome = await dirStats(path.join(ROOT, 'meow-memory-home'), 2500)
    const diary = await dirStats(path.join(ROOT, '日记'), 800)
    const sessions = await dirStats(path.join(HOME, 'sessions'), 3000)
    const report = await statOf(path.join(ROOT, '体检', '报告', '最新.md'))
    const stateNow = await statOf(path.join(HOME, 'state-now.md'))
    const thoughts = await statOf(path.join(HOME, 'thoughts.md'))
    const candidates = await statOf(path.join(HOME, 'candidates.md'))
    const agentsFile = await statOf(path.join(HOME, 'AGENTS.md'))

    const stateNowText = await readText(path.join(HOME, 'state-now.md'))
    const thoughtsText = await readText(path.join(HOME, 'thoughts.md'))
    const agentsText = await readText(path.join(HOME, 'AGENTS.md'))
    const undone = (() => {
      const idx = thoughtsText.indexOf('未了')
      if (idx < 0) return 0
      const tail = thoughtsText.slice(idx, idx + 4000)
      return tail.split(/\r?\n/).filter((line) => /^\s*[-*]\s*\[?\s?\]?/.test(line) && line.trim().length > 4).length
    })()

    // ---- 提示词固定块 ----
    let prompt = null
    try {
      const sp = tryGet(ctx, 'systemPrompt')
      if (sp?.assemble) prompt = summarizePrompt(await sp.assemble({}))
    } catch (error) {
      prompt = { error: String(error?.message ?? error) }
    }

    // ---- 模型 ----
    let model = null
    try {
      const sel = tryGet(ctx, 'agentDefaultModel')?.currentSelection?.()
      if (sel) model = [sel.provider, sel.model].filter(Boolean).join(' / ')
    } catch {}

    // ================= 层 1 核心 =================
    push({
      id: 'core',
      label: '核心',
      glyph: '◉',
      status: 'ok',
      summary: `DSH ${PROFILE} · ${toolTotal} 个工具 · ${plugins.length} 条插件行`,
      items: [
        { label: 'profile', value: PROFILE, note: PROFILE_DIR },
        { label: '模型', value: model ?? '（读不到）', note: 'agentDefaultModel' },
        { label: '工具总数', value: String(toolTotal), note: `内置 ${builtin.length} · MCP ${toolTotal - builtin.length}` },
        { label: '插件行', value: `${minePlugins.length} 个自己装的 + ${corePlugins.length} 核心`, note: `停用 ${disabledPlugins.length} 条 · configEditor.entries()` },
        { label: 'DSH_HOME', value: HOME, note: '' },
      ],
    })

    // ================= 层 2 插件 =================
    push({
      id: 'plugin',
      label: '插件',
      glyph: '▦',
      status: deadSwitches.length ? 'warn' : 'ok',
      summary: `${minePlugins.length} 个自己装的 · 核心行 ${corePlugins.length} 条`,
      items: [
        ...minePlugins
          .slice()
          .sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.id.localeCompare(b.id))
          .map((plugin) => ({
            label: plugin.id,
            value: plugin.disabled ? '停用' : '启用',
            status: plugin.disabled ? (plugin.configKeys.length ? 'warn' : 'idle') : 'ok',
            note: `${plugin.name}${plugin.configKeys.length ? ' · config: ' + plugin.configKeys.slice(0, 4).join(', ') : ''}`,
          })),
        {
          label: '— 核心', value: `${corePlugins.length} 条`, status: 'idle',
          note: `@deepseek-ai 官方行，停用 ${corePlugins.filter((p) => p.disabled).length} 条属正常（由模式行托管）`,
        },
      ],
    })

    // ================= 层 3 工具 =================
    const toolItems = [...mcp.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([server, list]) => ({
        label: `mcp__${server}`,
        value: `${list.length} 个`,
        status: list.length ? 'ok' : 'warn',
        note: list.slice(0, 6).join(' '),
      }))
    toolItems.push({
      label: '内置工具',
      value: `${builtin.length} 个`,
      status: 'ok',
      note: builtin.slice(0, 10).join(' '),
    })
    push({
      id: 'tool',
      label: '工具',
      glyph: '⚒',
      status: 'ok',
      summary: `${toolTotal} 个可调用工具 · ${mcp.size} 个 MCP 服务器`,
      items: toolItems,
    })

    // ================= 层 4 通道 =================
    const channelStatus = upCount === channelRows.length ? 'ok' : upCount === 0 ? 'bad' : 'warn'
    push({
      id: 'channel',
      label: '通道',
      glyph: '⇄',
      status: channelStatus,
      summary: `${upCount}/${channelRows.length} 开着`,
      items: channelRows.map((channel) => ({
        label: channel.label,
        value: channel.up ? `:${channel.port} 通` : `:${channel.port} 关`,
        status: channel.up ? 'ok' : 'bad',
        note: `${channel.what} · ${channel.up ? channel.ms + 'ms' : '连不上'}`,
      })),
    })

    // ================= 层 5 人设 =================
    push({
      id: 'preset',
      label: '人设',
      glyph: '✎',
      status: selected && !presetIds.includes(selected) ? 'bad' : 'ok',
      summary: `${presetIds.length} 个预设 · 选中 ${selected ?? '（未设）'}`,
      items: [
        { label: '预设清单', value: presetIds.join(' / ') || '（空）', note: 'agentPresets.list()' },
        { label: 'selectedDefault', value: selected ?? '无', status: selected && !presetIds.includes(selected) ? 'bad' : 'ok', note: PROFILE_DIR + '\\cordis.patch.yml' },
        { label: 'registry.default', value: defaultPreset ?? '无', note: '同上' },
        { label: 'AGENTS.md', value: agentsFile.exists ? kb(agentsFile.size) : '缺', note: HOME + '\\AGENTS.md' },
        { label: '候选归纳', value: candidates.exists ? kb(candidates.size) : '缺', note: 'candidates.md（归纳过闸用）' },
      ],
    })

    // ================= 层 6 记忆 =================
    push({
      id: 'memory',
      label: '记忆',
      glyph: '▤',
      status: report.exists && report.ageHours > 36 ? 'warn' : 'ok',
      summary: `fish ${kb(fishData.bytes)} · 会话 ${kb(sessions.bytes)} · 日记 ${diary.files} 篇`,
      items: [
        { label: 'fish 库', value: kb(fishData.bytes), note: `${fishData.files} 个文件 · ${path.join(ROOT, 'fish', 'data')}` },
        { label: 'meow-memory', value: kb(meowHome.bytes), note: `${meowHome.files} 个文件 · ${path.join(ROOT, 'meow-memory-home')}` },
        { label: '会话日志', value: kb(sessions.bytes), note: `${sessions.files} 个文件 · ${path.join(HOME, 'sessions')}` },
        { label: '日记', value: `${diary.files} 篇 / ${kb(diary.bytes)}`, note: path.join(ROOT, '日记') },
        { label: '体检报告', value: report.exists ? `${report.ageHours}h 前` : '没有', status: report.exists && report.ageHours > 36 ? 'warn' : 'ok', note: path.join(ROOT, '体检', '报告', '最新.md') },
      ],
    })

    // ================= 层 7 此刻 =================
    push({
      id: 'now',
      label: '此刻',
      glyph: '◇',
      status: stateNow.exists && stateNow.ageHours > 36 ? 'warn' : 'ok',
      summary: `state-now ${stateNow.exists ? stateNow.ageHours + 'h 前' : '缺'} · 未了 ${undone} 条`,
      items: [
        { label: 'state-now.md', value: stateNow.exists ? `${stateNow.ageHours}h 前` : '缺', status: stateNow.exists && stateNow.ageHours > 36 ? 'warn' : 'ok', note: `${countLines(stateNowText)} 行有效 · ${HOME}\\state-now.md` },
        { label: 'thoughts.md', value: thoughts.exists ? kb(thoughts.size) : '缺', note: `未了 ${undone} 条 · ${HOME}\\thoughts.md` },
        { label: 'candidates.md', value: candidates.exists ? kb(candidates.size) : '缺', note: '单次/candidate/waiting-confirm 三档' },
      ],
    })

    // ================= 层 8 身体 =================
    const body = channelRows.filter((c) => ['stage', 'petbrain', 'gsv'].includes(c.id))
    push({
      id: 'body',
      label: '身体',
      glyph: '♟',
      status: body.every((c) => c.up) ? 'ok' : body.some((c) => c.up) ? 'warn' : 'bad',
      summary: body.map((c) => `${c.label}${c.up ? '✓' : '✗'}`).join(' · '),
      items: body.map((channel) => ({
        label: channel.label,
        value: channel.up ? '在' : '没起',
        status: channel.up ? 'ok' : 'warn',
        note: `${channel.what} · :${channel.port}`,
      })),
    })

    // ================= 冲突 =================
    if (selected && presetIds.length && !presetIds.includes(selected)) {
      conflicts.push({
        level: 'bad',
        title: '选中的预设不存在',
        detail: `selectedDefault=${selected}，但注册表里只有 ${presetIds.join(' / ')}`,
        hint: '改 cordis.patch.yml 的 selectedDefault，或把预设装回来',
      })
    }
    for (const plugin of deadSwitches) {
      conflicts.push({
        level: 'warn',
        title: '停用但还留着配置',
        detail: `${plugin.id}（${plugin.name}）停用，config 里还有 ${plugin.configKeys.join(', ')}`,
        hint: '要么删配置保持干净，要么接回来——留着最容易忘',
      })
    }
    for (const [server, list] of mcp.entries()) {
      const port = MCP_PORT[server]
      const channel = port ? channelRows.find((c) => c.port === port) : null
      if (channel && !channel.up) {
        conflicts.push({
          level: 'bad',
          title: `${server} 工具在，服务没起`,
          detail: `${list.length} 个 mcp__${server}__ 工具挂在小号上，但 :${port} 连不上`,
          hint: `起 ${channel.label}，或者把这条 MCP 行停掉`,
        })
      }
    }
    if (/qq-chat/.test(agentsText)) {
      conflicts.push({
        level: 'warn',
        title: '旧规则还指着删掉的预设',
        detail: 'AGENTS.md / 抽屉里还有 qq-chat 字样，那两个预设已经删了',
        hint: '把旧句改成 standard，别让提示词指向不存在的预设',
      })
    }
    if (stateNow.exists && stateNow.ageHours > 36) {
      conflicts.push({
        level: 'warn',
        title: '此刻的状态可能早过期了',
        detail: `state-now.md 已经 ${stateNow.ageHours} 小时没动`,
        hint: '过期的不能当背景用，清掉或换新',
      })
    }
    if (report.exists && report.ageHours > 36) {
      conflicts.push({
        level: 'warn',
        title: '体检报告没跟上',
        detail: `最新一份是 ${report.ageHours} 小时前的`,
        hint: '跑一次 D:\\Ayu\\体检 的脚本',
      })
    }
    const dupes = new Map()
    for (const def of defs) {
      const toolName = String(def?.name ?? '')
      dupes.set(toolName, (dupes.get(toolName) ?? 0) + 1)
    }
    for (const [toolName, count] of dupes) {
      if (count > 1) {
        conflicts.push({ level: 'bad', title: '工具重名', detail: `${toolName} 被注册了 ${count} 次`, hint: '同名工具只有一个能调到，另一个等于没装' })
      }
    }
    if (toolTotal - builtin.length >= 60) {
      conflicts.push({
        level: 'info',
        title: 'MCP 工具占了大头',
        detail: `${toolTotal} 个工具里 ${toolTotal - builtin.length} 个来自 ${mcp.size} 个 MCP 服务，全都常驻在上下文里`,
        hint: '不常用的 MCP 行停掉能省 token，也少一条可能连不上的线',
      })
    }
    if (sessions.bytes > 100 * 1024 * 1024) {
      conflicts.push({
        level: 'info',
        title: '会话日志堆得不小',
        detail: `${kb(sessions.bytes)} / ${sessions.files} 个文件`,
        hint: '不影响运行，只是占盘；要清就清很早以前的那批',
      })
    }
    if (!conflicts.length) {
      conflicts.push({ level: 'ok', title: '没发现冲突', detail: '预设、MCP、开关、状态文件都对得上', hint: '' })
    }

    return {
      generatedAt: new Date().toISOString(),
      tookMs: Date.now() - started,
      layers,
      conflicts,
      prompt,
      stats: {
        plugins: minePlugins.length,
        pluginsAll: plugins.length,
        disabled: disabledPlugins.length,
        tools: toolTotal,
        mcpServers: mcp.size,
        channelsUp: upCount,
        channels: channelRows.length,
        presets: presetIds.length,
        conflicts: conflicts.filter((c) => c.level !== 'ok').length,
        bad: conflicts.filter((c) => c.level === 'bad').length,
      },
    }
  }

  async function snapshot(force = false) {
    const now = Date.now()
    if (!force && cache && now - cacheAt < 15000) return cache
    cache = await collect()
    cacheAt = now
    return cache
  }

  // 调试口：看某条 loader 行合并后的真实 config（默认 preset-standard）
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/whale-anatomy/entry',
      handler: async (req, res) => {
        try {
          const url = String(req.url ?? '')
          const id = decodeURIComponent((url.match(/id=([^&]+)/)?.[1] ?? 'include:preset-standard'))
          const editor = tryGet(ctx, 'configEditor')
          const all = editor?.entries?.() ?? []
          const shapeOf = (entry) => {
            const o = entry?.options ?? entry ?? {}
            return {
              id: String(o.id ?? ''),
              key: String(o.key ?? ''),
              patchId: String(o.patchId ?? ''),
              name: String(o.name ?? ''),
            }
          }
          const hit = all.find((entry) => {
            const s = shapeOf(entry)
            return s.id === id || s.key === id || s.patchId === id || `include:${s.patchId}` === id
          })
          const o = hit?.options ?? hit ?? null
          const plugins = Array.isArray(o?.config?.plugins) ? o.config.plugins : []
          const out = {
            id,
            found: Boolean(hit),
            total: all.length,
            idSamples: all.slice(0, 3).map(shapeOf),
            hitShape: hit ? shapeOf(hit) : null,
            configKeys: o?.config ? Object.keys(o.config) : [],
            rawConfig: o?.config ?? null,
            pluginCount: plugins.length,
            persona: plugins.find((p) => String(p?.id ?? '') === 'persona') ?? null,
            firstThree: plugins.slice(0, 3),
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          res.end(JSON.stringify(out))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: String(error?.message ?? error) }))
        }
      },
    }),
  )

  // 写入口：POST /whale-anatomy/apply-config  body { id, patch }
  //  走 configEditor.edit()，由 Loader 正常持久化 + 生效（不重启）
  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/whale-anatomy/apply-config',
      handler: async (req, res) => {
        const send = (code, obj) => {
          res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          res.end(JSON.stringify(obj))
        }
        try {
          if (req.method !== 'POST') return send(405, { error: 'POST only' })
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const id = String(body.id ?? 'system-prompt')
          const patch = body.patch ?? {}
          const editor = tryGet(ctx, 'configEditor')
          if (!editor?.edit) return send(500, { error: 'configEditor.edit unavailable' })
          const all = editor.entries?.() ?? []
          const shapeOf = (entry) => {
            const o = entry?.options ?? entry ?? {}
            return { id: String(o.id ?? ''), key: String(o.key ?? ''), patchId: String(o.patchId ?? ''), name: String(o.name ?? '') }
          }
          const hit = all.find((entry) => {
            const s = shapeOf(entry)
            return s.id === id || s.key === id || s.patchId === id || `include:${s.patchId}` === id
          })
          if (!hit) return send(404, { error: `entry not found: ${id}`, total: all.length })
          const entry = hit.entry ?? hit
          const before = hit?.options?.config ?? entry?.options?.config ?? null
          await editor.edit(entry, (current) => ({ ...current, ...patch }))
          const after = (editor.entries?.() ?? []).find((e) => shapeOf(e).id === id)?.options?.config ?? null
          return send(200, { ok: true, id, before, after })
        } catch (error) {
          return send(500, { error: String(error?.message ?? error) })
        }
      },
    }),
  )

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'exact',
      path: '/whale-anatomy/state',
      handler: async (req, res) => {
        try {
          const force = String(req.url ?? '').includes('force=1')
          const data = await snapshot(force)
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
          res.end(JSON.stringify(data))
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ error: String(error?.message ?? error) }))
        }
      },
    }),
  )
}
