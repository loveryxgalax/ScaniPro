// Renders App Store screenshots (1290×2796) from preview/index.html#shot-N
// and the app icon from store/icon.svg.  Usage: node scripts/render-store-assets.mjs
// Requires Playwright (npx playwright install chromium, or a preinstalled Chromium).
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

const outDir = join(root, 'store', 'screenshots');
mkdirSync(outDir, { recursive: true });
const preview = pathToFileURL(join(root, 'preview', 'index.html')).href;

const shotPage = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3 });
for (let i = 1; i <= 6; i++) {
  await shotPage.goto(`${preview}#shot-${i}`);
  await shotPage.reload();
  await shotPage.evaluate(() => document.fonts.ready);
  await shotPage.waitForTimeout(300);
  await shotPage.screenshot({ path: join(outDir, `0${i}-iphone-6.9.png`), clip: { x: 0, y: 0, width: 430, height: 932 } });
  console.log(`screenshot ${i}`);
}

for (const [name, size] of [['icon.png', 1024], ['splash-icon.png', 512]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(join(root, 'store', name === 'icon.png' ? 'icon.svg' : 'splash.svg')).href);
  await p.screenshot({ path: join(root, 'assets', name), omitBackground: name !== 'icon.png' });
  console.log(name);
}
await browser.close();
