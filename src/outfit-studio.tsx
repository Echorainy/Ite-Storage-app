import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageSourcePropType, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { WardrobeItem } from './domain';
import { Button, colors, Icon, s } from './ui';
import { localOutfit, outfitSlot, OutfitPlan, OutfitSlot, parseOutfit, slotLabels } from './outfit-plan';
import { OutfitAnchor, OutfitPiece, useOutfitReducedMotion } from './outfit-piece';
import { OutfitPopover } from './outfit-popover';
import { OutfitGlass } from './outfit-glass';

type Weather = { city: string; day: { feelsLikeC: number | null; highC: number | null; condition: string; rainProbability: number } };
type Props = { items: WardrobeItem[]; weather?: Weather; demo?: boolean; sources?: Record<string, ImageSourcePropType> };
const API = (process.env.EXPO_PUBLIC_WARDROBE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
export function OutfitStudio({ items, weather, demo = false, sources = {} }: Props) {
  const [plan, setPlan] = useState<OutfitPlan | null>(() => demo ? localOutfit(items, 21) : null);
  const [selected, setSelected] = useState<OutfitSlot>();
  const [anchors, setAnchors] = useState<Partial<Record<OutfitSlot, OutfitAnchor | null>>>({});
  const anchorCallbacks = useRef<Partial<Record<OutfitSlot, (anchor: OutfitAnchor | null) => void>>>({});
  const [root, setRoot] = useState<OutfitAnchor | null>(null);
  const reduced = useOutfitReducedMotion();
  const [sheet, setSheet] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const iteration = useRef(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const pieces = (plan?.itemIds ?? []).map(id => items.find(item => item.id === id)).filter((item): item is WardrobeItem => !!item);
  const active = pieces.find(item => outfitSlot(item) === selected);
  const alternatives = active ? items.filter(item => outfitSlot(item) === outfitSlot(active) && item.id !== active.id) : [];
  const changedItems = !!plan && pieces.length !== plan.itemIds.length;
  const complete = pieces.some(i => outfitSlot(i) === 'top') && pieces.some(i => outfitSlot(i) === 'bottom') && pieces.some(i => outfitSlot(i) === 'shoes');
  const main = pieces.filter(item => ['top', 'bottom', 'dress'].includes(outfitSlot(item) ?? ''));
  const extras = pieces.filter(item => !main.includes(item));
  const close = () => { setSheet(false); setSelected(undefined); };
  const generate = async () => {
    if (loading || !items.length) return;
    setSheet(false); setLoading(true); setNotice(''); setSelected(undefined); setSaved(false);
    const local = localOutfit(items, weather?.day.feelsLikeC ?? weather?.day.highC, iteration.current++);
    if (demo) { setPlan(local); setNotice('示例衣柜 · 仅用于体验展示，不会写入你的衣柜。'); setLoading(false); return; }
    const controller = new AbortController(); request.current = controller;
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const wardrobe = items.map(({ id, name, type, color, season, material }) => ({ id, name, type, color, season, material }));
      const message = `只推荐今天的一套穿搭。只返回 JSON，不要 Markdown：{"title":"穿搭标题","reason":"简短搭配理由","itemIds":["衣物的真实id"]}。只能使用衣柜中存在的 id，每个类别最多一件；连衣裙不能与上衣或下装同时选择；半身裙是下装，需要搭配上衣。天气：${JSON.stringify(weather ?? '未知，不要编造天气')}。衣柜：${JSON.stringify(wardrobe)}`;
      const response = await fetch(`${API}/api/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, wardrobe, weather: weather?.day }), signal: controller.signal });
      if (!response.ok) throw new Error('service');
      const payload = await response.json();
      const result = parseOutfit(payload.answer, items);
      if (!result) throw new Error('format');
      setPlan(result);
    } catch { setPlan(local); setNotice('AI 暂不可用或返回格式不完整，已使用衣柜里的单品生成本地搭配。可以重新生成再试。'); }
    finally { clearTimeout(timer); request.current = null; setLoading(false); }
  };
  const replace = (item: WardrobeItem) => {
    if (!plan || !active || loading || item.id === active.id || outfitSlot(item) !== outfitSlot(active) || !items.some(row => row.id === item.id)) return;
    setPlan({ ...plan, itemIds: plan.itemIds.map(id => id === active.id ? item.id : id), reason: '已按你的选择调整单品。当前搭配以画布中的衣物为准。', source: 'edited' });
    setSaved(false); setNotice(`已换成${item.name}`); setSheet(false);
  };
  const save = () => {
    if (!plan || changedItems) return;
    try {
      const key = demo ? 'outfit-studio-demo-saved-v1' : 'outfit-studio-saved-v1';
      const raw = globalThis.localStorage?.getItem(key);
      const previous = raw ? JSON.parse(raw) : [];
      const rows = Array.isArray(previous) ? previous : [];
      if (!globalThis.localStorage) throw new Error('unavailable');
      globalThis.localStorage.setItem(key, JSON.stringify([{ ...plan, savedAt: new Date().toISOString() }, ...rows].slice(0, 30)));
      setSaved(true); setNotice(demo ? '示例搭配已保存在此浏览器，与真实衣柜分开存储。' : '这套搭配已保存在此浏览器。');
    } catch { setNotice('保存失败：浏览器存储不可用，请检查隐私模式或存储空间后重试。'); }
  };
  const next = () => {
    if (!active) return;
    const choices = items.filter(item => outfitSlot(item) === selected);
    if (choices.length > 1) replace(choices[(choices.findIndex(item => item.id === active.id) + 1) % choices.length]);
  };
  const tile = (item: WardrobeItem, hero: boolean) => {
    const slot = outfitSlot(item)!;
    if (!anchorCallbacks.current[slot]) anchorCallbacks.current[slot] = anchor => setAnchors(previous => previous[slot] === anchor ? previous : { ...previous, [slot]: anchor });
    return <OutfitPiece key={slot} item={item} source={sources[item.id]} height={slot === 'dress' ? 280 : hero ? 160 : 108} label={slotLabels[slot]} selected={selected === slot} dimmed={!!selected && selected !== slot} disabled={loading} reduced={reduced} onAnchor={anchorCallbacks.current[slot]!} onSelect={() => { setSheet(false); setSelected(selected === slot ? undefined : slot); }} />;
  };
  return <View ref={setRoot} onTouchEnd={Platform.OS !== 'web' ? close : undefined} style={styles.studio} testID="outfit-studio">
    <View style={s.headingRow}><View style={{ gap: 6, flex: 1 }}><Text style={styles.eyebrow}>YOUR DAILY EDIT</Text><Text style={styles.title}>把今天，穿成喜欢的样子</Text></View><View style={styles.star}><Icon name="sun" color={colors.accent} /></View></View>
    <View style={[s.wrap, { alignItems: 'center' }]}><Text style={styles.tag}>{demo ? '示例衣柜' : '来自你的衣柜'} · {items.length} 件</Text><Text style={styles.meta}>{weather ? `${weather.city} · ${weather.day.condition}${weather.day.feelsLikeC != null || weather.day.highC != null ? ` · ${weather.day.feelsLikeC ?? weather.day.highC}°C` : ''}` : '还未绑定天气'}</Text></View>
    {!plan && !loading && <View style={styles.empty}><Image source={require('../assets/cat-mascot-resting.png')} style={{ width: 100, height: 100 }} resizeMode="contain" /><Text style={s.h2}>{items.length ? '你的下一套灵感，已经在衣柜里' : '先给衣柜添几件喜欢的衣服'}</Text><Text style={[s.muted, { textAlign: 'center' }]}>{items.length ? '一键组合上衣、下装与配饰，再按你的喜好换一件。' : '添加上衣和下装，或一条连衣裙，即可开始搭配。'}</Text></View>}
    {loading && <View style={styles.loading} accessibilityLiveRegion="polite"><ActivityIndicator color={colors.accent} /><Text style={s.label}>正在为今天寻找合拍的单品…</Text><Text style={s.muted}>整理衣柜 · 结合天气 · 组合搭配</Text></View>}
    {plan && <>
      <View style={[styles.canvas, loading && { opacity: .45 }]}>
        <View style={s.headingRow}><View style={{ gap: 4, flex: 1 }}><Text style={styles.canvasTitle}>{plan.title}</Text><Text style={s.sectionCaption}>{plan.source === 'ai' ? 'AI 为你搭配' : plan.source === 'edited' ? '由你重新搭配' : '衣柜本地搭配'} · {pieces.length} 件单品</Text></View><Text style={styles.edition}>01 / TODAY</Text></View>
        <View testID="outfit-separated-layout" style={styles.separatedLayout}><View style={styles.primaryColumn}>{main.map(item => tile(item, true))}</View>{extras.length > 0 && <View style={styles.secondaryColumn}>{extras.map(item => tile(item, false))}</View>}</View>
        {!pieces.length && <Text style={s.muted}>暂无可组合的单品，请补充上装、下装和鞋子。</Text>}
        <Text style={[s.sectionCaption, { textAlign: 'center', paddingTop: 8 }]}>轻点一件衣服，给搭配一点新变化</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="查看搭配理由" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.reason}><Icon name="feather" color={colors.accent} /><View style={{ flex: 1, gap: 4 }}><Text style={s.label}>为什么这样搭</Text><Text numberOfLines={expanded ? undefined : 2} style={s.muted}>{plan.reason}</Text></View><Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.muted} /></Pressable>
      {(!complete || changedItems) && <Text accessibilityRole="alert" style={s.muted}>{changedItems ? '衣柜中的部分单品已移除，请重新生成后保存。' : '还缺少上装、下装或鞋子；当前展示已有单品。'}</Text>}
    </>}
    {!!notice && <Text accessibilityLiveRegion="polite" style={s.muted}>{notice}</Text>}
    <OutfitGlass>
      {plan && Platform.OS === 'web' && <Button title={saved ? '已保存这套搭配' : '保存这套搭配'} icon={saved ? 'check' : 'bookmark'} disabled={saved || loading || !pieces.length || changedItems || !complete} onPress={save} />}
      <Button title={loading ? '正在生成…' : plan ? '重新搭配' : '一键生成今日穿搭'} icon="refresh-cw" secondary={!!plan && Platform.OS === 'web'} disabled={loading || !items.length} onPress={() => { void generate(); }} />
    </OutfitGlass>
    {active && selected && <OutfitPopover key={selected} anchor={anchors[selected] ?? null} root={root} reduced={reduced} onDismiss={close} alternatives={alternatives} sources={sources} choosing={sheet} onChooseToggle={() => setSheet(!sheet)} onNext={next} onReplace={replace} onClose={() => setSheet(false)} />}
  </View>;
}

const styles = StyleSheet.create({
  studio: { gap: 16, paddingVertical: 8 }, eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '700', letterSpacing: 2.5 }, title: { color: colors.ink, fontSize: 24, fontWeight: '700', lineHeight: 34 }, star: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
  tag: { backgroundColor: colors.soft, color: colors.ink, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12 }, meta: { color: colors.muted, fontSize: 12, flexShrink: 1 },
  canvas: { backgroundColor: 'rgba(255,250,244,.48)', borderWidth: 1, borderColor: 'rgba(255,255,255,.8)', borderRadius: 24, padding: 16, gap: 16 }, canvasTitle: { fontSize: 19, fontWeight: '600', color: colors.ink }, edition: { fontSize: 9, color: colors.muted, letterSpacing: 1 }, separatedLayout: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 8 }, primaryColumn: { flex: 1.45, gap: 12 }, secondaryColumn: { flex: 1, gap: 12 },
  reason: { flexDirection: 'row', gap: 12, padding: 16, borderRadius: 20, backgroundColor: 'rgba(255,250,244,.35)', alignItems: 'flex-start' }, empty: { padding: 24, gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 24 }, loading: { padding: 24, gap: 12, alignItems: 'center', backgroundColor: colors.soft, borderRadius: 20 },
});
