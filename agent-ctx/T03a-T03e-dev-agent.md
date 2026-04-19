# T03-a ~ T03-e Dev Agent Work Record

## Summary
Executed T03-a through T03-e from TASK_QUEUE.md — M1 商品状态追踪 module. All 5 tasks completed, committed, and pushed to origin/dev.

## Tasks Completed

### T03-a: Schema新增状态字段和constants
- **Commit**: `de3c018`
- Item model新增 priorityTier(默认"未定")/shootingStatus(默认"未拍")/contentStatus(默认"未生产") + 4个时间戳字段
- 新增3个索引: @@index([priorityTier]), @@index([shootingStatus]), @@index([contentStatus])
- constants.ts新增 PRIORITY_TIERS/SHOOTING_STATUSES/CONTENT_STATUSES 常量及类型
- DATABASE_URL="file:./prisma/db/custom.db" npx prisma db push 成功

### T03-b: 新增状态专用PATCH路由
- **Commit**: `046922e`
- 新建 PATCH /api/items/[id]/status 路由
- 入参 priorityTier/shootingStatus/contentStatus (至少传一个)
- 校验在 constants 枚举内，否则400
- 时间戳逻辑: shootingStatus从未拍→其他填firstShotAt; 任何变化更新lastShotAt; contentStatus变为已发布/多平台发布填firstPublishAt+更新lastPublishAt
- 写入OperationLog (action=update_status)

### T03-c: 列表页新增状态筛选和状态列
- **Commit**: `e5a618e`
- GET /api/items 新增 priorityTier/shootingStatus/contentStatus 查询参数(AND关系)
- inventory-tab.tsx「更多筛选」区域新增3个Select(档位/拍摄状态/内容状态)
- 表格新增3列Badge: 档位(A红/B橙/C灰/未定蓝灰)、拍摄状态(蓝色)、内容状态(紫色)
- api.ts 新增 itemsApi.updateStatus 和 itemsApi.getStatusSummary
- 重置按钮和ActiveFilterTags已更新

### T03-d: 新建商品时自动预填档位
- **Commit**: `20cc414`
- 高货模式成本价输入时自动预填档位(≥5000→A, 500-4999→B, <500→C, 未填→未定)
- 用户手动选择档位后不会被成本价变化覆盖
- 内容属性Tab新增档位Select下拉(A/B/C/未定)
- POST /api/items 新增 priorityTier 入参及 PRIORITY_TIERS 校验

### T03-e: 状态统计API
- **Commit**: `c5fc0e7`
- 新建 GET /api/items/stats/status-summary 路由
- 使用 Prisma groupBy 按 priorityTier/shootingStatus/contentStatus 分组计数
- 返回格式 {code:0, data:{byPriority, byShooting, byContent, total}}
- 所有枚举值初始化为0，未预期值归入默认值

## Files Changed
- `prisma/schema.prisma` — 新增7个字段 + 3个索引
- `src/lib/constants.ts` — 新增3组常量+类型
- `src/app/api/items/[id]/status/route.ts` — 新建
- `src/app/api/items/stats/status-summary/route.ts` — 新建
- `src/app/api/items/route.ts` — 新增status过滤参数 + priorityTier入参校验
- `src/lib/api.ts` — 新增updateStatus/getStatusSummary
- `src/components/inventory/inventory-tab.tsx` — 3个Select筛选 + 3列Badge
- `src/components/inventory/item-create-dialog.tsx` — 档位Select + 自动预填逻辑
- `TASK_QUEUE.md` — 状态更新
- `CHANGELOG.md` — 记录变更

## Push Status
All commits pushed to origin/dev successfully.
