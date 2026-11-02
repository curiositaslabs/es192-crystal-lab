"""Generate the microstructure fields used by the phase-diagram tab (writes assets/micro-fields.js).

Each field is a 384 x 384, tileable, 8-bit greyscale image, stored as a PNG data URI so the page can read the
pixels even when it is opened from disk. The page draws a micrograph for any point on a phase diagram by
thresholding these fields at the lever-rule fractions, so as the temperature falls the same structure grows
continuously, the way it does in a real casting or heat treatment.

  dArr  dendritic solidification: rank of the time each pixel froze (0 = first). Kobayashi (1993) phase-field
        model, several equiaxed dendrites with random <100> orientations, then the last interdendritic liquid.
  dOwn  which dendrite (grain) each pixel belongs to.
  eLam  lamellar eutectic: Swift-Hohenberg stripes seeded as colonies (rank-normalised, so a threshold at
        the phase's area fraction gives that fraction).
  sOwn  prior-austenite grains of the steel (index).
  sGb   order in which proeutectoid ferrite reaches each pixel: allotriomorphs nucleated along the
        austenite grain boundaries (rank-normalised).
  sGbd  plain distance from the austenite grain boundaries (rank): the proeutectoid cementite film.
  sFOwn which ferrite grain (nucleus) each pixel belongs to.
  sCol  pearlite colony index.
  sLam  pearlite lamellae: Swift-Hohenberg stripes seeded with one orientation per colony (rank).
  sTw   annealing twins in the austenite grains (255 inside a twin band).
  lSp   ledeburite (the iron-cementite eutectic): rows of rounded austenite islands in cementite, one row
        direction per colony (rank-normalised).
  cNd   primary cementite plates of a hypereutectic cast iron: distance from a set of long, thin plates (rank).

Usage, from the repo root:  python3 tools/make_micro_fields.py      (needs numpy, scipy, Pillow; ~1 min)
"""
import base64
import io
import os
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = 384
rng = np.random.default_rng(20261030)


def rank(a):
    """Rank-normalise to 0..255 so a threshold at f*255 selects the fraction f of the pixels."""
    flat = a.ravel()
    order = np.argsort(flat, kind="stable")
    r = np.empty_like(order)
    r[order] = np.arange(flat.size)
    return (r * 256 // flat.size).clip(0, 255).astype(np.uint8).reshape(a.shape)


def lap(f):
    return np.roll(f, 1, 0) + np.roll(f, -1, 0) + np.roll(f, 1, 1) + np.roll(f, -1, 1) - 4 * f


def grad(f):
    return (np.roll(f, -1, 1) - np.roll(f, 1, 1)) / 2, (np.roll(f, -1, 0) - np.roll(f, 1, 0)) / 2


def periodic_voronoi(pts, n=N):
    """Index of the nearest point (periodic box) and the distances to the nearest and second-nearest."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    d1 = np.full((n, n), 1e9, np.float32)
    d2 = np.full((n, n), 1e9, np.float32)
    own = np.zeros((n, n), np.int32)
    for k, (px, py) in enumerate(pts):
        dx = np.abs(xx - px); dx = np.minimum(dx, n - dx)
        dy = np.abs(yy - py); dy = np.minimum(dy, n - dy)
        d = np.hypot(dx, dy)
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        own = np.where(closer, k, own)
        d1 = np.where(closer, d, d1)
    return own, d1, d2


def smooth_noise(scale, amp=1.0):
    z = rng.standard_normal((N, N))
    z = ndimage.gaussian_filter(z, scale, mode="wrap")
    return z / z.std() * amp


def warp(ix, iy, scale, amp):
    """Smoothly displaced coordinates, for natural (slightly curved) boundaries."""
    return (ix + smooth_noise(scale, amp)) % N, (iy + smooth_noise(scale, amp)) % N


def lloyd(pts, iters=2):
    for _ in range(iters):
        own, _, _ = periodic_voronoi(pts)
        yy, xx = np.mgrid[0:N, 0:N]
        new = []
        for k, (px, py) in enumerate(pts):
            m = own == k
            if not m.any():
                new.append((px, py)); continue
            # periodic mean: unwrap around the current point
            dx = (xx[m] - px + N / 2) % N - N / 2
            dy = (yy[m] - py + N / 2) % N - N / 2
            new.append(((px + dx.mean()) % N, (py + dy.mean()) % N))
        pts = new
    return pts


def own_from_warped(pts, scale=18, amp=5):
    """Voronoi grains whose boundaries are gently curved (nearest seed measured in warped coordinates)."""
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    wx, wy = warp(xx, yy, scale, amp)
    own = np.zeros((N, N), np.int32)
    d1 = np.full((N, N), 1e9, np.float32)
    for k, (px, py) in enumerate(pts):
        dx = np.abs(wx - px); dx = np.minimum(dx, N - dx)
        dy = np.abs(wy - py); dy = np.minimum(dy, N - dy)
        d = np.hypot(dx, dy)
        c = d < d1
        own = np.where(c, k, own); d1 = np.where(c, d, d1)
    return own


def boundary_mask(own):
    b = np.zeros(own.shape, bool)
    for ax in (0, 1):
        for s in (1, -1):
            b |= own != np.roll(own, s, ax)
    return b


def periodic_edt(mask):
    """Distance to the nearest True pixel, periodic (tile 3x3, measure, take the centre)."""
    big = np.tile(~mask, (3, 3))
    d = ndimage.distance_transform_edt(big)
    return d[N:2 * N, N:2 * N]


def png_uri(a):
    buf = io.BytesIO()
    Image.fromarray(a.astype(np.uint8), "L").save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ------------------------------------------------------------------ dendrites (Kobayashi 1993 phase field)
def dendrites(nseed=9, steps=5200):
    tau, eps_b, delta, aniso, alpha, gamma, K = 3e-4, 0.010, 0.05, 4, 0.9, 10.0, 1.6
    dx, dt = 0.03, 1.2e-4
    pts = lloyd([(rng.uniform(0, N), rng.uniform(0, N)) for _ in range(nseed)], 1)
    own0, _, _ = periodic_voronoi(pts)
    th0 = rng.uniform(0, np.pi / 2, nseed)[own0]          # <100> growth directions, one per grain
    phi = np.zeros((N, N)); T = np.zeros((N, N))
    yy, xx = np.mgrid[0:N, 0:N]
    for (px, py) in pts:
        ddx = np.minimum(np.abs(xx - px), N - np.abs(xx - px)); ddy = np.minimum(np.abs(yy - py), N - np.abs(yy - py))
        phi[np.hypot(ddx, ddy) < 3] = 1.0
    arr = np.full((N, N), np.inf); arr[phi > 0.5] = 0
    noise_amp = 0.01
    for it in range(1, steps + 1):
        gx, gy = grad(phi)
        gx /= dx; gy /= dx
        theta = np.arctan2(gy, gx)
        eps = eps_b * (1 + delta * np.cos(aniso * (theta - th0)))
        deps = -eps_b * aniso * delta * np.sin(aniso * (theta - th0))
        a1 = eps * deps * gx; a2 = eps * deps * gy
        term1 = (np.roll(a1, -1, 0) - np.roll(a1, 1, 0)) / (2 * dx)   # d/dy (eps eps' dphi/dx)
        term2 = -(np.roll(a2, -1, 1) - np.roll(a2, 1, 1)) / (2 * dx)  # -d/dx (eps eps' dphi/dy)
        m = alpha / np.pi * np.arctan(gamma * (1.0 - T))
        lp = lap(phi) / dx ** 2
        new = phi + dt / tau * (term1 + term2 + eps ** 2 * lp + phi * (1 - phi) * (phi - 0.5 + m)
                                + noise_amp * phi * (1 - phi) * (rng.random((N, N)) - 0.5))
        T = T + dt * lap(T) / dx ** 2 + K * (new - phi)
        phi = new
        newly = (phi > 0.5) & np.isinf(arr)
        arr[newly] = it
        if it % 800 == 0:
            print("  dendrites step", it, "solid", round(float((phi > 0.5).mean()), 3), file=sys.stderr)
    solid = np.isfinite(arr)
    # last liquid: freezes in order of distance from the solid (interdendritic liquid freezes last)
    d = periodic_edt(solid)
    tmax = arr[solid].max()
    arr = np.where(solid, arr, tmax + d * (tmax / 40.0))
    # owner: walk the pixels in order of freezing; each takes the grain of its earliest-frozen neighbour
    own = np.full(N * N, -1, np.int32)
    flat = arr.ravel()
    order = np.argsort(flat, kind="stable")
    seeds_idx = [int(round(py)) % N * N + int(round(px)) % N for (px, py) in pts]
    for k, s in enumerate(seeds_idx):
        own[s] = k
    nb = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for p in order:
        if own[p] >= 0:
            continue
        y, x = divmod(int(p), N)
        best, bt = -1, np.inf
        for oy, ox in nb:
            q = ((y + oy) % N) * N + (x + ox) % N
            if own[q] >= 0 and flat[q] < bt:
                bt, best = flat[q], own[q]
        own[p] = best if best >= 0 else own0.ravel()[p]
    return rank(arr), own.reshape(N, N).astype(np.uint8)


# ------------------------------------------------------------------ lamellae (Swift-Hohenberg, seeded colonies)
def lamellae(colony, lam, steps, r=0.35, curl=10.0):
    """Stripes of period `lam` px; each colony starts with its own orientation, then the pattern relaxes."""
    ncol = int(colony.max()) + 1
    th = rng.uniform(0, np.pi, ncol)[colony]
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float64)
    wx, wy = warp(xx, yy, 30, curl)                       # gentle bending of the lamellae
    q0 = 2 * np.pi / lam
    u = 0.6 * np.cos(q0 * (wx * np.cos(th) + wy * np.sin(th)) + rng.uniform(0, 6.28, ncol)[colony])
    u += 0.05 * rng.standard_normal((N, N))
    k = 2 * np.pi * np.fft.fftfreq(N)
    k2 = k[None, :] ** 2 + k[:, None] ** 2
    L = r - (q0 ** 2 - k2) ** 2
    dt = 0.5
    for _ in range(steps):
        nl = np.fft.fft2(-u ** 3)
        u = np.real(np.fft.ifft2((np.fft.fft2(u) + dt * nl) / (1 - dt * L)))
    return u


def ledeburite(lam=13.0, ncol=12):
    """Rod-type eutectic seen in section: rows of rounded, slightly elongated austenite islands in cementite.
    Each colony has its own row direction; returns a distance-like field (small = inside an island)."""
    cpts = lloyd([(rng.uniform(0, N), rng.uniform(0, N)) for _ in range(ncol)], 1)
    col = own_from_warped(cpts, 22, 8)
    th = rng.uniform(0, np.pi, ncol)
    f = np.full((N, N), 1e9, np.float32)
    c0 = N / 2
    for c in range(ncol):
        t0 = th[c]
        for gv in np.arange(-N, N, lam * 0.9):
            for gu in np.arange(-N, N, lam):
                u0 = gu + (round(gv / (lam * 0.9)) % 2) * lam / 2
                cx = c0 + u0 * np.cos(t0) - gv * np.sin(t0) + rng.normal(0, lam * 0.15)
                cy = c0 + u0 * np.sin(t0) + gv * np.cos(t0) + rng.normal(0, lam * 0.15)
                if not (0 <= cx < N and 0 <= cy < N) or col[int(cy), int(cx)] != c:
                    continue
                t = t0 + rng.normal(0, 0.15)
                a, b = lam * rng.uniform(0.35, 0.95), lam * rng.uniform(0.26, 0.4)
                R = int(a * 2.2) + 2
                X, Y = np.meshgrid(np.arange(int(cx) - R, int(cx) + R + 1), np.arange(int(cy) - R, int(cy) + R + 1))
                dx, dy = X - cx, Y - cy
                uu = dx * np.cos(t) + dy * np.sin(t); vv = -dx * np.sin(t) + dy * np.cos(t)
                d = np.sqrt((uu / a) ** 2 + (vv / b) ** 2).astype(np.float32)
                Xi, Yi = X % N, Y % N
                f[Yi, Xi] = np.minimum(f[Yi, Xi], d)
    return np.minimum(f, 3.0)


def plates(n, lmin, lmax):
    """Distance (periodic) from n straight plates of random length and direction."""
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    d = np.full((N, N), 1e9, np.float32)
    for _ in range(n):
        cx, cy, a, l = rng.uniform(0, N), rng.uniform(0, N), rng.uniform(0, np.pi), rng.uniform(lmin, lmax)
        ux, uy = np.cos(a), np.sin(a)
        dx = (xx - cx + N / 2) % N - N / 2; dy = (yy - cy + N / 2) % N - N / 2
        t = np.clip(dx * ux + dy * uy, -l / 2, l / 2)
        d = np.minimum(d, np.hypot(dx - t * ux, dy - t * uy))
    return d


def twins(own, ngr):
    """One or two straight, parallel-sided annealing-twin bands across some of the grains."""
    tw = np.zeros((N, N), np.uint8)
    yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
    for g in range(ngr):
        m = own == g
        if not m.any() or rng.random() > 0.65:
            continue
        a = rng.uniform(0, np.pi)
        ys, xs = np.nonzero(m)
        # unwrap the grain around one of its pixels
        cx0, cy0 = xs[0], ys[0]
        ux = (xs - cx0 + N / 2) % N - N / 2 + cx0; uy = (ys - cy0 + N / 2) % N - N / 2 + cy0
        proj = ux * np.cos(a) + uy * np.sin(a)
        lo, hi = proj.min(), proj.max()
        for _ in range(rng.integers(1, 3)):
            w = rng.uniform(3, 11)
            c = rng.uniform(lo + 0.2 * (hi - lo), hi - 0.2 * (hi - lo))
            sel = (proj > c - w / 2) & (proj < c + w / 2)
            tw[ys[sel], xs[sel]] = 255
    return tw


def main():
    out = {}
    print("dendrites...", file=sys.stderr)
    out["dArr"], out["dOwn"] = dendrites()

    print("eutectic lamellae...", file=sys.stderr)
    cpts = lloyd([(rng.uniform(0, N), rng.uniform(0, N)) for _ in range(18)], 1)
    ecol = own_from_warped(cpts, 22, 8)
    out["eLam"] = rank(lamellae(ecol, lam=7.0, steps=30, curl=9.0))

    print("steel grains...", file=sys.stderr)
    gpts = lloyd([(rng.uniform(0, N), rng.uniform(0, N)) for _ in range(20)], 3)
    sown = own_from_warped(gpts, 20, 4)
    out["sOwn"] = sown.astype(np.uint8)
    gb = boundary_mask(sown)
    dgb = periodic_edt(gb)
    out["sGbd"] = rank(dgb + 0.6 * smooth_noise(3, 1.0))
    # ferrite allotriomorphs: nuclei sit on the boundaries (more at triple junctions); each grows along the
    # boundary faster than into the grain, so the ferrite forms lens-shaped grains that line the boundaries
    ys, xs = np.nonzero(gb)
    pick = rng.choice(len(xs), 150, replace=False)
    nuc = [(float(xs[i]), float(ys[i])) for i in pick]
    fown, dn, _ = periodic_voronoi(nuc)
    out["sFOwn"] = fown.astype(np.uint8)
    out["sGb"] = rank(dgb + 0.45 * dn + 2.2 * smooth_noise(6, 1.0))
    # pearlite colonies: about three per austenite grain, each confined to its grain
    ppts = [(rng.uniform(0, N), rng.uniform(0, N)) for _ in range(64)]
    pown, _, _ = periodic_voronoi(ppts)
    col = (sown * 64 + pown)
    _, col = np.unique(col, return_inverse=True)
    col = col.reshape(N, N)
    out["sCol"] = (col % 256).astype(np.uint8)
    out["sLam"] = rank(lamellae(col, lam=5.0, steps=25, curl=5.0))
    out["sTw"] = twins(sown, len(gpts))

    print("cast iron...", file=sys.stderr)
    out["lSp"] = rank(ledeburite() + 0.04 * smooth_noise(2, 1.0))
    out["cNd"] = rank(plates(14, 120, 300) + 0.8 * smooth_noise(3, 1.0))

    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    path = os.path.join(ROOT, "assets", "micro-fields.js")
    with open(path, "w") as f:
        f.write("/* Generated by tools/make_micro_fields.py: microstructure fields for the phase-diagram tab. */\n")
        f.write("window.MICRO_FIELDS = { N: %d, f: {\n" % N)
        f.write(",\n".join('  %s: "%s"' % (k, png_uri(v)) for k, v in out.items()))
        f.write("\n} };\n")
    if len(sys.argv) > 1:   # optional preview directory
        for k, v in out.items():
            Image.fromarray(v.astype(np.uint8), "L").save(os.path.join(sys.argv[1], k + ".png"))
    print("wrote", os.path.relpath(path, ROOT), os.path.getsize(path) // 1024, "KB", file=sys.stderr)


if __name__ == "__main__":
    main()
