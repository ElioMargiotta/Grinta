// Production diagnostic: login → switch club → planner → click "Verticaliser"
// calendar tile → its preparation PDF. Read-only. Output: out/prod-*.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "https://grintaclub.app";
const TEAM = process.env.GRINTA_TEAM_ID || "93d33a72-e448-48c3-89f0-a8000f699145";
const CLUB = process.env.GRINTA_CLUB || "Xamax";
const SESSION = process.env.GRINTA_SESSION_TEXT || "Verticaliser";
const OUT = path.join(process.cwd(), "scripts", "trailer", "out");
mkdirSync(OUT, { recursive: true });
const L = (p) => `${BASE}/fr${p}`;
const shot = (p, n) => p.screenshot({ path: path.join(OUT, `prod-${n}.png`) });

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

console.log("▶ login");
await page.goto(L("/login"), { waitUntil: "networkidle" });
await page.fill("#email", process.env.GRINTA_EMAIL);
await page.fill("#password", process.env.GRINTA_PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(2000);

console.log("▶ switch club →", CLUB);
try {
  await page.locator("button", { hasText: /Propriétaire|·/ }).first().click({ timeout: 8000 });
  await page.waitForTimeout(600);
  await page.locator("button", { hasText: new RegExp(CLUB, "i") }).last().click({ timeout: 8000 });
  await page.waitForTimeout(2500);
} catch (e) {
  console.log("  switcher skipped:", e.message.split("\n")[0]);
}

console.log("▶ planner");
await page.goto(L(`/planner/${TEAM}`), { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
await shot(page, "planner");

console.log(`▶ click session tile "${SESSION}"`);
const tile = page.getByText(new RegExp(SESSION, "i")).first();
if (await tile.count()) {
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await page.waitForTimeout(3000);
  console.log("  session url:", page.url());
  await shot(page, "session");

  // Find the preparation entry point (link/button) or derive the URL.
  const m = page.url().match(/\/sessions\/([0-9a-f-]+)/i);
  let prepUrl = m
    ? L(`/planner/${TEAM}/sessions/${m[1]}/preparation`)
    : page.url().replace(/\/+$/, "") + "/preparation";
  await page.goto(prepUrl, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(3500);
  await shot(page, "preparation");
  console.log("  prep url:", page.url());
} else {
  console.log(`⚠ tile "${SESSION}" not found on planner`);
}

await ctx.close();
await b.close();
console.log("✓ screenshots in", OUT);
