import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { CLOTHING_CATEGORY_ID, Category, Container, Item, Location, Room, directChildren, localDate, parseDate } from './domain';
import { Button, Chip, Field, Sheet, colors, s } from './ui';
import { CLOTHING_GROUPS, WARDROBE_COLORS, WARDROBE_SEASONS, clothingGroupForType, normalizeClothingType, normalizeWardrobeColor } from './wardrobe-options';

const itemFormStyles = StyleSheet.create({
  content: { gap: 12 },
  section: { gap: 8, marginTop: 4 },
  sectionSpaced: { gap: 8, marginTop: 16 },
  fieldGroup: { gap: 8 },
  chipGroup: { gap: 8 },
  actions: { gap: 12, marginTop: 16, paddingBottom: 4 },
  voiceField: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceInput: { flex: 1 },
});
function CompactField({ label, value, onChangeText, placeholder, numeric = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; numeric?: boolean }) {
  return <View style={itemFormStyles.fieldGroup}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#81918A" keyboardType={numeric ? 'number-pad' : 'default'} /></View>;
}

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export function ItemForm({ homeId, homeName, rooms, containers, categories, initialLocation, item, onClose, onSave }: { homeId: string; homeName: string; rooms: Room[]; containers: Container[]; categories: Category[]; initialLocation?: Location; item?: Item; onClose: () => void; onSave: (item: Omit<Item, 'id'>, id?: string) => string | null }) {
  const [name, setName] = useState(item?.name ?? ''); const [categoryId, setCategoryId] = useState(item?.categoryId ?? 'uncategorized');
  const [place, setPlace] = useState<Location | undefined>(item?.roomId ? { roomId: item.roomId, containerId: item.containerId } : initialLocation);
  const [clothing, setClothing] = useState({ type: item?.type ?? '', color: item?.color ?? '', material: item?.material ?? '', season: item?.season ?? '', image: item?.image ?? '' });
  const imageInput = useRef<any>(null);
  const recognition = useRef<BrowserRecognition | null>(null);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [withExpiry, setWithExpiry] = useState(!!item?.expiry); const [mode, setMode] = useState<'direct' | 'calculated'>('direct');
  const [date, setDate] = useState(item?.expiry ?? ''); const [production, setProduction] = useState(''); const [days, setDays] = useState(''); const [error, setError] = useState(''); const [picker, setPicker] = useState<'expiry' | 'production'>();
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const browser = globalThis as any;
    setVoiceSupported(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => { recognition.current?.stop(); recognition.current = null; };
  }, []);
  const toggleVoice = () => {
    if (!voiceSupported) return;
    if (voiceListening) { recognition.current?.stop(); return; }
    const browser = globalThis as any;
    const Recognition = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    const next = new Recognition() as BrowserRecognition;
    next.lang = 'zh-CN'; next.interimResults = true; next.continuous = false;
    next.onresult = event => {
      const transcript = Array.from(event.results as ArrayLike<any>).map(result => result[0]?.transcript ?? '').join('').trim();
      if (transcript) setName(transcript);
    };
    next.onerror = () => { setVoiceListening(false); setError('语音识别失败，请检查浏览器麦克风权限或改为手动输入'); };
    next.onend = () => { setVoiceListening(false); recognition.current = null; };
    recognition.current = next; setError(''); setVoiceListening(true);
    try { next.start(); } catch { setVoiceListening(false); recognition.current = null; setError('语音识别无法启动，请改为手动输入'); }
  };
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
    const message = onSave({ ...clothing, type: normalizeClothingType(clothing.type), color: normalizeWardrobeColor(clothing.color), name: name.trim(), homeId, categoryId, roomId: place?.roomId, containerId: place?.containerId, expiry, reminderDays: item?.reminderDays ?? 7, cell: place?.roomId === item?.roomId && place?.containerId === item?.containerId ? item?.cell : undefined }, item?.id);
    if (message) setError(message);
  };
  const moduleOptions = place ? directChildren(containers, place.roomId) : [];
  const selected = containers.find(c => c.id === place?.containerId);
  const parentId = selected?.level === 3 ? selected.parentId : selected?.id;
  const children = place && parentId ? directChildren(containers, place.roomId, parentId) : [];
  return <Sheet title={item ? '编辑物品' : '记录物品'} onClose={onClose}>
    <View style={itemFormStyles.content}>
    <Text style={s.muted}>所属家庭：{homeName}</Text>
    <View style={itemFormStyles.fieldGroup}><Text style={s.label}>物品名称</Text><View style={itemFormStyles.voiceField}><TextInput accessibilityLabel="物品名称" style={[s.input, itemFormStyles.voiceInput]} value={name} onChangeText={setName} placeholder="例如：黑色T恤" placeholderTextColor="#81918A" />{voiceSupported && <Pressable accessibilityRole="button" accessibilityLabel={voiceListening ? '停止语音录入' : '语音录入物品名称'} accessibilityState={{ busy: voiceListening }} onPress={toggleVoice} style={[s.iconButton, voiceListening && { backgroundColor: colors.peachSoft, borderRadius: 12 }]}><Text style={{ color: voiceListening ? colors.danger : colors.accent, fontSize: 20 }}>{voiceListening ? '■' : '●'}</Text></Pressable>}</View>{voiceListening && <Text style={s.sectionCaption}>正在听，请说出物品名称…</Text>}</View>
    <View style={itemFormStyles.section}><Text style={s.label}>位置</Text><View style={itemFormStyles.chipGroup}><Text style={s.sectionCaption}>房间</Text><View style={s.wrap}>{item && categoryId === CLOTHING_CATEGORY_ID && <Chip label="未设置位置" selected={!place} onPress={() => setPlace(undefined)} />}{rooms.map(room => <Chip key={room.id} label={room.name} tone="room" selected={place?.roomId === room.id} onPress={() => setPlace({ roomId: room.id })} />)}</View>{place && <><Text style={s.sectionCaption}>存放位置</Text><View style={s.wrap}><Chip label="直接放在房间" tone="neutral" selected={!place.containerId} onPress={() => setPlace({ roomId: place.roomId })} />{moduleOptions.map(c => <Chip key={c.id} label={c.name} tone="module" selected={parentId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>{!!children.length && <View style={s.wrap}>{children.map(c => <Chip key={c.id} label={c.name} tone="submodule" selected={place.containerId === c.id} onPress={() => setPlace({ roomId: place.roomId, containerId: c.id })} />)}</View>}</>}</View></View>
    <View style={itemFormStyles.sectionSpaced}><Text style={s.label}>分类标签</Text><View style={s.wrap}>{categories.map(c => <Chip key={c.id} label={c.name} selected={categoryId === c.id} onPress={() => setCategoryId(c.id)} />)}</View></View>
    {categoryId === CLOTHING_CATEGORY_ID && <View style={itemFormStyles.sectionSpaced}><Text style={s.sectionCaption}>衣物属性可稍后补充，保存后自动加入智能衣柜。</Text><Text style={s.label}>衣物类别（可选）</Text><View style={s.wrap}>{CLOTHING_GROUPS.map(group => <Chip key={group.id} label={group.label} tone="neutral" selected={clothingGroupForType(clothing.type)?.id === group.id} onPress={() => setClothing(current => ({ ...current, type: group.options[0] }))} />)}</View><View style={s.wrap}>{(clothingGroupForType(clothing.type)?.options ?? []).map(value => <Chip key={value} label={value} tone={clothingGroupForType(value)?.tone} selected={normalizeClothingType(clothing.type) === value} onPress={() => setClothing(current => ({ ...current, type: value }))} />)}</View><Text style={s.label}>颜色（可选）</Text><CompactField label="自定义颜色" value={clothing.color} onChangeText={value => setClothing(current => ({ ...current, color: value }))} placeholder="例如：黑色条纹" /><View style={s.wrap}>{WARDROBE_COLORS.map(value => <Chip key={value} label={value} selected={normalizeWardrobeColor(clothing.color) === value} onPress={() => setClothing(current => ({ ...current, color: value }))} />)}</View><CompactField label="材质" value={clothing.material} onChangeText={value => setClothing(current => ({ ...current, material: value }))} placeholder="未设置" /><Text style={s.label}>季节（可选）</Text><View style={s.wrap}>{WARDROBE_SEASONS.map(value => <Chip key={value} label={value} selected={clothing.season === value} onPress={() => setClothing(current => ({ ...current, season: value }))} />)}</View><Text style={s.label}>衣物图片（可选）</Text><View style={s.wrap}><Button title="选择衣物图片" secondary disabled={Platform.OS !== 'web'} onPress={() => imageInput.current?.click?.()} />{clothing.image ? <Button title="清除图片" secondary onPress={() => setClothing(current => ({ ...current, image: '' }))} /> : null}</View>{Platform.OS === 'web' && React.createElement('input', { ref: (node: any) => { imageInput.current = node; }, type: 'file', accept: 'image/*', style: { display: 'none' }, onChange: (event: any) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setClothing(current => ({ ...current, image: String(reader.result ?? '') })); reader.readAsDataURL(file); } } as any)}{clothing.image ? <Image accessibilityLabel="衣物图片预览" source={{ uri: clothing.image }} style={{ width: 110, height: 76, borderRadius: 12, marginTop: 8 }} /> : null}</View>}
    <View style={itemFormStyles.sectionSpaced}><Text style={s.label}>保质期</Text><View style={s.wrap}><Chip label="不设置保质期" selected={!withExpiry} onPress={() => setWithExpiry(false)} /><Chip label="设置保质期" selected={withExpiry} onPress={() => setWithExpiry(true)} /></View>
    {withExpiry && <><View style={[s.wrap, { marginTop: 12 }]}><Chip label="选择过期日" selected={mode === 'direct'} onPress={() => setMode('direct')} /><Chip label="生产日期 + 天数" selected={mode === 'calculated'} onPress={() => setMode('calculated')} /></View>{mode === 'direct' ? <View style={s.field}><Text style={s.label}>过期日期</Text>{dateField('过期日期', date, 'expiry', setDate)}</View> : <><View style={s.field}><Text style={s.label}>生产日期</Text>{dateField('生产日期', production, 'production', setProduction)}</View><CompactField label="保质期天数" value={days} onChangeText={setDays} numeric /></>}</>}
    </View><View style={itemFormStyles.actions}>{!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}<Button title={item ? '保存修改' : '保存物品'} onPress={save} /></View>
    </View>
  </Sheet>;
}
