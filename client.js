/**
 * Ayu骨架 · client 半
 * 一张 brutalist 的解剖图：左边是层，点开右边是这一层由什么组成；
 * 下面是冲突和工作量（每轮上下文固定块）。
 */
window.__ModuleLoader__.load({
  id: 'whale-anatomy',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback } = React
    const PANEL_ID = 'whale-anatomy'

    const STYLE = `
.wa-root{--ink:#0b0b0b;--paper:#f2efe4;--acid:#d8ff3e;--bad:#ff3b30;--warn:#ffb020;--ok:#00c971;
  position:absolute;inset:0;overflow:auto;background:var(--paper);color:var(--ink);
  font-family:"Cascadia Mono",Consolas,"Courier New",monospace;font-size:14px;line-height:1.55;padding:20px 22px 40px;}
.wa-root *{box-sizing:border-box}
.wa-head{display:flex;align-items:stretch;gap:0;border:3px solid var(--ink);background:var(--ink);color:var(--paper);box-shadow:8px 8px 0 rgba(0,0,0,.18)}
.wa-title{padding:12px 16px;font-size:22px;font-weight:700;letter-spacing:.06em;border-right:3px solid var(--paper)}
.wa-title b{color:var(--acid)}
.wa-meta{display:flex;align-items:center;gap:14px;padding:10px 16px;font-size:12.5px;flex:1;color:#cfcbbe}
.wa-score{margin-left:auto;display:flex;align-items:center;gap:10px;padding:8px 16px;border-left:3px solid var(--paper)}
.wa-score span{font-size:26px;font-weight:700;color:var(--acid);line-height:1}
.wa-btn{border:3px solid var(--ink);background:var(--acid);color:var(--ink);font:inherit;font-weight:700;
  padding:6px 14px;cursor:pointer;box-shadow:4px 4px 0 var(--ink);text-transform:uppercase;letter-spacing:.08em}
.wa-btn:active{box-shadow:none;transform:translate(3px,3px)}
.wa-btn-plain{background:var(--paper);color:var(--ink)}
.wa-score.wa-plain{margin-left:0}
.wa-exit{letter-spacing:.06em}
.wa-grid{display:grid;grid-template-columns:336px minmax(0,1fr);gap:18px;margin-top:18px;align-items:start}
.wa-chips{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.wa-chip{border:3px solid var(--ink);background:var(--paper);padding:9px 10px 8px;cursor:pointer;
  box-shadow:5px 5px 0 var(--ink);text-align:left;font:inherit;color:inherit;display:block;width:100%}
.wa-chip:hover{background:#fffdf2}
.wa-chip.on{background:var(--ink);color:var(--paper);box-shadow:5px 5px 0 var(--acid)}
.wa-chip.on .wa-chip-note{color:#bdb8a8}
.wa-chip-top{display:flex;align-items:center;gap:7px;font-size:15px;font-weight:700}
.wa-chip-note{margin-top:4px;font-size:11.5px;color:#5c5749;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow-wrap:anywhere}
.wa-dot{width:11px;height:11px;border:2px solid var(--ink);display:inline-block;flex:none}
.wa-dot.ok{background:var(--ok)} .wa-dot.warn{background:var(--warn)} .wa-dot.bad{background:var(--bad)} .wa-dot.idle{background:transparent}
.wa-detail{border:3px solid var(--ink);box-shadow:8px 8px 0 var(--ink);min-height:280px;background:#fffdf2}
.wa-detail-head{border-bottom:3px solid var(--ink);padding:10px 14px;background:var(--ink);color:var(--paper);
  display:flex;align-items:baseline;gap:12px}
.wa-detail-head h2{margin:0;font-size:18px;letter-spacing:.1em}
.wa-detail-head small{color:#cfcbbe;font-size:12px}
.wa-row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:12px;padding:8px 14px;border-bottom:1px dashed #c9c4b2}
.wa-row:last-child{border-bottom:none}
.wa-row-k{font-weight:700;font-size:13px;word-break:break-all}
.wa-row-v{font-size:13.5px}
.wa-row-note{grid-column:2;font-size:11.5px;color:#6a6555;word-break:break-all;margin-top:-4px}
.wa-sec{margin-top:22px}
.wa-sec-title{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;letter-spacing:.14em;
  text-transform:uppercase;padding-bottom:6px;border-bottom:3px solid var(--ink)}
.wa-sec-title i{background:var(--ink);color:var(--paper);padding:2px 8px;font-style:normal;font-size:11.5px}
.wa-conf{display:grid;grid-template-columns:1fr;gap:8px;margin-top:10px}
.wa-conf-row{display:grid;grid-template-columns:78px minmax(0,1fr);gap:12px;border:2px solid var(--ink);padding:9px 12px;background:#fffdf2;align-items:start}
.wa-conf-row.bad{border-left-width:12px;border-left-color:var(--bad)}
.wa-conf-row.warn{border-left-width:12px;border-left-color:var(--warn)}
.wa-conf-row.ok{border-left-width:12px;border-left-color:var(--ok)}
.wa-conf-row.info{border-left-width:12px;border-left-color:#5c5749}
.wa-tag{font-size:11.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
.wa-conf-t{font-weight:700;font-size:14px}
.wa-conf-d{font-size:12.5px;color:#3c382e;margin-top:3px;word-break:break-word}
.wa-conf-h{font-size:11.5px;color:#6a6555;margin-top:3px}
.wa-bar{display:flex;height:26px;border:3px solid var(--ink);margin-top:10px;overflow:hidden;background:#fffdf2}
.wa-bar i{display:block;height:100%;border-right:2px solid var(--ink)}
.wa-bar i:last-child{border-right:none}
.wa-block{display:grid;grid-template-columns:212px 62px minmax(0,1fr);gap:10px;padding:5px 2px;font-size:12.5px;border-bottom:1px dotted #c9c4b2;align-items:center}
.wa-block b{font-weight:700;font-size:12.5px}
.wa-block em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums}
.wa-block span{color:#5c5749;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wa-empty{border:3px dashed var(--ink);padding:22px;text-align:center;font-size:13px;color:#5c5749;margin-top:14px}
.wa-foot{margin-top:26px;display:flex;gap:16px;flex-wrap:nowrap;font-size:11.5px;color:#5c5749;align-items:center}
`

    let injected = false
    function ensureStyle() {
      if (injected || typeof document === 'undefined') return
      injected = true
      const el = document.createElement('style')
      el.setAttribute('data-whale-anatomy', '1')
      el.textContent = STYLE
      document.head.appendChild(el)
    }

    const STATUS_TEXT = { ok: '正常', warn: '注意', bad: '异常', info: '说明', idle: '空转' }

    function Dot(status) {
      return h('i', { className: 'wa-dot ' + (status || 'ok') })
    }

    function LayerChip({ layer, active, onPick }) {
      const bad = layer.status === 'bad'
      return h(
        'button',
        {
          type: 'button',
          className: 'wa-chip' + (active ? ' on' : ''),
          onClick: () => onPick(layer.id),
          style: bad && !active ? { background: '#ffe9e6' } : undefined,
        },
        h('div', { className: 'wa-chip-top' }, h('span', { style: { fontSize: 15 } }, layer.glyph || '▪'), layer.label, Dot(layer.status)),
        h('div', { className: 'wa-chip-note' }, layer.summary || ''),
      )
    }

    function Detail({ layer }) {
      if (!layer) return h('div', { className: 'wa-empty' }, '左边点一层')
      const items = layer.items || []
      return h(
        'div',
        { className: 'wa-detail' },
        h('div', { className: 'wa-detail-head' },
          h('h2', null, layer.label),
          h('small', null, layer.summary || ''),
          h('small', { style: { marginLeft: 'auto' } }, `${items.length} 项`),
        ),
        items.map((item, index) =>
          h(
            'div',
            { className: 'wa-row', key: index },
            h('div', { className: 'wa-row-k' }, Dot(item.status || 'ok'), ' ', item.label),
            h('div', { className: 'wa-row-v' }, item.value),
            item.note ? h('div', { className: 'wa-row-note' }, item.note) : null,
          ),
        ),
      )
    }

    function Conflicts({ list }) {
      const order = { bad: 0, warn: 1, info: 2, ok: 3 }
      const sorted = (list || []).slice().sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3))
      const counts = { bad: 0, warn: 0, info: 0 }
      for (const item of sorted) counts[item.level] = (counts[item.level] || 0) + 1
      return h(
        'div',
        { className: 'wa-sec' },
        h('div', { className: 'wa-sec-title' }, '冲突与风险',
          h('i', null, `异常 ${counts.bad || 0}`), h('i', null, `注意 ${counts.warn || 0}`), h('i', null, `说明 ${counts.info || 0}`)),
        sorted.length
          ? h('div', { className: 'wa-conf' }, sorted.map((item, index) =>
              h('div', { className: 'wa-conf-row ' + item.level, key: index },
                h('div', { className: 'wa-tag' }, STATUS_TEXT[item.level] || item.level),
                h('div', null,
                  h('div', { className: 'wa-conf-t' }, item.title),
                  h('div', { className: 'wa-conf-d' }, item.detail),
                  item.hint ? h('div', { className: 'wa-conf-h' }, '→ ' + item.hint) : null,
                ),
              ),
            ))
          : h('div', { className: 'wa-empty' }, '没有冲突'),
      )
    }

    function Prompt({ prompt }) {
      if (!prompt) return null
      if (prompt.error) {
        return h('div', { className: 'wa-sec' },
          h('div', { className: 'wa-sec-title' }, '每轮上下文'),
          h('div', { className: 'wa-empty' }, '读不到固定块：' + prompt.error + (prompt.keys ? ' · keys: ' + prompt.keys.join(',') : '')))
      }
      const groups = prompt.groups || []
      if (!groups.length) return null
      const palette = ['#0b0b0b', '#3c382e', '#6a6555', '#8f8a79', '#b4ae9b', '#d8ff3e', '#ffb020', '#ff3b30']
      const total = prompt.total || 1
      const main = groups[0]
      return h(
        'div',
        { className: 'wa-sec' },
        h('div', { className: 'wa-sec-title' }, '每轮上下文',
          h('i', null, `${total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total} 字符`),
          h('i', null, `${groups.length} 组`)),
        h('div', { className: 'wa-bar' },
          main.blocks.map((block, index) =>
            h('i', {
              key: index,
              title: `${block.label} ${block.chars}`,
              style: { width: `${Math.max(0.6, (block.chars / (main.total || 1)) * 100)}%`, background: palette[index % palette.length] },
            }),
          ),
        ),
        h('div', { style: { marginTop: 10 } },
          main.blocks.map((block, index) =>
            h('div', { className: 'wa-block', key: index },
              h('b', null, block.label),
              h('em', null, block.chars >= 1000 ? `${(block.chars / 1000).toFixed(1)}k` : String(block.chars)),
              h('span', null, block.head || ''),
            ),
          ),
        ),
        groups.slice(1).map((group, gi) =>
          h('div', { key: 'g' + gi, style: { marginTop: 12 } },
            h('div', { className: 'wa-block', style: { gridTemplateColumns: '212px 62px 1fr', borderBottom: '2px solid #0b0b0b' } },
              h('b', null, '▸ ' + group.key),
              h('em', null, `${group.count} 块`),
              h('span', null, `${group.total} 字符 · ` + group.blocks.slice(0, 4).map((block) => block.label).join(' / ')),
            ),
          ),
        ),
      )
    }

    function Anatomy() {
      ensureStyle()
      const [state, setState] = useState({ loading: true, data: null, error: null })
      const [picked, setPicked] = useState(null)

      const load = useCallback((force) => {
        setState((prev) => ({ ...prev, loading: true }))
        fetch('./whale-anatomy/state' + (force ? '?force=1' : ''), { cache: 'no-store' })
          .then((res) => res.json())
          .then((data) => {
            setState({ loading: false, data, error: data && data.error ? data.error : null })
            setPicked((current) => {
              if (current && data.layers && data.layers.some((layer) => layer.id === current)) return current
              const worst = (data.layers || []).find((layer) => layer.status === 'bad') || (data.layers || []).find((layer) => layer.status === 'warn')
              return worst ? worst.id : (data.layers && data.layers[0] ? data.layers[0].id : null)
            })
          })
          .catch((error) => setState({ loading: false, data: null, error: String(error && error.message ? error.message : error) }))
      }, [])

      useEffect(() => { load(true) }, [load])
      useEffect(() => {
        const timer = setInterval(() => load(false), 60000)
        return () => clearInterval(timer)
      }, [load])
      useEffect(() => {
        const onKey = (event) => { if (event.key === 'Escape') leave() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
      }, [])

      const data = state.data
      const layers = (data && data.layers) || []
      const layer = layers.find((item) => item.id === picked) || layers[0]
      const stats = (data && data.stats) || {}
      const generated = data && data.generatedAt ? new Date(data.generatedAt) : null
      const clock = generated
        ? `${String(generated.getHours()).padStart(2, '0')}:${String(generated.getMinutes()).padStart(2, '0')}:${String(generated.getSeconds()).padStart(2, '0')}`
        : '--:--:--'

      return h(
        'div',
        { className: 'wa-root' },
        h('div', { className: 'wa-head' },
          h('div', { className: 'wa-title' }, 'Ayu · ', h('b', null, '骨架')),
          h('div', { className: 'wa-meta' },
            h('span', null, `生成 ${clock}`),
            h('span', null, `插件 ${stats.plugins ?? '-'}`),
            h('span', null, `工具 ${stats.tools ?? '-'}`),
            h('span', null, `通道 ${stats.channelsUp ?? '-'}/${stats.channels ?? '-'}`),
            h('span', null, state.loading ? '采集中…' : `冲突 ${stats.conflicts ?? 0}`),
          ),
          h('div', { className: 'wa-score' },
            h('span', null, stats.bad ?? 0),
            h('em', { style: { fontStyle: 'normal', fontSize: 11.5, lineHeight: 1.2 } }, '异常'),
          ),
          h('div', { className: 'wa-score wa-plain' },
            h('button', { type: 'button', className: 'wa-btn wa-exit', onClick: leave, title: '回到对话（Esc）' }, '← 对话'),
          ),
          h('div', { className: 'wa-score' },
            h('button', { type: 'button', className: 'wa-btn wa-btn-plain', onClick: () => load(true) }, '刷新'),
          ),
        ),
        state.error ? h('div', { className: 'wa-empty' }, '采集失败：' + state.error) : null,
        state.loading && !data ? h('div', { className: 'wa-empty' }, '正在拆自己…') : null,
        data
          ? h('div', { className: 'wa-grid' },
              h('div', { className: 'wa-chips' },
                layers.map((item) => h(LayerChip, { key: item.id, layer: item, active: item.id === (layer && layer.id), onPick: setPicked })),
              ),
              h(Detail, { layer }),
            )
          : null,
        data && data.conflicts ? h(Conflicts, { list: data.conflicts }) : null,
        data && data.prompt ? h(Prompt, { prompt: data.prompt }) : null,
        data ? h('div', { className: 'wa-foot' },
          h('span', null, `扫描 ${data.tookMs ?? '-'} ms`),
          h('span', null, `profile ${stats.plugins ?? '-'} 条行`),
          h('span', null, '只读：不启停、不改配置'),
          h('span', null, 'Esc 也能回对话'),
        ) : null,
      )
    }

    function leave() {
      const api = layoutApi
      if (api && typeof api.selectPanel === 'function') {
        try {
          api.selectPanel(null)
          return
        } catch (error) {
          /* 兜底走下面 */
        }
      }
      if (typeof window !== 'undefined' && window.history && window.history.length > 1) window.history.back()
    }

    function Icon({ size, active }) {
      const edge = size || 18
      return h('svg', { width: edge, height: edge, viewBox: '0 0 20 20', 'aria-hidden': true, style: { display: 'block' } },
        h('rect', { x: 7, y: 1, width: 6, height: 4, fill: 'currentColor' }),
        h('rect', { x: 5, y: 7, width: 10, height: 2, fill: 'currentColor' }),
        h('rect', { x: 8, y: 11, width: 4, height: 8, fill: active ? 'currentColor' : 'none', stroke: 'currentColor', strokeWidth: 1.6 }),
      )
    }

    let layoutApi = null

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          ctx.inject(['layout'], (scoped) => {
            layoutApi = scoped.layout
          })
        } catch (error) {
          layoutApi = null
        }
        ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL_ID }, Anatomy))
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: 5, label: () => '骨架' }, Icon),
        )
      },
    }
  },
})
