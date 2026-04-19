import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * 基础种子数据 — 生产环境必需
 * 包含：系统配置、材质字典、器型字典、标签字典、初始贵金属市价
 * 不包含：供应商、批次、货品、客户、销售记录等业务测试数据
 */
async function main() {
  console.log('🌱 初始化基础配置数据...');

  // 1. 系统配置
  const configs = [
    { key: 'store_name', value: '翡翠珠宝', description: '店铺名称' },
    { key: 'operating_cost_rate', value: '0.05', description: '经营成本率' },
    { key: 'markup_rate', value: '0.30', description: '零售价上浮比例' },
    { key: 'aging_threshold_days', value: '90', description: '压货预警天数(旧)' },
    { key: 'warning_days', value: '90', description: '压货预警天数' },
    { key: 'default_alloc_method', value: 'equal', description: '默认分摊算法' },
    { key: 'admin_password', value: 'admin123', description: '管理员登录密码' },
  ];
  for (const c of configs) {
    await prisma.sysConfig.upsert({
      where: { key: c.key },
      update: { value: c.value, description: c.description },
      create: c,
    });
  }
  console.log('✅ 系统配置已插入/更新 (7条)');

  // 2. 材质 (36种) — 含 category 大类
  const materials = [
    { name: '黄金', category: '贵金属', subType: 'k999', sortOrder: 1 },
    { name: '银', category: '贵金属', subType: '990', costPerGram: 25, sortOrder: 2 },
    { name: 'k铂金', category: '贵金属', sortOrder: 3 },
    { name: '铂金', category: '贵金属', sortOrder: 4 },
    { name: '18K金', category: '贵金属', costPerGram: 780, sortOrder: 5 },
    { name: '翡翠', category: '玉', origin: '缅甸', sortOrder: 6 },
    { name: '和田玉', category: '玉', sortOrder: 7 },
    { name: '珍珠', category: '其他', subType: '淡水珠', origin: '浙江', sortOrder: 8 },
    { name: '朱砂', category: '文玩', sortOrder: 9 },
    { name: '蜜蜡', category: '文玩', sortOrder: 10 },
    { name: '碧玺', category: '水晶', sortOrder: 11 },
    { name: '青金石', category: '水晶', sortOrder: 12 },
    { name: '黑曜石', category: '水晶', sortOrder: 13 },
    { name: '金曜石', category: '水晶', sortOrder: 14 },
    { name: '玛瑙', category: '水晶', sortOrder: 15 },
    { name: '琥珀', category: '文玩', sortOrder: 16 },
    { name: '锆石', category: '其他', origin: '梧州', sortOrder: 17 },
    { name: '斑彩螺', category: '其他', origin: '意大利', sortOrder: 18 },
    { name: '金虎眼', category: '水晶', sortOrder: 19 },
    { name: '虎眼', category: '水晶', sortOrder: 20 },
    { name: '粉晶', category: '水晶', sortOrder: 21 },
    { name: '紫水晶', category: '水晶', sortOrder: 22 },
    { name: '莹石', category: '水晶', sortOrder: 23 },
    { name: '绿幽灵', category: '水晶', sortOrder: 24 },
    { name: '白幽灵', category: '水晶', sortOrder: 25 },
    { name: '彩幽灵', category: '水晶', sortOrder: 26 },
    { name: '金发晶', category: '水晶', sortOrder: 27 },
    { name: '钛晶', category: '水晶', sortOrder: 28 },
    { name: '巴西黄水晶', category: '水晶', sortOrder: 29 },
    { name: '人工黄水晶', category: '水晶', sortOrder: 30 },
    { name: '红幽灵', category: '水晶', sortOrder: 31 },
    { name: '蓝晶石', category: '水晶', sortOrder: 32 },
    { name: '海蓝宝', category: '水晶', sortOrder: 33 },
    { name: '天河石', category: '水晶', sortOrder: 34 },
    { name: '红绿宝石共生', category: '水晶', sortOrder: 35 },
    { name: '车花透辉石', category: '水晶', sortOrder: 36 },
    { name: '未分类', category: '其他', sortOrder: 99 },
  ];
  for (const m of materials) {
    await prisma.dictMaterial.upsert({
      where: { name: m.name },
      update: { category: m.category },
      create: m,
    });
  }
  console.log('✅ 材质已插入/更新 (36种, 含大类)');

  // 3. 器型 (9种) — 新 specFields 格式
  const types = [
    { name: '手镯', specFields: JSON.stringify({ weight: { required: false }, braceletSize: { required: true } }), sortOrder: 1 },
    { name: '挂件', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 2 },
    { name: '吊坠', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 3 },
    { name: '手串/手链', specFields: JSON.stringify({ weight: { required: false }, beadCount: { required: false }, beadDiameter: { required: true } }), sortOrder: 4 },
    { name: '项链', specFields: JSON.stringify({ weight: { required: false }, beadDiameter: { required: true } }), sortOrder: 5 },
    { name: '脚链', specFields: JSON.stringify({ weight: { required: false }, beadCount: { required: false }, beadDiameter: { required: false } }), sortOrder: 6 },
    { name: '戒指', specFields: JSON.stringify({ weight: { required: false }, metalWeight: { required: false }, ringSize: { required: true } }), sortOrder: 7 },
    { name: '耳饰', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 8 },
    { name: '摆件', specFields: JSON.stringify({ weight: { required: false }, size: { required: false } }), sortOrder: 9 },
    { name: '未分类', specFields: JSON.stringify({ weight: { required: false } }), sortOrder: 99 },
  ];
  for (const t of types) {
    await prisma.dictType.upsert({
      where: { name: t.name },
      update: { specFields: t.specFields },
      create: t,
    });
  }
  console.log('✅ 器型已插入/更新 (9种, 新格式)');

  // 4. 标签 (20个, 4组)
  const tags = [
    // 种水
    { name: '玻璃种', groupName: '种水' },
    { name: '冰种', groupName: '种水' },
    { name: '糯冰种', groupName: '种水' },
    { name: '糯种', groupName: '种水' },
    { name: '豆种', groupName: '种水' },
    // 颜色
    { name: '满绿', groupName: '颜色' },
    { name: '飘花', groupName: '颜色' },
    { name: '紫罗兰', groupName: '颜色' },
    { name: '黄翡', groupName: '颜色' },
    { name: '墨翠', groupName: '颜色' },
    { name: '无色', groupName: '颜色' },
    // 工艺
    { name: '手工雕', groupName: '工艺' },
    { name: '机雕', groupName: '工艺' },
    { name: '素面', groupName: '工艺' },
    // 题材
    { name: '观音', groupName: '题材' },
    { name: '佛公', groupName: '题材' },
    { name: '平安扣', groupName: '题材' },
    { name: '如意', groupName: '题材' },
    { name: '山水', groupName: '题材' },
    { name: '花鸟', groupName: '题材' },
  ];
  for (const t of tags) {
    await prisma.dictTag.upsert({
      where: { name: t.name },
      update: {},
      create: t,
    });
  }
  console.log('✅ 标签已插入 (20个, 4组)');

  // 5. 初始贵金属市价
  const silver = await prisma.dictMaterial.findUnique({ where: { name: '银' } });
  const gold18k = await prisma.dictMaterial.findUnique({ where: { name: '18K金' } });
  const today = new Date().toISOString().split('T')[0];

  if (silver) {
    await prisma.metalPrice.create({
      data: { materialId: silver.id, pricePerGram: 25, effectiveDate: today },
    });
  }
  if (gold18k) {
    await prisma.metalPrice.create({
      data: { materialId: gold18k.id, pricePerGram: 780, effectiveDate: today },
    });
  }
  console.log('✅ 贵金属初始市价已插入 (2条)');

  // 6. 工艺字典 (8种)
  const crafts = [
    { name: '手工雕刻', description: '匠人手工雕刻', sortOrder: 1 },
    { name: '机雕', description: '电脑数控雕刻', sortOrder: 2 },
    { name: '半手工', description: '机雕粗坯+手工精修', sortOrder: 3 },
    { name: '素面', description: '无雕刻，抛光素面', sortOrder: 4 },
    { name: '镂空雕', description: '镂空透雕工艺', sortOrder: 5 },
    { name: '浮雕', description: '浅浮雕/深浮雕', sortOrder: 6 },
    { name: '圆雕', description: '立体圆雕', sortOrder: 7 },
    { name: '未知', description: '工艺待确认', sortOrder: 99 },
  ];
  for (const c of crafts) {
    await prisma.dictCraft.upsert({
      where: { name: c.name },
      update: { description: c.description },
      create: c,
    });
  }
  console.log('✅ 工艺字典已插入/更新 (8种)');

  // 7. 卖点字典 (9种)
  const sellingPoints = [
    { name: '送礼', sortOrder: 1 },
    { name: '自戴', sortOrder: 2 },
    { name: '收藏', sortOrder: 3 },
    { name: '投资', sortOrder: 4 },
    { name: '孤品', sortOrder: 5 },
    { name: '性价比', sortOrder: 6 },
    { name: '名家出品', sortOrder: 7 },
    { name: '完美无瑕', sortOrder: 8 },
    { name: '稀有料子', sortOrder: 9 },
  ];
  for (const sp of sellingPoints) {
    await prisma.dictSellingPoint.upsert({
      where: { name: sp.name },
      update: {},
      create: sp,
    });
  }
  console.log('✅ 卖点字典已插入/更新 (9种)');

  // 8. 人群字典 (8种)
  const audiences = [
    { name: '年轻女性', sortOrder: 1 },
    { name: '中年女性', sortOrder: 2 },
    { name: '中年男性', sortOrder: 3 },
    { name: '资深藏家', sortOrder: 4 },
    { name: '新手入门', sortOrder: 5 },
    { name: '送长辈', sortOrder: 6 },
    { name: '送爱人', sortOrder: 7 },
    { name: '送朋友', sortOrder: 8 },
  ];
  for (const a of audiences) {
    await prisma.dictAudience.upsert({
      where: { name: a.name },
      update: {},
      create: a,
    });
  }
  console.log('✅ 人群字典已插入/更新 (8种)');

  console.log('🎉 基础配置数据初始化完成！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
