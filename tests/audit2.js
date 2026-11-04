// Visual audit: every tab (light, dark, phone, present) and every Explore setup via its deep link.
// Usage: node audit2.js [page path or URL, default ../index.html] [screenshot dir, default ./out] [width height]
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url0 = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const url = url0 + (url0.includes("?") ? "&" : "?") + "mode=explore";   // these suites test the full bench; learn-test.js covers Learn mode
const out = process.argv[3] || path.join(__dirname, "out"), W = +(process.argv[4] || 1440), H = +(process.argv[5] || 900);
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push("pageerror " + e.message));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errs.push(m.type() + " " + m.text()); });
  await page.setViewport({ width: W, height: H });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(url, { waitUntil: "networkidle0" }); await sleep(800);
  const tabs = ["bonds", "cells", "stack", "raft", "disl", "phase"];
  const n = { bonds: 4, cells: 5, stack: 6, raft: 4, disl: 4 };
  for (const t of tabs) {
    if (!n[t]) continue;
    for (let k = 1; k <= n[t]; k++) {
      await page.evaluate(h => { location.hash = h; }, t + ":" + k);
      await sleep(t === "raft" ? 4500 : t === "disl" ? 2500 : 1300);
      await page.screenshot({ path: `${out}/g-${t}-${k}.png` });
    }
  }
  for (const [sys, m] of [["cuni", 3], ["pbsn", 3], ["fec", 3]]) for (let k = 1; k <= m; k++) {
    await page.evaluate(h => { location.hash = h; }, "phase:" + sys + ":" + k); await sleep(2500);
    await page.screenshot({ path: `${out}/g-phase-${sys}-${k}.png` });
  }
  // dark via the theme button
  await page.click("#themeBtn"); await sleep(300);
  for (const t of tabs) { await page.click("#t-" + t); await sleep(1200); await page.screenshot({ path: `${out}/dark-${t}.png` }); }
  await page.click("#themeBtn"); await sleep(300);
  // present mode
  await page.click("#t-cells"); await page.click("#presentBtn"); await sleep(800); await page.screenshot({ path: `${out}/present-cells.png` });
  await page.click("#t-disl"); await sleep(800); await page.screenshot({ path: `${out}/present-disl.png` });
  await page.click("#presentBtn"); await sleep(400);
  // phone
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(600);
  for (const t of tabs) {
    await page.click("#t-" + t); await sleep(900);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (over > 0) errs.push("phone " + t + " horizontal overflow " + over);
    await page.screenshot({ path: `${out}/phone-${t}.png` });
  }
  await page.click("#t-bonds"); await sleep(500); await page.screenshot({ path: `${out}/phone-bonds-full.png`, fullPage: true });
  console.log(errs.length ? errs.join("\n") : "no console errors");
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]);  // headless Chrome sometimes hangs on close
  process.exit(0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
