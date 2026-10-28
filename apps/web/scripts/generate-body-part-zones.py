# Generuje strefy czesci ciala dopasowane do sylwetek SVG (maska z unii wypelnien).
# Uzycie: python apps/web/scripts/generate-body-part-zones.py [--png]
import os
import re
import sys

import numpy as np
import cv2

WEB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SVG_DIR = os.path.join(WEB_DIR, "public", "body")
OUT_TS = os.path.join(WEB_DIR, "src", "features", "findings", "body-part-zones.ts")
OUT_PNG = os.path.join(os.environ.get("TEMP", "/tmp"), "bodytrace")
S = 2  # skala robocza
W, H = 400 * S, 900 * S

TOKEN = re.compile(r"[A-Za-z]|-?\d*\.?\d+")


def parse_path(d):
    tokens = TOKEN.findall(d)
    i = 0
    subs, cur = [], []
    pos = start = (0.0, 0.0)
    cmd = None

    def num():
        nonlocal i
        v = float(tokens[i])
        i += 1
        return v

    while i < len(tokens):
        if tokens[i][0].isalpha():
            cmd = tokens[i]
            i += 1
        if cmd == "M":
            x, y = num(), num()
            if cur:
                subs.append(cur)
            cur = [(x, y)]
            pos = start = (x, y)
            cmd = "L"
        elif cmd == "L":
            x, y = num(), num()
            cur.append((x, y))
            pos = (x, y)
        elif cmd == "C":
            x1, y1, x2, y2, x3, y3 = num(), num(), num(), num(), num(), num()
            p0 = pos
            for t in np.linspace(0, 1, 17)[1:]:
                mt = 1 - t
                x = mt**3 * p0[0] + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t**3 * x3
                y = mt**3 * p0[1] + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t**3 * y3
                cur.append((x, y))
            pos = (x3, y3)
        elif cmd == "Q":
            x1, y1, x2, y2 = num(), num(), num(), num()
            p0 = pos
            for t in np.linspace(0, 1, 13)[1:]:
                mt = 1 - t
                x = mt * mt * p0[0] + 2 * mt * t * x1 + t * t * x2
                y = mt * mt * p0[1] + 2 * mt * t * y1 + t * t * y2
                cur.append((x, y))
            pos = (x2, y2)
        elif cmd in ("Z", "z"):
            cur.append(start)
            pos = start
            cmd = None
        else:
            raise ValueError(f"nieobslugiwana komenda: {cmd}")
    if cur:
        subs.append(cur)
    return subs


def load_mask(name):
    text = open(os.path.join(SVG_DIR, f"{name}.svg"), encoding="ascii").read()
    mask = np.zeros((H, W), np.uint8)
    for m in re.finditer(r'<path\s+([^>]*?)d="([^"]+)"', text):
        attrs, d = m.group(1), m.group(2)
        if 'fill="none"' in attrs:
            continue
        for sub in parse_path(d):
            pts = np.array([(round(x * S), round(y * S)) for x, y in sub], np.int32)
            cv2.fillPoly(mask, [pts], 255)
    return mask


def row_runs(mask, y):
    xs = np.flatnonzero(mask[y] > 0)
    if len(xs) == 0:
        return []
    runs = []
    s = xs[0]
    p = xs[0]
    for x in xs[1:]:
        if x > p + 1:
            runs.append((s, p))
            s = x
        p = x
    runs.append((s, p))
    return runs


def build_arm_cut(mask, side, p):
    """Zwraca tablice [H] z x linii ciecia ramie/tulow (NaN poza zakresem).

    Powyzej pachy: linia prosta szyja->pacha (ramie przylega do tulowia).
    Ponizej pachy: srodek rzeczywistej przerwy miedzy ramieniem a tulowiem.
    """
    y0 = (p["neck_bot"] + 4) * S
    y1 = p["hand_bot"] * S
    center = 200 * S
    topmost = None
    gaps = {}
    for y in range(y0, y1):
        runs = [r for r in row_runs(mask, y) if r[1] - r[0] > 4 * S]
        if len(runs) < 2:
            continue
        torso = next((r for r in runs if r[0] <= center <= r[1]), None)
        if torso is None:
            # ponizej krocza: bierzemy noge najblizsza srodka z naszej strony
            if side == "L":
                cand = [r for r in runs if r[1] < center]
                torso = max(cand, key=lambda r: r[1]) if cand else None
            else:
                cand = [r for r in runs if r[0] > center]
                torso = min(cand, key=lambda r: r[0]) if cand else None
        if torso is None:
            continue
        if side == "L":
            hand = [r for r in runs if r[1] < torso[0] - 2]
            if hand:
                gaps[y] = (max(r[1] for r in hand) + torso[0]) / 2
                if topmost is None:
                    topmost = y
        else:
            hand = [r for r in runs if r[0] > torso[1] + 2]
            if hand:
                gaps[y] = (min(r[0] for r in hand) + torso[1]) / 2
                if topmost is None:
                    topmost = y
    if topmost is None:
        return None
    # punkt przy szyi: krawedz szyi
    y_neck = (p["neck_bot"] - 2) * S
    runs = [r for r in row_runs(mask, y_neck) if r[1] - r[0] > 4 * S]
    torso_run = min(runs, key=lambda r: abs((r[0] + r[1]) / 2 - center))
    neck_x = torso_run[0] if side == "L" else torso_run[1]
    ax = gaps[topmost]
    cut = np.full(H, np.nan, np.float32)
    # odcinek szyja -> pacha (linia prosta)
    for y in range(y0, topmost + 1):
        t = (y - y0) / max(1, topmost - y0)
        cut[y] = neck_x + t * (ax - neck_x)
    # ponizej: srodek przerwy, gladzone; brak przerwy -> ostatnia wartosc
    last = ax
    for y in range(topmost + 1, y1):
        if y in gaps:
            last = 0.6 * last + 0.4 * gaps[y]
        cut[y] = last
    return cut


def arm_mask(cut, side, p):
    X = np.arange(W, dtype=np.float32)[None, :].repeat(H, 0)
    valid = ~np.isnan(cut)
    cut_f = np.where(valid, cut, 1e9 if side == "L" else -1e9)
    if side == "L":
        m = X < cut_f[:, None]
    else:
        m = X > cut_f[:, None]
    m &= valid[:, None]
    return m


PARAMS = {
    "female": dict(chin=122, neck_bot=146, chest_bot=268, abdomen_bot=372,
                   pelvis_bot=452, elbow=338, wrist=398, knee=652, ankle=838,
                   hand_bot=545),
    "male": dict(chin=120, neck_bot=146, chest_bot=268, abdomen_bot=370,
                 pelvis_bot=452, elbow=342, wrist=404, knee=652, ankle=836,
                 hand_bot=545),
}

BACK_BANDS = [("upper_back", "neck_bot", 292), ("lower_back", 292, 378),
              ("buttocks", 378, 472)]
FRONT_BANDS = [("chest", "neck_bot", "chest_bot"), ("abdomen", "chest_bot", "abdomen_bot"),
               ("pelvis", "abdomen_bot", "pelvis_bot")]
THIGH_TOP = {"front": 450, "back": 468}


def zone_contour(zmask):
    zm = (zmask.astype(np.uint8)) * 255
    cnts, _ = cv2.findContours(zm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return None
    c = max(cnts, key=cv2.contourArea)
    if cv2.contourArea(c) < 40 * S * S:
        return None
    approx = cv2.approxPolyDP(c, 1.7 * S, True)
    pts = approx.reshape(-1, 2) / S
    return pts


def compute_zones(name):
    sex, view = name.split("-")
    p = PARAMS[sex]
    mask = load_mask(name)
    cutL = build_arm_cut(mask, "L", p)
    cutR = build_arm_cut(mask, "R", p)
    if cutL is None or cutR is None:
        raise RuntimeError(f"brak pachy: {name} L={cutL is None} R={cutR is None}")
    firstL = int(np.nanargmax(~np.isnan(cutL)))
    print(f"  pacha L y={firstL // S} x={cutL[firstL] / S:.0f}, "
          f"R y={int(np.nanargmax(~np.isnan(cutR))) // S}")
    armL = arm_mask(cutL, "L", p)
    armR = arm_mask(cutR, "R", p)
    torso = ~(armL | armR)
    Y = np.arange(H, dtype=np.float32)[:, None].repeat(W, 1)
    X = np.arange(W, dtype=np.float32)[None, :].repeat(H, 0)
    body = mask > 0

    def band(y0, y1, extra=None):
        m = body & (Y > y0 * S) & (Y <= y1 * S)
        if extra is not None:
            m &= extra
        return m

    zones = {}
    zones["head"] = band(-1, p["chin"])
    zones["neck"] = band(p["chin"], p["neck_bot"])
    bands = BACK_BANDS if view == "back" else FRONT_BANDS
    for zid, y0, y1 in bands:
        y0v = p[y0] if isinstance(y0, str) else y0
        y1v = p[y1] if isinstance(y1, str) else y1
        zones[zid] = band(y0v, y1v, torso)
    tt = THIGH_TOP[view]
    for img_side, arm, xcond in (("L", armL, X < 200 * S), ("R", armR, X > 200 * S)):
        zones[f"UA_{img_side}"] = body & arm & (Y <= p["elbow"] * S)
        zones[f"FA_{img_side}"] = body & arm & (Y > p["elbow"] * S) & (Y <= p["wrist"] * S)
        zones[f"HA_{img_side}"] = body & arm & (Y > p["wrist"] * S)
        zones[f"TH_{img_side}"] = band(tt, p["knee"], xcond & torso)
        zones[f"SH_{img_side}"] = band(p["knee"], p["ankle"], xcond & torso)
        zones[f"FT_{img_side}"] = band(p["ankle"], 899, xcond)

    out = {}
    for zid, zm in zones.items():
        pts = zone_contour(zm)
        if pts is None:
            print(f"  !! pusta strefa {zid}")
            continue
        out[zid] = pts
    return out, mask


NAMES = {"UA": "upper_arm", "FA": "forearm", "HA": "hand", "TH": "thigh",
         "SH": "shin", "FT": "foot"}

ZONE_COLORS = [(255, 0, 0), (0, 200, 0), (0, 0, 255), (255, 160, 0), (200, 0, 200),
               (0, 200, 200), (255, 255, 0), (120, 60, 200), (0, 120, 255),
               (255, 0, 120), (100, 200, 100), (200, 100, 100), (100, 100, 200),
               (200, 200, 100), (100, 200, 200), (200, 100, 200), (150, 150, 150)]


def ts_name(view, zid):
    if zid in ("head", "neck", "chest", "abdomen", "pelvis",
               "upper_back", "lower_back", "buttocks"):
        return zid
    base, img_side = zid.split("_")
    # przod: lewa strona obrazu = prawa strona pacjenta; tyl: odwrotnie
    if view == "front":
        patient = "right" if img_side == "L" else "left"
    else:
        patient = "left" if img_side == "L" else "right"
    return f"{patient}_{NAMES[base]}"


def main():
    all_zones = {}
    for name in ["female-front", "female-back", "male-front", "male-back"]:
        sex, view = name.split("-")
        print(f"== {name} ==")
        zones, mask = compute_zones(name)
        vis = np.full((H, W, 3), 255, np.uint8)
        vis[mask > 0] = (235, 220, 210)
        named = {}
        for i, (zid, pts) in enumerate(zones.items()):
            color = ZONE_COLORS[i % len(ZONE_COLORS)]
            overlay = vis.copy()
            cv2.fillPoly(overlay, [(pts * S).astype(np.int32)], color)
            vis = cv2.addWeighted(vis, 0.45, overlay, 0.55, 0)
            c = pts.mean(axis=0).astype(int)
            label = ts_name(view, zid)
            cv2.putText(vis, label, (c[0] * S - 30, c[1] * S), cv2.FONT_HERSHEY_SIMPLEX,
                        0.45, (0, 0, 0), 1)
            named[label] = pts
            x0, y0 = pts.min(axis=0)
            x1, y1 = pts.max(axis=0)
            print(f"  {label:16s} pts={len(pts):3d} bbox=({x0:.0f},{y0:.0f})-({x1:.0f},{y1:.0f})")
        if "--png" in sys.argv:
            os.makedirs(OUT_PNG, exist_ok=True)
            cv2.imwrite(os.path.join(OUT_PNG, f"zones-{name}.png"),
                        cv2.resize(vis, (400, 900), interpolation=cv2.INTER_AREA))
        all_zones.setdefault(sex, {})[view] = named

    # eksport TS
    lines = ["import type { BodyFigure, BodySide } from \"@/lib/types\";", "",
             "// Wygenerowano automatycznie (apps/web/scripts/generate-body-part-zones.py).",
             "// Wielokaty stref w ukladzie viewBox 400x900, dopasowane do ksztaltu figur.",
             "export const BODY_PART_ZONES: Record<",
             "  BodyFigure,",
             "  Record<BodySide, Record<string, readonly number[]>>",
             "> = {"]
    for sex in ("female", "male"):
        lines.append(f"  {sex}: {{")
        for view in ("front", "back"):
            lines.append(f"    {view}: {{")
            for label, pts in all_zones[sex][view].items():
                flat = ", ".join(f"{round(float(v))}" for v in pts.flatten())
                lines.append(f"      {label}: [{flat}],")
            lines.append("    },")
        lines.append("  },")
    lines.append("};")
    with open(OUT_TS, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")
    print(f"zapisano {OUT_TS}")


if __name__ == "__main__":
    main()
