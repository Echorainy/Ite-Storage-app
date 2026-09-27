import type { ImageSourcePropType } from 'react-native';

// Keep demo images as stable serializable asset: URLs in the saved wardrobe.
// React Native requires static require calls, so this map is intentionally explicit.
export const wardrobeImageSources: Record<string, ImageSourcePropType> = {
  'asset:wardrobe/neutral-beige-blazer.png': require('../assets/wardrobe/neutral-beige-blazer.png'),
  'asset:wardrobe/neutral-dark-trousers.png': require('../assets/wardrobe/neutral-dark-trousers.png'),
  'asset:wardrobe/neutral-gray-sneakers.png': require('../assets/wardrobe/neutral-gray-sneakers.png'),
  'asset:wardrobe/neutral-white-shirt.png': require('../assets/wardrobe/neutral-white-shirt.png'),
  'asset:wardrobe/street-black-bomber.png': require('../assets/wardrobe/street-black-bomber.png'),
  'asset:wardrobe/street-black-mini-skirt.png': require('../assets/wardrobe/street-black-mini-skirt.png'),
  'asset:wardrobe/street-cargo-pants.png': require('../assets/wardrobe/street-cargo-pants.png'),
  'asset:wardrobe/street-chain-necklace.png': require('../assets/wardrobe/street-chain-necklace.png'),
  'asset:wardrobe/street-chunky-sneakers.png': require('../assets/wardrobe/street-chunky-sneakers.png'),
  'asset:wardrobe/street-gray-hoodie.png': require('../assets/wardrobe/street-gray-hoodie.png'),
  'asset:wardrobe/street-red-cap.png': require('../assets/wardrobe/street-red-cap.png'),
  'asset:wardrobe/street-white-socks.png': require('../assets/wardrobe/street-white-socks.png'),
  'asset:wardrobe/sweet-blue-skirt.png': require('../assets/wardrobe/sweet-blue-skirt.png'),
  'asset:wardrobe/sweet-cream-cardigan.png': require('../assets/wardrobe/sweet-cream-cardigan.png'),
  'asset:wardrobe/sweet-cream-dress.png': require('../assets/wardrobe/sweet-cream-dress.png'),
  'asset:wardrobe/sweet-mary-jane.png': require('../assets/wardrobe/sweet-mary-jane.png'),
  'asset:wardrobe/sweet-pastel-bag.png': require('../assets/wardrobe/sweet-pastel-bag.png'),
  'asset:wardrobe/sweet-pearl-hairclip.png': require('../assets/wardrobe/sweet-pearl-hairclip.png'),
  'asset:wardrobe/sweet-pink-blouse.png': require('../assets/wardrobe/sweet-pink-blouse.png'),
  'asset:wardrobe/sweet-ribbon-socks.png': require('../assets/wardrobe/sweet-ribbon-socks.png'),
};

export function localWardrobeImage(value?: string): ImageSourcePropType | undefined {
  return value ? wardrobeImageSources[value] : undefined;
}

export function wardrobeSourcesFor(items: Array<{ id: string; image?: string }>): Record<string, ImageSourcePropType> {
  return items.reduce<Record<string, ImageSourcePropType>>((result, item) => {
    const source = localWardrobeImage(item.image);
    if (source) result[item.id] = source;
    return result;
  }, {});
}
