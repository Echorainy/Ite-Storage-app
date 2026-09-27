import { createInitialData, CLOTHING_CATEGORY_ID, DEFAULT_HOME_GREETING, DEFAULT_HOME_NOTE, normalizeRoomLayout } from './domain.ts';
import type { Category, Container, Home, Item, Room, ClothingDraft } from './domain.ts';

export type Snapshot = { schemaVersion: number; homes: Home[]; rooms: Room[]; containers: Container[]; items: Item[]; categories: Category[] };
type LegacyItem = Omit<Item, 'homeId'> & { homeId?: string };
type LegacyWardrobeItem = ClothingDraft & { id: string; roomId?: string; containerId?: string; homeId?: string };
type StoredSnapshot = Omit<Snapshot, 'schemaVersion' | 'items'> & { schemaVersion?: number; items: LegacyItem[]; wardrobeItems?: LegacyWardrobeItem[] };
export const emptySnapshot = (): Snapshot => createInitialData();
export function encodeSnapshot(snapshot: Snapshot) { return JSON.stringify(snapshot); }

export function decodeSnapshot(value: string): Snapshot {
  const parsed: unknown = JSON.parse(value);
  if (!isSnapshot(parsed)) throw new Error('Invalid snapshot');
  const homes = parsed.homes.map(home => ({ ...home, greeting: home.greeting ?? DEFAULT_HOME_GREETING, note: home.note ?? DEFAULT_HOME_NOTE }));
  const rooms = parsed.rooms.map(({ kind, ...room }) => ({ ...room, layout: normalizeRoomLayout(room.layout, kind === 'walk-in-closet' || (parsed.schemaVersion ?? 0) >= 2 ? 6 : 8) }));
  const containers = parsed.containers.map(({ kind, ...container }) => ({ ...container, cells: [...new Set(container.cells)] }));
  const clothingIds = new Set(parsed.categories.filter(category => category.name.trim() === '衣物' || category.id === CLOTHING_CATEGORY_ID).map(category => category.id));
  const categories = parsed.categories.filter(category => !clothingIds.has(category.id));
  categories.unshift({ id: CLOTHING_CATEGORY_ID, name: '衣物', isSystem: true });
  const normalizeItem = (item: LegacyItem): Item => {
    const room = rooms.find(room => room.id === item.roomId && homes.some(home => home.id === room.homeId));
    const homeId = room?.homeId ?? homes.find(home => home.id === item.homeId)?.id ?? homes[0].id;
    const next: Item = { ...item, homeId, categoryId: clothingIds.has(item.categoryId) ? CLOTHING_CATEGORY_ID : item.categoryId };
    if (!room) { delete next.roomId; delete next.containerId; delete next.cell; }
    else if (item.containerId && !containers.some(container => container.id === item.containerId && container.roomId === room.id)) { delete next.containerId; delete next.cell; }
    return next;
  };
  const items = parsed.items.map(normalizeItem);
  // Older snapshots held clothes separately. Version 2 only reads the unified collection.
  if ((parsed.schemaVersion ?? 0) < 2 && Array.isArray(parsed.wardrobeItems)) {
    const ids = new Set(items.map(item => item.id));
    for (const legacy of parsed.wardrobeItems) {
      let id = legacy.id;
      let suffix = 1;
      while (ids.has(id)) id = `wardrobe-${legacy.id}-${suffix++}`;
      ids.add(id);
      items.push(normalizeItem({ ...legacy, id, categoryId: CLOTHING_CATEGORY_ID, reminderDays: 7 }));
    }
  }
  return { schemaVersion: 2, homes, rooms, containers, items, categories };
}
function isSnapshot(value: unknown): value is StoredSnapshot {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredSnapshot>;
  return Array.isArray(candidate.homes) && candidate.homes.length > 0 && Array.isArray(candidate.rooms) && Array.isArray(candidate.containers) && Array.isArray(candidate.items) && Array.isArray(candidate.categories)
    && candidate.rooms.every(room => room && typeof room.id === 'string' && typeof room.homeId === 'string' && (!room.layout || (Number.isFinite(room.layout.rows) && Number.isFinite(room.layout.cols))));
}
export function migrateSnapshot(value: string | null | undefined): Snapshot {
  if (!value) return emptySnapshot();
  try { return decodeSnapshot(value); } catch { return emptySnapshot(); }
}
