import React from 'react';
import { Image, Text, View } from 'react-native';
import { Sheet, colors, s } from './ui';

type RemakeCase = {
  name: string;
  meta: string;
  result: string;
  style: string;
  idea: string;
  original: any;
  after: any;
  detail: any;
};

const CASES: RemakeCase[] = [
  {
    name: '深棕工装夹克',
    meta: '外套 · 旧化帆布 · 工装款',
    result: '徽章拼贴工装夹克',
    style: '朋克街头',
    idea: '在领口和肩部加入复古徽章，保留原有结构，做成朋克街头风。',
    original: require('../assets/wardrobe-remake/jacket2-original.png'),
    after: require('../assets/wardrobe-remake/jacket2-after.png'),
    detail: require('../assets/wardrobe-remake/jacket2-detail.png'),
  },
  {
    name: '黑檐棒球帽',
    meta: '配饰 · 棉质 · 基础款',
    result: '猫咪刺绣棒球帽',
    style: '可爱街头',
    idea: '在帽身加入猫咪刺绣和花朵布贴，做成可爱街头风。',
    original: require('../assets/wardrobe-remake/cap-original.png'),
    after: require('../assets/wardrobe-remake/cap-after.png'),
    detail: require('../assets/wardrobe-remake/cap-after.png'),
  },
];

function ExampleImage({ label, source }: { label: string; source: any }) {
  return <View style={{ flex: 1, minWidth: 0, gap: 6 }}><Text style={[s.sectionCaption, { fontWeight: '700', color: colors.ink }]}>{label}</Text><Image source={source} resizeMode="cover" style={{ width: '100%', height: 126, borderRadius: 12, backgroundColor: colors.peachSoft }} /></View>;
}

export function WardrobeRemakeExamples({ onClose }: { onClose: () => void }) {
  return <Sheet title="衣物改造示例" onClose={onClose}>
    <Text style={[s.muted, { marginBottom: 4 }]}>这里先展示两个改造案例，实际衣物改造功能尚未完成。</Text>
    <View style={{ gap: 18 }}>
      {CASES.map(example => <View key={example.name} style={[s.card, { gap: 10 }]}>
        <View style={{ gap: 3 }}><Text style={s.h2}>{example.result}</Text><Text style={s.sectionCaption}>{example.name} · {example.meta} · {example.style}</Text></View>
        <Text style={s.muted}>{example.idea}</Text>
        <View style={{ flexDirection: 'row', gap: 7 }}><ExampleImage label="改造前" source={example.original} /><ExampleImage label="改造后" source={example.after} /><ExampleImage label="细节" source={example.detail} /></View>
      </View>)}
    </View>
  </Sheet>;
}
