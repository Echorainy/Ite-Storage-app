export const WARDROBE_TYPES = ['T恤', '衬衫', 'Polo', '针织衫', '毛衣', '卫衣', '背心/吊带', '正装衬衫', '马甲', '牛仔裤', '休闲裤', '阔腿裤', '西裤/西装裤', '工装裤', '短裤', '连衣裙', '半身裙', '百褶裙', '短裙/长裙', '夹克', '牛仔外套', '西装', '风衣', '大衣', '羽绒服/棉服'] as const;
export const WARDROBE_COLORS = ['黑色', '白色', '红色', '蓝色', '绿色', '黄色', '粉色', '紫色', '灰色', '棕色', '米色', '卡其色', '橙色', '牛仔蓝'] as const;
export const WARDROBE_SEASONS = ['四季', '春季', '夏季', '秋季', '冬季'] as const;
export function normalizeWardrobeColor(value: string) { const text = value.trim(); return WARDROBE_COLORS.find(color => text.includes(color)) ?? text; }
