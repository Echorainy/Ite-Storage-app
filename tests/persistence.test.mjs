import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeSnapshot, encodeSnapshot, emptySnapshot, migrateSnapshot } from '../src/persistence.ts';
import { DEFAULT_MODULE_COLOR, normalizeModuleColor } from '../src/domain.ts';

test('wardrobe and custom room layouts survive alongside existing inventory', () => {
  const snapshot = emptySnapshot();
  snapshot.rooms.push({ id: 'closet', homeId: 'home', name: '衣帽间', layout: { rows: 6, cols: 6 } });
  snapshot.rooms[0].layout = { rows: 12, cols: 10 };
  snapshot.items.push({ id: 'shirt', homeId: 'home', roomId: 'closet', categoryId: 'clothing', reminderDays: 7, name: '白衬衫', type: '衬衫', color: '白色', season: '四季' });
  const restored = decodeSnapshot(encodeSnapshot(snapshot));
  assert.deepEqual(restored, snapshot);
  assert.equal(restored.items.length, 3);
});

test('encodes and decodes all app collections without losing nested layout data', () => {
  const input = { homes: [{ id: 'h', name: '我的家', greeting: '今天也要把家照顾好', note: '喵今天好好收纳了吗' }], rooms: [{ id: 'r', homeId: 'h', name: '厨房', layout: { rows: 8, cols: 8 } }], containers: [{ id: 'c', roomId: 'r', name: '橱柜', level: 2, cells: [1, 2] }], items: [{ id: 'i', name: '茶', roomId: 'r', categoryId: 'drink', containerId: 'c', cell: 1, expiry: '2026-09-24', reminderDays: 7 }], categories: [{ id: 'drink', name: '饮品', isSystem: false }] };
  const restored = decodeSnapshot(encodeSnapshot(input));
  assert.deepEqual(restored.items, input.items.map(item => ({ ...item, homeId: 'h' })));
  assert.deepEqual(restored.rooms, input.rooms);
  assert.deepEqual(restored.containers, input.containers);
});

test('migrates missing or corrupt snapshots to safe initial data', () => {
  const initial = emptySnapshot();
  assert.deepEqual(migrateSnapshot(undefined), initial);
  assert.deepEqual(migrateSnapshot('{"homes":[]}'), initial);
  assert.deepEqual(migrateSnapshot('{broken'), initial);
  assert.deepEqual(migrateSnapshot('{"rooms":[{"id":"r"}]}').rooms, initial.rooms);
});

test('normalizes duplicate module cells when loading snapshots', () => {
  const snapshot = encodeSnapshot({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [{ id: 'c', roomId: 'r', name: '模块', level: 2, cells: [4, 4, 5] }],
    items: [],
    categories: [],
  });
  assert.deepEqual(decodeSnapshot(snapshot).containers[0].cells, [4, 5]);
});

test('old snapshots without module colors remain readable with the default color', () => {
  const snapshot = decodeSnapshot(encodeSnapshot({
    homes: [{ id: 'h', name: '家' }],
    rooms: [{ id: 'r', homeId: 'h', name: '房间', layout: { rows: 8, cols: 8 } }],
    containers: [{ id: 'c', roomId: 'r', name: '模块', level: 2, cells: [] }],
    items: [],
    categories: [],
  }));
  assert.equal(normalizeModuleColor(snapshot.containers[0].color), DEFAULT_MODULE_COLOR);
});

test('old snapshots without home copy use default greeting and note', () => {
  const snapshot = decodeSnapshot(JSON.stringify({ homes: [{ id: 'h', name: '家' }], rooms: [], containers: [], items: [], categories: [] }));
  assert.equal(snapshot.homes[0].greeting, '今天也要把家照顾好');
  assert.equal(snapshot.homes[0].note, '喵今天好好收纳了吗');
});


test('legacy wardrobes migrate once without merging names or losing metadata', () => {
  const original = {
    homes: [{id:'a',name:'A'}, {id:'b',name:'B'}],
    rooms: [{id:'r',homeId:'b',name:'衣帽间',kind:'walk-in-closet',layout:{rows:6,cols:6}}],
    containers: [{id:'c',roomId:'r',name:'衣柜',kind:'smart-wardrobe',level:2,cells:[0,1]}],
    categories: [{id:'custom',name:'衣物',isSystem:false}],
    items: [{id:'same',name:'衬衫',roomId:'r',categoryId:'custom',reminderDays:7}],
    wardrobeItems: [
      {id:'same',name:'衬衫',roomId:'r',containerId:'c',type:'衬衫',color:'白色',material:'棉',season:'夏季',image:'data:example'},
      {id:'orphan',name:'外套',roomId:'gone',containerId:'gone',type:'夹克',color:'黑色',season:'冬季'},
    ],
  };
  const migrated = decodeSnapshot(JSON.stringify(original));
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.wardrobeItems, undefined);
  assert.equal(migrated.items.length, 3);
  assert.equal(new Set(migrated.items.map(item => item.id)).size, 3);
  assert.equal(migrated.items[0].categoryId, 'clothing');
  const shirt = migrated.items.find(item => item.image);
  assert.equal(shirt.homeId, 'b');
  assert.equal(shirt.roomId, 'r');
  assert.equal(shirt.containerId, 'c');
  assert.equal(shirt.material, '棉');
  const orphan = migrated.items.find(item => item.id === 'orphan');
  assert.equal(orphan.homeId, 'a');
  assert.equal(orphan.roomId, undefined);
  assert.equal(orphan.containerId, undefined);
  assert.deepEqual(migrated.rooms[0].layout, {rows:6,cols:6});
  assert.equal(migrated.rooms[0].kind, undefined);
  assert.equal(migrated.containers[0].kind, undefined);
  assert.deepEqual(migrated.categories.filter(c => c.name === '衣物'), [{id:'clothing',name:'衣物',isSystem:true}]);
  assert.deepEqual(decodeSnapshot(encodeSnapshot(migrated)), migrated);
  assert.equal(decodeSnapshot(JSON.stringify({...migrated,wardrobeItems:original.wardrobeItems})).items.length, 3);
});
