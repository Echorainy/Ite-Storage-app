import React, { useRef, useState } from 'react';
import { Image, Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CLOTHING_CATEGORY_ID, Category, Container, Item, Location, Room, directChildren, localDate, parseDate } from './domain';
import { Button, Chip, Field, Sheet, colors, s } from './ui';
import { WARDROBE_TYPES, WARDROBE_COLORS, WARDROBE_SEASONS, normalizeWardrobeColor } from './wardrobe-options';

export function ItemForm({ homeId, homeName, rooms, containers, categories, initialLocation, item, onClose, onSave }: { homeId: string; homeName: string; rooms: Room[]; containers: Container[]; categories: Category[]; initialLocation?: Location; item?: Item; onClose: () => void; onSave: (item: Omit<Item, 'id'>, id?: string) => string | null }) {
  const [name, setName] = useState(item?.name ?? ''); const [categoryId, setCategoryId] = useState(item?.categoryId ?? 'uncategorized');
  const [place, setPlace] = useState<Location | undefined>(item?.roomId ? { roomId: item.roomId, containerId: item.containerId } : initialLocation);
  const [clothing, setClothing] = useState({ type: item?.type ?? '', color: item?.color ?? '', material: item?.material ?? '', season: item?.season ?? '', image: item?.image ?? '' });
  const imageInput = useRef<any>(null);
  const [withExpiry, setWithExpiry] = useState(!!item?.expiry); const [mode, setMode] = useState<'direct' | 'calculated'>('direct');
  const [date, setDate] = useState(item?.expiry ?? ''); const [production, setProduction] = useState(''); const [days, setDays] = useState(''); const [error, setError] = useState(''); const [picker, setPicker] = useState<'expiry' | 'production'>();
  const pickerValue = (value: string) => parseDate(value) ?? new Date();
  const dateField = (label: string, value: string, kind: 'expiry' | 'production', onChange: (value: string) => void) => <>{Platform.OS === 'web' ? <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder="YYYY-MM-DD" placeholderTextColor="#A89078" style={s.input} /> : <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setPicker(kind)} style={s.input}><Text style={{ color: value ? colors.ink : colors.muted }}>{value || '选择日期'}</Text></Pressable>}{picker === kind && Platform.OS !== 'web' && <DateTimePicker value={pickerValue(value)} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'default'} onChange={(_, selected) => { if (Platform.OS !== 'ios') setPicker(undefined); if (selected) onChange(localDate(selected)); }} />}</>;
  const save = () => {
    if (!name.trim()) return setError('请填写物品名称');
    if ((!place && !(item && (!item.roomId || categoryId === CLOTHING_CATEGORY_ID))) || (place && !rooms.some(r => r.id === place.roomId))) return setError('请选择房间');
    let expiry: string | undefined;
    if (withExpiry) {
      if (mode === 'direct') { if (!parseDate(date)) return setError('请输入有效的过期日期，例如 2026-12-31'); expiry = date; }
      else {
        const start = parseDate(production); const length = Number(days);
        if (!start || !Number.isInteger(length) || length <= 0 || length > 36500) return setError('请填写有效生产日期和 1–36500 的整数天数');
        start.setDate(start.getDate() + length); expiry = localDate(start);
      }
    }
    const message = onSave({ ...clothing, color: normalizeWardrobeColor(clothing.color), name: name.trim(), homeId, categoryId, roomId: place?.roomId, containerId: place?.containerId, expiry, reminderDays: item?.reminderDays ?? 7, cell: place?.roomId === item?.roomId && place?.containerId === item?.containerId ? item?.cell : undefined }, item?.id);
    if (message) setError(message);
  };
  const moduleOptions = place ? directChildren(containers, place.roomId) : [];
  const selected = containers.find(c => c.id === place?.containerId);
  const parentId = selected?.level === 3 ? selected.parentId : selected?.id;
  const children = place && parentId ? directChildren(containers, place.roomId, parentId) : [];
  return <Sheet title={item ? '编辑物品' : '记录物品'} onClose={onClose}>
    <Text style={s.muted}>所属家庭：{homeName}</Text>
    <Field label="物品名称" value={name} onChangeText={setName} />
    <Text style={s.label}>房间</Text><View style={s.wrap}>{item && categoryId === CLOTHING_CATEGORY_ID && <Chip label="未设置位置" selected={!place} onPress={() => setPlace(undefined)} />}{rooms.map(room => <Chip key={room.id} label={room.name} tone="room" selected={place?.roomId === room.id} onPress={() => setPlace({ roomId: room.id })} />)}</View>
    {place && <><Text style={[s.label, { marginVertical: 10 }]}>存放位置</Text><View style={s.wrap}><Chip label="直接放在房间" tone="neutral" selected={!place.containerId} onPress={() => setPlace({ roomId: place.roomId })} />{moduleOptions.map(c => <Chip key={c.id} label={c.name} tone="module" selected={parentId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>{!!children.length && <View style={[s.wrap, { marginTop: 8 }]}>{children.map(c => <Chip key={c.id} label={c.name} tone="submodule" selected={place.containerId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>}</>}
    <Text style={[s.label, { marginVertical: 10 }]}>分类标签</Text><View style={s.wrap}>{categories.map(c => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}</View>
    {categoryId === CLOTHING_CATEGORY_ID && <View><Text style={s.sectionCaption}>衣物属性可稍后补充，保存后自动加入智能衣柜。</Text><Text style={s.label}>款式（可选）</Text><View style={s.wrap}>{WARDROBE_TYPES.map(value => <Chip key={value} label={value} selected={clothing.type === value} onPress={() => setClothing(current => ({ ...current, type: value }))} />)}</View><Text style={s.label}>颜色（可选）</Text><Field label="自定义颜色" value={clothing.color} onChangeText={value => setClothing(current => ({ ...current, color: value }))} placeholder="例如：黑色条纹" /><View style={s.wrap}>{WARDROBE_COLORS.map(value => <Chip key={value} label={value} selected={normalizeWardrobeColor(clothing.color) === value} onPress={() => setClothing(current => ({ ...current, color: value }))} />)}</View><Field label="材质" value={clothing.material} onChangeText={value => setClothing(current => ({ ...current, material: value }))} placeholder="未设置" /><Text style={s.label}>季节（可选）</Text><View style={s.wrap}>{WARDROBE_SEASONS.map(value => <Chip key={value} label={value} selected={clothing.season === value} onPress={() => setClothing(current => ({ ...current, season: value }))} />)}</View><Text style={s.label}>衣物图片（可选）</Text><View style={s.wrap}><Button title="选择衣物图片" secondary disabled={Platform.OS !== 'web'} onPress={() => imageInput.current?.click?.()} />{clothing.image ? <Button title="清除图片" secondary onPress={() => setClothing(current => ({ ...current, image: '' }))} /> : null}</View>{Platform.OS === 'web' && React.createElement('input', { ref: (node: any) => { imageInput.current = node; }, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: (event: any) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setClothing(current => ({ ...current, image: String(reader.result ?? '') })); reader.readAsDataURL(file); } } as any)}{clothing.image ? <Image accessibilityLabel="衣物图片预览" source={{ uri: clothing.image }} style={{ width: 110, height: 76, borderRadius: 12, marginTop: 8 }} /> : null}</View>}
    <Text style={[s.label, { marginVertical: 10 }]}>保质期</Text><View style={s.wrap}><Chip label="不设置保质期" selected={!withExpiry} onPress={() => setWithExpiry(false)} /><Chip label="设置保质期" selected={withExpiry} onPress={() => setWithExpiry(true)} /></View>
    {withExpiry && <><View style={[s.wrap, { marginTop: 12 }]}><Chip label="选择过期日" selected={mode === 'direct'} onPress={() => setMode('direct')} /><Chip label="生产日期 + 天数" selected={mode === 'calculated'} onPress={() => setMode('calculated')} /></View>{mode === 'direct' ? <View style={s.field}><Text style={s.label}>过期日期</Text>{dateField('过期日期', date, 'expiry', setDate)}</View> : <><View style={s.field}><Text style={s.label}>生产日期</Text>{dateField('生产日期', production, 'production', setProduction)}</View><Field label="保质期天数" value={days} onChangeText={setDays} numeric /></>}</>}
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={item ? '保存修改' : '保存物品'} onPress={save} />
  </Sheet>;
}
