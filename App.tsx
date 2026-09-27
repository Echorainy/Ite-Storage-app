import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, SafeAreaView, ScrollView, StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { CLOTHING_CATEGORY_ID, ClothingDraft, wardrobeItems, Category, Container, Filter, Home, Item, Location, Room, DEFAULT_MODULE_COLOR, MODULE_COLORS, ROOM_LAYOUT_PRESETS, containerDescendants, createInitialData, directChildren, directItems, filterItems, filterLabels, homeItems, isValidHexColor, locationPath, matchesFilter, moduleColorTextColor, normalizeModuleColor, removeContainerContents, removeHomeContents, roomCellCount, validateName } from './src/domain';
import { occupiedCells, validateCells } from './src/grid-edit';
import { Button, Chip, Empty, Field, Icon, IconButton, IconName, Sheet, colors, s, useToday } from './src/ui';
import { HomePage, ItemRows, LayoutPage, RoomLayoutPage, RoomsPage } from './src/pages';
import { WardrobePage } from './src/WardrobePage';
import { ItemForm } from './src/ItemForm';
import { loadSnapshot, saveSnapshot } from './src/storage';
import { initializeNotifications, notificationsAvailable, cancelItemReminder, requestNotificationPermission, rescheduleAllReminders, scheduleItemReminder } from './src/notifications';


type Tab = 'home' | 'rooms' | 'items' | 'wardrobe' | 'settings';
type Editor = { kind: 'home' | 'room' | 'category' | 'container'; id?: string; roomId?: string; parentId?: string };
type Confirmation = { title: string; message: string; run: () => void };
let sequence = 0;
const newId = () => `local-${Date.now()}-${++sequence}`;

export default function App() {
  const [data, setData] = useState(createInitialData);
  const { homes, rooms, containers, items, categories } = data;
  const [activeHomeId, setActiveHomeId] = useState('home');
  const [tab, setTab] = useState<Tab>('home');
  const [location, setLocation] = useState<Location | undefined>();
  const [showRoomLayout, setShowRoomLayout] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>();
  const [query, setQuery] = useState('');
  const [homeMenu, setHomeMenu] = useState(false);
  const [editor, setEditor] = useState<Editor>();
  const [draftName, setDraftName] = useState('');
  const [draftColor, setDraftColor] = useState(DEFAULT_MODULE_COLOR);
  const [draftRows, setDraftRows] = useState('8');
  const [draftCols, setDraftCols] = useState('8');
  const [error, setError] = useState('');
  const [itemForm, setItemForm] = useState<{ initialLocation?: Location; item?: Item }>();
  const [selectedItemId, setSelectedItemId] = useState<string>();
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [hydrated, setHydrated] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const now = useToday();
  useEffect(() => {
    let active = true;
    loadSnapshot().then(snapshot => { if (active) { setData(snapshot); setActiveHomeId(current => snapshot.homes.some(home => home.id === current) ? current : snapshot.homes[0].id); setHydrated(true); void rescheduleAllReminders(snapshot.items); } }).catch(() => { if (active) setHydrated(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => { if (hydrated) void saveSnapshot(data); }, [data, hydrated]);
  useEffect(() => { void initializeNotifications().then(granted => setNotificationPermission(granted ? 'granted' : 'denied')).catch(() => setNotificationPermission('denied')); }, []);
  const home = homes.find(h => h.id === activeHomeId)!;
  const currentRooms = rooms.filter(r => r.homeId === activeHomeId);
  const currentItems = homeItems(items, rooms, activeHomeId);
  const activeRoom = currentRooms.find(r => r.id === location?.roomId);
  const selectedItem = items.find(i => i.id === selectedItemId);
  const path = (item: Item | Location) => locationPath(item.roomId, item.containerId, homes, rooms, containers, 'homeId' in item ? item.homeId : undefined);
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name ?? '未分类';
  const searchResults = items.filter(i => `${i.name} ${path(i)} ${categoryName(i.categoryId)}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const renderItems = (rows: Item[]) => <ItemRows items={rows} path={path} categoryName={categoryName} now={now} onItem={item => setSelectedItemId(item.id)} />;

  const back = () => {
    if (!location) return;
    const module = containers.find(c => c.id === location.containerId);
    setLocation(module ? { roomId: location.roomId, containerId: module.parentId } : undefined);
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tab !== 'rooms' || homeMenu || editor || itemForm || selectedItemId || confirmation) return false;
      if (showRoomLayout) { setShowRoomLayout(false); return true; }
      if (!location) return false;
      back(); return true;
    });
    return () => subscription.remove();
  }, [tab, location, containers, homeMenu, editor, itemForm, selectedItemId, confirmation, showRoomLayout]);

  const switchHome = (id: string) => {
    setActiveHomeId(id); setLocation(undefined); setShowRoomLayout(false); setFilter('all'); setCategoryFilter(undefined); setQuery('');
    setHomeMenu(false); setItemForm(undefined); setSelectedItemId(undefined);
  };
  const openEditor = (kind: Editor['kind'], entity?: Home | Room | Category | Container, context?: { roomId?: string; parentId?: string }) => {
    const room = entity as Room | undefined;
    setHomeMenu(false); setEditor({ kind, id: entity?.id, roomId: context?.roomId ?? (entity as Container | undefined)?.roomId, parentId: context?.parentId ?? (entity as Container | undefined)?.parentId }); setDraftName(entity?.name ?? ''); setDraftColor(kind === 'container' ? normalizeModuleColor((entity as Container | undefined)?.color) : DEFAULT_MODULE_COLOR); setDraftRows(kind === 'room' ? String(room?.layout?.rows ?? 8) : '8'); setDraftCols(kind === 'room' ? String(room?.layout?.cols ?? 8) : '8'); setError('');
  };
  const saveName = () => {
    if (!editor) return;
    const scope = editor.kind === 'home' ? homes : editor.kind === 'room' ? currentRooms : editor.kind === 'category' ? categories : containers.filter(c => c.roomId === editor.roomId && c.parentId === editor.parentId);
    const message = validateName(draftName, scope, editor.id);
    if (message) return setError(message);
    if (editor.kind === 'category' && categories.some(category => category.id === editor.id && category.isSystem)) return setError('系统分类不能修改');
    if (editor.kind === 'container' && !isValidHexColor(draftColor)) return setError('请输入有效的 HEX 颜色，如 #C98F7A');
    const rows = Number(draftRows); const cols = Number(draftCols);
    const editingRoom = editor.kind === 'room' && editor.id ? rooms.find(room => room.id === editor.id) : undefined;
    const minimumRoomSize = Math.min(8, editingRoom?.layout.rows ?? 8, editingRoom?.layout.cols ?? 8);
    if (editor.kind === 'room' && (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < minimumRoomSize || rows > 16 || cols < minimumRoomSize || cols > 16)) return setError(`房间尺寸必须是 ${minimumRoomSize} 到 16 之间的整数`);
    if (editor.kind === 'room' && editor.id) {
      if (cols !== editingRoom?.layout.cols && (containers.some(c => c.roomId === editor.id && c.cells.length) || items.some(i => i.roomId === editor.id && i.cell !== undefined))) return setError('房间已有布局，请先清空模块和物品再修改列数');
      const total = rows * cols;
      const hasOutOfBounds = containers.some(container => container.roomId === editor.id && container.cells.some(cell => cell >= total)) || items.some(item => item.roomId === editor.id && item.cell !== undefined && item.cell >= total);
      if (hasOutOfBounds) return setError('当前尺寸过小，已有模块或物品超出网格范围');
    }
    const name = draftName.trim(); const id = editor.id ?? newId();
    if (editor.kind === 'home') {
      setData(d => ({ ...d, homes: editor.id ? d.homes.map(h => h.id === id ? { ...h, name } : h) : [...d.homes, { id, name }] }));
      if (!editor.id) switchHome(id);
    } else if (editor.kind === 'room') {
      const layout = { rows, cols };
      setData(d => ({ ...d, rooms: editor.id ? d.rooms.map(r => r.id === id ? { ...r, name, layout } : r) : [...d.rooms, { id, name, homeId: activeHomeId, layout }] }));
    } else if (editor.kind === 'category') {
      setData(d => ({ ...d, categories: editor.id ? d.categories.map(c => c.id === id ? { ...c, name } : c) : [...d.categories, { id, name, isSystem: false }] }));
    } else {
      const level = editor.parentId ? 3 : 2;
      const color = normalizeModuleColor(draftColor);
      setData(d => ({ ...d, containers: editor.id ? d.containers.map(c => c.id === id ? { ...c, name, color } : c) : [...d.containers, { id, name, roomId: editor.roomId!, parentId: editor.parentId, level, cells: [], color }] }));
    }
    setEditor(undefined);
  };
  const beginItem = (initialLocation?: Location) => {
    if (!currentRooms.length) { setTab('rooms'); setLocation(undefined); openEditor('room'); return; }
    setItemForm({ initialLocation });
  };
  const addClothes = (drafts: ClothingDraft[]) => {
    if (drafts.some(draft => draft.roomId && !rooms.some(room => room.id === draft.roomId && room.homeId === activeHomeId))) return;
    if (drafts.some(draft => draft.containerId && !containers.some(c => c.id === draft.containerId && rooms.some(room => room.id === c.roomId && room.homeId === activeHomeId)))) return;
    const saved = drafts.map(draft => ({ ...draft, id: newId(), homeId: activeHomeId, categoryId: CLOTHING_CATEGORY_ID, reminderDays: 7 }));
    setData(current => current.homes.some(home => home.id === activeHomeId) ? { ...current, items: [...saved, ...current.items] } : current);
  };
  const saveItem = (draft: Omit<Item, 'id'>, editingId?: string) => {
    if (!homes.some(home => home.id === draft.homeId)) return '请选择有效家庭';
    const room = rooms.find(room => room.id === draft.roomId && room.homeId === draft.homeId);
    if (draft.roomId && !room) return '请选择所属家庭的房间';
    if (!room && !editingId) return '请选择房间';
    if (draft.containerId && !containers.some(c => c.id === draft.containerId && c.roomId === draft.roomId)) return '请选择有效模块';
    const occupied = room ? occupiedCells(room.id, draft.containerId, containers, items, undefined, editingId) : new Set<number>();
    const cell = room ? draft.cell !== undefined && draft.cell < roomCellCount(room.layout) && !occupied.has(draft.cell) ? draft.cell : Array.from({ length: roomCellCount(room.layout) }, (_, i) => i).find(i => !occupied.has(i)) : undefined;
    const saved = { ...items.find(item => item.id === editingId), ...draft, id: editingId ?? newId(), cell };
    setData(d => ({ ...d, items: editingId ? d.items.map(i => i.id === editingId ? saved : i) : [...d.items, saved] }));
    void scheduleItemReminder(saved);
    setItemForm(undefined); return null;
  };
  const deleteContainer = (container: Container) => {
    const descendants = containerDescendants(containers, container.id);
    const itemCount = items.filter(i => i.containerId && descendants.some(c => c.id === i.containerId)).length;
    setConfirmation({ title: `删除模块“${container.name}”？`, message: `将删除 ${descendants.length} 个模块和 ${itemCount} 件物品，删除后无法恢复。`, run: () => {
      items.filter(item => item.containerId && descendants.some(c => c.id === item.containerId)).forEach(item => { void cancelItemReminder(item.id); });
      const result = removeContainerContents(containers, items, container.id);
      setData(d => ({ ...d, containers: result.containers, items: result.items }));
      setLocation(container.parentId ? { roomId: container.roomId, containerId: container.parentId } : { roomId: container.roomId });
    } });
  };
  const updateContainerCells = (id: string, cells: number[]) => { const target = containers.find(c => c.id === id); const room = target && rooms.find(r => r.id === target.roomId); const message = validateCells(id, cells, containers, items, room?.layout.rows ?? 8, room?.layout.cols ?? 8); if (message) return message; setData(d => ({ ...d, containers: d.containers.map(c => c.id === id ? { ...c, cells: [...new Set(cells)] } : c) })); return null; };
  const deleteRoom = (room: Room) => {
    const moduleCount = containers.filter(c => c.roomId === room.id).length;
    const itemCount = items.filter(i => i.roomId === room.id).length;
    setConfirmation({ title: `删除房间“${room.name}”？`, message: `将删除 ${moduleCount} 个模块和 ${itemCount} 件物品，删除后无法恢复。`, run: () => {
      items.filter(item => item.roomId === room.id).forEach(item => { void cancelItemReminder(item.id); });
      setData(d => ({ ...d, rooms: d.rooms.filter(r => r.id !== room.id), containers: d.containers.filter(c => c.roomId !== room.id), items: d.items.filter(i => i.roomId !== room.id) }));
      setLocation(undefined); setSelectedItemId(undefined); setItemForm(undefined);
    } });
  };
  const deleteHome = (homeToDelete: Home) => {
    if (homes.length <= 1) return;
    const roomIds = new Set(rooms.filter(room => room.homeId === homeToDelete.id).map(room => room.id));
    const moduleCount = containers.filter(container => roomIds.has(container.roomId)).length;
    const itemCount = homeItems(items, rooms, homeToDelete.id).length;
    setConfirmation({ title: `删除家“${homeToDelete.name}”？`, message: `将删除 ${roomIds.size} 个房间、${moduleCount} 个模块和 ${itemCount} 件物品，删除后无法恢复。`, run: () => {
      homeItems(items, rooms, homeToDelete.id).forEach(item => { void cancelItemReminder(item.id); });
      const result = removeHomeContents({ homes, rooms, containers, items }, homeToDelete.id, true);
      if ('error' in result) return;
      setData(data => ({ ...data, homes: result.homes, rooms: result.rooms, containers: result.containers, items: result.items }));
      setShowRoomLayout(false);
      setActiveHomeId(result.homes[0]?.id ?? ''); setLocation(undefined); setFilter('all'); setCategoryFilter(undefined); setQuery(''); setHomeMenu(false); setEditor(undefined); setItemForm(undefined); setSelectedItemId(undefined);
    } });
  };
  const deleteCategory = (category: Category) => {
    if (category.isSystem) return;
    setConfirmation({ title: `删除分类“${category.name}”？`, message: '物品会保留，分类改为“未分类”。此修改适用于所有家。', run: () => {
      setData(d => ({ ...d, categories: d.categories.filter(c => c.id !== category.id), items: d.items.map(i => i.categoryId === category.id ? { ...i, categoryId: 'uncategorized' } : i) }));
      setCategoryFilter(current => current === category.id ? undefined : current);
    } });
  };
  const deleteItem = (item: Item) => {
    setConfirmation({ title: `删除物品“${item.name}”？`, message: '将同时从物品列表和智能衣柜删除，并取消到期提醒。删除后无法恢复。', run: () => {
      setData(d => ({ ...d, items: d.items.filter(i => i.id !== item.id) }));
      void cancelItemReminder(item.id); setSelectedItemId(undefined);
    } });
  };
  const chooseTab = (next: Tab) => { setTab(next); setShowRoomLayout(false); if (next === 'rooms') setLocation(undefined); if (next === 'items') { setFilter('all'); setCategoryFilter(undefined); } };
  const nav: [Tab, IconName, string][] = [['home', 'home', '首页'], ['rooms', 'grid', '房间'], ['items', 'package', '物品'], ['wardrobe', 'shopping-bag', '衣柜'], ['settings', 'settings', '设置']];
  const editedRoom = editor?.kind === 'room' ? rooms.find(room => room.id === editor.id) : undefined;
  const editorMinimum = Math.min(8, editedRoom?.layout.rows ?? 8, editedRoom?.layout.cols ?? 8);

  if (!hydrated) return <SafeAreaView style={s.screen}><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}><ActivityIndicator color={colors.accent} /><Text style={s.muted}>正在读取本地数据…</Text></View></SafeAreaView>;
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaView style={s.screen}><StatusBar barStyle="dark-content" /><View style={s.content}>
    {tab === 'home' && <HomePage home={home} items={currentItems} query={query} setQuery={setQuery} searchResults={searchResults} onHomes={() => setHomeMenu(true)} onFilter={value => { setFilter(value); setTab('items'); }} onAdd={() => beginItem()} onSaveCopy={(greeting, note) => setData(d => ({ ...d, homes: d.homes.map(h => h.id === activeHomeId ? { ...h, greeting, note } : h) }))} renderItems={renderItems} now={now} />}
    {tab === 'wardrobe' && <WardrobePage items={wardrobeItems(items)} homeName={home.name} rooms={currentRooms} containers={containers.filter(c => currentRooms.some(r => r.id === c.roomId))} path={path} onAdd={addClothes} onEdit={item => setItemForm({ item: items.find(row => row.id === item.id)! })} onDelete={deleteItem} />}
    {tab === 'rooms' && showRoomLayout
      ? <RoomLayoutPage home={home} rooms={currentRooms} containers={containers} items={currentItems} onBack={() => setShowRoomLayout(false)} onSavePositions={positions => setData(d => ({ ...d, rooms: d.rooms.map(room => positions[room.id] ? { ...room, mapPosition: positions[room.id] } : room) }))} />
      : tab === 'rooms' && (activeRoom && location
      ? <LayoutPage room={activeRoom} location={location} containers={containers} items={items} path={path(location)} onBack={back} onEnter={id => setLocation({ roomId: activeRoom.id, containerId: id })} onItem={i => setSelectedItemId(i.id)} onAdd={() => beginItem(location)} onCreateContainer={() => openEditor('container', undefined, { roomId: activeRoom.id, parentId: location.containerId })} onRenameContainer={c => openEditor('container', c)} onDeleteContainer={deleteContainer} onUpdateContainerCells={updateContainerCells} onDelete={() => deleteRoom(activeRoom)} renderItems={renderItems} />
      : <RoomsPage home={home} rooms={currentRooms} containers={containers} items={currentItems} onOpen={id => setLocation({ roomId: id })} onCreate={() => openEditor('room')} onRename={room => openEditor('room', room)} onDelete={deleteRoom} onOpenLayout={() => setShowRoomLayout(true)} />)}
    {tab === 'items' && <ScrollView contentContainerStyle={s.page}><View style={s.pageIntro}><Text style={s.title}>物品</Text><Text style={s.muted}>{home.name}</Text></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>家里的物品</Text><Text style={s.muted}>{currentItems.length} 件</Text></View><Text style={s.sectionCaption}>按到期状态和分类查看和整理家里的每件物品。</Text><View style={s.filterPanel}><Text style={s.label}>筛选范围</Text><View style={s.wrap}>{(Object.keys(filterLabels) as Filter[]).map(key => <Chip key={key} label={filterLabels[key]} selected={filter === key} onPress={() => setFilter(key)} />)}</View><Text style={s.label}>物品分类</Text><View style={s.wrap}><Chip label="全部分类" selected={!categoryFilter} onPress={() => setCategoryFilter(undefined)} />{categories.map(category => <Chip key={category.id} label={category.name} selected={categoryFilter === category.id} onPress={() => setCategoryFilter(category.id)} />)}</View></View><View style={s.itemListCard}>{renderItems(filterItems(currentItems, filter, categoryFilter, now))}</View></View><Button title="记录物品" icon="plus" onPress={() => beginItem()} /></ScrollView>}
    {tab === 'settings' && <ScrollView contentContainerStyle={s.page}><View style={s.pageIntro}><Text style={s.title}>设置</Text><Text style={s.muted}>把家庭、分类和提醒整理成适合你的样子。</Text></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>家庭管理</Text><Text style={s.statusBadge}>{homes.length} 个家</Text></View>{homes.map((h, index) => <View key={h.id} style={[s.settingsRow, index === homes.length - 1 && s.settingsRowLast]}><Pressable accessibilityRole="button" accessibilityLabel={`切换到 ${h.name}`} onPress={() => switchHome(h.id)} style={[s.row, s.settingsCopy]}><Icon name={activeHomeId === h.id ? 'check-circle' : 'home'} color={activeHomeId === h.id ? colors.accent : colors.muted} /><Text style={[s.label, { flexShrink: 1 }]}>{h.name}</Text></Pressable><View style={s.settingsActions}><IconButton name="edit-2" label={`重命名家庭 ${h.name}`} onPress={() => openEditor('home', h)} />{homes.length > 1 && <IconButton name="trash-2" label={`删除家庭 ${h.name}`} onPress={() => deleteHome(h)} />}</View></View>)}<Button title="新建家" icon="plus" secondary onPress={() => openEditor('home')} /></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>分类标签</Text><Text style={s.statusBadge}>{categories.length} 个分类</Text></View>{categories.map((c, index) => <View key={c.id} style={[s.settingsRow, index === categories.length - 1 && s.settingsRowLast]}><View style={s.settingsCopy}><Text style={s.label}>{c.name}</Text><Text style={s.sectionCaption}>{c.isSystem ? '系统分类' : '可编辑分类'}</Text></View>{!c.isSystem && <View style={s.settingsActions}><IconButton name="edit-2" label={`修改分类 ${c.name}`} onPress={() => openEditor('category', c)} /><IconButton name="trash-2" label={`删除分类 ${c.name}`} onPress={() => deleteCategory(c)} /></View>}</View>)}<Button title="新增分类" icon="plus" secondary onPress={() => openEditor('category')} /></View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>到期提醒</Text><Icon name="bell" color={colors.accent} /></View><Text style={s.sectionCaption}>{!notificationsAvailable ? '当前预览环境不启用系统通知，请安装独立开发版测试到期提醒。' : notificationPermission === 'granted' ? '已允许发送本地通知' : '尚未允许发送本地通知'}</Text><Button title="启用到期提醒" icon="bell" secondary disabled={!notificationsAvailable || notificationPermission === 'granted'} onPress={() => { void requestNotificationPermission().then(granted => { setNotificationPermission(granted ? 'granted' : 'denied'); if (granted) void rescheduleAllReminders(items); }); }} /></View></ScrollView>}
  </View><View style={s.nav}>{nav.map(([key, icon, label]) => <Pressable key={key} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: tab === key }} style={s.navItem} onPress={() => chooseTab(key)}><Icon name={icon} color={tab === key ? colors.accent : colors.muted} /><Text style={[s.navLabel, tab === key && { color: colors.accent }]}>{label}</Text></Pressable>)}</View>
    {homeMenu && <Sheet title="选择家庭" onClose={() => setHomeMenu(false)}>{homes.map(h => <View key={h.id} style={s.headingRow}><Pressable accessibilityRole="button" accessibilityLabel={`切换到 ${h.name}`} onPress={() => switchHome(h.id)} style={[s.row, { flex: 1, minHeight: 48 }]}><Icon name={h.id === activeHomeId ? 'check-circle' : 'home'} /><Text style={[s.label, { flexShrink: 1 }]}>{h.name}</Text></Pressable><IconButton name="edit-2" label={`重命名家庭 ${h.name}`} onPress={() => openEditor('home', h)} />{homes.length > 1 && <IconButton name="trash-2" label={`删除家庭 ${h.name}`} onPress={() => deleteHome(h)} />}</View>)}<Button title="新建家" icon="plus" onPress={() => openEditor('home')} /></Sheet>}
    {editor && <Sheet title={`${editor.id ? '编辑' : '新增'}${editor.kind === 'home' ? '家庭' : editor.kind === 'room' ? '房间' : editor.kind === 'category' ? '分类' : '模块'}`} onClose={() => setEditor(undefined)}><Field label="名称" value={draftName} onChangeText={setDraftName} />{editor.kind === 'room' && <View style={{ gap: 8, marginVertical: 10 }}><Text style={s.label}>房间网格尺寸（最小 {editorMinimum}×{editorMinimum}，最大 16×16）</Text><View style={s.wrap}>{ROOM_LAYOUT_PRESETS.map(size => { const selected = draftRows === String(size.rows) && draftCols === String(size.cols); return <Chip key={size.label} label={size.label} selected={selected} onPress={() => { setDraftRows(String(size.rows)); setDraftCols(String(size.cols)); }} />; })}</View><View style={s.row}><View style={{ flex: 1 }}><Field label="行数" value={draftRows} onChangeText={setDraftRows} numeric /></View><View style={{ flex: 1 }}><Field label="列数" value={draftCols} onChangeText={setDraftCols} numeric /></View></View><Text style={s.sectionCaption}>也可以自定义 {editorMinimum} 到 16 的整数，例如 12×8。</Text></View>}{editor.kind === 'container' && <View style={{ gap: 8, marginVertical: 10 }}><Text style={s.label}>模块颜色</Text><View style={s.wrap}>{MODULE_COLORS.map((color, index) => { const selected = draftColor.trim().toUpperCase() === color; return <Pressable key={color} accessibilityRole="radio" accessibilityLabel={`选择模块颜色 ${index + 1}`} accessibilityState={{ selected }} onPress={() => setDraftColor(color)} style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: color, borderWidth: selected ? 3 : 1, borderColor: selected ? colors.ink : colors.line, alignItems: 'center', justifyContent: 'center' }}>{selected && <Text style={{ color: moduleColorTextColor(color), fontWeight: '700' }}>✓</Text>}</Pressable>; })}</View><Field label="HEX 色值" value={draftColor} onChangeText={setDraftColor} placeholder="#C98F7A" /></View>}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={editor.kind === 'container' ? '保存模块' : '保存名称'} onPress={saveName} /></Sheet>}
    {itemForm && <ItemForm homeId={itemForm.item?.homeId ?? activeHomeId} homeName={homes.find(home => home.id === (itemForm.item?.homeId ?? activeHomeId))?.name ?? home.name} rooms={rooms.filter(room => room.homeId === (itemForm.item?.homeId ?? activeHomeId))} containers={containers} categories={categories} initialLocation={itemForm.initialLocation} item={itemForm.item} onClose={() => setItemForm(undefined)} onSave={saveItem} />}
    {selectedItem && <Sheet title={selectedItem.name} onClose={() => setSelectedItemId(undefined)}><View style={{ gap: 12 }}><Text style={s.muted}>{path(selectedItem)}</Text><Text style={s.label}>分类：{categoryName(selectedItem.categoryId)}</Text><Text style={s.muted}>{selectedItem.expiry ? `过期日期：${selectedItem.expiry}` : '未设置保质期'}</Text><Button title="编辑物品" icon="edit-2" onPress={() => { setItemForm({ item: selectedItem }); setSelectedItemId(undefined); }} /><Button title="删除物品" icon="trash-2" secondary onPress={() => deleteItem(selectedItem)} /></View></Sheet>}
    {confirmation && <Sheet title={confirmation.title} onClose={() => setConfirmation(undefined)}><Text style={s.muted}>{confirmation.message}</Text><Button title="确认删除" onPress={() => { confirmation.run(); setConfirmation(undefined); }} /><Button title="取消" secondary onPress={() => setConfirmation(undefined)} /></Sheet>}
  </SafeAreaView></GestureHandlerRootView>;
}
