import React, { useEffect } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { flip, offset, shift, useFloating } from '@floating-ui/react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { OutfitPopoverContent, OutfitPopoverContentProps } from './outfit-popover-content';
import type { OutfitAnchor } from './outfit-piece';

export type OutfitPopoverProps = OutfitPopoverContentProps & { anchor: OutfitAnchor | null; root: OutfitAnchor | null; reduced: boolean; onDismiss: () => void };
export function OutfitPopover({ anchor, root, reduced, onDismiss, ...content }: OutfitPopoverProps) {
  const { refs, floatingStyles, update } = useFloating({ placement: 'right', sameScrollView: false, middleware: [offset(8), flip({ fallbackPlacements: ['left', 'bottom', 'top'] }), shift({ padding: 12 })] });
  useEffect(() => { refs.setReference(anchor); refs.setOffsetParent(root); update(); }, [anchor, root, content.choosing]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { onDismiss(); return true; });
    return () => subscription.remove();
  }, [onDismiss]);
  return <View ref={refs.setFloating} collapsable={false} testID="outfit-popover" style={[floatingStyles, { zIndex: 20, maxWidth: 260, width: content.choosing ? 240 : undefined }]}>
    <Animated.View entering={FadeIn.duration(reduced ? 100 : 160).delay(reduced ? 0 : 80)} exiting={FadeOut.duration(100)} style={styles.glass}><OutfitPopoverContent {...content} /></Animated.View>
  </View>;
}
const styles = StyleSheet.create({ glass: { backgroundColor: 'rgba(255,250,244,.94)', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,.85)', boxShadow: '0 8px 28px rgba(61,34,15,.13)', padding: 4 } });
