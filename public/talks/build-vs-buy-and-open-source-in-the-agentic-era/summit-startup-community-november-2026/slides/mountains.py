"""Generate low-poly mountain SVGs for the deck.

Each mountain is a triangular lattice: row 0 is the peak, row n is the
base. Points jitter a little so facets look hand-cut. Facet shade comes
from where the facet sits relative to the peak (light from the left) plus
a little noise; top rows get snow.
"""

import colorsys
import random
import sys


def hex_to_hls(h):
    h = h.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)


def hls_to_hex(hls):
    h, l, s = hls
    l = max(0.0, min(1.0, l))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02x%02x%02x" % tuple(round(c * 255) for c in (r, g, b))


def mountain(rng, px, py, x0, x1, base, rows, color, snow_rows, snow):
    """Return [(points, fill)] facets for one mountain."""
    lattice = []
    for i in range(rows + 1):
        t = i / rows
        y = py + (base - py) * t
        left = px + (x0 - px) * t
        right = px + (x1 - px) * t
        row = []
        for j in range(i + 1):
            x = left + (right - left) * (j / i if i else 0.5)
            jx = jy = 0.0
            if 0 < i < rows:
                span = (x1 - x0) / rows
                jy = rng.uniform(-0.18, 0.18) * (base - py) / rows
                if 0 < j < i:
                    jx = rng.uniform(-0.3, 0.3) * span
            if i == rows:
                y = base
            row.append((x + jx, y + jy))
        lattice.append(row)

    base_hls = hex_to_hls(color)
    snow_hls = hex_to_hls(snow)
    facets = []
    for i in range(rows):
        a, b = lattice[i], lattice[i + 1]
        tris = []
        for j in range(i + 1):
            tris.append((a[j], b[j], b[j + 1]))
            if j < i:
                tris.append((a[j], b[j + 1], a[j + 1]))
        for tri in tris:
            cx = sum(p[0] for p in tri) / 3
            side = (cx - px) / max(1.0, (x1 - x0) / 2)  # -1 left .. 1 right
            src = snow_hls if i < snow_rows else base_hls
            light = src[1] + 0.07 * -side + rng.uniform(-0.035, 0.035)
            if i >= snow_rows:
                light -= 0.04 * (i / rows)
            fill = hls_to_hex((src[0], light, src[2]))
            facets.append((tri, fill))
    # Silhouette: up the left edge to the peak, down the right edge.
    outline = [row[0] for row in reversed(lattice)] + [row[-1] for row in lattice[1:]]
    return facets, outline


def svg(width, height, ranges, seed):
    rng = random.Random(seed)
    out = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'preserveAspectRatio="xMidYMax slice" aria-hidden="true">'
    ]
    for r in ranges:
        for px, py, half in r["peaks"]:
            facets, outline = mountain(
                rng,
                px,
                py,
                px - half * rng.uniform(0.9, 1.1),
                px + half * rng.uniform(0.9, 1.1),
                height,
                r["rows"],
                r["color"],
                r.get("snow_rows", 0),
                r.get("snow", "#ffffff"),
            )
            for tri, fill in facets:
                pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in tri)
                # Matching stroke hides hairline seams between facets.
                out.append(
                    f'<polygon points="{pts}" fill="{fill}" stroke="{fill}" '
                    f'stroke-width="0.8" stroke-linejoin="round"/>'
                )
            if "outline" in r:
                # A thin ridge line so pale summits stand off the sky.
                pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in outline)
                out.append(
                    f'<polyline points="{pts}" fill="none" stroke="{r["outline"]}" '
                    f'stroke-width="{r.get("outline_width", 2)}" stroke-linejoin="round" '
                    f'stroke-linecap="round"/>'
                )
    out.append("</svg>")
    return "\n".join(out) + "\n"


# Palette: white, light blues, navy.
BACK = "#b4cdec"
MID = "#7fa6d6"
FRONT = "#1f3a6b"
SNOW_BACK = "#f2f7fd"
SNOW = "#eef4fb"

TITLE = dict(
    width=1600,
    height=560,
    seed=7,
    ranges=[
        dict(
            color=BACK,
            rows=5,
            snow_rows=1,
            snow=SNOW_BACK,
            outline="#8fb0da",
            peaks=[(140, 170, 330), (560, 70, 380), (1010, 130, 360), (1450, 40, 400)],
        ),
        dict(
            color=MID,
            rows=5,
            snow_rows=1,
            snow=SNOW,
            outline="#4f78b0",
            peaks=[(-40, 250, 300), (360, 190, 330), (820, 230, 340), (1240, 170, 360), (1660, 260, 300)],
        ),
        dict(
            color=FRONT,
            rows=4,
            snow_rows=1,
            snow="#dfe9f6",
            outline="#16294d",
            peaks=[(120, 380, 300), (560, 330, 320), (1000, 400, 300), (1400, 350, 320)],
        ),
    ],
)

RIDGE = dict(
    width=1600,
    height=160,
    seed=11,
    ranges=[
        dict(
            color="#dbe7f5",
            rows=3,
            snow_rows=0,
            peaks=[(80, 50, 220), (420, 20, 260), (800, 60, 240), (1180, 10, 260), (1540, 45, 240)],
        ),
        dict(
            color="#a9c3e4",
            rows=3,
            snow_rows=0,
            peaks=[(250, 85, 200), (640, 95, 210), (1000, 75, 220), (1380, 90, 220)],
        ),
    ],
)

# Navy-on-navy variant for divider slides.
DIVIDER = dict(
    width=1600,
    height=200,
    seed=5,
    ranges=[
        dict(
            color="#2b4c86",
            rows=3,
            snow_rows=1,
            snow="#5f82b8",
            peaks=[(100, 40, 260), (520, 10, 280), (950, 50, 260), (1380, 20, 280)],
        ),
        dict(
            color="#16294d",
            rows=3,
            snow_rows=0,
            peaks=[(300, 100, 240), (760, 90, 250), (1180, 110, 240), (1620, 95, 240)],
        ),
    ],
)

if __name__ == "__main__":
    outdir = sys.argv[1]
    for name, spec in [("mountains-title", TITLE), ("mountains-ridge", RIDGE), ("mountains-divider", DIVIDER)]:
        with open(f"{outdir}/{name}.svg", "w") as f:
            f.write(svg(**spec))
