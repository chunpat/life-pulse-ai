from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1] / 'public'
ROOT.mkdir(parents=True, exist_ok=True)

BG_TOP = (251, 191, 36, 255)
BG_MID = (245, 158, 11, 255)
BG_BOTTOM = (180, 83, 9, 255)
GLOW = (253, 230, 138, 150)
CREAM = (255, 247, 237, 245)
BOLT = (120, 53, 15, 255)
SPARK_OUTER = (254, 243, 199, 255)
SPARK_INNER = (245, 158, 11, 255)


def lerp(a: int, b: int, t: float) -> int:
    return int(round(a + (b - a) * t))


def gradient_color(t: float) -> tuple[int, int, int, int]:
    if t < 0.55:
        local = t / 0.55
        start, end = BG_TOP, BG_MID
    else:
        local = (t - 0.55) / 0.45
        start, end = BG_MID, BG_BOTTOM
    return tuple(lerp(start[i], end[i], local) for i in range(4))


def make_icon(size: int) -> Image.Image:
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(size * 0.235)
    inset = int(size * 0.047)
    mask_draw.rounded_rectangle((inset, inset, size - inset, size - inset), radius=radius, fill=255)

    gradient = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    grad_px = gradient.load()
    for y in range(size):
      color = gradient_color(y / max(size - 1, 1))
      for x in range(size):
        grad_px[x, y] = color
    image.paste(gradient, (0, 0), mask)

    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse(
        (
            int(size * 0.04),
            int(size * -0.02),
            int(size * 0.72),
            int(size * 0.66),
        ),
        fill=GLOW,
    )
    glow = glow.filter(ImageFilter.GaussianBlur(radius=max(4, size // 32)))
    image = Image.alpha_composite(
        image,
        Image.composite(glow, Image.new('RGBA', (size, size), (0, 0, 0, 0)), mask),
    )

    circle_r = int(size * 0.285)
    cx = cy = size // 2
    circle_bbox = (cx - circle_r, cy - circle_r, cx + circle_r, cy + circle_r)

    shadow = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.ellipse(
        (
            circle_bbox[0],
            circle_bbox[1] + int(size * 0.014),
            circle_bbox[2],
            circle_bbox[3] + int(size * 0.014),
        ),
        fill=(120, 53, 15, 36),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(3, size // 48)))
    image = Image.alpha_composite(image, shadow)

    draw = ImageDraw.Draw(image)
    draw.ellipse(circle_bbox, fill=CREAM)

    bolt_points = [
        (0.430, 0.336),
        (0.392, 0.455),
        (0.475, 0.455),
        (0.405, 0.648),
        (0.612, 0.465),
        (0.522, 0.465),
        (0.598, 0.305),
    ]
    bolt = [(int(size * x), int(size * y)) for x, y in bolt_points]
    draw.polygon(bolt, fill=BOLT)

    outer_r = int(size * 0.047)
    inner_r = int(size * 0.020)
    ox = int(size * 0.707)
    oy = int(size * 0.324)
    draw.ellipse((ox - outer_r, oy - outer_r, ox + outer_r, oy + outer_r), fill=SPARK_OUTER)
    draw.ellipse((ox - inner_r, oy - inner_r, ox + inner_r, oy + inner_r), fill=SPARK_INNER)

    return image


def main() -> None:
    for filename, size in [('apple-touch-icon.png', 180), ('pwa-192x192.png', 192), ('pwa-512x512.png', 512)]:
        make_icon(size).save(ROOT / filename)

    favicon = make_icon(256)
    favicon.save(ROOT / 'favicon.ico', format='ICO', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])

    print('ICONS_GENERATED')
    for name in ['apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png', 'favicon.ico']:
        print(name, (ROOT / name).stat().st_size)


if __name__ == '__main__':
    main()