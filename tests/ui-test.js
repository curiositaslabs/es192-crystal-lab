// Shell and navigation test for Crystal Lab. Usage: node ui-test.js [page path or URL, default ../index.html]
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url0 = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const url = url0 + (url0.includes("?") ? "&" : "?") + "mode=explore";   // these suites test the full bench; learn-test.js covers Learn mode

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = []; const ok = (c, m) => log.push((c ? "PASS " : "FAIL ") + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  page.on("requestfailed", r => errors.push("requestfailed: " + r.url()));
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  const sel = () => page.$eval('nav.tabs [aria-selected="true"]', b => b.dataset.tab);
  const pressed = s => page.$eval(s, b => b.getAttribute("aria-pressed"));

  // removed text
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" }); await sleep(500);
  const body = await page.evaluate(() => document.body.innerText);
  ok(!/Materials Fundamentals/i.test(body) && !/Weeks 9–10/.test(body), "eyebrow line removed");
  ok(!/Six live models/.test(body), "intro paragraph removed");
  ok(!/Models are teaching schematics/.test(body) && !(await page.$("footer")), "footer removed");

  // every bench tab fits the window: model and its top controls visible without scrolling
  for (const [W, H] of [[1440, 900], [1280, 800], [1366, 768]]) {
    await page.setViewport({ width: W, height: H }); await sleep(300);
    for (const t of ["bonds", "cells", "stack", "raft", "disl"]) {
      await page.click("#t-" + t); await sleep(250);
      const r = await page.$eval(`#p-${t} .stage`, e => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: b.height }; });
      const ex = await page.$eval(`#p-${t} .explore`, e => e.getBoundingClientRect().bottom);
      ok(r.bottom <= H + 1 && r.h > 400 && ex <= H, `${W}×${H} ${t}: model ${Math.round(r.top)}–${Math.round(r.bottom)} px, Explore card ends ${Math.round(ex)} px`);
    }
  }
  await page.setViewport({ width: 1440, height: 900 }); await sleep(300);

  // keyboard: number keys and arrows
  await page.click("#t-bonds"); await page.focus("body");
  await page.keyboard.press("4"); await sleep(200); ok(await sel() === "raft", "key 4 opens Atom raft");
  await page.keyboard.press("6"); await sleep(200); ok(await sel() === "phase", "key 6 opens Phase diagrams");
  await page.focus("#pdC"); await page.keyboard.press("2"); await sleep(150); ok(await sel() === "phase", "typing a digit in a number box does not switch tabs");
  await page.click("#t-cells"); await page.focus("#t-cells"); await page.keyboard.press("ArrowRight"); await sleep(200);
  ok(await sel() === "stack" && await page.evaluate(() => document.activeElement.id) === "t-stack", "ArrowRight moves to the next tab and focuses it");
  await page.keyboard.press("Home"); await sleep(150); ok(await sel() === "bonds", "Home goes to the first tab");

  // links
  await page.evaluate(() => { location.hash = "disl"; }); await sleep(300); ok(await sel() === "disl", "#disl opens Dislocations (hashchange)");
  await page.evaluate(() => { location.hash = "cells:2"; }); await sleep(800);
  ok(await sel() === "cells" && await pressed('#cellMode [data-v="nbr"]') === "true" && await pressed('#cellType [data-v="fcc"]') === "true", "#cells:2 sets up the neighbours question");
  ok((await page.$eval('[data-guide="cells"] .exn', e => e.textContent)) === "2 / 5", "#cells:2 shows question 2 of 5");
  await page.evaluate(() => { location.hash = "phase:cuni:1"; }); await sleep(800);
  const ph = await page.evaluate(() => ({ sys: window.__phase.sys, C: window.__phase.C, T: window.__phase.T }));
  ok(ph.sys === "cuni" && ph.C === 35 && ph.T === 1250, `#phase:cuni:1 sets Cu–Ni, 35 wt% Ni, 1250 °C (${ph.sys}, ${ph.C}, ${ph.T})`);
  await page.goto(url.split("#")[0] + "#stack:3", { waitUntil: "networkidle0" }); await sleep(900);
  ok(await sel() === "stack" && /stacking fault/.test(await page.$eval("#stackVerdict", e => e.textContent)), "fresh load of #stack:3 sets up the stacking fault");

  // Explore card
  await page.click("#t-disl"); await sleep(200);
  const g = '[data-guide="disl"]';
  ok(await page.$eval(g + ' [data-x="prev"]', b => b.disabled), "Explore: Previous disabled on question 1");
  await page.click(g + ' [data-x="next"]'); await sleep(100);
  ok((await page.$eval(g + " .exn", e => e.textContent)) === "2 / 9", "Explore: Next goes to 2 / 9");
  ok(await page.$eval(g + " .exa", e => e.hidden), "Explore: answer hidden at first");
  await page.click(g + ' [data-x="ans"]'); await sleep(100);
  ok(!(await page.$eval(g + " .exa", e => e.hidden)) && /Burgers vector/.test(await page.$eval(g + " .exa", e => e.textContent)), "Explore: Show answer reveals it");
  await page.click(g + ' [data-x="setup"]'); await sleep(400);
  ok(await pressed("#dislBurgers") === "true", "Explore: Set it up turns on the Burgers circuit");

  // theme: toggles and is remembered
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await page.click("#themeBtn"); await sleep(300);
  const after = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(before !== after && await page.evaluate(() => document.documentElement.dataset.theme) === "dark", `theme button switches to dark (${before} → ${after})`);
  await page.reload({ waitUntil: "networkidle0" }); await sleep(400);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === "dark", "dark theme is remembered after reload");
  await page.click("#themeBtn"); await sleep(200);
  ok(await page.evaluate(() => document.documentElement.dataset.theme) === "light", "theme button switches back to light");

  // present mode
  await page.keyboard.press("p"); await sleep(400);
  ok(await page.evaluate(() => document.body.classList.contains("present")), "key P turns on present mode");
  await page.click("#presentBtn"); await sleep(300);
  ok(!(await page.evaluate(() => document.body.classList.contains("present"))), "Present button turns it off");

  // phone: tabs scroll sideways, page does not
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(400);
  await page.click("#t-phase"); await sleep(400);
  const nav = await page.$eval("nav.tabs", n => ({ sw: n.scrollWidth, cw: n.clientWidth, sl: n.scrollLeft }));
  const tb = await page.$eval("#t-phase", b => { const r = b.getBoundingClientRect(); return [r.left, r.right]; });
  ok(nav.sw > nav.cw && tb[0] >= 0 && tb[1] <= 390, `phone: tab strip scrolls and keeps the chosen tab in view (${Math.round(tb[0])}–${Math.round(tb[1])})`);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, "phone: no horizontal page scroll (" + over + ")");

  ok(errors.length === 0, "no console errors (" + errors.length + ")"); errors.slice(0, 10).forEach(e => log.push("ERR " + e));
  console.log(log.join("\n")); await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]);  // headless Chrome sometimes hangs on close
  process.exit(log.some(l => l.startsWith("FAIL")) ? 1 : 0);
})().catch(e => { console.log(log.join("\n")); console.error("CRASH", e); process.exit(1); });
