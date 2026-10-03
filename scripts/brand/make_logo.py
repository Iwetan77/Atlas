# Atlas mark: a white planet with a tilted orbit ring and a small moon, on Atlas pink.
from PIL import Image, ImageDraw, ImageFilter

PINK = (255, 46, 126)
PINK_LIGHT = (255, 120, 170)
WHITE = (255, 255, 255)
SHADE = (255, 228, 238)

def gradient(size, top, bottom):
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x * 0.35 + y * 0.65) / size  # light from the top left
            px[x, y] = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return g

def mark(size, scale=1.0, ring_gap=PINK):
    """The planet and ring on a transparent square of `size`, drawn 4x then reduced."""
    S = size * 4
    c = S / 2
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    r = 0.235 * S * scale              # planet radius
    rw, rh = 0.45 * S * scale, 0.15 * S * scale   # ring half-axes
    stroke = 0.042 * S * scale
    angle = -22

    def ring(color, width):
        im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([c - rw, c - rh, c + rw, c + rh], outline=color, width=int(width))
        return im

    def halves(im):
        top = im.copy(); bottom = im.copy()
        ImageDraw.Draw(top).rectangle([0, c, S, S], fill=(0, 0, 0, 0))
        ImageDraw.Draw(bottom).rectangle([0, 0, S, c], fill=(0, 0, 0, 0))
        return top.rotate(angle, resample=Image.BICUBIC, center=(c, c)), bottom.rotate(angle, resample=Image.BICUBIC, center=(c, c))

    back, front = halves(ring(WHITE + (255,), stroke))
    # A pink border under the front of the ring separates it from the planet.
    _, front_gap = halves(ring(ring_gap + (255,) if ring_gap else (0, 0, 0, 0), stroke * 1.75))

    planet = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(planet)
    d.ellipse([c - r, c - r, c + r, c + r], fill=WHITE + (255,))
    # Soft shade on the lower right for a little depth.
    shade = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(shade).ellipse([c - r * 0.55, c - r * 0.55, c + r * 1.35, c + r * 1.35], fill=SHADE + (255,))
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).ellipse([c - r, c - r, c + r, c + r], fill=255)
    shade_mask = Image.composite(shade.split()[3], Image.new('L', (S, S), 0), mask).filter(ImageFilter.GaussianBlur(S * 0.03))
    planet.paste(Image.new('RGBA', (S, S), SHADE + (255,)), (0, 0), Image.eval(shade_mask, lambda v: int(v * 0.6)))

    # The moon sits on the ring's far side, upper right, turned with the ring (PIL turns
    # counterclockwise on screen by `angle`).
    import math
    theta = math.radians(-38)
    dx, dy = rw * math.cos(theta), rh * math.sin(theta)
    phi = math.radians(angle)
    mx = c + dx * math.cos(phi) + dy * math.sin(phi)
    my = c - dx * math.sin(phi) + dy * math.cos(phi)
    moon = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    mr = 0.05 * S * scale
    ImageDraw.Draw(moon).ellipse([mx - mr, my - mr, mx + mr, my + mr], fill=WHITE + (255,))

    # The separating edge only matters where the ring crosses the planet.
    gap_mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(gap_mask).ellipse([c - r * 1.02, c - r * 1.02, c + r * 1.02, c + r * 1.02], fill=255)
    front_gap.putalpha(Image.composite(front_gap.split()[3], Image.new('L', (S, S), 0), gap_mask))
    for part in (back, planet, front_gap, front, moon):
        layer.alpha_composite(part)
    return layer.resize((size, size), Image.LANCZOS)

def icon(size=1024):
    bg = gradient(size, PINK_LIGHT, PINK).convert('RGBA')
    bg.alpha_composite(mark(size))
    return bg

if __name__ == '__main__':
    big = icon(1024)
    big.save('icon.png')
    # Preview: the icon, rounded like a phone shows it, at a few sizes on dark and light.
    prev = Image.new('RGB', (1500, 560), (41, 44, 51))
    rounded = Image.new('L', (1024, 1024), 0)
    ImageDraw.Draw(rounded).rounded_rectangle([0, 0, 1023, 1023], radius=230, fill=255)
    shown = big.copy(); shown.putalpha(rounded)
    x = 40
    for s in (440, 220, 120, 60):
        prev.paste(shown.resize((s, s), Image.LANCZOS), (x, 60 + (440 - s) // 2), shown.resize((s, s), Image.LANCZOS))
        x += s + 60
    prev.save('preview.png')
    print('ok')
