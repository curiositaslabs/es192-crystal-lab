# ES 192 Crystal Lab

Interactive models for **ES 192: Materials Selection in Mechanical Design** (Harvard SEAS), Weeks 9–10, Materials Fundamentals.

**Live page:** https://curiositaslabs.github.io/es192-crystal-lab/

| # | Tab | Link | Lecture | What it shows |
|---|---|---|---|---|
| 1 | Bonds | [#bonds](https://curiositaslabs.github.io/es192-crystal-lab/#bonds) | 9A | Ionic, covalent, metallic, van der Waals and hydrogen bonds; energy–distance and force–distance curves; bond energy vs melting point for 20 substances |
| 2 | Unit cells | [#cells](https://curiositaslabs.github.io/es192-crystal-lab/#cells) | 9A | SC, BCC, FCC, HCP, rock salt and diamond cubic in 3D; atoms per cell, coordination shells, densest planes, real metals with computed lattice constant and density, iron's BCC ↔ FCC change |
| 3 | Stacking | [#stack](https://curiositaslabs.github.io/es192-crystal-lab/#stack) | 9A | Build close-packed layers: ABAB → HCP, ABCABC → FCC, stacking faults; square layers → BCC; show one unit cell inside each stack (FCC cube can be stood upright) |
| 4 | Atom raft | [#raft](https://curiositaslabs.github.io/es192-crystal-lab/#raft) | 9A · 10A | Live 2D Lennard-Jones simulation (~1,800 atoms): melting, slow cooling vs quenching, grain orientation map, vacancies, solutes, glass formation |
| 5 | Dislocations | [#disl](https://curiositaslabs.github.io/es192-crystal-lab/#disl) | 10A | Edge dislocation glide vs rigid slip, Burgers circuit, solute and grain-boundary pinning |
| 6 | Phase diagrams | [#phase](https://curiositaslabs.github.io/es192-crystal-lab/#phase) | Lab 9 · 10B | Cu–Ni, Pb–Sn (solder) and the whole Fe–Fe₃C diagram (steels and white cast irons, with a steels-only zoom), drawn in the textbook's style (wt% and at%, °C and °F): hover or pin a point to see the phases, tie line and lever-rule fractions, a simulated micrograph that grows as the alloy cools (dendrites, eutectic colonies, ferrite on austenite boundaries, pearlite), a real micrograph of the closest real alloy, and the atomic arrangement; "Cool slowly from the top" logs every phase change with a thumbnail of the structure it makes; Cu–Ni can also be cast quickly to show coring |

## Learn and Explore

The page opens in **Learn** mode: each tab is a short chapter with a stated objective and 5 to 9 steps. Each step is one move in a learning cycle: **Watch** (the model demonstrates while the text narrates), **Predict** (commit to an answer, then see), **Try it** (do something to the model; the model itself checks when the goal is reached), **Work it out** (calculate a number read off the model; a wrong answer gets a hint, a second one the worked answer), **The idea** (the principle and its equation) and **Apply it** (an engineering choice). A step brings in only the controls it needs and can point at parts of the model. Progress is remembered on that computer and shows under the chapter names. **Explore** (top right) is the full bench with every control, for free experiments and class demos.

- **Link to a lesson step:** `#learn:phase:3` opens chapter 6 at step 3 (the link button beside Back copies it). `?mode=explore` opens in Explore.
- On a phone the lesson is a sheet docked at the bottom of the screen, under the live model.

## Using it in class

- **Explore questions.** Every tab has a short set of questions at the top of its panel. **Set it up** puts the model in the state the question needs; **Show answer** reveals the answer. The link button copies a link that opens that question already set up.
- **Links to a question:** add `:n` to a tab link. `#cells:2` opens Unit cells with question 2 set up; `#phase:cuni:1` opens Cu–Ni with its first question set up (systems: `cuni`, `pbsn`, `fec`).
- **Keys:** `1`–`6` switch tabs, `←`/`→` move along the tab bar, `P` toggles Present mode (full screen, larger models). Double-click a 3D model, or use its ⟲ button, to reset the view.
- **Light/dark:** the moon/sun button; the choice is remembered on that computer.
- Without WebGL the two 3D tabs show a message and every other tab still works.

## Embed in Canvas

In a Canvas page, switch the editor to HTML and paste:

```html
<iframe src="https://curiositaslabs.github.io/es192-crystal-lab/#cells" width="100%" height="900" style="border:0" allowfullscreen title="ES 192 Crystal Lab"></iframe>
```

Change `#cells` to any tab name above, or to a question link such as `#cells:2`.

## Data sources

- Bond energies and melting points: Callister & Rethwisch, *Materials Science and Engineering: An Introduction*, 10th ed., Table 2.3.
- Atomic radii and crystal structures: same, Table 3.1. Atomic weights: Fig. 2.8. Computed density uses ρ = nA / (V<sub>C</sub> N<sub>A</sub>), Eq. 3.8.
- Measured densities and lattice constants for C, Si and NaCl: standard reference values.
- Phase diagrams: Pb–Sn and Fe–Fe₃C traced from the vector figures in Callister & Rethwisch 10e (Figs. 9.8, 9.24), snapped to the labelled invariant points and smoothed through the traced points (centripetal Catmull–Rom); the Fe–C peritectic uses the standard 0.09 / 0.17 / 0.53 wt% C at 1493 °C; Cu–Ni fitted through the melting points of Cu and Ni and the 1250 °C tie line of §9.8 (Fig. 9.3b). Checks: Pb–Sn liquidus 214 °C at 50 wt% Sn (Table 9.1); Example Problem 9.2 and the §9.8 lever-rule example reproduced.

- Ionic and atomic radii in the Bonds pair: Callister Table 12.3 (Li⁺ from Shannon); neutral atoms use the metallic radius of the metal and the covalent radius of the non-metal.
- Simulated micrographs: fields from `tools/make_micro_fields.py` (phase-field dendrites after Kobayashi, *Physica D* 63, 1993; Swift–Hohenberg lamellae seeded as colonies; grain-boundary growth maps). Each structure is drawn at its lever-rule amount converted to area (volume) fraction; Pb–Sn uses lead 11.34 and tin 7.29 g/cm³.
- Real micrographs: DoITPoMS Micrograph Library (University of Cambridge, CC BY-NC-SA 4.0), Wikimedia Commons (CC BY / BY-SA) and Rosenhain & Tucker, *Phil. Trans. R. Soc. A* 209 (1909) (public domain). Every image, its licence and its stand-in status are listed in `assets/micrographs/SOURCES.md`.

Bond-curve shapes (Morse form), raft temperatures (reduced Lennard-Jones units) and dislocation stresses (0–100 schematic scale) are teaching schematics that show trends, not measured values.

## Files and workflow

- `crystal-lab.html`: the source (styles, markup and script with no document wrapper). Edit this file.
- `index.html`: the published page, generated by `python3 tools/build.py`. Loads three.js r128 from cdnjs and fonts from Google Fonts, plus the files in `assets/`.
- `assets/micro-fields.js`: the microstructure fields (PNG data URIs, so they also work when the page is opened from disk). Regenerate with `python3 tools/make_micro_fields.py` (needs numpy, scipy, Pillow; about a minute; fixed random seed).
- `assets/micrographs/`: the real micrographs and `SOURCES.md` with their credits and licences.
- `tests/`: browser tests in headless Chrome. Once: `cd tests && npm install`. Then `npm test` runs all five suites (Learn mode first; the others open the page with `?mode=explore`) against `../index.html` (lessons, interaction, phase-diagram numbers, navigation/layout, no-WebGL fallback); `npm run audit` writes screenshots of every tab and every Explore setup to `tests/out/`. Pass a URL to test the live site, e.g. `node ui-test.js https://curiositaslabs.github.io/es192-crystal-lab/`.
- GitHub Pages caches the page for 10 minutes. After a deploy, open it with a new `?v=` number (for example `…/es192-crystal-lab/?v=5#phase`) or hard-refresh (⌘⇧R).
