# Changelog

All notable changes to the Jade Inventory Management System (翡翠进销存管理系统).

Format: [BUG] Bug修复 | [FEAT] 功能更新 | [TEST] 测试相关 | [DEPLOY] 部署修复

---

## [2026-03-05]

### [FEAT] 新增"复制AI喂料"和"下载JSON"按钮 (T04-b)
- **修改文件**: `src/lib/api.ts`, `src/components/inventory/item-detail-dialog.tsx`
- **内容**:
  - api.ts 新增 itemsApi.exportForAI(id) 方法，调用 GET /api/items/[id]/export-for-ai
  - item-detail-dialog 底部新增"复制AI喂料"按钮（Copy图标）：调用 exportForAI → JSON.stringify → 写入剪贴板 + toast
  - item-detail-dialog 底部新增"下载JSON"按钮（Download图标）：同上但触发下载 `{SKU编码}.json` 文件
  - 两个按钮共享 exporting 状态防止重复点击

### [FEAT] 新建单SKU导出API (T04-a)
- **新增文件**: `src/app/api/items/[id]/export-for-ai/route.ts`
- **内容**:
  - GET /api/items/[id]/export-for-ai 路由，返回结构化 JSON（中文字段名）
  - 包含字段：SKU编码/商品名称/材质大类/材质细类/器型/工艺/产地/年代款式/证书编号/主色/副色/尺寸/重量/价格带/建议售价/卖点标签/目标人群/故事点/图片(主图+所有图片)/状态(档位/拍摄状态/内容状态)/最后更新
  - 不返回 operationNote 和 extraData（私用字段）
  - 所有字段无值时返回 null，不会出现 undefined

### [FEAT] 新增GET /api/items/stats/status-summary状态统计API (T03-e)
- **新增文件**: `src/app/api/items/stats/status-summary/route.ts`
- **内容**:
  - 使用 Prisma groupBy 按 priorityTier/shootingStatus/contentStatus 分组计数
  - 返回格式 {code:0, data:{byPriority, byShooting, byContent, total}}
  - 所有枚举值初始化为0，未预期值归入默认值
  - api.ts 新增 itemsApi.getStatusSummary 方法

### [FEAT] 新建商品时自动预填档位 (T03-d)
- **修改文件**: `src/components/inventory/item-create-dialog.tsx`, `src/app/api/items/route.ts`
- **内容**:
  - 高货模式成本价输入时自动预填档位（≥5000→A, 500-4999→B, <500→C, 未填→未定）
  - 用户手动选择档位后不会被成本价变化覆盖
  - 内容属性Tab新增档位Select下拉（A/B/C/未定）
  - POST /api/items 新增 priorityTier 入参及 PRIORITY_TIERS 校验

### [FEAT] 列表页新增状态筛选和状态列 (T03-c)
- **修改文件**: `src/app/api/items/route.ts`, `src/components/inventory/inventory-tab.tsx`, `src/lib/api.ts`
- **内容**:
  - GET /api/items 新增 priorityTier/shootingStatus/contentStatus 查询参数（AND 关系过滤）
  - inventory-tab.tsx「更多筛选」区域新增3个Select：档位/拍摄状态/内容状态
  - 表格新增3列Badge：档位(A红/B橙/C灰/未定蓝灰)、拍摄状态(蓝色)、内容状态(紫色)
  - 重置按钮和ActiveFilterTags已更新含新字段
  - api.ts 新增 itemsApi.updateStatus 和 itemsApi.getStatusSummary 方法

### [FEAT] 新增PATCH /api/items/[id]/status状态专用路由 (T03-b)
- **新增文件**: `src/app/api/items/[id]/status/route.ts`
- **内容**:
  - PATCH /api/items/[id]/status 路由，入参 priorityTier/shootingStatus/contentStatus（至少传一个）
  - 校验传入值在 constants.ts 枚举列表内，否则返回 400
  - shootingStatus 从"未拍"变为其他时自动填 firstShotAt；任何 shootingStatus 变化更新 lastShotAt
  - contentStatus 变为"已发布"或"多平台发布"时自动填 firstPublishAt + 更新 lastPublishAt
  - 写入 OperationLog（action=update_status）

### [FEAT] schema新增状态字段+constants常量 (T03-a)
- **修改文件**: `prisma/schema.prisma`, `src/lib/constants.ts`
- **内容**:
  - Item model新增priorityTier(默认"未定")/shootingStatus(默认"未拍")/contentStatus(默认"未生产")3个状态字段
  - 新增4个时间戳字段: firstShotAt/lastShotAt/firstPublishAt/lastPublishAt
  - 新增3个索引: @@index([priorityTier]), @@index([shootingStatus]), @@index([contentStatus])
  - constants.ts新增PRIORITY_TIERS/SHOOTING_STATUSES/CONTENT_STATUSES常量及对应类型
  - 已执行 DATABASE_URL="file:./prisma/db/custom.db" npx prisma db push 成功

---

## [2026-04-21]

### [FEAT] 新建卖点和人群字典表及API (T02-d)
- **修改文件**: `prisma/schema.prisma`, `prisma/seed-base.ts`, `src/app/api/dicts/selling-points/route.ts`, `src/app/api/dicts/selling-points/[id]/route.ts`, `src/app/api/dicts/audiences/route.ts`, `src/app/api/dicts/audiences/[id]/route.ts`
- **内容**:
  - DictSellingPoint/ItemSellingPoint/DictAudience/ItemAudience模型已在schema中（含多对多关联和级联删除）
  - 已执行 DATABASE_URL="file:./db/custom.db" npx prisma db push 成功
  - seed-base.ts已含9种默认卖点（送礼/自戴/收藏/投资/孤品/性价比/名家出品/完美无瑕/稀有料子）和8种默认人群（年轻女性/中年女性/中年男性/资深藏家/新手入门/送长辈/送爱人/送朋友）
  - GET/POST /api/dicts/selling-points 列表查询+新建
  - PATCH/DELETE /api/dicts/selling-points/[id] 更新+删除（关联Item时返回400）
  - GET/POST /api/dicts/audiences 列表查询+新建
  - PATCH/DELETE /api/dicts/audiences/[id] 更新+删除（关联Item时返回400）

### [FEAT] item-create-dialog卖点和人群多选+API支持 (T02-e)
- **修改文件**: `src/app/api/items/route.ts`, `src/app/api/items/[id]/route.ts`, `src/components/inventory/item-detail-dialog.tsx`
- **内容**:
  - item-create-dialog已有卖点和人群多选Checkbox组件（ContentAttributesTab），highValueForm和batchForm均含sellingPointIds/audienceIds数组
  - POST /api/items 新增sellingPointIds/audienceIds参数，创建Item后批量插入ItemSellingPoint/ItemAudience关联记录
  - PUT /api/items/[id] 新增sellingPointIds/audienceIds的replace语义（先deleteMany旧关联再createMany新关联）
  - GET /api/items/[id] 响应新增sellingPoints:[{id,name}]和audiences:[{id,name}]字段
  - item-detail-dialog内容属性区域新增卖点和目标人群显示

---

## [2026-04-19]

### [FEAT] 新建DictCraft工艺字典表及API (T02-a)
- **修改文件**: `prisma/schema.prisma`, `prisma/seed-base.ts`, `src/app/api/dicts/crafts/route.ts`, `src/app/api/dicts/crafts/[id]/route.ts`
- **内容**:
  - DictCraft model（id, name@unique, description?, sortOrder, isActive, items Item[]）及Item.craft relation已存在于schema
  - seed-base.ts新增8种默认工艺：手工雕刻/机雕/半手工/素面/镂空雕/浮雕/圆雕/未知
  - GET /api/dicts/crafts 列表查询 + POST /api/dicts/crafts 新建
  - PATCH /api/dicts/crafts/[id] 更新 + DELETE /api/dicts/crafts/[id] 删除（关联Item时返回400）
  - 已执行 DATABASE_URL="file:./prisma/db/custom.db" npx prisma db push 成功

### [FEAT] item-create-dialog工艺下拉联动 (T02-b)
- **修改文件**: `src/lib/api.ts`, `src/components/inventory/item-create-dialog.tsx`
- **内容**:
  - api.ts已有dictsApi.getCrafts/createCraft/updateCraft/deleteCraft方法
  - item-create-dialog「内容属性」Tab已有工艺Select下拉，从/api/dicts/crafts动态加载isActive=true的选项
  - 提交时craftId已包含在API请求body中（高货模式和通货模式均支持）

### [FEAT] settings-tab新增工艺字典管理页 (T02-c)
- **修改文件**: `src/components/inventory/settings-tab.tsx`
- **内容**:
  - 字典管理区域新增工艺Card（Wrench图标，橙色边框），展示名称/描述/排序/状态列
  - 支持编辑、停用/启用操作
  - 新增创建工艺Dialog（名称/描述/排序）
  - 新增编辑工艺Dialog（名称/描述/排序/状态切换）
  - 与材质/器型管理交互模式一致

### [FEAT] Prisma schema新增商品内容属性字段 (T01-a)
- **修改文件**: `prisma/schema.prisma`
- **内容**:
  - Item model新增8个可空字段: craftId(工艺字典外键)、era(年代款式)、mainColor(主色)、subColor(副色)、priceRange(价格带)、storyPoints(故事点)、operationNote(经营笔记)、extraData(JSON扩展预留)
  - origin和certNo已存在，跳过
  - 新增索引: @@index([priceRange])
  - 已执行 npx prisma db push 成功

### [FEAT] 更新Item创建API接受新字段 (T01-b)
- **修改文件**: `src/app/api/items/route.ts`
- **内容**:
  - POST /api/items 新增提取 craftId/era/mainColor/subColor/priceRange/storyPoints/operationNote/extraData 字段
  - 校验：priceRange 仅接受走量/中档/精品，storyPoints/operationNote 上限 5000 字符
  - 新字段传入 prisma.item.create

### [FEAT] 更新Item编辑API接受新字段 (T01-c)
- **修改文件**: `src/app/api/items/[id]/route.ts`
- **内容**:
  - PUT /api/items/[id] 新增 priceRange/storyPoints/operationNote 校验，craftId 转 parseInt
  - GET /api/items/[id] 默认返回新字段（Prisma 全量返回）
  - trackedFields 新增 7 个新字段用于操作日志

### [FEAT] 更新item-create-dialog显示新字段 (T01-d)
- **修改文件**: `src/components/inventory/item-create-dialog.tsx`
- **内容**:
  - 新增 Tabs 组件（基础信息 / 内容属性）
  - 「内容属性」Tab 包含：主色/副色、产地/年代款式、证书编号/价格带(Select)、故事点(Textarea 4行)、经营笔记(Textarea 3行)
  - 产地和证书编号从基础信息 Tab 移到内容属性 Tab
  - 两种模式（高货/通货）均支持内容属性
  - 表单提交时新字段加入 API 请求 body

### [FEAT] 更新item-detail-dialog展示新字段 (T01-e)
- **修改文件**: `src/components/inventory/item-detail-dialog.tsx`
- **内容**:
  - 新增「内容属性」section 显示主色/副色/年代款式/价格带/故事点/经营笔记
  - 所有新字段为空时整个 section 不显示
  - storyPoints 和 operationNote 使用 whitespace-pre-wrap 保留换行
  - 经营笔记标签标注"私用"

### [FEAT] 新增constants.ts枚举常量并更新API (T01-f)
- **新增文件**: `src/lib/constants.ts`
- **修改文件**: `src/app/api/items/route.ts`, `src/app/api/items/[id]/route.ts`
- **内容**:
  - 新建 constants.ts，定义 PRICE_RANGES = ['走量', '中档', '精品'] as const 及 PriceRange 类型
  - T01-b 和 T01-c 中硬编码的 VALID_PRICE_RANGES 改为引用 PRICE_RANGES 常量
  - 使用 (PRICE_RANGES as readonly string[]).includes() 进行校验

### [FIX] CSV库存导入增强 — 容错+去重+空值保护 (T00-a)
- **修改文件**: `src/app/api/import/items-csv/route.ts`
- **原因**: CSV导入3个问题影响真实数据导入
- **修复**:
  1. `csv-parse` 添加 `relax_column_count: true`，容忍用户CSV列数不一致（常见于Excel导出少填列）
  2. 去重逻辑从仅 `quantity===1` 扩展到所有数量：使用 `db.item.count()` 检查已有记录数，qty>1时按差异量创建（已有3件需5件则补创建2件）
  3. `sellingPrice` 为null时默认0（Prisma schema中sellingPrice是非空Float，写入null会导致错误）
- **验收**: 12条CSV首次导入19件全部成功；二次上传全部去重（19件重复跳过）；空材质/器型自动创建"未分类"；数量>=2正确创建多件Item

### [FIX] CSV销售导入增强 — 容错+匹配码优先+匹配码存储 (T00-b)
- **修改文件**: `src/app/api/import/sales/route.ts`
- **原因**: 销售导入3个问题影响历史数据导入
- **修复**:
  1. `csv-parse` 添加 `relax_column_count: true`，容忍用户CSV列数不一致
  2. 匹配码查找优先匹配 `status='in_stock'` 的Item，避免误匹配已售出的Item
  3. 自动创建Item时将匹配码存入notes `[MK:xxx]`，保持与库存导入一致的关联机制
- **验收**: 6条销售CSV全部成功导入，匹配码关联/名称模糊匹配/自动创建客户/Item状态变sold/自动创建Item均通过

### [FIX] 系统配置无法编辑
- **修改文件**: `src/components/inventory/settings-tab.tsx`
- **原因**: 服务器配置 Input 使用 `value={c.value}` 但无 `onChange` 处理, React 将其视为只读
- **修复**: 新增 `editConfigs` state, Input 绑定 `onChange` 实时更新本地状态, `onBlur` 保存到服务器
- **同时修复**: 压货预警天数独立区域 → 合并到统一配置列表; 数值配置显示百分比换算

### [FEAT] 店铺名称可配置, 同步到导航/登录页/标题栏
- **修改文件**: `settings-tab.tsx`, `navigation.tsx`, `login-page.tsx`, `page.tsx`, `prisma/seed-base.ts`
- **内容**:
  - 系统配置中"店铺名称"输入框, 修改后同步到服务器 `store_name` 配置
  - 导航栏标题、登录页标题、浏览器标签页标题、页脚均读取 `store_name` 配置
  - 新增 `store_name` 到 seed-base.ts (默认值: 翡翠珠宝)
  - 使用 `useState(()=>{localStorage读取})` + `useEffect` 从服务器同步, 避免 hydration 问题

### [FIX] 移除无用的"柜台编号快捷参考"功能
- **修改文件**: `src/components/inventory/settings-tab.tsx`
- **内容**: 删除柜台编号快捷复制按钮区域

### [FIX] 供应商删除保护: 已关联商品/批次的供应商不能删除
- **修改文件**: `src/app/api/suppliers/[id]/route.ts`
- **内容**: DELETE 请求先检查 item.count 和 batch.count, >0 则返回 400 错误提示

### [FIX] CSV库存导入改进
- **修改文件**: `src/app/api/import/items-csv/route.ts`, `settings-tab.tsx`
- **内容**:
  - **数量列**: CSV新增"数量"列, ≥2时创建N件Item, 每件costPrice直接复用(单价不分摊)
  - **去重**: 名称+成本价+证书号组合去重, 已存在则跳过, 结果显示重复跳过数量
  - **材质/器型智能推断**: 从名称中提取关键词(翡翠→翡翠, 手镯→手镯), 推断结果显示给用户
  - **未分类默认值**: 无材质/器型时分配"未分类"(自动创建)
  - **匹配码**: 新增"匹配码"列, 存入notes为`[MK:xxx]`, 用于销售导入关联
  - 导入结果展示: 成功件数、重复跳过、自动创建字典项、推断字段

### [FIX] 销售导入支持无SKU历史数据
- **修改文件**: `src/app/api/import/sales/route.ts`
- **内容**:
  - 支持3种匹配方式: ①SKU精确匹配 → ②匹配码关联查找 → ③名称+成本价模糊匹配
  - 匹配不到时自动创建status='sold'的Item, 再创建SaleRecord (保留库存-销售关联)
  - 自动创建材质/器型(与库存导入一致)
  - 自动创建客户(按姓名匹配)
  - 支持"匹配码"关联: 销售CSV和库存CSV使用相同匹配码自动关联

### [FEAT] 新增"未分类"材质和器型到seed-base
- **修改文件**: `prisma/seed-base.ts`
- **内容**: DictMaterial增加"未分类"(category=其他, sortOrder=99); DictType增加"未分类"

### [FIX] CSV模板更新
- **修改文件**: `src/app/api/import/template/route.ts`, `settings-tab.tsx`
- **内容**: 模板和下载示例增加"数量"、"匹配码"列, 移除旧的SKU必填列

## [2026-04-18]

### [DEPLOY] Docker 镜像体积优化 — standalone 模式
- **修改文件**: `next.config.ts`, `Dockerfile`, `scripts/entrypoint.sh`, `.gitignore`
- **内容**:
  - 启用 Next.js `output: "standalone"` 模式，仅打包运行必需的文件
  - 镜像体积从 ~800MB 缩小到 ~200MB（减少约 75%）
  - runner 阶段改为 `node server.js` 启动（standalone 模式），不再需要完整 node_modules
  - seed-base.ts 预编译为 JS（esbuild），运行时用 `node seed-base.js` 执行，彻底消除 tsx 依赖
  - 修复 tsx 交互式安装提示导致容器启动卡住的问题
  - Dockerfile runner 只安装 prisma CLI（用于 db push），不再安装 tsx

### [FIX] 添加缺失的 csv-parse 依赖 — 修复 Docker 构建 Module not found
- **修改文件**: `package.json`, `pnpm-lock.yaml`, `eslint.config.mjs`
- **内容**:
  - CSV 导入 API 引用了 `csv-parse/sync` 但该依赖未在 package.json 中声明
  - Docker 构建时 Turbopack 报错 `Module not found: Can't resolve 'csv-parse/sync'`（#15/#16 失败）
  - 添加 `csv-parse` 为正式依赖
  - eslint 忽略 `prisma/seed-base.js` 编译产物（CJS require 风格报错）

### [FIX] 修复部署初始化 + CSV 导入数据对齐
- **修改文件**: `scripts/entrypoint.sh`, `src/app/api/import/items-csv/route.ts`, `src/components/inventory/settings-tab.tsx`
- **内容**:
  - entrypoint.sh 移除所有 `2>/dev/null`，seed 失败时打印详细错误信息而非静默"成功"
  - entrypoint.sh 新增数据完整性校验：seed 后检查 DictMaterial 数量，为0则自动重试
  - CSV 导入 SKU 改为**可选**：留空时自动生成（与入库 API 相同逻辑）
  - CSV 导入材质/器型按**名称匹配**：精确匹配已有字典，匹配不到则自动创建
  - 自动创建材质时会推断大类（翡翠→玉、黄金→贵金属等）
  - 前端导入提示更新：必填列仅"名称"，SKU留空自动生成

### [DEPLOY] GitHub Actions 同时推送到阿里云 ACR + Docker Hub
- **修改文件**: `.github/workflows/docker-build.yml`, `docker-compose.yml`
- **内容**:
  - 工作流新增阿里云 ACR 登录和推送步骤
  - 一次构建同时推送到 Docker Hub 和阿里云 ACR（华东1杭州）
  - docker-compose.yml 默认镜像改为阿里云 ACR 地址（国内拉取快）
  - 极空间拉取命令：`docker pull crpi-mhs13r1rv9emmqbi.cn-hangzhou.personal.cr.aliyuncs.com/jadeerp/jadeerp:latest`

### [BUG] 修复 NAS Docker 权限拒绝 + 图片按钮冒泡
- **修改文件**: `scripts/entrypoint.sh`, `Dockerfile`, `docker-compose.yml`, `src/components/inventory/inventory-tab.tsx`
- **内容**:
  - entrypoint.sh 移除 `set -e`，避免 mkdir 失败导致容器崩溃循环重启
  - Dockerfile 容器以 root 启动，安装 su-exec，支持 PUID/PGID 环境变量降权运行
  - entrypoint.sh 启动时自动 chown 数据目录，解决 NAS 映射目录权限问题
  - docker-compose.yml 添加 PUID=0/PGID=0 默认值（root 运行，兼容所有 NAS）
  - 修复图片列 TableCell 没有 stopPropagation 导致点击图片打开侧边栏的问题
  - 修复卡片视图中图片区域点击冒泡问题

### [DEPLOY] Docker 持久化路径统一 + 启动判断逻辑
- **修改文件**: `scripts/entrypoint.sh`(新增), `Dockerfile`, `docker-compose.yml`
- **内容**:
  - 新增 `entrypoint.sh` 启动脚本，统一 `DATABASE_URL=file:/app/data/db/custom.db`
  - 启动时判断数据库是否已存在：已存在则仅做 schema 迁移（`prisma db push`），不存在才创建表+种子数据
  - 修复之前 prisma db push 和应用使用不同数据库路径的问题
  - Dockerfile 改为 `ENTRYPOINT` 指向 entrypoint.sh，不再用 CMD 内联命令
  - docker-compose.yml 改为本地目录映射 `./jade-data:/app/data`（NAS 友好），注释标注可替换为 NAS 实际路径
  - 镜像更新时保留已有数据（db/images/logs），仅同步 schema 变更

### [DEPLOY] 生产 Docker 镜像排除测试数据
- **修改文件**: `prisma/seed.ts`, `prisma/seed-base.ts`(新增), `prisma/seed-demo.ts`(新增), `Dockerfile`, `.dockerignore`
- **内容**:
  - `seed.ts` 拆分为环境感知入口：`NODE_ENV=production` 仅初始化基础配置，否则初始化基础+演示数据
  - `seed-base.ts` 新增：仅包含系统配置/材质/器型/标签/贵金属市价（生产必需）
  - `seed-demo.ts` 新增：保留原完整演示数据（供应商/批次/货品/客户/销售记录）
  - Dockerfile CMD 改为 `prisma db push + seed-base.ts`（不再执行演示数据种子）
  - `.dockerignore` 排除 `db/`、`prisma/seed-demo.ts`、`prisma/seed-business.ts`、`tests/`、`public/images/`

### [DEPLOY] 修复 GitHub Actions Docker Hub 推送失败
- **修改文件**: `.github/workflows/docker-build.yml`
- **内容**:
  - 将 Docker Hub 用户名从 `gg480` 改为 `lrunningmjgoat`
  - 移除 secrets 条件判断导致的登录步骤跳过问题
  - 简化工作流：直接使用 `push: true`，移除 `load` 回退逻辑
  - 确保登录步骤始终执行，依赖 GitHub Secrets 正确配置

---

## [2026-04-17]

### [FEAT] 统一数据存储路径，Docker 单 Volume 持久化
- **修改文件**: `src/lib/db.ts`, `src/app/api/backup/route.ts`, `Dockerfile`, `docker-compose.yml`, `package.json`
- **内容**:
  - `db.ts` 统一数据库路径解析：有 `DATA_DIR` 环境变量时用 `{DATA_DIR}/db/custom.db`，否则用 `./db/custom.db`
  - `backup/route.ts` 备份/恢复路径与 db.ts 统一，使用 `DATA_DIR/db/` 目录
  - Docker 简化为单 VOLUME `/app/data`，子目录：`/app/data/db/`（数据库）、`/app/data/images/`（图片）、`/app/data/logs/`（日志预留）
  - Dockerfile 添加首次启动自动执行 `prisma db push` 初始化数据库
  - docker-compose.yml 从双 volume 简化为单 volume `jade-data:/app/data`
  - package.json start 脚本移除硬编码 DATABASE_URL

### [FEAT] 图片存储本地化 + Docker 镜像支持
- **新增文件**: `src/app/api/images/[filename]/route.ts`, `docker-compose.yml`
- **修改文件**: `src/app/api/items/[id]/images/route.ts`, `Dockerfile`
- **内容**:
  - 图片上传 API：开发环境存 `public/images/`（Next.js 静态服务），生产环境存 `/app/data/images/`（Docker Volume）
  - 数据库中图片路径：开发 `/images/xxx.png`，生产 `/api/images/xxx.png`
  - 新增 `/api/images/[filename]` 路由：生产环境通过 API 读取本地图片文件，含目录遍历防护 + MIME 类型校验 + 缓存头
  - Dockerfile 添加 `VOLUME ["/app/data", "/app/db"]` 声明，`/app/data/images` 和 `/app/db` 持久化
  - docker-compose.yml 一键启动，数据库和图片分别挂载 volume
  - 图片上传增加文件类型校验（JPG/PNG/GIF/WEBP）和大小限制（10MB）

### [FEAT] 修复移动端显示适配
- **修改文件**: `dialog.tsx`, `inventory-tab.tsx`, `item-create-dialog.tsx`, `item-detail-dialog.tsx`, `batch-create-dialog.tsx`, `batch-detail-dialog.tsx`, `sales-tab.tsx`, `customers-tab.tsx`, `batches-tab.tsx`, `settings-tab.tsx`, `customer-search-select.tsx`
- **内容**:
  - Dialog 组件基础样式：移动端 padding 从 p-6 改为 p-4 sm:p-6，宽度从 calc(100%-2rem) 改为 calc(100%-1rem)
  - 所有 `grid-cols-2` 改为 `grid-cols-1 sm:grid-cols-2`（筛选区、表单、详情面板）
  - 所有 `grid-cols-3` 改为 `grid-cols-1 sm:grid-cols-3`（入库规格、销售详情）
  - 所有 `grid-cols-2 md:grid-cols-N` 改为 `grid-cols-2 sm:grid-cols-3 md:grid-cols-N`（统计卡片）
  - CustomerSearchSelect 下拉宽度改为 `min(320px, calc(100vw-2rem))` 防溢出
  - Settings Tab 标签页 `grid-cols-6` 改为 `grid-cols-3 sm:grid-cols-6`
- **涉及组件**: 11个文件，约30处 grid-cols 响应式断点调整

### [BUG] 修复 customersApi is not defined — 点击库存管理报错
- **文件**: `src/components/inventory/inventory-tab.tsx`
- **原因**: 替换客户Select为搜索组件时误删了 `customersApi` import，但批量出库仍依赖它加载客户数据
- **修复**: 恢复 `customersApi` import
- **commit**: `d0c9133`

### [FEAT] 出库模块客户选择器改为手机号/姓名/微信搜索模式
- **新增文件**: `src/components/inventory/customer-search-select.tsx`
- **修改文件**: `src/components/inventory/inventory-tab.tsx`
- **内容**:
  - 新增 `CustomerSearchSelect` 组件（基于 Popover + Command）
  - 输入时 300ms 防抖搜索后端 API（`/api/customers?keyword=xxx`）
  - 支持按姓名、手机号、微信搜索客户
  - 下拉列表展示客户姓名+手机号/微信，支持"散客"选项
  - 出库对话框和批量出库对话框均替换为搜索模式
- **commit**: `56885d5`

### [BUG] 修复 getItemTagColor is not defined — 点击SKU数据行报错
- **文件**: `src/components/inventory/inventory-tab.tsx`
- **原因**: 第2074行使用了 `getItemTagColor(tag)`，但函数实际定义名是 `getTagColor`
- **修复**: `getItemTagColor(tag)` → `getTagColor(tag)`
- **commit**: `ca765dc`

### [BUG] 修复 P0-P1 业务问题（4项）
- **修改文件**: `inventory-tab.tsx`, `item-create-dialog.tsx`, `items/route.ts`, `items/batch/route.ts`, `batch-create-dialog.tsx`, `batches/route.ts`
- **内容**:
  1. **P0-#4 点击多选框时弹出侧边框**: TableCell/Checkbox 加 `onClick={e => e.stopPropagation()}`
  2. **P0-#2 批次入库成本价校验逻辑**: `validateRequiredFields` 区分高货/通货模式，通货模式成本从批次分摊；前端展示"预计分摊成本"；后端有batchId时自动计算allocatedCost
  3. **P1-#6 SKU编码和批次编码纯ASCII**: SKU格式改为 `{材质ID2位}{类型ID2位}-{月日4位}-{序号3位}` 如 `0601-0417-001`；批次格式改为 `B{类别码}{月日4位}{序号3位}` 如 `BJ0417001`；后端增加非ASCII字符校验
  4. **P1-#3 所有编号默认生成不许用户录入**: batchCode Input改为只读+自动生成；移除batchCode空值校验
- **commit**: `be045f2`

### [BUG] 修复 React error #31 — item.tags 对象被当作字符串渲染
- **文件**: `src/components/inventory/inventory-tab.tsx`
- **原因**: API返回 `item.tags` 是对象数组 `[{id, name, groupName, isActive}]`，3处代码直接当 `string[]` 渲染
- **修复**: 3处标签渲染逻辑改为 `tgs.map(t => typeof t === 'string' ? t : t.name)` 提取标签名
- **commit**: `472cc71`

### [BUG] 修复确认出库报错 — 全面增加 API 参数校验防止 NaN 崩溃
- **修改文件**: `sales/route.ts`, `sales/return/route.ts`, `sales/bundle/route.ts`, `items/route.ts`, `items/batch/route.ts`, `batches/route.ts`, `metal-prices/route.ts`, `metal-prices/reprice/route.ts`, `customers/route.ts`, `inventory-tab.tsx`
- **原因**: `actualPrice` 为空字符串时 `parseFloat("")` 返回 NaN，Prisma 收到 NaN 后抛异常
- **修复**:
  - 8个API路由增加必填参数校验和NaN防护
  - 前端出库对话框增加成交价/渠道/日期必填验证和红色星号标记
  - 修复 `items/route.ts` 中校验代码在 `finalMaterialId` 声明前使用导致的运行时错误
- **commit**: `f8431e6`

### [TEST] 添加前端业务流程 E2E 点击测试脚本
- **新增文件**: `tests/e2e-click-test.ts`
- **内容**: 覆盖15个业务场景、79项断言——首页加载、7个Tab导航、23个Dashboard图表、入库/编辑/销售/退货/批次/客户/贵金属/系统设置/认证/套装/备份/日志
- **commit**: `dba4f46`

---

## [2026-04-16]

### [FEAT] 器型必填、成本价必填、采购日期默认当天
- **文件**: `src/components/inventory/item-create-dialog.tsx`
- **内容**:
  - 添加器型(typeId)必填验证 + 红色星号标记
  - 添加成本价(costPrice)必填验证 + 红色星号标记
  - purchaseDate 默认值从空字符串改为当天日期
- **commit**: `8b4644e`

### [BUG] 全面排查并修复 API 数据类型转换问题，解决入库 Internal Server Error
- **修改文件**: `items/route.ts`, `items/[id]/route.ts`, `items/batch/route.ts`, `sales/route.ts`, `sales/return/route.ts`, `sales/bundle/route.ts`, `batches/route.ts`, `metal-prices/route.ts`, `metal-prices/reprice/route.ts`
- **原因**: 前端传 Int 值（如 braceletSize=56）但 Prisma schema 要求 String?，10个API路由缺少类型转换
- **修复**: 全面添加 spec 字段类型转换 + 数值字段 parseInt/parseFloat
- **commit**: `6fc463f`, `6bd8888`

### [BUG] 修复部署环境 DATABASE_URL 缺失导致前端加载失败
- **修改文件**: `src/lib/db.ts`, `package.json`, `scripts/deploy-build.sh`
- **原因**: `.env` 只在构建时被 Turbopack 读取，运行时不加载，Prisma Client 初始化失败
- **修复**: 三重保障 — db.ts fallback + package.json start脚本 + deploy-build.sh export
- **commit**: `6432291`

### [BUG] 修复部署 Turbopack panic — Invalid distDirRoot
- **修改文件**: `next.config.ts`
- **原因**: 硬编码 `outputFileTracingRoot: "/workspace/projects"`，部署环境路径为 `/tmp/workdir`
- **修复**: 移除 outputFileTracingRoot，添加 `turbopack: { root: path.resolve(__dirname) }` 动态解析
- **commit**: `f1a09ec`

### [DEPLOY] 修复部署构建失败 — bash -c 复合命令解析异常
- **新增文件**: `scripts/deploy-build.sh`
- **修改文件**: `.coze`, `package.json`
- **原因**: `.coze` 的 `["bash", "-c", "compound string"]` 被部署平台解析异常
- **修复**: 创建独立部署脚本，改用 `["sh", "scripts/deploy-build.sh"]`；添加 postinstall/prebuild 钩子
- **commit**: `62ce13a`

### [DEPLOY] 修复部署构建缺少 pnpm install 和 prisma generate 步骤
- **修改文件**: `.coze`
- **原因**: deploy build 仅配置 `["pnpm", "run", "build"]`，部署环境无 node_modules
- **修复**: 改为包含 install + prisma generate 的复合命令
- **commit**: `d1417ac`

---

## [2026-04-14]

### [BUG] Dashboard 分批加载+图表延迟渲染，解决页面卡死无法交互
- **文件**: `src/components/inventory/dashboard-tab.tsx`
- **内容**: Dashboard 组件分批加载图表数据，延迟渲染减少首屏计算量
- **commit**: `8d7714c`

### [BUG] 用 next/dynamic 替换 React.lazy，修复看板页卡死无法切标签
- **文件**: `src/app/page.tsx`, `src/lib/store.ts`
- **内容**: Dashboard/Inventory/Settings 动态导入添加 `ssr:false`，默认 activeTab 改为 sales
- **commit**: `b57d7ec`, `adffeda`

### [BUG] 适配沙箱环境并修复服务启动问题
- **文件**: 多项环境配置
- **内容**: 修复 Prisma Client 未生成、端口绑定、构建缓存等问题
- **commit**: `82fe902`, `0e9ec7e`

### [INIT] Initial commit
- **内容**: 项目初始化，翡翠进销存管理系统基础代码
- **commit**: `5ff65ed`
