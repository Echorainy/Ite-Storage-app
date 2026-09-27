import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import type { WardrobeItem } from './domain';
import { colors, Icon, s } from './ui';

export function useOutfitReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; subscription.remove(); };
  }, []);
  return reduced;
}

export function OutfitImage({ item, source, small = false }: { item: WardrobeItem; source?: ImageSourcePropType; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [item.image, source]);
  const uri = item.image && (/^(https?:|data:|blob:)/i.test(item.image) ? item.image : `http://localhost:8000/${item.image.replace(/^\//, '')}`);
  return (source || uri) && !failed ? <Image source={source ?? { uri }} onError={() => setFailed(true)} resizeMode="contain" accessibilityLabel={item.name} style={{ width: '100%', height: '100%' }} /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="image" color={colors.muted} />{!small && <Text style={s.sectionCaption}>暂无单品图片</Text>}</View>;
}

export type OutfitAnchor = React.ElementRef<typeof View>;
type Props = {
  item: WardrobeItem; source?: ImageSourcePropType; height: number; label: string;
  selected: boolean; dimmed: boolean; disabled: boolean; reduced: boolean;
  positionStyle?: any;
  onSelect: () => void; onAnchor: (anchor: OutfitAnchor | null) => void;
};
export function OutfitPiece({ item, source, height, label, selected, dimmed, disabled, reduced, positionStyle, onSelect, onAnchor }: Props) {
  const lift = useSharedValue(0);
  const scale = useSharedValue(1);
  const glow = useSharedValue(0);
  const opacity = useSharedValue(1);
  const fade = useSharedValue(1);
  const prior = useRef({ item, source });
  const [outgoing, setOutgoing] = useState<{ item: WardrobeItem; source?: ImageSourcePropType }>();
  const spring = { duration: 280, dampingRatio: .58, reduceMotion: ReduceMotion.System };
  useEffect(() => {
    cancelAnimation(lift); cancelAnimation(scale);
    const settle = { duration: 180, dampingRatio: .7, reduceMotion: ReduceMotion.System };
    lift.value = reduced ? 0 : selected ? withSequence(withTiming(-24, { duration: 140, easing: Easing.out(Easing.cubic) }), withSpring(-18, settle)) : withSpring(0, spring);
    scale.value = reduced ? 1 : selected ? withSequence(withTiming(1.08, { duration: 140, easing: Easing.out(Easing.cubic) }), withSpring(1.05, settle)) : withSpring(1, spring);
    glow.value = withTiming(selected ? .22 : 0, { duration: reduced ? 100 : 220 });
    opacity.value = withTiming(dimmed ? .78 : 1, { duration: 160 });
  }, [selected, dimmed, reduced]);
  useEffect(() => {
    if (prior.current.item.id === item.id && prior.current.source === source) return;
    setOutgoing(prior.current); prior.current = { item, source };
    cancelAnimation(fade); fade.value = 0;
    fade.value = withTiming(1, { duration: reduced ? 100 : 180, easing: Easing.inOut(Easing.ease) });
    const timer = setTimeout(() => setOutgoing(undefined), reduced ? 120 : 200);
    return () => clearTimeout(timer);
  }, [item, source, reduced]);
  const imageStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: lift.value }, { scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const incomingStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const outgoingStyle = useAnimatedStyle(() => ({ opacity: 1 - fade.value }));
  return <Pressable testID={`outfit-item-${item.id}`} accessibilityRole="button" accessibilityLabel={`选择${item.name}`} accessibilityState={{ selected }} aria-pressed={selected} disabled={disabled}
    onTouchEnd={event => event.stopPropagation()}
    onPressIn={() => { if (!reduced) { cancelAnimation(scale); scale.value = withTiming(.98, { duration: 70 }); } }}
    onPressOut={() => { if (!reduced) scale.value = withSpring(selected ? 1.05 : 1, spring); }}
    onPress={onSelect} style={[{ paddingTop: 24, paddingBottom: 12, gap: 8, zIndex: selected ? 2 : 0 }, positionStyle]}>
    <View ref={onAnchor} collapsable={false} testID={`outfit-anchor-${item.id}`} style={{ height, width: '100%' }}>
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
      <Animated.View testID={`outfit-motion-${item.id}`} style={[StyleSheet.absoluteFill, imageStyle]}>
        {outgoing && <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={[StyleSheet.absoluteFill, outgoingStyle]}><OutfitImage item={outgoing.item} source={outgoing.source} /></Animated.View>}
        <Animated.View style={[StyleSheet.absoluteFill, incomingStyle]}><OutfitImage item={item} source={source} /></Animated.View>
      </Animated.View>
    </View>
    <Text numberOfLines={1} style={{ color: selected ? colors.ink : colors.muted, fontSize: 11, textAlign: 'center', fontWeight: selected ? '600' : '400' }}>{item.name}</Text>
    <Text style={{ color: colors.muted, fontSize: 10, textAlign: 'center', opacity: .7 }}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', top: '10%', left: '14%', right: '14%', bottom: '10%', borderRadius: 100, backgroundColor: '#C7DEC3', boxShadow: '0 0 26px 18px rgba(183,211,180,0.8)' },
});
