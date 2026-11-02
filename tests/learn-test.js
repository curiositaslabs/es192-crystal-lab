// Learn mode: every chapter's steps render, goals are detected from the models, answers are checked,
// and switching to Explore puts every control back. Usage: node learn-test.js [page path or URL] [screenshot dir]
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const out = process.argv[3] || path.join(__dirname, "out");
fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = []; const ok = (c, m) => log.push((c ? "PASS " : "FAIL ") + m);
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push("pageerror: " + e.message));
  page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  await page.goto(url + "#bonds", { waitUntil: "networkidle0" }); await sleep(800);
  ok(await page.evaluate(() => document.body.classList.contains("learn") && !document.querySelector("#lesson").hidden), "a first visit opens in Learn mode with the lesson column");
  const step = () => page.evaluate(() => window.__learn.step);
  const go = async (tab, k, wait) => { await page.evaluate((t, n) => { location.hash = "learn:" + t + ":" + n; }, tab, k); await sleep(wait || 900); };
  const solved = async (ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 3000)) { const s = await step(); if (s && s.solved) return true; await sleep(150); } return false; };
  const setVal = (sel, v) => page.$eval(sel, (e, x) => { e.value = x; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); }, v);
  const answer = async v => { await page.$eval(".lsn-blank input", (e, x) => { e.value = x; }, String(v)); await page.click(".lsn-check"); await sleep(200); };

  // every step of every chapter renders and Next walks through them
  const counts = { bonds: 8, cells: 7, stack: 5, raft: 6, disl: 9, phase: 9 };
  for (const [tab, n] of Object.entries(counts)) {
    await go(tab, 1, 700);
    let seen = 0, bad = [];
    for (let k = 0; k < n; k++) {
      const s = await step(), h = await page.$eval(".lsn-step > h3", e => e.textContent.trim());
      if (!s || s.tab !== tab || s.i !== k || !h) bad.push(k + 1); else seen++;
      if (k < n - 1) { await page.click("#lsnNext"); await sleep(tab === "raft" ? 500 : 350); }
    }
    ok(seen === n && !bad.length, `${tab}: all ${n} steps render in order${bad.length ? " (bad " + bad.join(",") + ")" : ""}`);
  }
  await page.screenshot({ path: out + "/learn-phase-last.png" });

  // a "try" goal is read from the model's own state
  await go("bonds", 2);
  ok(await page.evaluate(() => !!document.querySelector("#lesson .lsn-ctl #bondR")), "bonds 2: the spacing slider is brought into the lesson");
  ok(!(await step()).solved, "bonds 2: not solved before the student acts");
  await setVal("#bondR", 1.0); ok(await solved(), "bonds 2: moving the atoms to r0 completes the goal");
  ok(await page.$eval("#lsnNext", e => e.classList.contains("go") && /Next/.test(e.textContent)), "bonds 2: Next becomes the primary button once done");
  await page.screenshot({ path: out + "/learn-bonds-2-done.png" });

  // stacking: build ABAB
  await go("stack", 2, 1200);
  for (const L of ["B", "A", "B"]) { await page.click(`#stackAdd [data-v="${L}"]`); await sleep(700); }
  ok(await solved(), "stack 2: building ABAB is recognised as HCP");

  // numeric answers: right first time, and the hint then answer path
  await go("cells", 2, 1200); await answer(4); ok(await solved(1000), "cells 2: 4 atoms per FCC cell is accepted");
  await go("phase", 3, 1200);
  ok(await page.evaluate(() => document.querySelector(".lsn-why").hidden), "phase 3: the explanation stays hidden until answered");
  await answer(0.3); ok(/Not yet/.test(await page.$eval(".lsn-fb", e => e.textContent)) && !(await step()).solved, "phase 3: a wrong lever-rule answer gets a hint");
  await answer(0.665); ok(await solved(1000), "phase 3: W_alpha = 0.665 is accepted (0.67 ± 0.02)");
  await go("phase", 3, 1000); await answer(0.2); await answer(0.1);
  ok((await step()).solved && /answer is 0.67/.test(await page.$eval(".lsn-why", e => e.textContent)), "phase 3: two wrong answers reveal the worked answer");

  // a prediction reveals the outcome either way and sets the model up
  await go("phase", 5, 1000); await page.click('.lsn-opts button[data-j="1"]'); await sleep(900);
  const st = await page.evaluate(() => window.__phase);
  ok((await step()).solved && Math.abs(st.C - 61.9) < 0.01, "phase 5: a prediction reveals the answer and moves the point to the eutectic");

  // pins follow the model
  await go("phase", 1, 1200);
  ok(await page.evaluate(() => document.querySelectorAll(".pin:not([hidden])").length) === 4, "phase 1: four labelled pins point at the diagram");
  await page.screenshot({ path: out + "/learn-phase-1.png" });

  // Explore puts every control back where it was
  await go("disl", 3, 900);
  await page.click('#modeSw [data-m="explore"]'); await sleep(500);
  const back = await page.evaluate(() => ({
    learn: document.body.classList.contains("learn"), lesson: !document.querySelector("#lesson").hidden,
    tau: !!document.querySelector("#p-disl .side #dislTau"), go: !!document.querySelector("#p-disl .side #dislGo"),
    pins: document.querySelectorAll(".pin").length
  }));
  ok(!back.learn && !back.lesson && back.tau && back.go && back.pins === 0, "Explore restores the bench: controls back in the side panel, no pins");
  await page.click('#modeSw [data-m="learn"]'); await sleep(500);
  ok(await page.evaluate(() => document.body.classList.contains("learn")), "Learn mode comes back");

  // progress shows under the chapter names
  ok(await page.evaluate(() => [...document.querySelectorAll("nav.tabs .pg b")].some(b => parseFloat(b.style.width) > 0)), "chapter progress bars fill as steps are done");

  // phone: lesson below the model, no sideways scroll
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await sleep(600);
  for (const t of ["bonds", "phase"]) {
    await go(t, 1, 700);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(over <= 0, `phone ${t}: no horizontal scroll (${over})`);
    await page.screenshot({ path: `${out}/learn-phone-${t}.png`, fullPage: true });
  }
  ok(errors.length === 0, "no console errors (" + errors.length + ")"); errors.slice(0, 10).forEach(e => log.push("ERR " + e));
  console.log(log.join("\n"));
  await Promise.race([browser.close(), new Promise(r => setTimeout(r, 5000))]);
  process.exit(log.some(l => l.startsWith("FAIL")) ? 1 : 0);
})().catch(e => { console.log(log.join("\n")); console.error("CRASH", e); process.exit(1); });
