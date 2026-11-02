// Click-through test of Crystal Lab. Usage: node test.js [page path or URL, default ../index.html] [screenshot dir, default ./out]
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url0 = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const url = url0 + (url0.includes("?") ? "&" : "?") + "mode=explore";   // these suites test the full bench; learn-test.js covers Learn mode
const out = process.argv[3] || path.join(__dirname, "out");
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = [];
const ok = (cond, msg) => { log.push((cond ? "PASS " : "FAIL ") + msg); };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new",
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"]
  });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.type() + ": " + m.text()); });
  page.on("requestfailed", r => errors.push("requestfailed: " + r.url()));
  await page.setViewport({ width: 1366, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(url, { waitUntil: "networkidle0" });
  const text = sel => page.$eval(sel, e => e.textContent.trim());
  const click = async sel => { await page.click(sel); await sleep(120); };
  const shot = async name => page.screenshot({ path: out + "/" + name + ".png" });

  /* ---------- BONDS ---------- */
  const nChips = await page.$$eval("#bondChips button", b => b.length);
  ok(nChips === 20, "bonds: 20 substance chips (" + nChips + ")");
  for (let i = 0; i < nChips; i++) { await page.click(`#bondChips button[data-i="${i}"]`); await sleep(40); }
  ok(errors.length === 0, "bonds: every substance renders without error");
  await page.click('#bondChips button[data-i="0"]');
  const bfps = await page.evaluate(() => new Promise(r => { document.getElementById("bondForm").click(); let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  log.push("INFO bonds: frame rate during Form animation " + bfps + " fps");
  await click("#bondForm"); await sleep(600);
  const mid = await text("#bondState");   // read before the screenshot: under SwiftShader a screenshot can outlast the 1.1 s transfer
  await shot("bonds-ionic-transfer");
  ok(/electron jumps/.test(mid), "bonds: Form shows electron transfer -> " + mid);
  await sleep(2600);
  const formed = await page.$eval("#bondR", e => +e.value);
  ok(Math.abs(formed - 1) < 0.02, "bonds: Form ends at r0 (" + formed + ")");
  await shot("bonds-ionic-formed");
  await click("#bondBreak"); await sleep(2800);
  ok(/Broken/.test(await text("#bondState")), "bonds: Pull until it breaks -> " + await text("#bondState"));
  for (const i of [7, 10, 13, 19]) { await page.click(`#bondChips button[data-i="${i}"]`); await sleep(300); await shot("bonds-" + i); }
  // slider at the force peak
  await page.$eval("#bondR", e => { e.value = 1.23; e.dispatchEvent(new Event("input")); });
  ok(/peak force/.test(await text("#bondState")), "bonds: peak message at r = 1.23 r0");
  await click("#bondParts");
  // scatter click on W
  const box = await page.$eval("#bondScatter", e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
  await shot("bonds-scatter-hover");

  /* ---------- UNIT CELLS ---------- */
  await click("#t-cells"); await sleep(400);
  for (const t of ["sc", "bcc", "fcc", "hcp", "nacl", "dia"]) for (const m of ["ball", "hard", "cut", "nbr"]) {
    await page.click(`#cellType [data-v="${t}"]`); await page.click(`#cellMode [data-v="${m}"]`); await sleep(250);
    const cn = await page.$$eval("#cellStats dd", d => d[1] && d[1].textContent);
    if (m === "nbr") {
      const expect = { sc: "6", bcc: "8", fcc: "12", hcp: "12", nacl: "6", dia: "4" }[t];
      ok(cn === expect, `cells: ${t} neighbours shell has ${cn} atoms (expect ${expect})`);
    }
    if (["fcc-cut", "hcp-cut", "fcc-nbr", "bcc-nbr", "hcp-nbr", "nacl-ball", "dia-ball", "nacl-cut"].includes(t + "-" + m)) await shot("cells-" + t + "-" + m);
  }
  await page.click('#cellType [data-v="fcc"]'); await page.click('#cellMode [data-v="cut"]'); await sleep(300);
  const dens = await page.$$eval("#cellStats dd", d => d.map(x => x.textContent));
  ok(dens.some(s => /8\.9\d g\/cm³ from the cell · 8\.94 measured/.test(s)), "cells: Cu density " + dens[dens.length - 1]);
  // click the cell to pick an atom
  const st = await page.$eval("#cellStage canvas", e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  let picked = false;
  for (const [fx, fy] of [[0.5, 0.5], [0.42, 0.45], [0.58, 0.55], [0.35, 0.3], [0.65, 0.7]]) {
    await page.mouse.click(st.x + st.w * fx, st.y + st.h * fy); await sleep(200);
    if (!(await page.$eval("#cellTip", e => e.hidden))) { picked = true; break; }
  }
  ok(picked, "cells: clicking an atom shows its share -> " + (picked ? await text("#cellTip") : "none"));
  await shot("cells-fcc-cut-picked");
  // drag rotate
  await page.mouse.move(st.x + st.w * 0.5, st.y + st.h * 0.5); await page.mouse.down();
  await page.mouse.move(st.x + st.w * 0.7, st.y + st.h * 0.6, { steps: 8 }); await page.mouse.up(); await sleep(200);
  await click("#cellPlane"); await sleep(200); await shot("cells-fcc-plane");
  await click("#cellReps"); await sleep(200); await shot("cells-fcc-2x2x2");
  await click("#cellReps"); await click("#cellPlane");
  for (const [T, expect] of [[1000, "FCC"], [1450, "BCC"], [1550, "liquid"], [20, "BCC"]]) {
    await page.$eval("#ironT", (e, T) => { e.value = T; e.dispatchEvent(new Event("input")); }, T); await sleep(150);
    const o = await text("#ironOut");
    ok(o.includes(expect), `cells: iron at ${T} °C -> ${o}`);
  }
  for (const s of ["Zinc", "Cobalt"]) {
    await page.click('#cellType [data-v="hcp"]'); await sleep(150);
    await page.select("#cellMetal", s === "Zinc" ? "0" : "1"); await sleep(150);
    const d = await page.$$eval("#cellStats dd", d => d.map(x => x.textContent));
    log.push("INFO cells: " + s + " -> " + d.slice(-2).join(" | "));
  }

  /* ---------- STACKING ---------- */
  await click("#t-stack"); await sleep(300);
  await click("#stackClear");
  ok(await page.$eval('#stackAdd [data-v="A"]', b => b.disabled), "stack: cannot drop A on A");
  await click('#stackAdd [data-v="B"]'); await sleep(200); await shot("stack-drop-mid"); await sleep(700);
  await click('#stackAdd [data-v="A"]'); await sleep(900);
  ok(/HCP/.test(await text("#stackVerdict")), "stack: ABA -> " + await text("#stackVerdict"));
  await click("#stackClear"); await click('#stackAdd [data-v="B"]'); await sleep(800); await click('#stackAdd [data-v="C"]'); await sleep(900);
  ok(/FCC/.test(await text("#stackVerdict")), "stack: ABC -> " + await text("#stackVerdict"));
  await shot("stack-abc");
  await click('[data-preset="ABCABABC"]'); await sleep(300);
  ok(/stacking fault/.test(await text("#stackVerdict")), "stack: fault -> " + await text("#stackVerdict"));
  await click("#stackSide"); await sleep(200); await shot("stack-fault-side");
  await click('[data-preset="ABCABC"]'); await click("#stackTop"); await sleep(200); await shot("stack-fcc-top");
  await click("#stackGlass"); await sleep(200); await shot("stack-fcc-glass"); await click("#stackGlass");
  for (let i = 0; i < 4; i++) { const b = await page.$$('#stackAdd button:not([disabled])'); await b[0].click(); await sleep(60); }
  ok((await page.$$eval("#stackSeq b", b => b.length)) === 10, "stack: capped at 10 layers");
  ok(await page.$$eval("#stackAdd button", b => b.every(x => x.disabled)), "stack: add buttons disabled at 10");

  /* ---------- RAFT ---------- */
  await click("#t-raft"); await sleep(1500);
  const r0 = await page.evaluate(() => window.__raft.state());
  ok(r0.six > 0.85, "raft: starts as a near-perfect crystal (" + (100 * r0.six).toFixed(0) + "% six-fold)");
  await shot("raft-start");
  // tools
  const rc = await page.$eval("#raftCv", e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.click(rc.x + rc.w * 0.5, rc.y + rc.h * 0.5); await sleep(100);
  ok((await page.evaluate(() => window.__raft.state().N)) === r0.N - 1, "raft: remove tool deletes an atom");
  await click('#raftTool [data-v="big"]'); await page.mouse.click(rc.x + rc.w * 0.3, rc.y + rc.h * 0.3);
  await click('#raftTool [data-v="poke"]');
  await page.mouse.move(rc.x + rc.w * 0.7, rc.y + rc.h * 0.7); await page.mouse.down();
  await page.mouse.move(rc.x + rc.w * 0.75, rc.y + rc.h * 0.6, { steps: 10 }); await sleep(300); await shot("raft-poke"); await page.mouse.up();
  await click('#raftTool [data-v="remove"]');
  // melt -> slow cool
  await click("#raftReset"); await click("#raftMelt"); await sleep(5000);
  const melt = await page.evaluate(() => window.__raft.state());
  ok(melt.T > 1.1 && melt.six < 0.35, `raft: melted (T ${melt.T.toFixed(2)}, ${(100 * melt.six).toFixed(0)}% six-fold)`);
  await shot("raft-liquid");
  await click("#raftSlow"); const t0 = Date.now(); await sleep(1000);
  while ((await page.evaluate(() => window.__raft.state().cooling)) && Date.now() - t0 < 150000) await sleep(1000);
  log.push("INFO raft: slow cool took " + ((Date.now() - t0) / 1000).toFixed(0) + " s in headless Chrome");
  const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t = performance.now(); const f = () => { n++; if (performance.now() - t < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
  log.push("INFO raft: headless frame rate " + fps.toFixed(0) + " fps");
  const slow = await page.evaluate(() => window.__raft.state());
  ok(slow.T < 0.15, `raft: slow cool reaches low T (${slow.T.toFixed(2)})`);
  log.push(`INFO raft: slow cool -> ${(100 * slow.six).toFixed(0)}% six-fold`);
  await click('#raftColor [data-v="grain"]'); await sleep(200); await shot("raft-slow-grains");
  await click('#raftColor [data-v="nbr"]'); await shot("raft-slow-nbr");
  await click("#raftMelt"); await sleep(4000); await click("#raftQuench"); await sleep(10000);
  const q = await page.evaluate(() => window.__raft.state());
  log.push(`INFO raft: quench -> ${(100 * q.six).toFixed(0)}% six-fold, T ${q.T.toFixed(2)}`);
  await click('#raftColor [data-v="grain"]'); await sleep(200); await shot("raft-quench-grains");
  await click('#raftColor [data-v="nbr"]');
  await click('#raftMix [data-v="two"]'); await sleep(4000); await click("#raftQuench"); await sleep(10000);
  const glass = await page.evaluate(() => window.__raft.state());
  log.push(`INFO raft: two sizes quench -> ${(100 * glass.six).toFixed(0)}% six-fold`);
  ok(glass.six < q.six, "raft: two-size quench is less ordered than one-size quench (glass)");
  await shot("raft-glass");
  await click("#raftPause"); const p1 = await page.evaluate(() => window.__raft.state().T); await sleep(500); const p2 = await page.evaluate(() => window.__raft.state().T);
  ok(p1 === p2, "raft: pause freezes the simulation"); await click("#raftPause");
  await click("#raftReset");

  /* ---------- DISLOCATIONS ---------- */
  await click("#t-disl"); await sleep(300);
  await shot("disl-start");
  await click("#dislBurgers");
  for (let i = 0; i < 14; i++) { await click("#dislStep"); await sleep(450); }
  const bv = await text("#dislBroken");
  await shot("disl-burgers-inside");
  log.push("INFO disl: after 14 steps, bonds breaking " + bv + " status " + await text("#dislStatus"));
  await click("#dislReset"); await click("#dislBurgers");
  await click("#dislGo"); await sleep(1500);
  ok(/Gliding/.test(await text("#dislStatus")), "disl: glides at stress 30 -> " + await text("#dislStatus"));
  await shot("disl-gliding");
  await sleep(12000);
  ok(/Slipped/.test(await text("#dislStatus")), "disl: crosses the crystal -> " + await text("#dislStatus"));
  await shot("disl-slipped");
  await click("#dislReset"); await click("#dislSolute"); await click("#dislGo"); await sleep(6000);
  ok(/Pinned/.test(await text("#dislStatus")), "disl: pinned by solute at 30 -> " + await text("#dislStatus"));
  await shot("disl-pinned");
  await page.$eval("#dislTau", e => { e.value = 60; e.dispatchEvent(new Event("input")); }); await sleep(3000);
  ok(!/Pinned/.test(await text("#dislStatus")), "disl: breaks free at 60 -> " + await text("#dislStatus"));
  await click("#dislReset"); await click("#dislSolute"); await click("#dislGB");
  await page.$eval("#dislTau", e => { e.value = 30; e.dispatchEvent(new Event("input")); });
  await click("#dislGo"); await sleep(9000);
  ok(/grain boundary/.test(await text("#dislStatus")), "disl: blocked at grain boundary -> " + await text("#dislStatus"));
  await shot("disl-gb");
  await click("#dislGB"); await click("#dislReset");
  await click('#dislMode [data-v="rigid"]');
  await page.$eval("#dislTau", e => { e.value = 40; e.dispatchEvent(new Event("input")); });
  await click("#dislGo"); await sleep(1500);
  ok(/Not enough stress/.test(await text("#dislStatus")), "disl: rigid at 40 holds -> " + await text("#dislStatus"));
  await page.$eval("#dislTau", e => { e.value = 96; e.dispatchEvent(new Event("input")); }); await sleep(700);
  ok(/Every bond/.test(await text("#dislStatus")), "disl: rigid at 96 -> " + await text("#dislStatus") + " / broken " + await text("#dislBroken"));
  await shot("disl-rigid");
  await sleep(2500);
  ok(/Slipped/.test(await text("#dislStatus")), "disl: rigid slips -> " + await text("#dislStatus"));
  await click('#dislMode [data-v="disl"]');

  /* ---------- PRESENT, DARK, PHONE ---------- */
  await click("#presentBtn"); await sleep(400); await click("#t-cells"); await sleep(400); await shot("present-cells"); await click("#presentBtn");
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]); await sleep(300);
  for (const t of ["bonds", "cells", "stack", "raft", "disl"]) { await click("#t-" + t); await sleep(500); await shot("dark-" + t); }
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(500);
  for (const t of ["bonds", "cells", "stack", "raft", "disl"]) {
    await click("#t-" + t); await sleep(500);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 0, `phone: ${t} has no horizontal scroll (${over}px)`);
    await page.screenshot({ path: out + "/phone-" + t + ".png", fullPage: false });
  }
  ok(errors.length === 0, "no console errors, page errors or failed requests (" + errors.length + ")");
  errors.slice(0, 20).forEach(e => log.push("ERR " + e));
  console.log(log.join("\n"));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]);  // headless Chrome sometimes hangs on close
  process.exit(log.some(l => l.startsWith("FAIL")) ? 1 : 0);
})().catch(e => { console.log(log.join("\n")); console.error("TEST CRASH", e); process.exit(1); });
