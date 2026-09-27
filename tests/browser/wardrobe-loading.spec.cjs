const { test, expect } = require('@playwright/test');

const title = '绑定当前位置并获取天气';
async function openWardrobe(page, stored = false) {
  await page.addInitScript(stored => {
    if (stored) localStorage.setItem('smart-wardrobe-location-v1', JSON.stringify({ latitude: 21, longitude: -157 }));
    window.locationCalls = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success, failure) {
        window.locationCalls++;
        window.resolveLocation = () => success({ coords: { latitude: 21, longitude: -157 } });
        window.rejectLocation = code => failure({ code });
      },
    } });
  }, stored);
  await page.goto('/');
  await page.getByRole('tab', { name: '衣柜', exact: true }).click();
  return page.getByRole('button', { name: title, exact: true });
}

for (const width of [320, 390, 1200]) test(`location loader stays centered and stable at ${width}`, async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  let finishWeather;
  await page.route('**/api/weather?**', async route => {
    await new Promise(resolve => { finishWeather = resolve; });
    await route.fulfill({ json: { city: '檀香山', days: [{ condition: '晴', highC: 27, rainProbability: 0 }] } });
  });
  const button = await openWardrobe(page);
  const before = await button.boundingBox();
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  await expect(button.getByText(title, { exact: true })).toHaveCSS('opacity', '0');
  await expect(button.getByTestId('button-loader')).toBeVisible();
  expect(await button.boundingBox()).toEqual(before);
  const loader = await button.getByTestId('button-loader').boundingBox();
  expect(Math.abs(loader.x + loader.width / 2 - before.x - before.width / 2)).toBeLessThan(1);
  expect(Math.abs(loader.y + loader.height / 2 - before.y - before.height / 2)).toBeLessThan(1);
  expect(loader.x).toBeGreaterThanOrEqual(before.x);
  expect(loader.y).toBeGreaterThanOrEqual(before.y);
  expect(loader.x + loader.width).toBeLessThanOrEqual(before.x + before.width);
  expect(loader.y + loader.height).toBeLessThanOrEqual(before.y + before.height);
  const transform = await button.getByTestId('button-loader').evaluate(node => getComputedStyle(node).transform);
  await expect.poll(() => button.getByTestId('button-loader').evaluate(node => getComputedStyle(node).transform)).not.toBe(transform);
  if (process.env.WARDROBE_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.WARDROBE_SCREENSHOT_DIR}/wardrobe-loading-${width}.png` });
  await button.dispatchEvent('click');
  expect(await page.evaluate(() => window.locationCalls)).toBe(1);
  await page.evaluate(() => window.resolveLocation());
  await expect.poll(() => !!finishWeather).toBe(true);
  await expect(button).toBeDisabled();
  finishWeather();
  await expect(button).toBeEnabled();
  await expect(button.getByTestId('button-loader')).toHaveCount(0);
  await expect(button.getByText(title, { exact: true })).toHaveCSS('opacity', '1');
  await expect(page.getByText('已绑定：檀香山', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const code of [1, 3]) test(`location loader recovers after geolocation error ${code}`, async ({ page }) => {
  const button = await openWardrobe(page);
  await button.click();
  await expect(button).toBeDisabled();
  await page.evaluate(code => window.rejectLocation(code), code);
  await expect(button).toBeEnabled();
  await expect(button.getByTestId('button-loader')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('定位失败');
  await button.click();
  await expect(button).toBeDisabled();
});

test('saved location loader respects reduced motion and recovers from weather failure', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let finishWeather;
  await page.route('**/api/weather?**', async route => {
    await new Promise(resolve => { finishWeather = resolve; });
    await route.fulfill({ status: 500, json: {} });
  });
  const button = await openWardrobe(page, true);
  await expect(button).toBeDisabled();
  const loader = button.getByTestId('button-loader');
  await expect(loader).toBeVisible();
  const initial = await loader.evaluate(node => getComputedStyle(node).transform);
  await page.waitForTimeout(300);
  expect(await loader.evaluate(node => getComputedStyle(node).transform)).toBe(initial);
  await expect.poll(() => !!finishWeather).toBe(true);
  finishWeather();
  await expect(button).toBeEnabled();
  await expect(loader).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('天气获取失败');
});
