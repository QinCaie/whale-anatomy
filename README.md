# whale-anatomy · Ayu骨架

把「她现在由什么组成、哪些正在跑、哪里已经对不上」画成一张可点开的解剖图。
**只读**：不启停插件、不改配置、不碰记忆。

## 它答什么问题

- 我身上到底装了哪些插件？哪些只是停用但配置还留着？（未接线开关）
- 我有多少个工具？分别挂在哪条 MCP 上？哪条 MCP 挂了但工具还在？
- 七个端口（网关 / SnowLuma HTTP+WS / QQ 桥接控制台 / GSV 语音 / 桌宠大脑 / Live2D 舞台）谁开着？
- 预设注册表选的默认预设还在不在？AGENTS.md 里有没有还指着已删预设的旧句子？
- 记忆四本账（fish / meow-memory / 会话日志 / 日记）各多大？体检报告多久没更新？
- 此刻（state-now）是不是早过期了？未了的事还有几条？
- **每轮上下文**到底由哪些固定块拼起来、各占多少字？

## 打开方式

左侧栏图标「骨架」（order 5，在 plugins 与 schedules 之间）。

## 接口

`GET /whale-anatomy/state` — 一次完整快照（15s 内存缓存）。
`GET /whale-anatomy/state?force=1` — 跳过缓存。

```json
{ "generatedAt": "...", "tookMs": 210,
  "layers": [{ "id": "plugin", "label": "插件", "status": "ok|warn|bad", "summary": "...", "items": [...] }],
  "conflicts": [{ "level": "bad|warn|ok", "title": "...", "detail": "...", "hint": "..." }],
  "prompt": { "total": 41200, "blocks": [{ "label": "system", "chars": 9000, "head": "..." }] },
  "stats": { "plugins": 42, "tools": 180, "conflicts": 3 } }
```

## 数据来源（都是现成的，没另造一套）

| 层 | 来源 |
| --- | --- |
| 插件 | `ctx.configEditor.entries()`（loader 真实条目） |
| 工具 | `ctx.tools.definitions()`，按 `mcp__<server>__` 前缀分组 |
| 人设 | `ctx.agentPresets.list()` + `cordis.patch.yml` 的 `selectedDefault` |
| 通道 | 对本机固定端口做 TCP 探活（450ms 超时） |
| 记忆 | `D:\Ayu\{fish\data,meow-memory-home,日记}`、`$DSH_HOME/sessions`、`体检/报告/最新.md` |
| 此刻 | `$DSH_HOME/{state-now.md,thoughts.md,candidates.md,AGENTS.md}` |
| 上下文 | `ctx.systemPrompt.assemble({})` |

## 冲突规则

1. `selectedDefault` 指向不存在的预设 → 异常
2. 插件停用但 config 非空 → 注意（未接线开关）
3. MCP 有工具但对应服务端口连不上 → 异常
4. 同名工具注册两次 → 异常
5. AGENTS.md 仍出现已删预设名（`qq-chat`） → 注意
6. `state-now.md` / 体检报告超过 36 小时未更新 → 注意

## 装 / 卸

```powershell
# 装
plugin_manager install_bundle target=D:\Ayu\plugins\whale-anatomy
# 卸
plugin_manager remove_bundle target=whale-anatomy
```

改完代码不用重装：client 半由 web 运行时热载（刷新页面即可），host 半改完重装或重启 profile。
