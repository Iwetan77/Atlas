from PIL import Image, ImageDraw, ImageFont
from make_logo import icon, mark, gradient, PINK, PINK_LIGHT
import os
out = 'scripts/brand/out'; os.makedirs(out, exist_ok=True)

def rounded(im, radius_ratio=0.225):
    m = Image.new('L', im.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, im.size[0]-1, im.size[1]-1], radius=int(im.size[0]*radius_ratio), fill=255)
    r = im.copy(); r.putalpha(m); return r

full = icon(1024); full.save(f'{out}/icon.png')                       # app icon (iOS/Android legacy)
full.save(f'{out}/atlas-icon.png')                                     # web apple-touch-icon + manifest
# Android adaptive: the mark inside the safe zone on transparent, over a pink background.
fg = Image.new('RGBA', (512, 512), (0, 0, 0, 0)); fg.alpha_composite(mark(512, scale=0.62)); fg.save(f'{out}/android-icon-foreground.png')
gradient(512, PINK_LIGHT, PINK).convert('RGBA').save(f'{out}/android-icon-background.png')
# Themed (one-colour) icon: white where the mark is, the gap cut out.
mono_src = mark(432, scale=0.62, ring_gap=(0, 0, 0))
px = mono_src.load(); mono = Image.new('RGBA', (432, 432), (0, 0, 0, 0)); mp = mono.load()
for y in range(432):
    for x in range(432):
        r, g, b, a = px[x, y]
        mp[x, y] = (255, 255, 255, int(a * min(r, g, b) / 255) if a else 0)
mono.save(f'{out}/android-icon-monochrome.png')
rounded(icon(456)).save(f'{out}/splash-icon.png')                    # splash: the rounded icon on the dark splash
rounded(icon(192)).resize((48, 48), Image.LANCZOS).save(f'{out}/favicon.png')

# Link preview card, 1200x630: the icon, the name and the line.
card = Image.new('RGBA', (1200, 630), (41, 44, 51, 255))
glow = Image.new('RGBA', (1200, 630), (0, 0, 0, 0))
ImageDraw.Draw(glow).ellipse([-120, -40, 620, 700], fill=(255, 46, 126, 70)); glow = glow.filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(120))
card.alpha_composite(glow)
card.alpha_composite(rounded(icon(300)), (110, 165))
d = ImageDraw.Draw(card)
d.text((470, 190), 'Atlas', font=ImageFont.truetype('node_modules/@expo-google-fonts/space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf', 120), fill=(255, 255, 255))
d.text((474, 340), 'One balance. Your world.', font=ImageFont.truetype('node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf', 44), fill=(180, 182, 196))
d.text((474, 405), 'Stocks, crypto, savings and sends in one app.', font=ImageFont.truetype('node_modules/@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf', 30), fill=(255, 138, 181))
card.convert('RGB').save(f'{out}/og.png', quality=92)
print('done', sorted(os.listdir(out)))
