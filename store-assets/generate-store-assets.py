#!/usr/bin/env python3
"""Generate all image assets for Playlist Warden (extension icons + store art).

Extension icons follow the Chrome Web Store spec: 128x128 canvas with the
artwork at 96x96 (16px transparent padding per side). All other sizes are
LANCZOS downscales of one 4096px master, so every target stays crisp.

Usage: python3 store-assets/generate-store-assets.py
Outputs:
  extension/public/icons/icon-{16,32,48,96,128}.png   (manifest icons)
  store-assets/promo-small-440x280.png                (CWS, required)
  store-assets/promo-marquee-1400x560.png             (CWS, optional)
"""

from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "extension" / "public" / "icons"
ASSETS_DIR = ROOT / "store-assets"

BG_TOP = (26, 32, 38, 255)       # artwork squircle, gradient top
BG_BOT = (13, 17, 21, 255)       # gradient bottom
BAR = (238, 242, 245, 235)       # playlist bars
THUMB = (46, 54, 62, 255)        # row thumbnail tiles
ACCENT = (0, 212, 170, 255)      # martjn teal — the "flagged" row
PLAY = (240, 248, 246, 255)      # play triangle inside the accent thumb

MASTER = 4096
ARTWORK = 3072                    # 96/128 of the canvas -> 16px padding at 128


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def gradient_rect(d: ImageDraw.ImageDraw, box, top, bot) -> None:
    x0, y0, x1, y1 = box
    h = max(1, y1 - y0)
    for i in range(h):
        t = i / h
        col = tuple(round(lerp(a, b, t)) for a, b in zip(top, bot))
        d.line([(x0, y0 + i), (x1, y0 + i)], fill=col)


def draw_artwork(size: int) -> Image.Image:
    """Render the 96x96-artwork at `size` px (transparent canvas)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = size

    # squircle backdrop
    radius = round(S * 0.22)
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S, S], radius=radius, fill=255)
    bg = Image.new("RGBA", (S, S))
    gradient_rect(ImageDraw.Draw(bg), (0, 0, S, S), BG_TOP, BG_BOT)
    img.paste(bg, (0, 0), mask)
    d = ImageDraw.Draw(img)

    # three playlist rows: thumb tile + bar
    rows_y = (0.30, 0.50, 0.70)
    bar_lens = (0.58, 0.58, 0.50)
    thumb_side = S * 0.20
    bar_h = S * 0.085
    x_pad = S * 0.14
    gap = S * 0.055
    for i, (cy, blen) in enumerate(zip(rows_y, bar_lens)):
        y0 = S * cy
        tx0 = x_pad
        d.rounded_rectangle(
            [tx0, y0 - thumb_side / 2, tx0 + thumb_side, y0 + thumb_side / 2],
            radius=S * 0.04,
            fill=THUMB,
        )
        bx0 = tx0 + thumb_side + gap
        fill = ACCENT if i == 1 else BAR
        d.rounded_rectangle(
            [bx0, y0 - bar_h / 2, bx0 + S * blen, y0 + bar_h / 2],
            radius=bar_h / 2,
            fill=fill,
        )
        if i == 1:
            # play triangle inside the accent row's thumb
            cx = tx0 + thumb_side * 0.40
            tw = thumb_side * 0.52
            th = thumb_side * 0.60
            d.polygon(
                [
                    (cx, y0 - th / 2),
                    (cx, y0 + th / 2),
                    (cx + tw, y0),
                ],
                fill=PLAY,
            )
    return img


def make_icons() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    master = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
    artwork = draw_artwork(ARTWORK)
    pad = (MASTER - ARTWORK) // 2
    master.paste(artwork, (pad, pad), artwork)
    for n in (16, 32, 48, 96, 128):
        master.resize((n, n), Image.LANCZOS).save(ICONS_DIR / f"icon-{n}.png")
        print(f"wrote {ICONS_DIR}/icon-{n}.png")


def rows_motif(d: ImageDraw.ImageDraw, area, count: int, alpha: int) -> None:
    """Faint staggered playlist rows as background texture."""
    x0, y0, x1, y1 = area
    row_h = (y1 - y0) / count
    for i in range(count):
        y = y0 + i * row_h + row_h * 0.32
        offset = (list(range(count))[i] % 3) * row_h * 1.4
        col = ACCENT[:3] + (alpha,) if i % 4 == 2 else BAR[:3] + (alpha,)
        d.rounded_rectangle(
            [x0 + offset, y, x1 - offset * 0.4, y + row_h * 0.36],
            radius=row_h * 0.18,
            fill=col,
        )


def tile(width: int, height: int, out: Path, icon_frac: float) -> None:
    scale = 4
    W, H = width * scale, height * scale
    img = Image.new("RGB", (W, H))
    d = ImageDraw.Draw(img)
    gradient_rect(d, (0, 0, W, H), (18, 23, 28, 255), (9, 12, 15, 255))

    # texture rows on the right side
    tex = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rows_motif(
        ImageDraw.Draw(tex),
        (round(W * 0.46), round(H * 0.10), round(W * 0.97), round(H * 0.90)),
        count=7,
        alpha=26,
    )
    img.paste(Image.alpha_composite(Image.new("RGBA", (W, H)), tex).convert("RGB"), (0, 0), tex.split()[3])

    # icon artwork, vertically centered on the left
    side = round(H * icon_frac)
    art = draw_artwork(side)
    img.paste(art, (round(W * 0.07), (H - side) // 2), art)

    # teal baseline accent under the icon
    d.rounded_rectangle(
        [round(W * 0.07), round(H * 0.86), round(W * 0.07 + side), round(H * 0.86 + H * 0.012)],
        radius=H * 0.006,
        fill=ACCENT,
    )
    img.resize((width, height), Image.LANCZOS).save(out)
    print(f"wrote {out}")


def make_tiles() -> None:
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)
    tile(440, 280, ASSETS_DIR / "promo-small-440x280.png", icon_frac=0.52)
    tile(1400, 560, ASSETS_DIR / "promo-marquee-1400x560.png", icon_frac=0.62)


if __name__ == "__main__":
    make_icons()
    make_tiles()
