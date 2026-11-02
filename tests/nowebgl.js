// Page must still work when WebGL cannot start (lab laptops, locked-down browsers).
const puppeteer = require("puppeteer-core");
const path = require("path"), fs = require("fs");
const arg = process.argv[2] || path.join(__dirname, "..", "index.html");
const url0 = /^(https?|file):/.test(arg) ? arg : "file://" + path.resolve(arg);
const url = url0 + (url0.includes("?") ? "&" : "?") + "mode=explore";   // these suites test the full bench; learn-test.js covers Learn mode

(async () => {
  const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--disable-gpu", "--disable-webgl", "--disable-3d-apis", "--disable-software-rasterizer"] });
  const p = await b.newPage(); const errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.setViewport({ width: 1280, height: 800 });
  await p.goto(url + "#phase", { waitUntil: "networkidle0" }); await new Promise(r => setTimeout(r, 600));
  const ph = await p.evaluate(() => window.__phase && window.__phase.sys);
  await p.click("#t-cells"); await new Promise(r => setTimeout(r, 300));
  const msg = await p.$eval("#cellStage", e => e.textContent.trim());
  await p.click("#t-raft"); await new Promise(r => setTimeout(r, 600));
  const raft = await p.evaluate(() => window.__raft && window.__raft.state().N);
  console.log((ph === "pbsn" ? "PASS" : "FAIL") + " no WebGL: phase tab works (" + ph + ")");
  console.log((/needs WebGL/.test(msg) ? "PASS" : "FAIL") + " no WebGL: Unit cells shows a message -> " + msg.slice(0, 60));
  console.log((raft > 1000 ? "PASS" : "FAIL") + " no WebGL: atom raft runs (" + raft + " atoms)");
  console.log((errs.length === 0 ? "PASS" : "FAIL") + " no WebGL: no page errors " + errs.join(" | "));
  await Promise.race([b.close(), new Promise(r => setTimeout(r, 5000))]);  // headless Chrome sometimes hangs on close
  process.exit(errs.length || ph !== "pbsn" || raft <= 1000 ? 1 : 0);
})();
