// Ball-and-stick check, Cells tab: every rod joins two touching atoms, every touching pair has a rod,
// and nothing else (no cell-edge lines) is drawn. Usage: node bonds-check.js [page]
const puppeteer = require("puppeteer-core");
const path = require("path");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url = (/^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg)) + "?mode=explore#cells";
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 900 });
  await page.goto(url, { waitUntil: "networkidle0" }); await sleep(600);
  let fail = 0;
  for (const mode of ["ball", "nbr"]) for (const type of ["sc", "bcc", "fcc", "hcp", "nacl", "dia"]) for (const reps of mode === "nbr" ? [1] : [1, 2]) {
    await page.click(`#cellMode [data-v="${mode}"]`); await page.click(`#cellType [data-v="${type}"]`);
    const on = await page.$eval("#cellReps", b => b.getAttribute("aria-pressed") === "true");
    if (mode === "ball" && on !== (reps === 2)) await page.click("#cellReps");
    await sleep(150);
    const r = await page.evaluate(() => {
      const root = window.__cells.root(), atoms = [], rods = []; let lines = 0;
      root.traverse(o => {
        if (o.isLineSegments || o.isLine) lines++;
        else if (o.isMesh && o.geometry.type === "SphereGeometry" && !(o.material.side === 1)) atoms.push(o.position.clone());
        else if (o.isMesh && o.geometry.type === "CylinderGeometry") rods.push({ p: o.position.clone(), L: o.geometry.parameters.height, q: o.quaternion.clone() });
      });
      // ends of each rod
      const ends = rods.map(c => { const d = new c.p.constructor(0, 1, 0).applyQuaternion(c.q).multiplyScalar(c.L / 2); return [c.p.clone().add(d), c.p.clone().sub(d)]; });
      const idx = v => atoms.findIndex(a => a.distanceTo(v) < 1e-3);
      const bad = ends.filter(([a, b]) => idx(a) < 0 || idx(b) < 0).length;
      const L = rods.map(c => c.L), dmin = Math.min(...L), dmax = Math.max(...L);
      // touching pairs = pairs at the shortest atom–atom distance
      let nn = Infinity; for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) nn = Math.min(nn, atoms[i].distanceTo(atoms[j]));
      let pairs = 0; for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) if (Math.abs(atoms[i].distanceTo(atoms[j]) - nn) < 0.02 * nn) pairs++;
      return { atoms: atoms.length, rods: rods.length, lines, bad, pairs, spread: (dmax - dmin) / nn, rodVsNN: dmax / nn };
    });
    // in the neighbour view only the centre's rods are drawn, so rods = coordination number
    const ok = r.lines === 0 && r.bad === 0 && r.spread < 0.02 && Math.abs(r.rodVsNN - 1) < 0.02 && (mode === "nbr" ? r.rods === r.atoms - 1 : r.rods === r.pairs);
    if (!ok) fail++;
    console.log((ok ? "ok  " : "FAIL") + ` ${mode} ${type} ${reps}: ${r.atoms} atoms, ${r.rods} rods, ${r.pairs} touching pairs, ${r.lines} other lines, rod/nn ${r.rodVsNN.toFixed(3)}`);
  }
  console.log(fail ? fail + " FAIL" : "all pass");
  await Promise.race([browser.close(), sleep(5000)]); process.exit(fail ? 1 : 0);
})().catch(e => { console.error("CRASH", e); process.exit(1); });
