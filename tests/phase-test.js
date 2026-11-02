// Phase-diagram tab test. Usage: node phase-test.js [page path or URL, default ../index.html] [screenshot dir, default ./out]
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url0 = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const url = url0 + (url0.includes("?") ? "&" : "?") + "mode=explore";   // these suites test the full bench; learn-test.js covers Learn mode
const out = process.argv[3] || path.join(__dirname, "out");
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = []; const ok = (c, m) => log.push((c ? "PASS " : "FAIL ") + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  page.on("requestfailed", r => errors.push("requestfailed: " + r.url()));
  await page.setViewport({ width: 1366, height: 1000 }); await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(url + "#phase", { waitUntil: "networkidle0" }); await sleep(800);
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__phase)));
  const set = async (c, t) => {
    await page.$eval("#pdC", (e, v) => { e.value = v; e.dispatchEvent(new Event("change")); }, String(c));
    await page.$eval("#pdT", (e, v) => { e.value = v; e.dispatchEvent(new Event("change")); }, String(t));
    await sleep(150);
  };
  const sys = async k => { await page.click(`#pdSys [data-v="${k}"]`); await sleep(400); };
  const shot = n => page.screenshot({ path: out + "/" + n + ".png" });
  const read = () => page.$eval("#pdRead", e => e.innerText.replace(/\n/g, " | "));
  const W = s => { const r = s.r; const w2 = (s.C - r.c1) / (r.c2 - r.c1); return [1 - w2, w2]; };

  // Pb-Sn
  let s = await st(); ok(s.sys === "pbsn", "default system is Pb–Sn");
  await set(40, 150); s = await st();
  ok(s.r.k === "α+β" && Math.abs(s.r.c1 - 11) < 1 && Math.abs(s.r.c2 - 98) < 0.7, `Pb–Sn 40/150: Cα ${s.r.c1.toFixed(2)}, Cβ ${s.r.c2.toFixed(2)} (Callister 11, 98)`);
  ok(Math.abs(W(s)[0] - 0.67) < 0.015, `Pb–Sn 40/150: Wα ${W(s)[0].toFixed(3)} (Callister 0.67)`);
  await shot("pd-pbsn-40-150");
  for (const [c, lo, hi] of [[63, 183, 185], [50, 183, 214], [30, 183, 256], [61.9, 183, 183]]) {
    await set(c, 100); s = await st();
    ok(s.range && Math.abs(s.range[0] - lo) <= 1.5 && Math.abs(s.range[1] - hi) <= 2, `Pb–Sn ${c}: melting range ${s.range && s.range.map(v => v.toFixed(1)).join("–")} (expect ${lo}–${hi})`);
  }
  await set(61.9, 150); await shot("pd-pbsn-eutectic");
  await set(40, 210); s = await st(); ok(s.r.k === "α+L", "Pb–Sn 40/210 is α + L"); await shot("pd-pbsn-40-210");
  await set(10, 60); s = await st(); ok(s.r.k === "α+β", "Pb–Sn 10/60 is α + β (below solvus)"); await shot("pd-pbsn-10-60");
  await set(10, 250); s = await st(); ok(s.r.k === "α", "Pb–Sn 10/250 is α");
  await set(80, 200); s = await st(); ok(s.r.k === "β+L", "Pb–Sn 80/200 is β + L"); await shot("pd-pbsn-80-200");
  await set(80, 300); s = await st(); ok(s.r.k === "L", "Pb–Sn 80/300 is L"); await shot("pd-pbsn-liquid");
  await set(99.5, 120); s = await st(); ok(s.r.k === "β", "Pb–Sn 99.5/120 is β");
  log.push("INFO Pb–Sn 40/150 readout: " + await (async () => { await set(40, 150); return read(); })());
  // cooling
  await set(40, 150); await page.click("#pdCool"); await sleep(1500); await shot("pd-pbsn-cooling");
  let t0 = Date.now(); while ((await page.$eval("#pdCool", e => e.textContent)) === "Stop" && Date.now() - t0 < 60000) await sleep(500);
  s = await st(); ok(Math.round(s.T) === 20, "Pb–Sn cooling finished at 20 °C (" + ((Date.now() - t0) / 1000).toFixed(0) + " s)");
  const logTxt = await page.$eval("#pdLog", e => e.innerText.replace(/\n/g, " | ")); log.push("INFO Pb–Sn 40 cooling log: " + logTxt);
  ok(/liquidus/.test(logTxt) && /eutectic/.test(logTxt), "cooling log lists liquidus and eutectic");

  // Cu-Ni
  await sys("cuni"); await set(35, 1250); s = await st();
  ok(s.r.k === "α+L" && Math.abs(s.r.c1 - 31.5) < 0.05 && Math.abs(s.r.c2 - 42.5) < 0.05, `Cu–Ni 35/1250: CL ${s.r.c1.toFixed(2)}, Cα ${s.r.c2.toFixed(2)} (Callister 31.5, 42.5)`);
  ok(Math.abs(W(s)[0] - 0.68) < 0.005, `Cu–Ni 35/1250: WL ${W(s)[0].toFixed(3)} (Callister 0.68)`);
  log.push("INFO Cu–Ni 35/1250 readout: " + await read());
  await shot("pd-cuni-35-1250");
  await set(35, 1100); s = await st(); ok(s.r.k === "α", "Cu–Ni 35/1100 is α"); await shot("pd-cuni-alpha");
  await set(35, 1400); s = await st(); ok(s.r.k === "L", "Cu–Ni 35/1400 is L");
  await set(30, 1100); s = await st(); log.push("INFO Cu–Ni 30 range " + s.range.map(v => v.toFixed(0)).join("–"));

  // Fe-C
  await sys("fec"); await set(0.45, 700); s = await st();
  ok(s.r.k === "α+Fe₃C", "Fe–C 0.45/700 is α + Fe₃C"); log.push("INFO Fe 0.45/700 readout: " + await read());
  const pear = (await read()).match(/Pearlite \| (\d+)%/); ok(pear && Math.abs(+pear[1] - 58) <= 1, "Fe 0.45 pearlite " + (pear && pear[1]) + "% (Callister Eq 9.20: 58%)");
  log.push("INFO Fe 0.45 events: " + s.events.map(e => Math.round(e.T) + " " + e.text).join(" | "));
  await shot("pd-fe-045-700");
  for (const [c, t, k, n] of [[0.45, 900, "γ", "gamma"], [0.45, 760, "α+γ", "alpha-gamma"], [0.76, 600, "α+Fe₃C", "eutectoid"], [1.0, 600, "α+Fe₃C", "hyper"], [1.0, 800, "γ+Fe₃C", "gamma-cem"], [2.1, 1180, "L+γ", "liq-gamma"], [0.01, 800, "α", "ferrite"], [0.2, 500, "α+Fe₃C", "low-c"],
    [0.05, 1500, "δ", "delta"], [0.07, 1450, "δ+γ", "delta-gamma"], [0.3, 1510, "δ+L", "delta-liq"], [3.0, 1200, "L+γ", "ci-liq-gamma"], [5.5, 1160, "L+Fe₃C", "ci-liq-cem"], [3.0, 1000, "γ+Fe₃C", "ci-white"], [3.0, 600, "α+Fe₃C", "ci-pearlite"]]) {
    await set(c, t); s = await st(); ok(s.r.k === k, `Fe–C ${c}/${t} is ${k} (got ${s.r.k})`); await shot("pd-fe-" + n);
  }
  await set(3.0, 600); ok((await page.evaluate(() => window.__micro.kind)) === "white", "Fe 3.0/600 micrograph is a white cast iron (transformed ledeburite)");
  await set(0.45, 1600); s = await st(); ok(s.events.some(e => /peritectic/.test(e.text)), "Fe 0.45 cooled from the melt passes the 1493 °C peritectic");
  // microstructure: areas match the lever rule (by volume), the real-photo view and the cooling-log thumbnails
  const micro = () => page.evaluate(() => window.__micro);
  await set(0.45, 600); let m = await micro();
  ok(m && m.kind === "pearlite" && Math.abs(m.areas[1] - 0.42) < 0.02, `Fe 0.45/600 micrograph: proeutectoid ferrite area ${m && m.areas[1].toFixed(3)} (lever 0.42)`);
  await set(0.45, 760); m = await micro(); s = await st();
  ok(m.kind === "proeu" && Math.abs(m.areas[1] - W(s)[0]) < 0.02, `Fe 0.45/760 micrograph: ferrite area ${m.areas[1].toFixed(3)} (lever ${W(s)[0].toFixed(3)})`);
  await page.click('#pdMicroMode [data-v="real"]'); await sleep(1200);
  const real = await page.$eval("#pdReal", e => ({ hidden: e.hidden, w: e.naturalWidth, src: e.getAttribute("src") }));
  ok(!real.hidden && real.w > 0, "real photo shown for 0.45 % C steel (" + real.src + ")"); await shot("pd-real-fe045");
  await set(0.45, 1100); await sleep(300);
  ok(await page.$eval("#pdReal", e => !e.hidden && /austenite/.test(e.getAttribute("src"))), "real photo for austenite is the stainless stand-in");
  await page.click('#pdMicroMode [data-v="look"]'); await sleep(200);
  ok(await page.$eval("#pdReal", e => e.hidden), "real photo hidden again in micrograph view");
  await sys("pbsn"); await set(40, 150); m = await micro();
  ok(m.kind === "eutectic" && Math.abs(m.areas[1] - 0.455) < 0.02, `Pb–Sn 40/150 micrograph: primary α area ${m.areas[1].toFixed(3)} (0.50 by mass = 0.455 by volume)`);
  await sleep(400);
  const th = await page.$$eval("#pdLog canvas", cs => cs.map(c => c.width));
  ok(th.length === 2 && th.every(w => w > 0), "cooling log has a drawn thumbnail per change (" + th.length + ")");
  await sys("cuni"); await set(35, 1250); m = await micro();
  ok(m.kind === "mushy" && Math.abs(m.areas[1] - 0.32) < 0.02, `Cu–Ni 35/1250 micrograph: solid area ${m.areas[1].toFixed(3)} (lever 0.32)`);
  await page.click("#pdCored"); await set(35, 1100); await shot("pd-cuni-cored");
  ok(/Cored/.test(await page.$eval("#pdWhy", e => e.textContent)), "Cu–Ni cored option explains coring");
  await page.click("#pdCored"); await sys("fec");
  // hover/drag on canvas
  const box = await page.$eval("#pdCv", e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(box.x + box.w * 0.4, box.y + box.h * 0.4); await sleep(200);
  s = await st(); ok(s.C > 0 && s.T > 400, `clicking the diagram picks a point (${s.C.toFixed(2)}, ${Math.round(s.T)})`);
  // dark + phone
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]); await sleep(300); await sys("pbsn"); await set(40, 150); await shot("pd-dark");
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(500);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(over <= 0, "phone: no horizontal scroll (" + over + ")"); await page.screenshot({ path: out + "/pd-phone.png", fullPage: true });
  ok(errors.length === 0, "no console errors (" + errors.length + ")"); errors.slice(0, 10).forEach(e => log.push("ERR " + e));
  console.log(log.join("\n")); await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]);  // headless Chrome sometimes hangs on close
  process.exit(log.some(l => l.startsWith("FAIL")) ? 1 : 0);
})().catch(e => { console.log(log.join("\n")); console.error("CRASH", e); process.exit(1); });
