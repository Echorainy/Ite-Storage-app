import type { WardrobeItem } from './domain';

export type OutfitSlot = 'top' | 'bottom' | 'dress' | 'outer' | 'shoes' | 'bag' | 'accessory';
export type OutfitPlan = { title: string; reason: string; itemIds: string[]; source: 'ai' | 'local' | 'edited' };
export const slotLabels: Record<OutfitSlot, string> = { top: '上装', bottom: '下装', dress: '连衣裙', outer: '外套', shoes: '鞋履', bag: '包袋', accessory: '配饰' };
export function outfitSlot(item: WardrobeItem): OutfitSlot | undefined {
  const type = item.type.toLowerCase();
  if (/连衣裙|连体|dress|jumpsuit/.test(type)) return 'dress';
  if (/鞋|靴|sneaker|shoe|boot/.test(type)) return 'shoes';
  if (/包|bag/.test(type)) return 'bag';
  if (/裤|半身裙|百褶裙|短裙|长裙|下装|trouser|pants|skirt|shorts|jeans|bottom/.test(type)) return 'bottom';
  if (/外套|夹克|西装$|风衣|大衣|羽绒|棉服|开衫|jacket|coat|blazer|cardigan/.test(type)) return 'outer';
  if (/恤|衬衫|polo|针织|毛衣|卫衣|背心|吊带|马甲|上装|shirt|top|hoodie|sweater/.test(type)) return 'top';
  if (/帽|袜|围巾|项链|饰|腰带|cap|sock|scarf|necklace|accessory/.test(type)) return 'accessory';
  return undefined;
}
export function localOutfit(items: WardrobeItem[], temperature?: number | null, offset = 0): OutfitPlan {
  const ids: string[] = [];
  const pick = (slot: OutfitSlot) => {
    const choices = items.filter(item => outfitSlot(item) === slot);
    if (choices.length) ids.push(choices[offset % choices.length].id);
    return choices.length > 0;
  };
  // The integrated wardrobe always presents the requested core set: one top,
  // one bottom and one pair of shoes. A dress is only a fallback when a
  // category is genuinely missing from the user's wardrobe.
  const hasTop = pick('top');
  const hasBottom = pick('bottom');
  if (!hasTop && !hasBottom) pick('dress');
  if (temperature == null || temperature < 24) pick('outer');
  pick('shoes'); pick('bag'); pick('accessory');
  return { title: '今天，轻松出门', reason: '从现有衣柜按类别组合。点击单品，可以换成更合心意的一件。', itemIds: ids, source: 'local' };
}
export function parseOutfit(answer: unknown, items: WardrobeItem[]): OutfitPlan | null {
  try {
    const value = typeof answer === 'string' ? JSON.parse(answer.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')) : answer;
    if (!value || !Array.isArray(value.itemIds) || !value.itemIds.length || value.itemIds.length > 7) return null;
    const itemIds = value.itemIds;
    if (new Set(itemIds).size !== itemIds.length) return null;
    const slots = new Set<OutfitSlot>();
    for (const id of itemIds) {
      const item = items.find(row => row.id === id);
      const slot = item && outfitSlot(item);
      if (!slot || slots.has(slot)) return null;
      slots.add(slot);
    }
    if (slots.has('dress') && (slots.has('top') || slots.has('bottom'))) return null;
    if (!slots.has('dress') && !(slots.has('top') && slots.has('bottom'))) return null;
    if (!slots.has('shoes')) return null;
    if (typeof value.reason !== 'string' || typeof value.title !== 'string') return null;
    return { title: value.title.slice(0, 48), reason: value.reason.slice(0, 400), itemIds, source: 'ai' };
  } catch { return null; }
}
