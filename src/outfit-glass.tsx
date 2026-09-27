import React from 'react';
import { View } from 'react-native';

export function OutfitGlass({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: 4, padding: 8, borderRadius: 24, backgroundColor: 'rgba(255,250,244,.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,.85)', boxShadow: '0 4px 20px rgba(61,34,15,.04)' }}>{children}</View>;
}
