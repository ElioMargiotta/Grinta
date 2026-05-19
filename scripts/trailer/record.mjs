// Grinta — trailer screen recorder (production, real Xamax Academy data)
//
// Films the storyboard in one continuous 1080p retina video. You then
// speed-up / cut / add music + voice-over in CapCut / Screen Studio.
//
// Prereqs (one-time):
//   npm i -D playwright && npx playwright install chromium
//
// Run:
//   GRINTA_EMAIL=… GRINTA_PASSWORD=… node scripts/trailer/record.mjs
//
// Read-only: it never clicks "Enregistrer" / "Annuler la séance" / submit
// buttons — only navigation (calendar tile + preparation step sidebar).
//
// Env (all optional, defaults = the known-good prod demo):
//   BASE_URL              default https://grintaclub.app
//   GRINTA_LOCALE         default fr
//   GRINTA_CLUB           club to switch to (default "Xamax")
//   GRINTA_TEAM_ID        planner team (default the Xamax active team)
//   GRINTA_SESSION_TEXT   calendar tile to open (default "Verticaliser")

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = (process.env.BASE_URL || "https://grintaclub.app").replace(/\/$/, "");
const LOCALE = process.env.GRINTA_LOCALE || "fr";
const CLUB = process.env.GRINTA_CLUB || "Xamax";
const TEAM = process.env.GRINTA_TEAM_ID || "93d33a72-e448-48c3-89f0-a8000f699145";
const SESSION = process.env.GRINTA_SESSION_TEXT || "Verticaliser";
const EMAIL = process.env.GRINTA_EMAIL;
const PASSWORD = process.env.GRINTA_PASSWORD;
const OUT = path.join(process.cwd(), "scripts", "trailer", "out");

if (!EMAIL || !PASSWORD) {
  console.error("✗ Set GRINTA_EMAIL and GRINTA_PASSWORD env vars first.");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });
const L = (p) => `${BASE}/${LOCALE}${p}`;

/** Calm easeInOutQuad scroll top→bottom so the camera "reveals" content. */
async function cinematicScroll(page, ms = 3500) {
  await page.evaluate(async (d) => {
    const max = Math.max(0, document.body.scrollHeight - window.innerHeight);
    if (max < 40) return new Promise((r) => setTimeout(r, d));
    const t0 = performance.now();
    await new Promise((res) => {
      (function f(now) {
        const t = Math.min(1, (now - t0) / d);
        const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        window.scrollTo(0, max * e);
        t < 1 ? requestAnimationFrame(f) : res();
      })(t0);
    });
  }, ms);
}

async function settle(page) {
  try {
    await page.goto(page.url(), { waitUntil: "networkidle", timeout: 25000 });
  } catch {}
}

async function scene(page, label, url, { hold = 1600, scroll = 3500 } = {}) {
  console.log(`▶ ${label}  →  ${url}`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  } catch {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
  }
  await page.waitForTimeout(hold);
  await cinematicScroll(page, scroll);
  await page.waitForTimeout(hold);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  });
  const page = await context.newPage();

  // --- Login ---
  console.log("▶ Login");
  await page.goto(L("/login"), { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(2000);

  // --- Switch club → Xamax ---
  console.log("▶ Switch club →", CLUB);
  try {
    await page.locator("button", { hasText: /Propriétaire|·/ }).first()
      .click({ timeout: 8000 });
    await page.waitForTimeout(600);
    await page.locator("button", { hasText: new RegExp(CLUB, "i") }).last()
      .click({ timeout: 8000 });
    await page.waitForTimeout(2500);
  } catch (e) {
    console.log("  switcher skipped:", e.message.split("\n")[0]);
  }

  // Scene 2 — Club identity + teams
  await scene(page, "2. Identité du club", L("/settings/club"));
  await scene(page, "2b. Mes équipes", L("/teams"));

  // Scene 3 — Season planning (the populated calendar)
  await scene(page, "3. Planning de la saison", L(`/planner/${TEAM}`), {
    hold: 2200,
    scroll: 5000,
  });

  // Scene 4 — Open the real session from the calendar tile
  console.log(`▶ 4. Séance "${SESSION}" (clic tuile calendrier)`);
  const tile = page.getByText(new RegExp(SESSION, "i")).first();
  if (await tile.count()) {
    await tile.scrollIntoViewIfNeeded();
    await tile.click();
    await page.waitForTimeout(3000);
    await settle(page);

    // Walk the guided builder via the left step sidebar (navigation only —
    // never the Enregistrer / Annuler buttons).
    await cinematicScroll(page, 3500);
    for (const step of ["Bloc principal 1", "Jeu final & retour au calme"]) {
      const s = page.getByText(step, { exact: false }).first();
      if (await s.count()) {
        console.log(`   → étape « ${step} »`);
        await s.click().catch(() => {});
        await page.waitForTimeout(2200);
        await cinematicScroll(page, 3000);
      }
    }

    // Scene 6 — "Revue & export" : the PDF moment (hold long)
    const review = page.getByText("Revue & export", { exact: false }).first();
    if (await review.count()) {
      console.log("▶ 6. Revue & export (fiche PDF)");
      await review.click().catch(() => {});
      await page.waitForTimeout(3000);
      await cinematicScroll(page, 4500);
      await page.waitForTimeout(2500);
    }
  } else {
    console.log(`   ⚠ tuile "${SESSION}" introuvable — scène séance sautée`);
  }

  // Scene 5 — Exercise library (strong visual: pitch diagrams + ASF filters)
  await scene(page, "5. Bibliothèque ASF", L("/exercises"), {
    hold: 2000,
    scroll: 5000,
  });

  await page.waitForTimeout(800);
  await context.close(); // flushes the .webm
  await browser.close();
  console.log(`\n✓ Done. Raw recording in: ${OUT}`);
  console.log("  Next: import the .webm in CapCut/Screen Studio, cut to 30s,");
  console.log("  add on-screen text + voice-over from scripts/trailer/README.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
