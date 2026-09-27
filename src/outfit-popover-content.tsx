import React from 'react';
import { ImageSourcePropType, Pressable, ScrollView, Text, View } from 'react-native';
import type { WardrobeItem } from './domain';
import { colors, Icon, s } from './ui';
import { OutfitImage } from './outfit-piece';

export type OutfitPopoverContentProps = {
  alternatives: WardrobeItem[]; sources: Record<string, ImageSourcePropType>;
  choosing: boolean; onChooseToggle: () => void; onNext: () => void;
  onReplace: (item: WardrobeItem) => void; onClose: () => void;
};
export function OutfitPopoverContent({ alternatives, sources, choosing, onChooseToggle, onNext, onReplace, onClose }: OutfitPopoverContentProps) {
  const empty = !alternatives.length;
  return <View onTouchEnd={event => event.stopPropagation()} style={{ gap: choosing ? 8 : 0 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="换一件" disabled={empty} onPress={onNext} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, paddingHorizontal: 12, borderRadius: 22, opacity: empty ? .5 : pressed ? .65 : 1 })}><Icon name="repeat" color={colors.accent} /><Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>{empty ? '暂无同类单品' : '换一件'}</Text></Pressable>
      {!empty && <><View style={{ height: 18, width: 1, backgroundColor: colors.line }} /><Pressable accessibilityRole="button" accessibilityLabel="挑选单品" accessibilityState={{ expanded: choosing }} onPress={onChooseToggle} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name={choosing ? 'chevron-up' : 'grid'} color={colors.ink} /></Pressable></>}
      {choosing && <Pressable accessibilityRole="button" accessibilityLabel="关闭挑选" onPress={onClose} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Icon name="x" color={colors.muted} /></Pressable>}
    </View>
    {choosing && <ScrollView testID="outfit-candidates" keyboardShouldPersistTaps="handled" style={{ maxHeight: 240 }} contentContainerStyle={{ gap: 4, paddingHorizontal: 6, paddingBottom: 6 }}>
      {alternatives.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`换成${item.name}`} onPress={() => onReplace(item)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, backgroundColor: pressed ? colors.soft : 'rgba(255,250,244,.4)' })}>
        <View style={{ width: 48, height: 60 }}><OutfitImage item={item} source={sources[item.id]} small /></View><View style={{ flex: 1, gap: 4 }}><Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12, fontWeight: '500' }}>{item.name}</Text><Text style={s.sectionCaption}>{item.color}</Text></View><Icon name="arrow-up-right" color={colors.accent} />
      </Pressable>)}
    </ScrollView>}
  </View>;
}
