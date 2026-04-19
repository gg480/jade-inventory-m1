# TASK_QUEUE 追加 - T05 测试基建系列

> 追加到 TASK_QUEUE.md 现有内容后面。优先级高于所有未完成任务。
> 本批次任务执行完后，此文件内容可并入 TASK_QUEUE.md 主文件。

---

## 第零优先级（插队）：测试基建

> 以下任务优先级高于 M2 和任何未完成的业务功能。
> 理由：T01-T04 已由 agent 自主完成，但缺少回归测试保护。
> 在进入 M2 前必须补齐测试基建，否则后续改动会持续破坏已有功能。

> 执行顺序：T05-a → T05-b → T05-c 三个完成后，T05-d/e/f/g/h/i 可并行。

---

### T05-a 新建健康检查 API
```
status: 已完成
依赖: 无
涉及文件:
  - src/app/api/health/route.ts（新建）

任务描述:
  新建 GET /api/health 路由。
  
  响应格式:
  {
    "code": 0,
    "data": {
      "status": "ok",
      "timestamp": "ISO时间字符串",
      "version": "从 package.json 读取的 version",
      "db": {
        "connected": true,
        "itemCount": 123,
        "dictMaterialCount": 10
      },
      "uptime": 进程运行秒数
    },
    "message": "ok"
  }
  
  实现要点:
  - 用 prisma.item.count() 验证数据库连接
  - 用 prisma.dictMaterial.count() 验证种子数据存在
  - 任何一步失败返回 code=500，data.db.connected=false, data.db.error=错误信息
  - 不做认证（健康检查必须匿名可访问）
  - 响应时间应 <500ms

验收:
  - curl http://localhost:5000/api/health 返回正确 JSON
  - 停掉数据库后再请求，返回 500 且 error 有值
  - pnpm lint --quiet 无新增报错

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: T05-a完成(2026-04-19)。新建GET /api/health路由，返回{code:0,data:{status:'ok',timestamp,version,db:{connected:true,itemCount,dictMaterialCount},uptime,responseTime},message:'ok'}。数据库连接失败时返回code=500+error信息。不做认证。实测22ms响应。验收：curl http://localhost:5000/api/health 返回正确JSON(44 items, 39 materials)。

---

### T05-b 编写启动自检脚本
```
status: 已完成
依赖: T05-a
涉及文件:
  - scripts/smoke-test.sh（新建）
  - scripts/smoke-test.bat（新建，Windows 兼容）
  - package.json（新增 scripts 条目）

任务描述:
  新建启动自检脚本，顺序执行以下检查：
  
  1. pnpm install --frozen-lockfile
  2. npx prisma generate
  3. npx prisma db push
  4. pnpm run build（输出存 /tmp/build.log 或 build.log，检查有无 "error" 关键字但忽略 error-handler 等正常命名）
  5. 后台启动 pnpm run start，sleep 15 秒
  6. curl http://localhost:5000/api/health 验证返回 code=0
  7. kill 掉后台进程
  
  任一步失败：打印具体错误，exit 1
  全部通过：打印 "✅ 启动自检通过"，exit 0
  
  脚本必须：
  - 有明确的错误提示（失败在哪一步、错误信息）
  - 清理后台进程（即使中途失败也要 kill server）
  - 幂等（重复跑不会造成副作用）
  
  package.json 新增:
  "scripts": {
    ...
    "test:smoke": "bash scripts/smoke-test.sh"
  }

验收:
  - bash scripts/smoke-test.sh 在干净 repo 上能跑通，总耗时 < 90 秒
  - 故意破坏（比如删掉 prisma/schema.prisma 里的某行）后跑，在对应步骤失败并报错
  - pnpm run test:smoke 同等效果

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___
备注: T05-b完成(2026-04-19)。新建scripts/smoke-test.sh和smoke-test.bat启动自检脚本，7步顺序执行(bun install→prisma generate→prisma db push→next build→next start→health check→cleanup)。package.json新增test:smoke脚本。build日志检查error关键字排除正常命名。trap EXIT清理后台进程。幂等。实测全部7步通过，总耗时约60秒。

---

### T05-c 更新 AGENT_BRIEFING 追加测试规则
```
status: 已完成
依赖: T05-b
涉及文件:
  - AGENT_BRIEFING.md

任务描述:
  在 AGENT_BRIEFING.md 末尾追加一个章节 "## 测试规则（必须遵守）"，
  内容如下（原文照抄，不要修改措辞）：
  
  ```
  ## 测试规则（必须遵守）
  
  ### 提交前必跑
  每个原子任务完成后、commit 前必须按顺序执行：
  1. pnpm run test:smoke（启动自检）—— 不通过不许 commit
  2. pnpm run test:api（如改动涉及 API 路由）—— 不通过不许 commit
  3. pnpm lint --quiet —— 不通过不许 commit
  4. 所有改动涉及数据库 schema 时额外跑 pnpm run test:integrity
  
  任一失败：不提交代码，在任务备注里记录失败信息，status=阻塞-测试未通过。
  
  ### 改 API 时必须同步更新测试
  修改或新增任何 /api/ 路由时：
  1. 先检查 tests/api/ 下有没有对应测试文件
  2. 有就更新测试，没有就新建
  3. 测试必须包含：
     - 正常入参返回 code=0 + 关键字段
     - 缺失必填参数返回 code=400
     - 非法枚举值返回 code=400
     - 关联查询返回正确结构
  
  ### 改 Schema 时
  修改 prisma/schema.prisma 后：
  1. npx prisma db push
  2. pnpm run test:integrity 确认无数据异常
  3. 有异常先修数据迁移脚本再提交
  
  ### 写测试时发现 bug
  - 能明确判断是 bug 的：直接修，在任务备注里说明"顺便修复了 xxx bug"
  - 不能明确判断的：在任务备注记录，status=已完成-有问题，继续下一任务
  ```
  
  同时更新 AGENT_BRIEFING.md 前面的"每次启动的固定流程"章节，
  把第5步"执行 git 同步"之后追加一步"执行 pnpm run test:smoke 确认环境健康"。

验收:
  - AGENT_BRIEFING.md 末尾有新增章节
  - "每次启动的固定流程"多了 smoke test 步骤
  - 无其他内容被误删

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___
备注: T05-c完成(2026-04-19)。AGENT_BRIEFING.md"每次启动固定流程"第6步新增smoke test。末尾新增"测试规则（必须遵守）"章节（提交前必跑/改API必须同步测试/改Schema流程/写测试发现bug处理原则）。无其他内容误删。

---

### T05-d 搭建 API 测试基础设施
```
status: 已完成
依赖: T05-c
涉及文件:
  - tests/api/helpers/setup.ts（新建）
  - tests/api/helpers/factories.ts（新建）
  - tests/api/helpers/client.ts（新建）
  - package.json（新增 test:api 脚本）
  - vitest.config.ts 或 jest.config.ts（按项目实际测试框架选择，若未配置则引入 vitest）

任务描述:
  先检查项目是否已有测试框架（看 package.json 里有无 vitest 或 jest）。
  
  如果没有：
  - 引入 vitest（更现代、零配置、快）：pnpm add -D vitest @vitest/ui
  - 新建 vitest.config.ts，配置 test 环境为 node
  
  然后新建测试基础设施：
  
  1. tests/api/helpers/setup.ts
     - 导出 beforeAll/afterAll 钩子，准备测试数据库（用独立的 test.db）
     - 提供 resetDb() 函数，每个测试开始前重置数据
     - 提供 seedBaseDicts() 函数，种入基础字典数据
  
  2. tests/api/helpers/client.ts
     - 导出 apiGet/apiPost/apiPatch/apiDelete 封装函数
     - 自动拼接 baseURL（默认 http://localhost:5000，可环境变量覆盖）
     - 自动处理 response.json()
     - 返回 { code, data, message } 标准结构
  
  3. tests/api/helpers/factories.ts
     - 提供测试数据工厂函数：
       createMinimalItem() → 最少字段的合法 Item
       createFullItem() → 所有新字段都填的 Item
       createMaterial() / createType() / createCraft() 等
     - 每个工厂返回实际创建后的对象（含 ID）
  
  4. package.json 新增:
     "scripts": {
       "test:api": "vitest run tests/api"
     }
  
  5. 新建一个最小的示例测试 tests/api/health.test.ts:
     - 测试 GET /api/health 返回 code=0
     - 用于验证测试框架工作正常

验收:
  - pnpm run test:api 能跑，health.test.ts 测试通过
  - 测试使用独立的 test.db，不污染开发数据库
  - 环境变量 DATABASE_URL 在测试时自动指向 test.db
  - 每次 test:api 前自动重置 test.db

完成后:
  - 更新 CHANGELOG.md
  - 更新 AGENTS.md 追加"测试" 章节，说明如何跑测试
  - status=已完成
```
备注: ___
备注: T05-d完成(2026-04-19)。引入vitest(v4.1.4)，新建vitest.config.ts(test.db独立数据库)。setup.ts: beforeAll/afterAll钩子+resetDb()+seedBaseDicts()。client.ts: apiGet/apiPost/apiPatch/apiPut/apiDelete封装。factories.ts: createMinimalItem/createFullItem/createMaterial/createType/createCraft/createSellingPoint/createAudience/createCustomer工厂函数。health.test.ts: 6个测试全部通过。package.json新增test:api脚本。AGENTS.md追加Testing章节。

---

### T05-e 为 T01 系列补 API 测试
```
status: 已完成
依赖: T05-d
涉及文件:
  - tests/api/items.test.ts（新建）
  - tests/api/items-export.test.ts（新建）

任务描述:
  为 T01-a 到 T04-b 已实现的 API 补测试。
  
  1. tests/api/items.test.ts 至少覆盖：
  
     POST /api/items:
     - 最少字段（name）创建成功，返回 code=0
     - 包含所有新字段（priceRange, storyPoints, craftId 等）创建成功
     - priceRange='非法值' 返回 code=400
     - 缺失 name 返回 code=400
     - 传入 storyPoints 超过 5000 字符返回 code=400
     - 传入 costPrice=5000 创建，返回的 priorityTier 自动为 'A'
     - 传入 costPrice=1000 创建，priorityTier='B'
     - 传入 costPrice=300 创建，priorityTier='C'
  
     PATCH /api/items/[id]:
     - 更新 storyPoints 成功
     - 更新 sellingPointIds (数组) 成功，关联表正确更新
     - 更新 audienceIds 成功
     - 部分更新（只传一个字段）不影响其他字段
  
     GET /api/items/[id]:
     - 返回结构包含新字段 (即使 null)
     - 返回结构包含 sellingPoints / audiences / craft 关联对象
  
     PATCH /api/items/[id]/status:
     - 改 priorityTier='A' 成功
     - 改 shootingStatus 从 '未拍' 到 '白底完成'，firstShotAt 自动填入
     - 改 contentStatus 到 '已发布'，firstPublishAt 自动填入
     - 传入非法枚举值返回 400
  
  2. tests/api/items-export.test.ts 至少覆盖：
  
     GET /api/items/[id]/export-for-ai:
     - 返回结构包含所有中文字段
     - 响应不包含 operationNote 字段（私有字段不泄露）
     - 响应不包含 extraData 字段
     - 材质大类正确推断（如果材质无父级，从 category 取）
     - storyPoints 保留换行符
     - 空字段显式返回 null 而非 undefined

验收:
  - pnpm run test:api 包含本次新增测试，全部通过
  - 测试总数至少 25 个
  - 如发现已实现功能有 bug，修复后再提交，备注说明

完成后:
  - 更新 CHANGELOG.md
  - status=已完成（如有修 bug 注明已完成-修复N个bug）
```
备注: ___
备注: T05-e完成(2026-04-19)。items.test.ts: 28个测试覆盖POST/PUT/GET/PATCH status四个端点。items-export.test.ts: 11个测试覆盖export-for-ai端点。setup.ts修复3个bug(移除skipDuplicates/改用deleteMany/setupTestDb不再db push)。总测试数45个(6+28+11)，全部通过。

---

### T05-f 为 T02 系列补 API 测试
```
status: 已完成
依赖: T05-d（可与 T05-e 并行）
涉及文件:
  - tests/api/dicts-craft.test.ts（新建）
  - tests/api/dicts-selling-points.test.ts（新建）
  - tests/api/dicts-audiences.test.ts（新建）

任务描述:
  为 T02-a 到 T02-e 实现的字典 API 补测试。
  
  每个字典测试文件包含：
  
  - GET /api/dicts/xxx 返回默认种子数据（数量正确）
  - POST /api/dicts/xxx 新建成功
  - POST 重复 name 返回 400
  - PATCH /api/dicts/xxx/[id] 更新成功
  - DELETE /api/dicts/xxx/[id] 无关联时成功
  - DELETE 有 Item 关联时返回 400
  - isActive=false 的字典项在默认 GET 列表中是否过滤（按实际实现验证）

验收:
  - pnpm run test:api 包含三个新文件全部通过
  - 测试总数至少 20 个

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: T05-f完成(2026-04-19)。3个测试文件共50个测试（craft 18 + selling-points 16 + audiences 16）。覆盖：GET种子数据验证/isActive过滤/include_inactive/数据结构/sortOrder排序、POST新建/sortOrder默认值/重复名400、PATCH更新名称/sortOrder/description/停用/启用/不存在id、DELETE无关联软删除/有关联返回400。总API测试数95个，全部通过。commit: e5971fd

---

### T05-g 为 CSV 导入补 API 测试
```
status: 待执行
依赖: T05-d
涉及文件:
  - tests/api/imports.test.ts（新建）
  - tests/fixtures/（新建目录）
  - tests/fixtures/items-valid.csv（新建）
  - tests/fixtures/items-duplicate.csv（新建）
  - tests/fixtures/sales-valid.csv（新建）

任务描述:
  为 T00-a 和 T00-b 修复的 CSV 导入逻辑补测试。
  
  1. 在 tests/fixtures/ 下准备三个测试 CSV 文件：
     - items-valid.csv: 10 条合法库存数据，覆盖带数量/带匹配码/有空字段
     - items-duplicate.csv: 与上面有 3 条重复的数据
     - sales-valid.csv: 对应 items-valid 中部分 SKU 的销售记录
  
  2. tests/api/imports.test.ts 测试:
  
     POST /api/import/items-csv:
     - 上传 items-valid.csv，成功 10 条
     - 再次上传同一份，成功 0 条，重复跳过 10 条
     - 上传 items-duplicate.csv（首次），成功 7 条，重复跳过 3 条
     - 含空材质行 → 自动创建"未分类"
     - "数量"列=3 → 创建 3 件独立 Item
     - "匹配码"列 → 存入 notes 为 [MK:xxx] 格式
  
     POST /api/import/sales:
     - 上传 sales-valid.csv（前置已导入库存），成功匹配
     - 匹配码关联优先于名称匹配
     - 无匹配时自动创建 status=sold 的 Item
     - 自动创建客户（按姓名）

验收:
  - pnpm run test:api 全部通过
  - 测试覆盖三种匹配方式（SKU/匹配码/名称+成本）

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T05-h 编写数据完整性检查
```
status: 待执行
依赖: T05-d
涉及文件:
  - tests/data-integrity.test.ts（新建）
  - scripts/check-data-integrity.ts（新建，可独立运行）
  - package.json（新增 test:integrity 脚本）

任务描述:
  编写珠宝 ERP 的数据完整性检查。
  
  scripts/check-data-integrity.ts 实现以下检查（全部基于生产数据库运行，只读）：
  
  1. 外键完整性:
     - 所有 SaleRecord.itemId 指向的 Item 存在
     - 所有 ItemImage.itemId 指向的 Item 存在
     - 所有 Item.batchId（非空时）指向的 Batch 存在
     - 所有 Item.customerId（非空时）指向的 Customer 存在
  
  2. 状态一致性:
     - Item.status='sold' 的都至少有一条对应 SaleRecord
     - Item.status='in_stock' 的不应该有未退货的 SaleRecord
     - priceRange 只能是 '走量'|'中档'|'精品'|null
     - priorityTier 只能是 'A'|'B'|'C'|'未定'|null
     - shootingStatus 只能是常量 SHOOTING_STATUSES 中的值
     - contentStatus 只能是常量 CONTENT_STATUSES 中的值
  
  3. 唯一性:
     - 每个 Item 最多一张 isPrimary=true 的 ItemImage
     - SKU 字段全局唯一
     - 批次 code 全局唯一
  
  4. 数值合法性:
     - costPrice > 0（非 null 时）
     - actualPrice > 0（SaleRecord 中非 null 时）
     - 批次 totalCost >= 0
  
  脚本输出格式:
  - 每类检查输出 ✅ 通过 或 ❌ 发现 N 条异常
  - 异常详情：列出前 10 条异常数据的 ID 和问题描述
  - 最后输出总结：共检查 N 项，通过 X 项，异常 Y 项
  - 有任何异常则 exit 1
  
  tests/data-integrity.test.ts:
  - 用测试数据库先种入故意错误的数据（比如孤立的 SaleRecord）
  - 跑检查脚本，验证能检测出来
  - 然后在干净数据上跑，验证全部通过
  
  package.json:
  "scripts": {
    "test:integrity": "tsx scripts/check-data-integrity.ts"
  }

验收:
  - pnpm run test:integrity 在当前数据库运行，输出各项检查结果
  - pnpm run test:api 包含完整性检查测试
  - 故意破坏数据后能检测出具体问题

完成后:
  - 更新 CHANGELOG.md
  - 备注写明：当前数据库检查结果（通过项数/异常项数）
  - 如发现历史数据有异常，列出异常摘要，不要自动修复，等待人工决策
  - status=已完成
```
备注: ___

---

### T05-i 扩展 E2E 冒烟测试
```
status: 待执行
依赖: T05-d
涉及文件:
  - tests/e2e-click-test.ts（修改）
  - tests/e2e/（新建目录）
  - tests/e2e/flow-new-item.spec.ts（新建）
  - tests/e2e/flow-export-ai.spec.ts（新建）

任务描述:
  不要删除或改写现有 tests/e2e-click-test.ts，只在末尾新增 3 条关键流的断言。
  同时新建两个独立的关键流测试。
  
  在 tests/e2e-click-test.ts 末尾新增:
  
  流程1 - 新建带完整内容属性的商品:
  - 打开新建对话框
  - 填基础信息 + 跳到内容属性 Tab
  - 选工艺、多选卖点、多选人群
  - 填故事点
  - 保存
  - 在列表找到该 SKU，点开详情
  - 验证所有新字段正确显示
  
  流程2 - 复制 AI 喂料:
  - 打开任一带完整字段的商品详情
  - 点"复制 AI 喂料"按钮
  - 验证 Toast 出现
  - （剪贴板验证可选，headless 环境可能不支持，至少验证按钮不报错）
  
  流程3 - 状态筛选:
  - 列表筛选 priorityTier=A
  - 验证所有显示的商品档位都是 A
  - 筛选 shootingStatus=未拍
  - 验证结果符合
  
  新建 tests/e2e/flow-new-item.spec.ts:
  - 用 Playwright 做完整场景测试
  - 从空状态开始，新建一个完整 SKU，验证详情页展示
  
  新建 tests/e2e/flow-export-ai.spec.ts:
  - 调 API 导出，验证 JSON 结构
  - 模拟用户在 UI 上操作导出按钮

验收:
  - npx tsx tests/e2e-click-test.ts 通过（原 79 项 + 新增至少 15 项断言）
  - 如项目已有 Playwright，pnpm run test:e2e 跑新增场景通过
  - 如无 Playwright，在备注里说明，暂时只保留断言式测试，等待人工确认是否引入

完成后:
  - 更新 CHANGELOG.md
  - status=已完成
```
备注: ___

---

### T05-j 统一测试入口和 CI 配置
```
status: 待执行
依赖: T05-e, T05-f, T05-g, T05-h, T05-i 全部完成
涉及文件:
  - package.json（完善 scripts）
  - .github/workflows/test.yml（新建，如已有则修改）
  - AGENTS.md（追加测试章节）

任务描述:
  1. package.json scripts 完善为:
  "scripts": {
    ...
    "test:smoke": "bash scripts/smoke-test.sh",
    "test:api": "vitest run tests/api",
    "test:e2e": "npx tsx tests/e2e-click-test.ts",
    "test:integrity": "tsx scripts/check-data-integrity.ts",
    "test:all": "pnpm run test:smoke && pnpm run test:api && pnpm run test:e2e"
  }
  
  2. 新建 .github/workflows/test.yml:
     - 触发：push 到 dev 分支、PR 到 main
     - 步骤：checkout → pnpm install → prisma generate → prisma db push → test:smoke → test:api
     - 不跑 test:e2e（需要 server 运行，CI 环境复杂）
     - 失败时在 PR 标记红色
  
  3. AGENTS.md 追加章节 "## 测试体系":
     - 列出四层测试：smoke / api / integrity / e2e
     - 每层跑法和用途
     - 提交前最低要求：smoke + api + lint
     - Agent 工作流参考 AGENT_BRIEFING.md 的测试规则

验收:
  - pnpm run test:all 能一次性跑完所有测试
  - 推 dev 分支后 GitHub Actions 自动跑并显示结果
  - AGENTS.md 有清晰的测试章节

完成后:
  - 更新 CHANGELOG.md
  - 更新 TASK_QUEUE.md 把所有 T05 系列整合到主文件，本追加文件可删除
  - status=已完成
```
备注: ___

---

## T05 完工后的里程碑验收

### T05-z 测试体系整体验收
```
status: 阻塞-依赖未完成
依赖: T05-a 到 T05-j 全部完成

任务描述（由 agent 自主执行，生成报告）:

  1. 跑 pnpm run test:all，把完整输出保存到 /tmp/test-all-report.txt
  
  2. 统计并输出:
     - smoke test 耗时
     - API 测试总数 / 通过数 / 耗时
     - E2E 断言总数 / 通过数
     - 数据完整性检查项数 / 异常数
     - 总覆盖 API 路由比例（计算 tests/api 覆盖的路由占 src/app/api 下总路由的百分比）
  
  3. 输出 docs/test-coverage-report.md，包含:
     - 上述统计数据
     - 未覆盖的 API 路由列表
     - 建议下一步扩展的测试方向
  
  4. 如果所有测试都通过，并且 API 覆盖率 >= 60%，则：
     - status=已完成
     - 通知人工：测试体系就绪，可以开始 M2

  如果任何测试失败:
     - status=已完成-有问题
     - 备注详细描述哪些失败、初步判断原因

完成后:
  - 更新 CHANGELOG.md
  - 更新本任务 status
```
备注: ___

---

## 进度追踪

```
T05 系列任务数: 11
已完成: 6
当前执行: T05-g
下一个: T05-g
```

---

## 给 agent 的额外指示

执行本批次任务时注意：

1. **T05-a/b/c 必须串行**，因为 T05-b 的 smoke test 依赖 T05-a 的 health API，T05-c 依赖前两个存在。

2. **T05-d 搭建完测试框架后，e/f/g/h/i 五个可以并行推进**。如果你一次 session 时间够，一次性全做完也可以。

3. **T05-e/f/g 写测试过程中如果发现已有功能的 bug**，优先级分两种：
   - 明显是 bug（参数校验漏、响应字段错）：直接修，在本任务备注注明
   - 难判断是 bug 还是设计（接口语义不清）：本任务 status=已完成-有问题，备注描述，不自行决定

4. **测试用的数据库要严格隔离**。DATABASE_URL 在 test 环境必须指向 test.db，不能污染 custom.db。Prisma 用 dotenv 配合 NODE_ENV=test 切换。

5. **commit 粒度**：每个 T05-x 完成 commit 一次，不要攒多个一起提交。commit message 格式：
   `[T05-a] 新增 /api/health 健康检查路由`

6. **发现 smoke test 跑不通**：说明基础环境有问题，停止后续所有任务，status=阻塞-环境问题，详细备注。这种情况必须人工介入。

7. **整个 T05 系列预计工作量 3-5 天**。如果某一天进度明显落后（比如一天内卡在 T05-d 超过 8 小时），stop 并在备注说明卡点。
