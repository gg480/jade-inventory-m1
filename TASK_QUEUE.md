# TASK_QUEUE.md
> agent 每次启动后读完 AGENT_BRIEFING.md 再读本文件。
> 认领最靠前的 status=待执行 的任务，执行完更新 status 和备注。

---

## 任务状态说明

- `待执行` — 可以立刻开工
- `进行中` — 当前 session 正在执行
- `已完成` — 验收通过，代码已提交
- `已完成-有问题` — 完成但 QA 发现问题，等待人工介入
- `阻塞-待澄清` — 任务描述不清，等待人工说明
- `阻塞-依赖未完成` — 依赖的前置任务尚未完成
- `阻塞-schema错误` — Prisma 相关报错，等待人工介入
- `暂缓` — 人工决定暂时不做

---

## 第一优先级：修复当前卡点

### T00-a 验证并修复历史库存数据 CSV 导入
```
status: 待执行
依赖: 无
涉及文件:
  - src/app/api/import/items-csv/route.ts
  - src/components/inventory/settings-tab.tsx

任务描述:
  当前 CSV 导入流程已有基础实现（见 CHANGELOG 2026-04-19），
  但需要验证以下场景是否正常：
  1. 上传一份包含 10 条以上记录的真实库存 CSV，确认全部导入成功
  2. 重复上传同一份 CSV，确认去重逻辑生效（显示"重复跳过 N 条"）
  3. CSV 中有空的材质/器型字段，确认自动创建"未分类"并提示
  4. CSV 中的"数量"列 >= 2 时，确认创建了对应数量的 Item 记录
  如果上述任一场景失败，修复对应逻辑。

验收:
  - 用真实 CSV（10 条以上）跑一次完整导入，控制台无报错
  - 数据库里能查到对应 Item 记录
  - 前端显示正确的导入结果（成功数/跳过数/创建字典数）
  - pnpm lint --quiet 无新增报错
  - agent browser 打开设置页 → 数据导入 → 上传 CSV → 确认结果正常

完成后:
  - 更新 CHANGELOG.md
  - 更新本任务 status=已完成
```
备注: ___

---

### T00-b 验证并修复历史销售数据 CSV 导入
```
status: 阻塞-依赖未完成
依赖: T00-a 必须先完成
涉及文件:
  - src/app/api/import/sales/route.ts
  - src/components/inventory/settings-tab.tsx

任务描述:
  验证销售导入流程（见 CHANGELOG 2026-04-19）：
  1. 上传一份与库存 CSV 对应的销售记录 CSV
  2. 确认通过匹配码/名称+成本价成功关联 Item
  3. 确认自动创建客户（按姓名匹配）
  4. 确认导入后 Item 状态变为 sold，SaleRecord 记录存在
  如果任一场景失败，修复对应逻辑。

验收:
  - 导入后能在销售记录页看到对应记录
  - 对应 Item 的 status = sold
  - 导入结果显示"成功 N 条/匹配失败 N 条"
  - agent browser QA：销售记录页面展示正常

完成后:
  - 更新 CHANGELOG.md
  - 更新本任务 status=已完成
```
备注: ___

---

## 第二优先级：M1 商品主数据扩展

> M1 目标：让每个 SKU 能输出完整结构化 JSON 喂给 AI 生成文案。
> 按 a→b→c→d→e→f 顺序执行，不要跳。

### T01-a Prisma schema 新增商品内容属性字段
```
status: 阻塞-依赖未完成
依赖: T00-a, T00-b 完成后开始
涉及文件:
  - prisma/schema.prisma

任务描述:
  在 Item model 新增以下字段，全部可空：
  
  craftId        Int?      // 工艺字典外键（DictCraft 表在 T02-a 建，这里先加字段）
  origin         String?   // 产地
  era            String?   // 年代款式
  certNo         String?   // 证书编号
  mainColor      String?   // 主色
  subColor       String?   // 副色
  priceRange     String?   // 价格带：走量/中档/精品
  storyPoints    String?   // 故事点（长文本）
  operationNote  String?   // 经营笔记（长文本，AI不读）
  extraData      String?   // JSON扩展预留字段
  
  新增索引：
  @@index([priceRange])
  
  注意：craftId 的外键关联（relation）暂不加，等 T02-a 建好 DictCraft 后在 T02-b 统一处理。
  
  执行：npx prisma db push

验收:
  - npx prisma db push 成功，无报错
  - 打开一条现有 Item 详情，页面不报错（新字段为 null，不影响显示）
  - pnpm lint --quiet 无新增报错

完成后:
  - 在备注里写明：已执行 npx prisma db push，成功
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T01-b 更新 Item 创建 API 接受新字段
```
status: 阻塞-依赖未完成
依赖: T01-a
涉及文件:
  - src/app/api/items/route.ts

任务描述:
  POST /api/items 的处理逻辑中，
  在从 request body 提取参数处，新增以下字段的提取（全部可选）：
  craftId, origin, era, certNo, mainColor, subColor,
  priceRange, storyPoints, operationNote, extraData
  
  校验规则：
  - priceRange 如果传入，只接受 '走量'|'中档'|'精品'，否则返回 400
  - storyPoints 和 operationNote 长度上限 5000 字符
  - 其他字段无特殊校验，trim 处理即可
  
  把这些字段传入 prisma.item.create 的 data 对象里。

验收:
  - POST /api/items 传入 priceRange='精品' 能成功创建
  - POST /api/items 传入 priceRange='非法值' 返回 400
  - POST /api/items 不传新字段（保持原有行为）能正常创建
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T01-c 更新 Item 编辑 API 接受新字段
```
status: 阻塞-依赖未完成
依赖: T01-b
涉及文件:
  - src/app/api/items/[id]/route.ts

任务描述:
  PATCH /api/items/[id] 同样处理新增字段，逻辑与 T01-b 相同。
  GET /api/items/[id] 的响应中确保包含新字段（Prisma select 或默认返回即可）。

验收:
  - PATCH /api/items/[id] 能更新 storyPoints 字段
  - GET /api/items/[id] 响应里能看到新字段（值为 null 也算）
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T01-d 更新 item-create-dialog 显示新字段
```
status: 阻塞-依赖未完成
依赖: T01-c
涉及文件:
  - src/components/inventory/item-create-dialog.tsx

任务描述:
  在新建商品对话框中新增一个 Tab "内容属性"（放在现有 Tab 最后）。
  Tab 内包含以下字段（全部选填，无必填标记）：
  
  第一组（一行两列）：
  - 主色（Input）
  - 副色（Input）
  
  第二组（一行两列）：
  - 产地（Input，placeholder "如：新疆、缅甸"）
  - 年代款式（Input，placeholder "如：现代工、明清老件"）
  
  第三组（一行两列）：
  - 证书编号（Input）
  - 价格带（Select，选项：走量/中档/精品）
  
  第四组（整行）：
  - 故事点（Textarea，4行，placeholder "此件为...材质细腻，工艺为...，适合..."）
  
  第五组（整行）：
  - 经营笔记（Textarea，3行，placeholder "自用备注，不会生成到文案中"）
  
  提交时把这些字段加入 API 请求 body。

验收:
  - 新建商品对话框出现"内容属性" Tab
  - 填入故事点后保存，重新打开该商品能看到内容
  - 不填内容属性直接保存，原有行为不受影响
  - 移动端（Chrome 手机模式）布局不错乱
  - pnpm lint --quiet 无新增报错
  - agent browser QA：新建一条商品，填写内容属性，保存，再打开验证

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T01-e 更新 item-detail-dialog 展示新字段
```
status: 阻塞-依赖未完成
依赖: T01-d
涉及文件:
  - src/components/inventory/item-detail-dialog.tsx

任务描述:
  在商品详情侧边栏/对话框中新增"内容属性"展示区域。
  
  展示逻辑：
  - 如果所有新字段都为空，整个区域折叠/不显示（避免空白区块）
  - 有值的字段才显示，空值显示 "—"
  - storyPoints 保留换行（whitespace-pre-wrap）
  - operationNote 同样保留换行，加一个小标签"经营笔记（私用）"以区分

验收:
  - 有内容属性的商品详情页正确显示
  - 无内容属性的商品详情页不出现空白区块
  - pnpm lint --quiet 无新增报错
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T01-f 新增 constants.ts 枚举常量
```
status: 阻塞-依赖未完成
依赖: T01-b
涉及文件:
  - src/lib/constants.ts（不存在则新建）

任务描述:
  新建或追加 src/lib/constants.ts，定义以下常量：
  
  export const PRICE_RANGES = ['走量', '中档', '精品'] as const;
  export type PriceRange = typeof PRICE_RANGES[number];
  
  （后续 T03 的状态字段常量也会加到这里）
  
  同时把 T01-b 和 T01-c 里硬编码的 '走量'|'中档'|'精品' 改为引用这个常量。

验收:
  - constants.ts 存在且可被导入
  - API 里的枚举校验改为用 PRICE_RANGES.includes()
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

## 第三优先级：M1 字典扩展（工艺/卖点/人群）

> T01 全部完成后再开始 T02。

### T02-a 新建 DictCraft 工艺字典表
```
status: 阻塞-依赖未完成
依赖: T01-a 全系列完成
涉及文件:
  - prisma/schema.prisma
  - prisma/seed-base.ts
  - src/app/api/dicts/crafts/route.ts（新建）

任务描述:
  1. schema.prisma 新增 DictCraft model：
     model DictCraft {
       id          Int      @id @default(autoincrement())
       name        String   @unique
       description String?
       sortOrder   Int      @default(0)
       isActive    Boolean  @default(true)
       items       Item[]
     }
     
     同时给 Item 加上 relation：
     craft  DictCraft? @relation(fields: [craftId], references: [id])
  
  2. 执行 npx prisma db push
  
  3. seed-base.ts 新增默认工艺项：
     手工雕刻 / 机雕 / 半手工 / 素面 / 镂空雕 / 浮雕 / 圆雕 / 未知
  
  4. 新建 src/app/api/dicts/crafts/route.ts
     参考现有 src/app/api/dicts/ 下的路由实现（材质或器型）
     支持：GET（列表）/ POST（新建）
  
  5. 新建 src/app/api/dicts/crafts/[id]/route.ts
     支持：PATCH（修改）/ DELETE（删除，有 Item 关联时返回 400）

验收:
  - npx prisma db push 成功
  - GET /api/dicts/crafts 返回 8 条默认工艺
  - POST /api/dicts/crafts 能新建
  - DELETE /api/dicts/crafts/[id] 有 Item 关联时返回 400
  - pnpm lint --quiet 无新增报错

完成后:
  - 备注写明：已执行 db push
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T02-b item-create-dialog 工艺下拉联动
```
status: 阻塞-依赖未完成
依赖: T02-a
涉及文件:
  - src/components/inventory/item-create-dialog.tsx
  - src/lib/api.ts

任务描述:
  1. api.ts 新增 dictsApi.crafts.list() 方法，调用 GET /api/dicts/crafts
  2. item-create-dialog 的"内容属性" Tab 里，
     在价格带字段旁边加一个"工艺"Select 下拉，
     选项从 /api/dicts/crafts 动态加载（isActive=true 的）
  3. 提交时把 craftId 加入请求 body

验收:
  - 内容属性 Tab 里出现工艺下拉，选项正确
  - 选择工艺后保存，数据库里 Item.craftId 有值
  - pnpm lint --quiet 无新增报错
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T02-c settings-tab 新增工艺字典管理页
```
status: 阻塞-依赖未完成
依赖: T02-a
涉及文件:
  - src/components/inventory/settings-tab.tsx

任务描述:
  在设置页的字典管理区域新增"工艺"子 Tab。
  交互与现有材质/器型字典管理完全一致：
  - 列表展示（名称、描述、排序、启用状态）
  - 新增按钮 + 对话框
  - 编辑（行内或对话框）
  - 删除（有关联时报错提示）

验收:
  - 设置页能看到工艺 Tab
  - 可以新增/编辑/删除工艺项
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T02-d 新建卖点和人群字典表及 API
```
status: 阻塞-依赖未完成
依赖: T02-a 完成（与 T02-b/T02-c 可并行）
涉及文件:
  - prisma/schema.prisma
  - prisma/seed-base.ts
  - src/app/api/dicts/selling-points/route.ts（新建）
  - src/app/api/dicts/selling-points/[id]/route.ts（新建）
  - src/app/api/dicts/audiences/route.ts（新建）
  - src/app/api/dicts/audiences/[id]/route.ts（新建）

任务描述:
  1. schema.prisma 新增：
  
  model DictSellingPoint {
    id     Int    @id @default(autoincrement())
    name   String @unique
    sortOrder Int @default(0)
    isActive  Boolean @default(true)
    items  ItemSellingPoint[]
  }
  
  model ItemSellingPoint {
    itemId         Int
    sellingPointId Int
    item           Item             @relation(fields: [itemId], references: [id], onDelete: Cascade)
    sellingPoint   DictSellingPoint @relation(fields: [sellingPointId], references: [id])
    @@id([itemId, sellingPointId])
  }
  
  model DictAudience {
    id     Int    @id @default(autoincrement())
    name   String @unique
    sortOrder Int @default(0)
    isActive  Boolean @default(true)
    items  ItemAudience[]
  }
  
  model ItemAudience {
    itemId     Int
    audienceId Int
    item       Item         @relation(fields: [itemId], references: [id], onDelete: Cascade)
    audience   DictAudience @relation(fields: [audienceId], references: [id])
    @@id([itemId, audienceId])
  }
  
  Item model 新增反向关联：
    sellingPoints ItemSellingPoint[]
    audiences     ItemAudience[]
  
  2. 执行 npx prisma db push
  
  3. seed-base.ts 新增默认卖点：
     送礼 / 自戴 / 收藏 / 投资 / 孤品 / 性价比 / 名家出品 / 完美无瑕 / 稀有料子
  
     默认人群：
     年轻女性 / 中年女性 / 中年男性 / 资深藏家 / 新手入门 / 送长辈 / 送爱人 / 送朋友
  
  4. 新建四个 API 路由（参考 DictCraft 的实现）
     卖点和人群的 GET/POST/PATCH/DELETE 各一套

验收:
  - npx prisma db push 成功
  - GET /api/dicts/selling-points 返回 9 条默认卖点
  - GET /api/dicts/audiences 返回 8 条默认人群
  - pnpm lint --quiet 无新增报错

完成后:
  - 备注写明：已执行 db push
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T02-e item-create-dialog 卖点和人群多选
```
status: 阻塞-依赖未完成
依赖: T02-d
涉及文件:
  - src/components/inventory/item-create-dialog.tsx
  - src/app/api/items/route.ts
  - src/app/api/items/[id]/route.ts
  - src/lib/api.ts

任务描述:
  1. 内容属性 Tab 新增两个多选区域（参考现有标签多选的实现方式）：
     - 卖点（多选 Checkbox 组或 Tag 点击选择）
     - 目标人群（同上）
  
  2. POST /api/items 入参新增 sellingPointIds: number[]
     创建 Item 后在 ItemSellingPoint 表批量插入关联
  
  3. PATCH /api/items/[id] 入参新增 sellingPointIds 和 audienceIds
     更新时先删除旧关联再插入新关联（replace 语义）
  
  4. GET /api/items/[id] 响应包含：
     sellingPoints: [{id, name}, ...]
     audiences: [{id, name}, ...]

验收:
  - 创建商品时能多选卖点和人群，保存后重开能看到
  - GET /api/items/[id] 响应里有 sellingPoints 和 audiences
  - pnpm lint --quiet 无新增报错
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

## 第四优先级：M1 商品状态追踪

> T01 全系列完成后可开始，T02 可并行。

### T03-a schema 新增状态字段和 constants
```
status: 阻塞-依赖未完成
依赖: T01-a 完成
涉及文件:
  - prisma/schema.prisma
  - src/lib/constants.ts

任务描述:
  1. schema.prisma Item model 新增：
  
  priorityTier    String?  @default("未定")    // A / B / C / 未定
  shootingStatus  String?  @default("未拍")    // 未拍/白底完成/细节完成/场景完成/全套完成
  contentStatus   String?  @default("未生产")  // 未生产/已生产/已发布/多平台发布
  firstShotAt     DateTime?
  lastShotAt      DateTime?
  firstPublishAt  DateTime?
  lastPublishAt   DateTime?
  
  新增索引：
  @@index([priorityTier])
  @@index([shootingStatus])
  @@index([contentStatus])
  
  执行：npx prisma db push
  
  2. constants.ts 追加：
  
  export const PRIORITY_TIERS = ['A', 'B', 'C', '未定'] as const;
  export const SHOOTING_STATUSES = ['未拍','白底完成','细节完成','场景完成','全套完成'] as const;
  export const CONTENT_STATUSES = ['未生产','已生产','已发布','多平台发布'] as const;
  
  export type PriorityTier = typeof PRIORITY_TIERS[number];
  export type ShootingStatus = typeof SHOOTING_STATUSES[number];
  export type ContentStatus = typeof CONTENT_STATUSES[number];

验收:
  - npx prisma db push 成功
  - constants.ts 可被导入
  - 现有 Item 详情页不报错（新字段 null/默认值）
  - pnpm lint --quiet 无新增报错

完成后:
  - 备注写明：已执行 db push
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T03-b 新增状态专用 PATCH 路由
```
status: 阻塞-依赖未完成
依赖: T03-a
涉及文件:
  - src/app/api/items/[id]/status/route.ts（新建）

任务描述:
  新建 PATCH /api/items/[id]/status 路由。
  
  入参（body，至少传一个）：
  { priorityTier?, shootingStatus?, contentStatus? }
  
  逻辑：
  - 校验传入值在 constants.ts 的枚举列表内，否则 400
  - 更新对应字段
  - 状态变化时间戳逻辑：
    * shootingStatus 从 '未拍' 变为其他 → 若 firstShotAt 为空则填入当前时间
    * 任何 shootingStatus 变化 → 更新 lastShotAt
    * contentStatus 变为 '已发布' 或 '多平台发布' → 若 firstPublishAt 为空则填入当前时间，更新 lastPublishAt
  - 写入 OperationLog（参考现有写日志的逻辑）
  - 返回更新后的 Item

验收:
  - PATCH /api/items/[id]/status 传 priorityTier='A' 成功
  - 传非法值返回 400
  - shootingStatus 从未拍改为白底完成，firstShotAt 有值
  - OperationLog 里有记录
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T03-c 列表页新增状态筛选和状态列
```
status: 阻塞-依赖未完成
依赖: T03-b
涉及文件:
  - src/app/api/items/route.ts
  - src/components/inventory/inventory-tab.tsx

任务描述:
  1. GET /api/items 支持新增 query 参数：
     ?priorityTier=A&shootingStatus=未拍&contentStatus=未生产
     多个参数可组合（AND 关系）
  
  2. inventory-tab.tsx 筛选区新增三个 Select：
     档位（全部/A/B/C/未定）
     拍摄状态（全部/未拍/白底完成/...）
     内容状态（全部/未生产/...）
  
  3. 表格新增三列（加到现有列后面）：
     - 档位：彩色 Badge（A=红/B=橙/C=灰/未定=蓝灰）
     - 拍摄状态：Badge
     - 内容状态：Badge
     建议在现有"列显示"控制里加这三列的开关（如果有该功能的话）

验收:
  - 筛选 priorityTier=A 只显示 A 档商品
  - 组合筛选 A 档 + 未拍 返回正确结果
  - 列表里能看到三个状态 Badge
  - pnpm lint --quiet 无新增报错
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T03-d 新建商品时自动预填档位
```
status: 阻塞-依赖未完成
依赖: T03-b
涉及文件:
  - src/components/inventory/item-create-dialog.tsx

任务描述:
  在新建商品对话框里，当用户填写成本价后，
  自动根据成本价预填档位字段（用户可手动覆盖）：
  - costPrice >= 5000 → A
  - costPrice 500-4999 → B
  - costPrice < 500 → C
  - costPrice 未填 → 未定
  
  在"内容属性" Tab 里显示档位字段（Select 下拉，选项 A/B/C/未定）。
  或者在基础信息 Tab 里放也可以，选择更显眼的位置。

验收:
  - 填入成本价 8000，档位自动变为 A
  - 手动把档位改为 B，保存后是 B（不被成本价覆盖）
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T03-e 状态统计 API
```
status: 阻塞-依赖未完成
依赖: T03-a
涉及文件:
  - src/app/api/items/stats/status-summary/route.ts（新建）

任务描述:
  新建 GET /api/items/stats/status-summary 路由。
  
  返回格式：
  {
    "code": 0,
    "data": {
      "byPriority": { "A": 0, "B": 0, "C": 0, "未定": 0 },
      "byShooting": { "未拍": 0, "白底完成": 0, "细节完成": 0, "场景完成": 0, "全套完成": 0 },
      "byContent": { "未生产": 0, "已生产": 0, "已发布": 0, "多平台发布": 0 },
      "total": 0
    }
  }
  
  用 Prisma groupBy 或多个 count 查询实现。

验收:
  - API 返回正确格式
  - 各计数加总等于 Item 总数（status=in_stock 和 sold 都算，按实际业务定）
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

## 第五优先级：M1 结构化导出 API

> T01 + T02 全系列完成后再开始 T04。这是 M1 的验收里程碑。

### T04-a 新建单 SKU 导出 API
```
status: 阻塞-依赖未完成
依赖: T02-e, T03-a
涉及文件:
  - src/app/api/items/[id]/export-for-ai/route.ts（新建）

任务描述:
  新建 GET /api/items/[id]/export-for-ai 路由。
  
  响应格式（字段名用中文）：
  {
    "code": 0,
    "data": {
      "SKU编码": "...",
      "商品名称": "...",
      "材质大类": "...",      // material.parent?.category 或 material.category
      "材质细类": "...",      // material.name
      "器型": "...",          // type.name
      "工艺": "...",          // craft?.name 或 null
      "产地": "...",          // origin 或 null
      "年代款式": "...",       // era 或 null
      "证书编号": "...",       // certNo 或 null
      "主色": "...",
      "副色": "...",
      "尺寸": { 从 ItemSpec 提取，保持原结构 },
      "重量": "...",
      "价格带": "...",
      "建议售价": 0,
      "卖点标签": ["..."],    // sellingPoints.map(s=>s.sellingPoint.name)
      "目标人群": ["..."],    // audiences.map(a=>a.audience.name)
      "故事点": "...",        // storyPoints，null 则为 null
      "图片": {
        "主图": null,         // 暂时返回第一张图的 url，M2 会细化
        "所有图片": ["..."]   // 所有 ItemImage.url
      },
      "状态": {
        "档位": "...",
        "拍摄状态": "...",
        "内容状态": "..."
      },
      "最后更新": "ISO时间字符串"
    }
  }
  
  注意：
  - operationNote 不返回（私用字段）
  - extraData 不返回
  - 所有字段有值就返回值，无值返回 null，不省略字段

验收:
  - 找一个信息填写比较完整的 SKU 调用此接口
  - 返回 JSON 字段完整，格式正确，无 undefined
  - 找一个信息几乎都是空的 SKU 调用，所有字段都返回 null 而非 undefined
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T04-b 列表页新增"导出 AI 喂料"按钮
```
status: 阻塞-依赖未完成
依赖: T04-a
涉及文件:
  - src/components/inventory/item-detail-dialog.tsx
  - src/lib/api.ts

任务描述:
  1. api.ts 新增 itemsApi.exportForAI(id) 方法
  
  2. item-detail-dialog.tsx 顶部操作区新增两个按钮：
     - "复制 AI 喂料"：调用 exportForAI，把返回的 data 对象 JSON.stringify(null, 2) 后写入剪贴板
       成功后 Toast 提示"已复制到剪贴板"
     - "下载 JSON"：同上，但触发下载 `{SKU编码}.json` 文件

验收:
  - 商品详情页能看到两个按钮
  - 点击"复制 AI 喂料"，剪贴板里有完整 JSON
  - 点击"下载 JSON"，浏览器下载文件，内容正确
  - agent browser QA

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

## M1 验收里程碑（T04-b 完成后执行）

### T04-z M1 整体验收
```
status: 阻塞-依赖未完成
依赖: T04-b 完成

任务描述（人工执行，非代码任务）:
  1. 找 3 个真实 SKU，填写完整的内容属性（工艺/故事点/卖点/人群）
  2. 调用 /api/items/[id]/export-for-ai，检查 JSON 字段是否完整
  3. 把 JSON 贴给 Claude，使用以下 prompt：
  
     "你是一个资深珠宝玉器内容创作者。根据以下商品数据，写一篇 200-300 字的小红书文案，
     风格：真诚分享、带个人体验感、使用 3-5 个 emoji、结尾提一个问题引导评论。
     输出：标题（30字内）、正文、5-8个话题标签。商品数据：{粘贴 JSON}"
  
  4. 如果 AI 生成的文案可以直接或稍微修改后发出 → M1 验收通过
  5. 如果 AI 说"信息不足"或生成的内容明显失准 → 回头补字段（重开任务）
  
  验收通过后：
  - 在本任务备注里写"M1 验收通过，日期：[日期]"
  - status=已完成
  - 通知人工：M1 完成，可以开始 M2

status: 阻塞-依赖未完成
```
备注: ___

---

## 后续任务（M2/M3/M10 等）

M2（拍摄任务/照片索引/NAS扫描）和 M10（认知底座）的任务在 M1 验收通过后展开。
届时人工会更新本文件，在此追加新的任务组。

---

## 进度统计（agent 每次启动时更新这一行）

```
最后更新: 2026-04-19
已完成: 0 / 19 个任务
当前正在执行: T00-a
下一个待执行: T00-a
预计 M1 完成: ____
```
