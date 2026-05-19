// Quick diagnostic: login + screenshot the key screens to verify footage
// quality and find session links. Output: scripts/trailer/out/probe-*.png
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const OUT = path.join(process.cwd(), "scripts", "trailer", "out");
mkdirSync(OUT, { recursive: true });
const L = (p) => `${BASE}/fr${p}`;

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
const page = await ctx.newPage();

await page.goto(L("/login"), { waitUntil: "networkidle" });
await page.fill("#email", process.env.GRINTA_EMAIL);
await page.fill("#password", process.env.GRINTA_PASSWORD);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1500);

await page.goto(L("/teams"), { waitUntil: "networkidle" });
const teamId = await page.evaluate(() => {
  const skip = new Set(["archived", "new"]);
  for (const a of document.querySelectorAll("a[href]")) {
    const m = a.getAttribute("href").match(/\/(?:teams|planner)\/([^/?#]+)/);
    if (m && !skip.has(m[1])) return m[1];
  }
  return null;
});
console.log("teamId =", teamId);

const shots = [
  ["club", L("/settings/club")],
  ["teams", L("/teams")],
  ["planner", L(`/planner/${teamId}`)],
  ["session-new", L(`/planner/${teamId}/sessions/new`)],
  ["sessions", L(`/planner/${teamId}/sessions`)],
  ["exercises", L("/exercises")],
];
for (const [name, url] of shots) {
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded" });
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, `probe-${name}.png`) });
  if (name === "sessions") {
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => h && h.includes("/sessions/") && !h.endsWith("/new"))
    );
    console.log("session links:", links.slice(0, 8));
  }
}
await ctx.close();
await b.close();
console.log("✓ screenshots in", OUT);
