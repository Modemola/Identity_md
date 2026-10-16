import math, random, sys
out = sys.argv[1]
GREEN = "#3ecf7a"

def ring(cx, cy, r, color, n=56, seed=7):
    """The swarm: a sparse orbit of agents, denser on one side, as if circling the seal."""
    rnd = random.Random(seed)
    dots = []
    for i in range(n):
        a = (i / n) * 2 * math.pi + rnd.uniform(-0.04, 0.04)
        # leave two small gaps so it reads as moving agents, not a dotted border
        if 0.18 < (a % (2 * math.pi)) < 0.42 or 3.3 < a < 3.5:
            continue
        rr = r + rnd.uniform(-7, 7)
        size = rnd.choice([3.2, 4, 4.8, 6]) * (1.25 if math.sin(a + 0.8) > 0.55 else 1)
        op = round(rnd.uniform(0.45, 1), 2)
        dots.append(f'<circle cx="{cx + rr*math.cos(a):.1f}" cy="{cy + rr*math.sin(a):.1f}" r="{size/2:.2f}" fill="{color}" opacity="{op}"/>')
    return "\n    ".join(dots)

def seal(ink, check, cx=256, cy=256, s=236, w=22):
    h = s / 2
    # check drawn in the square's own geometry: short leg, long leg, mitred joint
    p = f"M{cx-62} {cy+6} L{cx-18} {cy+50} L{cx+66} {cy-46}"
    return (f'<rect x="{cx-h}" y="{cy-h}" width="{s}" height="{s}" fill="none" stroke="{ink}" stroke-width="{w}" stroke-linejoin="miter"/>\n'
            f'    <path d="{p}" fill="none" stroke="{check}" stroke-width="{w+6}" stroke-linecap="square" stroke-linejoin="miter"/>')

def svg(body, w=512, h=512, bg=None, extra=""):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">
  {extra}{b}
  <g>
    {body}
  </g>
</svg>
'''

files = {}
# 1. the mark, for light backgrounds
files["kept-mark.svg"] = svg(seal("#000", GREEN) + "\n    " + ring(256, 256, 206, "#000"))
# 2. the mark, for dark backgrounds
files["kept-mark-dark.svg"] = svg(seal("#fff", GREEN) + "\n    " + ring(256, 256, 206, "#fff"), bg="#000")
# 3. avatar: tight crop on a black tile, legible at 32px (no ring: too fine at that size)
files["kept-avatar.svg"] = svg(seal("#fff", GREEN, s=270, w=30), bg="#000")
# 4. stamp: rotated, inked texture, like the KEPT stamp on the site
stamp_filter = '''<defs><filter id="ink" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="5"/>
    <feComponentTransfer><feFuncA type="discrete" tableValues="0 1 1 1"/></feComponentTransfer>
  </filter></defs>
  '''
files["kept-stamp.svg"] = svg(f'<g transform="rotate(-8 256 256)" filter="url(#ink)">' + seal(GREEN, GREEN) + "\n    " + ring(256, 256, 206, GREEN) + "</g>", extra=stamp_filter)
# 5. horizontal lockup: mark + wordmark (IBM Plex Mono, tracked wide)
def lockup(ink, bg):
    mark = f'<g transform="translate(0 0) scale(0.5)">' + seal(ink, GREEN) + "\n    " + ring(256, 256, 206, ink) + "</g>"
    word = f'<text x="300" y="158" font-family="IBM Plex Mono, ui-monospace, monospace" font-weight="500" font-size="92" letter-spacing="29" fill="{ink}">KEPT</text>'
    tag = f'<text x="304" y="200" font-family="IBM Plex Mono, ui-monospace, monospace" font-weight="400" font-size="19" letter-spacing="3.2" fill="{ink}" opacity="0.6">PROMISES THE SWARM ENFORCES</text>'
    return svg(mark + "\n    " + word + "\n    " + tag, w=880, h=256, bg=bg)
files["kept-logo.svg"] = lockup("#000", None)
files["kept-logo-dark.svg"] = lockup("#fff", "#000")
for name, s in files.items():
    open(f"{out}/{name}", "w").write(s)
print("\n".join(files))
