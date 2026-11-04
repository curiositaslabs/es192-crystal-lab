// Stacking tab, "Show one unit cell": the highlighted atoms must be exactly one conventional cell of the
// stacked crystal (HCP 17, FCC 14, BCC 9), with the right touching pairs and cell size.
// Usage: node stack-cell-check.js [page]
const puppeteer = require("puppeteer-core");
const path = require("path");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url = (/^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg)) + "?mode=explore#stack";
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" }); await sleep(600);
  let fail = 0;
  const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fail++; };
  const measure = () => page.evaluate(() => {
    const root = window.__stack.root(), P = [];
    root.traverse(o => { if (o.isMesh && o.userData.inCell) P.push(o.position.clone().add(o.parent.position)); });
    const d = []; for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) d.push(P[i].distanceTo(P[j]));
    const cnt = x => d.filter(y => Math.abs(y - x) < 1e-3).length;
    const st = window.__stack.state();
    return { n: P.length, st, nn: cnt(1), e2: cnt(Math.SQRT2), diag6: cnt(Math.sqrt(6)), eB: cnt(2 / Math.sqrt(3)), hexc: cnt(2 * Math.sqrt(2 / 3)),
      note: document.querySelector("#stackCellNote").textContent, solid: (() => { let k = 0; root.traverse(o => { if (o.userData.inCell === false && o.material.opacity > 0.2) k++; }); return k; })() };
  });
  const press = async (sel, on) => { const p = await page.$eval(sel, b => b.getAttribute("aria-pressed") === "true"); if (p !== on) await page.click(sel); };
  const build = async (layer, s) => {
    await page.click(`#stackLayer [data-v="${layer}"]`); await page.click("#stackClear");
    for (const L of s.slice(1)) { await page.click(`#stackAdd [data-v="${L}"]`); }
    await page.waitForFunction(() => !window.__stack.busy(), { timeout: 20000 });   // the last layer has landed
  };
  await press("#stackCell", true);
  const want = { hcp: { n: 17, nn: 45 }, fcc: { n: 14, nn: 36 }, bcc: { n: 9, nn: 8 } };
  const cases = [["cp", "ABA", "hcp"], ["cp", "ABAB", "hcp"], ["cp", "ABABAB", "hcp"], ["cp", "ABABABABAB", "hcp"],
    ["cp", "ABCA", "fcc"], ["cp", "ABCAB", "fcc"], ["cp", "ABCABC", "fcc"], ["cp", "ACBACB", "fcc"], ["cp", "ABCABCABCA", "fcc"],
    ["sq", "ABA", "bcc"], ["sq", "ABAB", "bcc"], ["sq", "ABABA", "bcc"], ["sq", "ABABAB", "bcc"]];
  for (const [layer, s, k] of cases) {
    await build(layer, s.split(""));
    const r = await measure(), w = want[k];
    let geo = r.nn === w.nn;
    if (k === "fcc") geo = geo && r.e2 === 15 && r.diag6 === 4;       // 12 cube edges + 3 opposite face pairs at sqrt2, 4 body diagonals sqrt6
    if (k === "bcc") geo = geo && r.eB === 12;                          // 12 cube edges of 2/sqrt3
    if (k === "hcp") geo = geo && r.hexc === 7;                         // 7 vertical c-edges of height c = 1.633
    ok(r.st.cell === k && r.n === w.n && r.st.cellAtoms === w.n && geo && r.solid === 0,
      `${layer} ${s}: ${r.st.cell} cell, ${r.n} atoms (want ${w.n}), touching pairs ${r.nn} (want ${w.nn}), a-pairs ${k === 'fcc' ? r.e2 + '/15 diag ' + r.diag6 + '/4' : k === 'bcc' ? r.eB + '/12' : r.hexc + '/7'}, other atoms faded: ${r.solid === 0}`);
  }
  await build("cp", ["A", "B"]); let r = await measure();
  ok(r.n === 0 && /Stack more layers/.test(r.note), "2 layers: no cell, asks for more layers");
  await build("cp", ["A", "B", "C"]); r = await measure();
  ok(r.n === 0 && /FCC cell needs 4/.test(r.note), "ABC: asks for a 4th layer");
  await page.click('[data-preset="ABCABABC"]'); await sleep(300); r = await measure();
  ok(r.n === 0 && /no single repeating cell/.test(r.note), "stacking fault: no cell");
  await page.click('[data-preset="sq:ABABAB"]'); await sleep(300); r = await measure();
  ok(r.st.layer === "sq" && r.st.cell === "bcc" && await page.$eval('#stackAdd [data-v="C"]', b => b.hidden), "BCC preset switches to square layers and hides C");
  await page.click('[data-preset="ABABAB"]'); await sleep(300); r = await measure();
  ok(r.st.layer === "cp" && r.st.cell === "hcp", "HCP preset switches back to close-packed");
  ok(await page.$eval("#stackUpright", b => b.hidden), "upright button hidden for HCP");
  await page.click('[data-preset="ABCABC"]'); await sleep(300);
  ok(!(await page.$eval("#stackUpright", b => b.hidden)), "upright button shown for the FCC cell");
  await press("#stackUpright", true);
  await page.waitForFunction(() => !window.__stack.busy(), { timeout: 20000 });
  const up = await page.evaluate(() => {
    const root = window.__stack.root(), P = [];
    root.updateMatrixWorld(true);
    root.traverse(o => { if (o.isMesh && o.userData.inCell) P.push(root.worldToLocal(o.getWorldPosition(new o.position.constructor()))); });
    const c = P.reduce((a, p) => a.add(p), new P[0].constructor()).multiplyScalar(1 / P.length);
    const h = Math.SQRT1_2, near = x => [-h, 0, h].some(y => Math.abs(x - y) < 1e-3);
    const rel = P.map(p => p.clone().sub(c));
    return { n: P.length, centred: c.length() < 1e-3, grid: rel.every(p => near(p.x) && near(p.y) && near(p.z)),
      corners: rel.filter(p => [p.x, p.y, p.z].every(x => Math.abs(Math.abs(x) - h) < 1e-3)).length };
  });
  ok(up.n === 14 && up.centred && up.grid && up.corners === 8, `upright FCC cube: axis-aligned, 8 corners + 6 face centres, centred (${JSON.stringify(up)})`);
  await page.click("#stackClear"); await sleep(300);
  ok(await page.$eval("#stackUpright", b => b.hidden && b.getAttribute("aria-pressed") === "false"), "Start over drops the upright view");
  await press("#stackCell", false); await sleep(200); r = await measure();
  ok(r.n === 0 && !r.st.cell, "switching the cell off restores the plain stack");
  await browser.close(); setTimeout(() => process.exit(fail ? 1 : 0), 100);
  if (fail) process.exitCode = 1;
})();
