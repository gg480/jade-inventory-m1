# T02-d & T02-e Work Record

## Agent: dev-agent
## Date: 2026-04-21

## T02-d: 新建卖点和人群字典表及 API

### What was done:
1. **Schema**: DictSellingPoint, ItemSellingPoint, DictAudience, ItemAudience models were already in schema.prisma from prior work
2. **DB Push**: Ran `DATABASE_URL="file:./db/custom.db" npx prisma db push` - database was created fresh and synced
3. **Seed**: Ran `DATABASE_URL="file:./db/custom.db" npx tsx prisma/seed-base.ts` - 9 selling points + 8 audiences seeded successfully
4. **API Routes**: All 4 routes already existed:
   - GET/POST `/api/dicts/selling-points`
   - PATCH/DELETE `/api/dicts/selling-points/[id]`
   - GET/POST `/api/dicts/audiences`
   - PATCH/DELETE `/api/dicts/audiences/[id]`

### Files modified: None (all pre-existing)
### Files verified: schema.prisma, seed-base.ts, 4 API route files

## T02-e: item-create-dialog 卖点和人群多选

### What was done:
1. **Frontend**: item-create-dialog already had selling points/audiences multi-select in ContentAttributesTab
2. **POST /api/items**: Added `sellingPointIds` and `audienceIds` extraction from body; added nested create for ItemSellingPoint/ItemAudience in `db.item.create`; updated include to return sellingPoints/audiences
3. **PUT /api/items/[id]**: Added `sellingPointIds` and `audienceIds` extraction; added replace semantics (deleteMany + createMany); updated include to return sellingPoints/audiences
4. **GET /api/items/[id]**: Added `sellingPoints` and `audiences` to include; added mapping in response to return `[{id, name}]`
5. **item-detail-dialog**: Added selling points and audiences display in content attributes section

### Files modified:
- `src/app/api/items/route.ts` - POST handler: sellingPointIds/audienceIds support
- `src/app/api/items/[id]/route.ts` - GET/PUT handlers: sellingPoints/audiences in response, replace semantics for PUT
- `src/components/inventory/item-detail-dialog.tsx` - Display sellingPoints/audiences in content attributes

## Lint: Passed (0 errors, 1 pre-existing warning)
