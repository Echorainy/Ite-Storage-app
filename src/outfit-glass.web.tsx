import React from 'react';

export function OutfitGlass({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 8, borderRadius: 24, background: 'rgba(255,250,244,.72)', backdropFilter: 'blur(18px) saturate(140%)', WebkitBackdropFilter: 'blur(18px) saturate(140%)', border: '1px solid rgba(255,255,255,.85)', boxShadow: '0 4px 20px rgba(61,34,15,.04)' }}>{children}</div>;
}
