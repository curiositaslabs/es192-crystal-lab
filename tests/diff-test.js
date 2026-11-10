// Diffusion tab (Lecture 11A): carburizing numbers against Callister, and the nucleation-and-growth simulation against Avrami.
// Usage: node diff-test.js [page path or URL, default ../index.html] [screenshot dir]
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url0 = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const url = url0 + (url0.includes("?") ? "&" : "?") + "mode=explore";
const out = process.argv[3];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = []; const ok = (c, m) => log.push((c ? "PASS " : "FAIL ") + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url + "#diff", { waitUntil: "networkidle0" }); await sleep(600);
  const st = () => page.evaluate(() => window.__diff.state());
  const val = (sel, v) => page.evaluate((s, x) => { const e = document.querySelector(s); e.value = x; e.dispatchEvent(new Event("input", { bubbles: true })); }, sel, v);
  const shot = async n => { if (out) { fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: path.join(out, n + ".png") }); } };

  ok(await page.$eval('nav.tabs [aria-selected="true"]', b => b.dataset.tab) === "diff", "#diff opens the Diffusion tab");
  await page.keyboard.press("1"); await sleep(150); await page.keyboard.press("7"); await sleep(300);
  ok(await page.$eval('nav.tabs [aria-selected="true"]', b => b.dataset.tab) === "diff", "key 7 opens Diffusion");

  // carburizing: Callister Design Example 5.1 numbers (exact erf: 0.4769, so ~1% shorter than the book's 0.4747)
  await val("#cbT", 1050); await val("#cbX", 0.75); await sleep(100);
  let s = await st();
  ok(Math.abs(s.need - 5.21) < 0.05, `1050 °C, 0.75 mm: ${s.need.toFixed(2)} h (Callister 5.3 h with 0.4747)`);
  await val("#cbT", 950); await sleep(100); s = await st();
  ok(Math.abs(s.need - 15.6) < 0.15, `950 °C: ${s.need.toFixed(2)} h`);
  await val("#cbTime", 4); await sleep(100); s = await st();
  ok(Math.abs(s.depth - 0.379) < 0.005, `950 °C, 4 h: depth ${s.depth.toFixed(3)} mm`);
  await val("#cbTime", 16); await sleep(100); s = await st();
  ok(Math.abs(s.depth / 0.379 - 2) < 0.02, `16 h is twice as deep as 4 h (${s.depth.toFixed(3)} mm)`);
  await page.click("#cbReset"); await page.click("#cbRun"); await sleep(4800); s = await st();
  ok(!s.running && s.hits.some(h => h.T === 950) && Math.abs(s.t - s.need) < 1e-6, `run stops when deep enough (t = ${s.t.toFixed(2)} h)`);
  await shot("diff-carb");
  await page.click("#cbFollow"); await sleep(1500); s = await st(); ok(s.follow, "follow one atom switches on");

  // nucleation and growth
  await page.click('#diffView [data-v="grow"]'); await sleep(400);
  await page.click('#ngMode [data-v="rates"]'); await sleep(50);
  const runAt = async (n, g) => { await val("#ngN", n); await val("#ngG", g); await sleep(250); const t0 = Date.now(); await page.waitForFunction(() => window.__diff.state().runs.length > 0, { timeout: 5000 }); return [await st(), Date.now() - t0]; };
  let [a] = await runAt(2, 0.3);
  ok(a.grains > 30 && a.grains < 200, `Ṅ 100, Ġ 2: ${a.grains} grains (theory ≈ ${Math.round(0.88 * 0.04 * Math.pow(100 / 2e-3, 2 / 3))})`);
  ok(Math.abs(a.th / a.thA - 1) < 0.2, `t½ sim ${a.th.toFixed(1)} s vs Avrami ${a.thA.toFixed(1)} s`);
  let [fine] = await runAt(3, -0.5);
  ok(fine.grains > 300, `Ṅ 1000, Ġ 0.32: ${fine.grains} grains (fine)`);
  ok(Math.abs(fine.th / fine.thA - 1) < 0.15, `fine: t½ sim ${fine.th.toFixed(1)} s vs Avrami ${fine.thA.toFixed(1)} s`);
  let [coarse] = await runAt(0.5, 1);
  ok(coarse.grains > 0 && coarse.grains < 20, `Ṅ 3, Ġ 10: ${coarse.grains} grains (coarse)`);
  const t0 = Date.now(); await val("#ngN", 3); await val("#ngG", -0.5); await sleep(160); const ms = Date.now() - t0;
  ok(ms < 1500, `worst-case recompute ${ms} ms`);
  await sleep(7500); await shot("diff-grow-rates");

  // temperature: nothing near Tm, fastest near the nose, finest grains when coldest
  await page.click('#ngMode [data-v="temp"]'); await sleep(50);
  const T = {};
  for (const d of [40, 80, 150, 250, 380]) { await val("#ngDT", d); await sleep(450); T[d] = await st(); }
  ok(T[40].none || T[40].th > 1e5, `40 °C below Tm: ${T[40].none ? "no nucleus" : "t½ " + Math.round(T[40].th) + " s"}`);
  ok(T[150].th < T[80].th && T[150].th < T[380].th, `fastest near the nose: t½ 80/150/380 = ${Math.round(T[80].th)}/${Math.round(T[150].th)}/${Math.round(T[380].th)} s`);
  ok(T[380].grains > T[250].grains && T[250].grains > T[150].grains && T[150].grains > T[80].grains, `colder gives more grains: ${[80, 150, 250, 380].map(d => T[d].grains).join(" < ")}`);
  for (const d of [80, 150, 250, 380]) ok(Math.abs(T[d].th / T[d].thA - 1) < (T[d].grains < 4 ? 0.6 : 0.15), `${d} °C below: t½ sim ${Math.round(T[d].th)} s vs Avrami ${Math.round(T[d].thA)} s`);
  await val("#ngDT", 150); await sleep(8000); await shot("diff-grow-temp");

  // Explore questions all set up without errors
  for (let i = 1; i <= 8; i++) { await page.evaluate(k => { location.hash = "diff:" + k; }, i); await sleep(900); }
  await shot("diff-explore-last");
  // dark theme draws
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; }); await sleep(600); await shot("diff-dark");
  // phone width
  await page.setViewport({ width: 390, height: 844 }); await page.evaluate(() => { location.hash = "diff:1"; }); await sleep(1500); await shot("diff-phone");

  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  console.log(log.join("\n"));
  console.log(log.filter(l => l.startsWith("FAIL")).length ? "SOME FAILED" : "ALL PASS (" + log.length + ")");
  setTimeout(() => process.exit(0), 5000);
  await browser.close(); process.exit(0);
})();
