# Jade Inventory Management System (翡翠进销存管理系统)

## Project Overview
A full-featured jade/jewelry inventory management system built with Next.js 16 + Prisma + SQLite + Tailwind CSS + shadcn/ui.

**Tech Stack**: Next.js 16 (App Router) | React 19 | TypeScript 5 | Prisma (SQLite) | Tailwind CSS 4 | shadcn/ui | Zustand | Recharts

**Key Features**: Dashboard analytics, inventory CRUD, batch management, sales records, customer management, operation logs, system settings, barcode scanner, dark mode, mobile responsive.

## Build & Run Commands
```bash
pnpm install          # Install dependencies
npx prisma generate   # Generate Prisma client (required after install/pull)
npx prisma db push    # Push schema to SQLite (first time or after schema change)
pnpm run dev          # Start dev server on port 5000 (HMR enabled)
pnpm run build        # Production build (creates .next/ directory)
pnpm run start        # Start production server on port 5000
pnpm run lint         # ESLint check
npx tsx prisma/seed.ts # Seed demo data
npx tsx tests/e2e-click-test.ts # Run E2E business flow test (79 assertions)
```

**Important**: After pulling code or changing Prisma schema, always run `rm -rf .next && npx prisma generate` before starting.

## Project Structure
```
src/
├── app/
│   ├── page.tsx              # Main SPA page (tab-based navigation, default tab=sales)
│   ├── layout.tsx            # Root layout (ThemeProvider, fonts)
│   ├── globals.css           # Global styles + Tailwind
│   └── api/                  # 60+ API routes
│       ├── auth/             # Login/session management
│       ├── items/            # Inventory CRUD + batch ops
│       ├── sales/            # Sales + returns + bundles
│       ├── batches/          # Batch management + allocation
│       ├── customers/        # Customer CRUD (supports keyword search)
│       ├── suppliers/        # Supplier CRUD
│       ├── dashboard/        # Dashboard aggregate + 23 chart APIs
│       ├── dicts/            # Material/Type/Tag dictionaries
│       ├── config/           # System config key-value
│       ├── metal-prices/     # Precious metal pricing + repricing
│       ├── logs/             # Operation logs
│       ├── export/           # CSV/Excel export
│       ├── import/           # Data import
│       ├── pricing/          # Pricing engine
│       └── backup/           # DB backup/restore
├── components/
│   ├── inventory/            # All business components
│   │   ├── dashboard-tab.tsx
│   │   ├── inventory-tab.tsx       # Inventory list + sale dialog + batch sell
│   │   ├── sales-tab.tsx
│   │   ├── batches-tab.tsx
│   │   ├── customers-tab.tsx
│   │   ├── settings-tab.tsx
│   │   ├── logs-tab.tsx
│   │   ├── navigation.tsx
│   │   ├── shared.tsx              # ErrorBoundary, LoadingSkeleton, etc.
│   │   ├── item-create-dialog.tsx  # High-value + batch item creation
│   │   ├── item-detail-dialog.tsx
│   │   ├── batch-create-dialog.tsx # Quick + full batch creation
│   │   ├── batch-detail-dialog.tsx
│   │   ├── customer-search-select.tsx  # Async customer search (phone/name/wechat)
│   │   ├── barcode-scanner.tsx
│   │   ├── image-lightbox.tsx
│   │   ├── login-page.tsx
│   │   └── notification-bell.tsx
│   └── ui/                   # shadcn/ui primitives
├── lib/
│   ├── api.ts                # Frontend API client
│   ├── store.ts              # Zustand state management
│   ├── db.ts                 # Prisma client singleton (DATABASE_URL fallback)
│   └── auth.ts               # Session management
prisma/
├── schema.prisma             # 18 models (SQLite)
└── seed.ts                   # Demo data seeder
scripts/
└── deploy-build.sh           # Deployment build script (install + prisma + build)
tests/
└── e2e-click-test.ts         # E2E business flow test (15 scenarios, 79 assertions)
```

## Database
- SQLite via Prisma ORM (file: `db/custom.db`)
- 18 tables: SysConfig, DictMaterial, DictType, DictTag, Supplier, Customer, Batch, Item, ItemTag, ItemSpec, ItemImage, SaleRecord, BundleSale, MetalPrice, User, SaleReturn, OperationLog, Session
- Default admin password: `admin123` (stored in SysConfig)

## Code Style
- TypeScript strict mode (noImplicitAny: false for flexibility)
- Client components use `'use client'` directive
- API routes follow `{ code: 0, data: T, message: "ok" }` response format
- API error responses: `{ code: 400/500, data: null, message: "错误描述" }`
- Tailwind CSS with emerald/teal color scheme (jade-themed)
- Dark mode via next-themes

## Business Rules
- **SKU编码**: 纯ASCII格式 `{材质ID2位}{类型ID2位}-{月日4位}-{序号3位}`，如 `0601-0417-001`，系统自动生成，不允许用户输入
- **批次编码**: 纯ASCII格式 `B{类别码}{月日4位}{序号3位}`，如 `BJ0417001`，系统自动生成，不允许用户输入
- **类别码映射**: 玉→J、贵金属→M、水晶→C、文玩→A、其他→O
- **成本价规则**: 高货模式必填；通货模式（有batchId）由批次自动分摊 `totalCost / quantity`
- **客户选择**: 出库/批量出库使用异步搜索组件，支持手机号/姓名/微信搜索
- **必填字段**: 器型(typeId)、成本价(costPrice，高货模式)、成交价(actualPrice，出库时)、销售渠道、销售日期
- **标签渲染**: API返回 `item.tags` 是对象数组，渲染时需提取 `.name` 属性

## Environment Variables
- `DATABASE_URL` - SQLite connection string (default: `file:./db/custom.db`, fallback in db.ts)
- `COZE_PROJECT_DOMAIN_DEFAULT` - Deployment domain
- `DEPLOY_RUN_PORT` - Service port (must be 5000)

## Deployment
- `.coze` config uses `scripts/deploy-build.sh` for build (handles install + prisma + build)
- `package.json` has `postinstall: "prisma generate"` and `prebuild: "prisma generate"` as safeguards
- Production start script: `DATABASE_URL=${DATABASE_URL:-file:./db/custom.db} NODE_ENV=production next start -p 5000`

## Known Issues
- HMR "Router action dispatched before initialization" error in dev mode (cosmetic, not functional)
- barcode-scanner requires HTTPS for camera access (falls back to manual input)
- After pulling fresh code or updating Prisma schema, MUST clear `.next` cache (`rm -rf .next`) and re-run `npx prisma generate` before starting dev server
- Deployment environment uses `/tmp/workdir` as project path (not `/workspace/projects`)
- Turbopack production build sometimes caches old chunks — if code changes don't take effect, do `rm -rf .next && pnpm build`

## Change Log
See [CHANGELOG.md](./CHANGELOG.md) for detailed change history with bug fixes and feature updates categorized by date.

## Development Workflow
1. Before modifying: Record planned changes in CHANGELOG.md under a new date entry
2. After modifying: Update the CHANGELOG entry with actual changes (files, reasons, fixes)
3. Update AGENTS.md if project structure, business rules, or known issues change
4. Run `pnpm lint --quiet` and `npx tsx tests/e2e-click-test.ts` before committing

## Testing
- **Smoke Test**: `pnpm run test:smoke` — 启动自检（install→prisma→build→start→health check），约60秒
- **API Test**: `pnpm run test:api` — vitest API 测试，需先启动 dev server
- **E2E Test**: `npx tsx tests/e2e-click-test.ts` — 前端业务流程点击测试（79断言）
- **Integrity**: `pnpm run test:integrity` — 数据完整性检查
- **测试数据库**: API 测试使用独立 `test.db`，不污染开发数据库 `custom.db`
- **测试基础设施**: `tests/api/helpers/` — setup.ts (DB钩子), client.ts (API封装), factories.ts (数据工厂)
- **提交前最低要求**: test:smoke + lint（如涉及 API 路由则需 test:api）
- **详细测试规则**: 见 AGENT_BRIEFING.md "测试规则" 章节
