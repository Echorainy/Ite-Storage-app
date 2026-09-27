const { test, expect } = require('@playwright/test');

async function seedLegacyHomes(page) {
  const snapshot = {
    homes: [{ id: 'a', name: '城里家' }, { id: 'b', name: '山间家' }],
    rooms: [{ id: 'ar', homeId: 'a', name: '卧室', layout: { rows: 8, cols: 8 } }, { id: 'br', homeId: 'b', name: '旧衣帽间', kind: 'walk-in-closet', layout: { rows: 6, cols: 6 } }],
    containers: [{ id: 'bc', roomId: 'br', name: '旧衣柜', kind: 'smart-wardrobe', level: 2, cells: [0, 1] }],
    categories: [{ id: 'uncategorized', name: '未分类', isSystem: true }, { id: 'old-clothes', name: '衣物', isSystem: false }],
    items: [{ id: 'a-shirt', name: '城里衬衫', roomId: 'ar', categoryId: 'old-clothes', reminderDays: 7 }],
    wardrobeItems: [{ id: 'b-coat', name: '山间外套', roomId: 'br', containerId: 'bc', color: '蓝色', type: '夹克', season: '冬季', material: '棉' }],
  };
  await page.addInitScript(snapshot => {
    if (!sessionStorage.getItem('wardrobe-test-seeded')) {
      localStorage.setItem('home-whereabouts.snapshot', JSON.stringify(snapshot));
      sessionStorage.setItem('wardrobe-test-seeded', '1');
    }
  }, snapshot);
  await page.goto('/');
}

test('all homes share one wardrobe; edits use the owning home; legacy locations remain accessible', async ({ page }) => {
  await seedLegacyHomes(page);
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑衣物 城里衬衫' })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑衣物 山间外套' })).toBeVisible();
  await page.getByRole('button', { name: '编辑衣物 山间外套' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('所属家庭：山间家', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: '旧衣帽间', exact: true })).toBeVisible();
  await expect(dialog.getByRole('radio', { name: '卧室', exact: true })).toHaveCount(0);
  await dialog.getByRole('textbox', { name: '物品名称', exact: true }).fill('山间棉外套');
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '切换到 山间家', exact: true }).click();
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑衣物 城里衬衫' })).toBeVisible();
  await expect(page.getByRole('button', { name: '编辑衣物 山间棉外套' })).toBeVisible();
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await page.getByRole('button', { name: '重命名房间 旧衣帽间' }).click();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '行数', exact: true })).toHaveValue('6');
  await page.getByRole('dialog').getByRole('textbox', { name: '行数', exact: true }).fill('8');
  await page.getByRole('dialog').getByRole('button', { name: '保存名称', exact: true }).click();
  await page.getByRole('button', { name: '打开房间 旧衣帽间' }).click();
  await expect(page.getByTestId('layout-grid')).toBeVisible();
  await page.getByRole('button', { name: '打开模块 旧衣柜' }).click();
  await expect(page.getByRole('button', { name: '查看物品 山间棉外套' }).last()).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '编辑衣物 山间棉外套' })).toHaveCount(1);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('home-whereabouts.snapshot')));
  expect(saved.schemaVersion).toBe(2);
  expect(saved.wardrobeItems).toBeUndefined();
  expect(saved.items).toHaveLength(2);
});

test('unplaced clothes survive room deletion but are removed with their home', async ({ page }) => {
  await seedLegacyHomes(page);
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await page.getByRole('textbox', { name: '衣物名称', exact: true }).fill('未定位围巾');
  await page.getByRole('button', { name: '添加衣物', exact: true }).click();
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await page.getByRole('button', { name: '删除房间 卧室', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 城里衬衫' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '删除衣物 未定位围巾' })).toBeVisible();
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '删除家庭 城里家', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 未定位围巾' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '删除衣物 山间外套' })).toBeVisible();
});

test('global wardrobe shares records with inventory and preserves speech', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await expect(page.getByRole('button', { name: '语音填写名称' })).toBeVisible();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('白衬衫');
  await page.getByRole('dialog').getByRole('radio', { name: '卧室', exact: true }).click();
  await page.getByRole('dialog').getByRole('radio', { name: '衣物', exact: true }).click();
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 白衬衫' })).toBeVisible();
  await page.getByRole('textbox', { name: '衣物名称', exact: true }).fill('蓝外套');
  await page.getByRole('textbox', { name: '材质', exact: true }).fill('羊毛');
  await page.getByRole('button', { name: '添加衣物', exact: true }).click();
  await expect(page.getByText('我的家 → 未设置位置', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑衣物 蓝外套' }).click();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '材质', exact: true })).toHaveValue('羊毛');
  await page.getByRole('dialog').getByRole('radio', { name: '其他', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 蓝外套' })).toHaveCount(0);
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await page.getByRole('button', { name: '查看物品 蓝外套' }).click();
  await page.getByRole('button', { name: '编辑物品', exact: true }).click();
  await page.getByRole('dialog').getByRole('radio', { name: '衣物', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: '材质', exact: true })).toHaveValue('羊毛');
  await page.getByRole('dialog').getByRole('radio', { name: '卧室', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.reload();
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 蓝外套' })).toHaveCount(1);
  await page.getByRole('textbox', { name: '搜索衣柜衣物' }).fill('不存在');
  await expect(page.getByRole('button', { name: '删除衣物 白衬衫' })).toHaveCount(0);
  await page.getByRole('textbox', { name: '搜索衣柜衣物' }).fill('');
  await page.getByRole('button', { name: '删除衣物 白衬衫' }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 白衬衫' })).toBeVisible();
  await page.getByRole('button', { name: '删除衣物 白衬衫' }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 白衬衫' })).toHaveCount(0);
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByRole('button', { name: '全部物品 3', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await expect(page.getByRole('button', { name: '修改分类 衣物' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '删除分类 衣物' })).toHaveCount(0);
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await expect(page.getByRole('button', { name: '添加智能衣帽间' })).toHaveCount(0);
  await page.getByRole('button', { name: '打开房间 卧室' }).click();
  await expect(page.getByRole('button', { name: '添加智能衣柜' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const width of [320, 390, 1200]) test(`wardrobe responsive layout at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await page.getByRole('textbox', { name: '衣物名称', exact: true }).fill('适合秋冬出门穿的超长名称浅棕色保暖外套');
  await page.getByRole('button', { name: '添加衣物', exact: true }).click();
  for (const name of ['添加衣物', '选择衣物图片', '导入 JSON']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    const box = await button.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
  }
  await expect(page.getByRole('tab')).toHaveCount(5);
  for (const tab of await page.getByRole('tab').all()) { const box = await tab.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width + 1); }
  await page.getByText('天气与位置', { exact: true }).scrollIntoViewIfNeeded();
  if (process.env.WARDROBE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.WARDROBE_SCREENSHOT_DIR}/wardrobe-${width}.png` });
});

test('image recognition and suggestion use configured service; malformed import is rejected', async ({ page }) => {
  await page.route('**/api/analyze', route => route.fulfill({ json: { item: { name: '识别的衬衫', category: '衬衫', color: '白色', material: '棉', season: '四季' } } }));
  await page.route('**/api/chat', route => route.fulfill({ json: { answer: '今天穿识别的衬衫。' } }));
  await page.goto('/');
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  await page.locator('input[type=file]').first().setInputFiles({ name: 'shirt.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: '添加衣物', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除衣物 识别的衬衫' })).toBeVisible();
  await page.getByRole('button', { name: '生成今日建议', exact: true }).click();
  await expect(page.getByText('今天穿识别的衬衫。', { exact: true })).toBeVisible();
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('[{"name":{}}]') });
  await expect(page.getByRole('alert')).toContainText('衣物字段必须是文本');
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'clothes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([{name:'导入围巾',type:'其他衣物',color:'红色',material:'羊毛',season:'冬季'}])) });
  await expect(page.getByRole('button', { name: '编辑衣物 导入围巾' })).toBeVisible();
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看物品 导入围巾' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看物品 识别的衬衫' })).toBeVisible();
});
