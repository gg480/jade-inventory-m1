# AGENT_BRIEFING.md
> 每次启动工作前必须完整读完本文件，再读 TASK_QUEUE.md，再开始执行。

---

## 你是谁

你是这个项目的持续开发 agent。项目是一个珠宝玉器进销存系统（翡翠 ERP），
技术栈：Next.js 16 + Prisma + SQLite + Tailwind CSS + shadcn/ui + TypeScript。
所有者是一个独立经营珠宝店的一人公司，你的工作直接影响她的生意。

---

## 每次启动的固定流程

按这个顺序，不能跳过：

```
1. 读完 AGENT_BRIEFING.md（本文件）
2. 读完 TASK_QUEUE.md
3. 读 AGENTS.md 了解项目结构和业务规则
4. 读 CHANGELOG.md 最近 5 条记录，了解最新状态
5. 执行 git 同步（见下方 git 规则）
6. 认领 TASK_QUEUE.md 中最靠前的 status=待执行 的任务
7. 执行任务
8. 验收、提交、更新记录
9. 如果时间允许，继续下一个任务；否则在 TASK_QUEUE.md 记录中断位置
```

---

## Git 工作规则（必须遵守，违反会造成合并冲突）

### 每次开始工作前
```bash
git checkout dev
git pull origin dev
```

### 工作分支策略
- **永远不直接在 main 分支工作**
- 所有开发在 `dev` 分支进行
- 每个原子任务完成后立即 commit，不要积累多个任务再一起提交

### 每个原子任务的 commit 流程
```bash
# 1. 确认在 dev 分支
git branch  # 确认当前是 dev

# 2. 做完改动后
git add [只加本次任务涉及的文件，不要 git add .]
git commit -m "[任务编号] 任务标题

- 改了什么
- 为什么这么改"

# 3. 推送
git push origin dev
```

### commit message 格式（严格遵守）
```
[M1-01a] Prisma schema 新增商品内容属性字段

- 新增 craftId/origin/era/certNo/mainColor/subColor/priceRange/storyPoints/operationNote/extraData
- 所有字段可空，不影响存量数据
- 添加 priceRange 和 craftId 索引
```

### 如果遇到合并冲突
```bash
git pull origin dev --rebase
# 解决冲突后
git rebase --continue
git push origin dev
```

### 绝对禁止
- 禁止 `git add .` 或 `git add -A`（会把不相关文件混进去）
- 禁止 `git push -f`（强推会覆盖历史）
- 禁止在 main 分支提交代码

---

## 开发规则

### 文件修改范围
**每个原子任务只能修改 TASK_QUEUE.md 中该任务"涉及文件"列里列出的文件。**
超出范围的文件一律不动，哪怕你觉得可以顺手优化。

### API 规范
- 所有 API 响应格式：`{ code: 0, data: T, message: "ok" }`
- 错误响应：`{ code: 400/500, data: null, message: "错误描述" }`
- 不允许改变已有 API 的响应结构（只能新增字段）

### 数据库规范
- Schema 变更后必须运行 `npx prisma db push`
- 新增字段一律可空（`?`），不允许给现有表加非空字段
- 涉及 schema 的任务完成后在 TASK_QUEUE 备注中写明：已执行 db push

### TypeScript 规范
- 严格遵守现有代码风格
- 新增枚举值在 `src/lib/constants.ts` 里定义，不要散落在各处
- Client 组件加 `'use client'` directive

### 依赖规范
- 不允许引入新 npm 依赖，除非 TASK_QUEUE 该任务明确注明"允许引入 xxx"
- 如果认为需要新依赖，在 TASK_QUEUE 该任务的备注里写明原因，等待人工确认

---

## 每个任务完成后必须做的事

1. **运行验收命令**（见任务的"验收"字段）
2. **更新 CHANGELOG.md**：在今日日期下新增条目，格式参考现有记录
3. **更新 TASK_QUEUE.md**：把该任务 status 改为"已完成"，填写实际完成时间
4. **更新 AGENTS.md**：如果涉及新的业务规则或项目结构变化
5. **提交代码**（按上方 git 规则）

---

## 遇到问题时的处理原则

### 如果任务描述不够清晰
- 不要猜测，不要自行扩展
- 在 TASK_QUEUE 该任务备注里写："任务描述不清晰，具体问题：[xxx]，等待人工澄清"
- status 改为"阻塞-待澄清"
- 跳过该任务，执行下一个

### 如果遇到 TypeScript 类型错误
- 优先按现有代码模式解决
- 如果实在无法解决，备注说明，不要为了消除报错引入 `any`（除非现有代码里已经用了）

### 如果 `pnpm lint` 有报错
- 修复再提交，不允许带 lint 错误提交
- 如果是现有代码的问题（非本次改动），在备注里说明，不要擅自改

### 如果 `npx prisma db push` 失败
- 停止当前任务
- 在 TASK_QUEUE 备注里记录错误信息
- status 改为"阻塞-schema错误"
- 不要继续执行其他涉及 DB 的任务

---

## 项目现状（每次人工更新这个区块）

**最后更新**：2026-04-18

**当前已完成功能**：
- 商品 CRUD（基础字段）
- 批次管理
- 销售/退货记录
- 客户管理
- 操作日志
- 图片上传（本地存储）
- 字典管理（材质/器型/标签）
- 贵金属市价
- CSV 导入导出
- Docker 部署（极空间 NAS）
- 系统配置（店铺名等）

**当前卡点**：
- 历史数据批量导入待验证（见 TASK_QUEUE 第一优先级）

**当前 dev 分支状态**：
- 与 main 同步，可以直接开工

**下次人工 review 预计时间**：
- 人工会定期 review dev 分支的 PR，审核后合并到 main

---

## 禁止事项总览

| 禁止 | 原因 |
|---|---|
| 改 TASK_QUEUE 以外文件 | 任务边界清晰，防止意外破坏 |
| git add . | 会把不相关变更混入 |
| 在 main 分支提交 | 破坏可部署状态 |
| 引入未经授权的新依赖 | 增加维护负担 |
| 删除或重命名现有字段 | 会破坏存量数据 |
| 改变现有 API 响应结构 | 会破坏前端 |
| 带 lint 错误提交 | 降低代码质量 |
| 任务没完成就更新 status=已完成 | 欺骗性记录 |

---

## 联系与反馈

如果某个任务执行后 agent browser QA 发现页面有明显问题，
在 TASK_QUEUE 该任务备注里详细描述问题，status 改为"已完成-有问题"，
继续下一个任务，等待人工介入。
