export const PRICE_RANGES = ['走量', '中档', '精品'] as const;
export type PriceRange = typeof PRICE_RANGES[number];

export const PRIORITY_TIERS = ['A', 'B', 'C', '未定'] as const;
export type PriorityTier = typeof PRIORITY_TIERS[number];

export const SHOOTING_STATUSES = ['未拍', '白底完成', '细节完成', '场景完成', '全套完成'] as const;
export type ShootingStatus = typeof SHOOTING_STATUSES[number];

export const CONTENT_STATUSES = ['未生产', '已生产', '已发布', '多平台发布'] as const;
export type ContentStatus = typeof CONTENT_STATUSES[number];
