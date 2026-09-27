import type { LocationTone } from './domain';
export type ClothingGroup = { id: string; label: string; tone: LocationTone; options: readonly string[] };
export const CLOTHING_GROUPS: readonly ClothingGroup[] = [
  { id: 'tops', label: '上身', tone: 'room', options: ['T恤', '衬衫', 'Polo衫', '针织衫', '卫衣', '背心', '西装', '夹克', '大衣', '羽绒服', '内衣', '家居上衣', '连衣裙'] },
  { id: 'bottoms', label: '下身', tone: 'module', options: ['牛仔裤', '休闲裤', '西裤', '短裤', '半身裙', '打底裤', '内裤', '家居裤', '连体裤'] },
  { id: 'shoes', label: '鞋子', tone: 'submodule', options: ['运动鞋', '休闲鞋', '皮鞋', '靴子', '凉鞋', '拖鞋', '其他鞋'] },
  { id: 'accessories', label: '配饰', tone: 'neutral', options: ['包', '帽子', '围巾', '手套', '腰带', '袜子', '首饰', '眼镜', '其他配饰'] },
] as const;
export const WARDROBE_TYPES = CLOTHING_GROUPS.flatMap(group => group.options);
export const WARDROBE_COLORS = ['黑色', '白色', '红色', '蓝色', '绿色', '黄色', '粉色', '紫色', '灰色', '棕色', '米色', '卡其色', '橙色', '牛仔蓝'] as const;
export const WARDROBE_SEASONS = ['四季', '春季', '夏季', '秋季', '冬季'] as const;
const LEGACY_TYPES: Record<string, string> = { Polo: 'Polo衫', '背心/吊带': '背心', '正装衬衫': '衬衫', '马甲': '背心', '牛仔外套': '夹克', '西裤/西装裤': '西裤', '工装裤': '休闲裤', '羽绒服/棉服': '羽绒服' };
export function normalizeClothingType(value?: string) { return value ? LEGACY_TYPES[value] ?? value : ''; }
export function clothingGroupForType(value?: string) { const type = normalizeClothingType(value); return CLOTHING_GROUPS.find(group => group.options.includes(type)); }
export function normalizeWardrobeColor(value: string) { const text = value.trim(); return WARDROBE_COLORS.find(color => text.includes(color)) ?? text; }
