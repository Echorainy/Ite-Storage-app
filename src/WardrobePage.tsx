import React, { useRef, useState } from 'react';
import { Image, ImageSourcePropType, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ClothingDraft, Item, WardrobeItem, Location, Room, Container, directChildren } from './domain';
import { Button, Chip, Empty, Field, Icon, IconButton, colors, s } from './ui';
import { WardrobeRemakeExamples } from './WardrobeRemakeExamples';
import { CLOTHING_GROUPS, WARDROBE_TYPES, WARDROBE_COLORS, WARDROBE_SEASONS, normalizeClothingType, normalizeWardrobeColor, clothingGroupForType } from './wardrobe-options';
import { OutfitStudio } from './outfit-studio';
import { localWardrobeImage, wardrobeSourcesFor } from './wardrobe-assets';

type WardrobeWeather = { city: string; day: { date: string; highC: number | null; lowC: number | null; condition: string; rainProbability: number; feelsLikeC: number | null } };
const SMART_WARDROBE_API = (process.env.EXPO_PUBLIC_WARDROBE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const WARDROBE_LOCATION_KEY = 'smart-wardrobe-location-v1';
export function WardrobePage({ items, homeName, rooms, containers, path, onAdd, onEdit, onDelete }: { items: WardrobeItem[]; homeName: string; rooms: Room[]; containers: Container[]; path: (item: Item) => string; onAdd: (items: ClothingDraft[]) => void; onEdit: (item: Item) => void; onDelete: (item: Item) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<string>(WARDROBE_TYPES[0]);
  const [groupId, setGroupId] = useState(CLOTHING_GROUPS[0].id);
  const [color, setColor] = useState('');
  const [material, setMaterial] = useState('');
  const [season, setSeason] = useState('四季');
  const [image, setImage] = useState('');
  const [imageFile, setImageFile] = useState<any>(null);
  const [place, setPlace] = useState<Location>();
  const [visionLoading, setVisionLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [weather, setWeather] = useState<WardrobeWeather>();
  const [weatherLoading, setWeatherLoading] = useState(false);
  const weatherPending = useRef(false);
  const [locationStatus, setLocationStatus] = useState('尚未绑定位置');
  const [remakeExamplesOpen, setRemakeExamplesOpen] = useState(false);
  const fileInput = useRef<any>(null);
  const jsonInput = useRef<any>(null);
  const chooseImage = () => fileInput.current?.click?.();
  const importJson = () => jsonInput.current?.click?.();
  const fetchWeather = async (latitude: number, longitude: number) => {
    weatherPending.current = true;
    setWeatherLoading(true);
    try {
      const response = await fetch(`${SMART_WARDROBE_API}/api/weather?days=1&latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`);
      if (!response.ok) throw new Error('天气接口暂不可用');
      const payload = await response.json();
      if (!payload.days?.[0]) throw new Error('没有返回今天的天气');
      setWeather({ city: payload.city || '当前位置', day: payload.days[0] });
      setLocationStatus(`已绑定：${payload.city || '当前位置'}`);
    } catch (weatherError) {
      setLocationStatus('天气获取失败，请重试');
      setError(`天气获取失败：${weatherError instanceof Error ? weatherError.message : '请确认本机天气服务已启动'}`);
    } finally { weatherPending.current = false; setWeatherLoading(false); }
  };
  const bindLocation = () => {
    if (weatherPending.current) return;
    const geolocation = Platform.OS === 'web' ? (globalThis as any).navigator?.geolocation : undefined;
    if (!geolocation) return setError('当前浏览器不支持定位');
    weatherPending.current = true;
    setWeatherLoading(true);
    setError('');
    setLocationStatus('正在获取当前位置…');
    const locationFailed = () => {
      weatherPending.current = false;
      setWeatherLoading(false);
      setLocationStatus(locationStatus);
      setError('定位失败，请允许浏览器访问位置后重试');
    };
    try {
      geolocation.getCurrentPosition((position: any) => {
        const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        try { globalThis.localStorage?.setItem(WARDROBE_LOCATION_KEY, JSON.stringify(location)); } catch {}
        void fetchWeather(location.latitude, location.longitude);
      }, locationFailed, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
    } catch { locationFailed(); }
  };
  React.useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const stored = globalThis.localStorage?.getItem(WARDROBE_LOCATION_KEY);
      if (stored) { const location = JSON.parse(stored); if (Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) void fetchWeather(location.latitude, location.longitude); }
    } catch {}
  }, []);
  const handleJsonImport = (event: any) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { const rows = JSON.parse(String(reader.result ?? '')); if (!Array.isArray(rows)) throw new Error('JSON 顶层必须是数组'); if (rows.some(row => !row || typeof row !== 'object' || ['filename', 'name', 'category', 'type', 'color', 'material', 'season', 'image'].some(key => row[key] !== undefined && typeof row[key] !== 'string'))) throw new Error('衣物字段必须是文本'); const imported = rows.map((row: any, index: number) => ({ id: `imported-${Date.now()}-${index}`, name: row.filename || row.name || '未命名衣物', type: row.category || row.type || WARDROBE_TYPES[0], color: row.color || '未设置', material: row.material || '', season: row.season || '四季', image: row.image || '' })); onAdd(imported); setError(`已导入 ${imported.length} 件衣物`); } catch (importError) { setError(`导入失败：${importError instanceof Error ? importError.message : '文件格式错误'}`); } }; reader.readAsText(file, 'utf-8'); };
  const imageUri = (value: unknown) => {
    if (typeof value !== 'string' || !value) return '';
    if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;
    return `${SMART_WARDROBE_API}${value.startsWith('/') ? '' : '/'}${value}`;
  };
  const imageSource = (value: unknown): ImageSourcePropType => localWardrobeImage(typeof value === 'string' ? value : undefined) ?? { uri: imageUri(value) };
  const addItem = async () => {
    if (!imageFile && !name.trim()) return setError('请填写衣物名称或先选择衣物图片');
    setError('');
    let nextName = name.trim(); let nextType = normalizeClothingType(type); let nextColor = normalizeWardrobeColor(color) || '未设置'; let nextMaterial = material; let nextSeason = season; let nextImage = image;
    if (imageFile) {
      setVisionLoading(true);
      try {
        const form = new FormData(); form.append('file', imageFile);
        const response = await fetch(`${SMART_WARDROBE_API}/api/analyze`, { method: 'POST', body: form });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload?.item) throw new Error(payload.detail || payload.message || '视觉识别失败');
        const result = payload.item || payload;
        nextName = result.name || nextName || result.filename || '未命名衣物'; nextType = normalizeClothingType(result.category || nextType); nextColor = normalizeWardrobeColor(result.color || nextColor); nextMaterial = result.material || nextMaterial; nextSeason = result.season || nextSeason;
        nextImage = imageUri(result.image || result.cutout_path) || nextImage;
      } catch (visionError) {
        setImageFile(null);
        setError(`识别失败：${visionError instanceof Error ? visionError.message : '请检查视觉服务'}。仍可手动填写后添加。`);
        setVisionLoading(false); return;
      }
      setVisionLoading(false);
      if (!nextName.trim()) return setError('请手动填写衣物名称后再添加');
    }
    if (!nextName.trim()) return setError('识别未返回名称，请手动填写衣物名称后再添加');
    onAdd([{ name: nextName, type: nextType, color: nextColor, material: nextMaterial || '未设置', season: nextSeason, image: nextImage, roomId: place?.roomId, containerId: place?.containerId }]);
    setName(''); setColor(''); setMaterial(''); setSeason('四季'); setImage(''); setImageFile(null); setPlace(undefined); setError('');
  };
  const moduleOptions = place ? directChildren(containers, place.roomId) : [];
  const selected = containers.find(c => c.id === place?.containerId);
  const parentId = selected?.level === 3 ? selected.parentId : selected?.id;
  const childOptions = place && parentId ? directChildren(containers, place.roomId, parentId) : [];
  const filtered = items.filter(item => `${item.name} ${item.type} ${clothingGroupForType(item.type)?.label ?? ""} ${item.color} ${item.material || ''} ${item.season}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled"><View style={s.headingRow}><View style={{ gap: 4, flex: 1 }}><Text style={s.title}>智能衣柜</Text><Text style={s.muted}>所有家庭的衣物 · 统一管理与快速查找</Text></View><Icon name="shopping-bag" color={colors.accent} /></View><View style={s.sectionCard}><View style={s.sectionHeader}><View><Text style={s.h2}>天气与位置</Text><Text style={s.sectionCaption}>{locationStatus}</Text></View><Icon name="map-pin" color={colors.accent} /></View>{weather && <View style={[s.card, { gap: 4 }]}><Text style={s.label}>{weather.city} · 今天</Text><Text style={s.h2}>{weather.day.condition} · 体感 {weather.day.feelsLikeC ?? weather.day.highC ?? ''}°C</Text><Text style={s.muted}>最高 {weather.day.highC ?? ''}°C · 最低 {weather.day.lowC ?? ''}°C · 降雨概率 {weather.day.rainProbability}%</Text></View>}<Button title="绑定当前位置并获取天气" icon="navigation" secondary loading={weatherLoading} onPress={bindLocation} /></View><View style={s.sectionCard}><OutfitStudio items={items} weather={weather} sources={wardrobeSourcesFor(items)} /></View><View style={s.sectionCard}><Text style={s.sectionCaption}>新增衣物归入{homeName}，可稍后编辑存放位置。</Text><Field label="衣物名称" value={name} onChangeText={setName} placeholder="例如：黑色T恤" /><Text style={s.label}>衣物类别</Text><View style={s.wrap}>{CLOTHING_GROUPS.map(group => <Chip key={group.id} label={group.label} tone="neutral" selected={group.id === groupId} onPress={() => { setGroupId(group.id); setType(group.options[0]); }} />)}</View><View style={s.wrap}>{(CLOTHING_GROUPS.find(group => group.id === groupId)?.options ?? []).map(value => <Chip key={value} label={value} tone={CLOTHING_GROUPS.find(group => group.id === groupId)?.tone} selected={type === value} onPress={() => setType(value)} />)}</View><Field label="颜色（输入黑色条纹会自动归类为黑色）" value={color} onChangeText={value => setColor(value)} placeholder="例如：黑色条纹" /><View style={s.wrap}>{WARDROBE_COLORS.slice(0, 8).map(value => <Chip key={value} label={value} selected={normalizeWardrobeColor(color) === value} onPress={() => setColor(value)} />)}</View><Field label="材质" value={material} onChangeText={setMaterial} placeholder="例如：棉、牛仔、羊毛" /><Text style={s.label}>存放位置（可选）</Text><View style={s.wrap}><Chip label="未设置位置" selected={!place} onPress={() => setPlace(undefined)} />{rooms.map(room => <Chip key={room.id} label={room.name} tone="room" selected={place?.roomId === room.id} onPress={() => setPlace({ roomId: room.id })} />)}</View>{place && <><View style={s.wrap}><Chip label="直接放在房间" tone="neutral" selected={!place.containerId} onPress={() => setPlace({ roomId: place.roomId })} />{moduleOptions.map(c => <Chip key={c.id} label={c.name} tone="module" selected={parentId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>{childOptions.length > 0 && <View style={[s.wrap, { marginTop: 8 }]}>{childOptions.map(c => <Chip key={c.id} label={c.name} tone="submodule" selected={place.containerId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>}</>}<Text style={s.label}>季节</Text><View style={s.wrap}>{WARDROBE_SEASONS.map(value => <Chip key={value} label={value} selected={season === value} onPress={() => setSeason(value)} />)}</View>{Platform.OS !== 'web' && <Text style={s.muted}>图片上传、JSON 导入和定位天气请在网页端使用。</Text>}<View style={s.wrap}><Button title="选择衣物图片" icon="image" secondary disabled={Platform.OS !== 'web'} onPress={chooseImage} /><Button title={visionLoading ? "正在抠图并识别…" : "添加衣物"} icon="plus" disabled={visionLoading} onPress={() => { void addItem(); }} /><Button title="导入 JSON" icon="upload" secondary disabled={Platform.OS !== 'web'} onPress={importJson} /></View>{Platform.OS === 'web' && React.createElement('input', { ref: (node: any) => { fileInput.current = node; }, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: (event: any) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); setImageFile(file); reader.onload = () => setImage(String(reader.result ?? '')); reader.readAsDataURL(file); } } as any)}{Platform.OS === 'web' && React.createElement('input', { ref: (node: any) => { jsonInput.current = node; }, type: 'file', accept: '.json,application/json', style: { display: 'none' }, onChange: handleJsonImport } as any)}{!!image && <Image accessibilityLabel="待添加衣物预览" source={imageSource(image)} style={{ width: 110, height: 76, borderRadius: 12, marginTop: 8 }} />}{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}</View><View style={s.sectionCard}><View style={s.sectionHeader}><Text style={s.h2}>衣柜里的衣物</Text><Text style={s.muted}>{filtered.length} 件</Text></View><View style={s.searchWrap}><Icon name="search" color={colors.muted} /><TextInput accessibilityLabel="搜索衣柜衣物" placeholder="搜索名称、类别、颜色、材质或季节" value={query} onChangeText={setQuery} style={[s.input, s.searchInput]} /></View><View style={{ gap: 10 }}>{filtered.length ? filtered.map(item => <View key={item.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>{item.image ? <Image accessibilityLabel={item.name} source={imageSource(item.image)} style={{ width: 74, height: 74, borderRadius: 12 }} /> : <View style={{ width: 74, height: 74, borderRadius: 12, backgroundColor: colors.peachSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 30 }}>👕</Text></View>}<View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={s.label} numberOfLines={2}>{item.name}</Text><Text style={s.muted}>{path(item)}</Text><Text style={s.muted}>{item.type} · {item.color} · {item.material || '未设置'} · {item.season}</Text></View><View style={{ gap: 8 }}><IconButton name="edit-2" label={`编辑衣物 ${item.name}`} onPress={() => onEdit(item)} /><IconButton name="trash-2" label={`删除衣物 ${item.name}`} onPress={() => onDelete(item)} /></View></View>) : <Empty text="还没有匹配的衣物" />}<Pressable accessibilityRole="button" accessibilityLabel="查看衣物改造示例" onPress={() => setRemakeExamplesOpen(true)} style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10, marginTop: 2 }}><Text style={[s.sectionCaption, { color: colors.accent, textDecorationLine: 'underline' }]}>衣物改造功能尚未完成，点击查看改造示例</Text></Pressable></View></View>{remakeExamplesOpen && <WardrobeRemakeExamples onClose={() => setRemakeExamplesOpen(false)} />}</ScrollView>;
}
