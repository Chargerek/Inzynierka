from typing import Any

BODY_VIEWBOX_WIDTH = 400
BODY_VIEWBOX_HEIGHT = 900

ALLOWED_IMAGE_MIMES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024

MAX_AREA_STROKES = 128
MAX_STROKE_POINTS = 2000
MIN_BRUSH_RADIUS = 1.0
MAX_BRUSH_RADIUS = 80.0

ALLOWED_BODY_PARTS = frozenset(
    {
        "head",
        "neck",
        "chest",
        "abdomen",
        "pelvis",
        "upper_back",
        "lower_back",
        "buttocks",
        "left_upper_arm",
        "right_upper_arm",
        "left_forearm",
        "right_forearm",
        "left_hand",
        "right_hand",
        "left_thigh",
        "right_thigh",
        "left_shin",
        "right_shin",
        "left_foot",
        "right_foot",
    }
)


def validate_marker_geometry(payload: Any) -> dict[str, Any]:
    """Sprawdza geometrię znacznika na mapie ciała.

    Oczekiwany kształt: {"kind": "marker", "x": 0..400, "y": 0..900}
    — współrzędne w układzie viewBox sylwetki.
    """
    if not isinstance(payload, dict):
        raise ValueError("Geometria musi być obiektem JSON.")
    if payload.get("kind") != "marker":
        raise ValueError("Obsługiwany jest tylko znacznik punktowy (kind=marker).")
    try:
        x = float(payload["x"])
        y = float(payload["y"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("Geometria wymaga pól x i y.") from exc
    if not (0 <= x <= BODY_VIEWBOX_WIDTH and 0 <= y <= BODY_VIEWBOX_HEIGHT):
        raise ValueError(
            f"Współrzędne poza mapą (x: 0–{BODY_VIEWBOX_WIDTH}, y: 0–{BODY_VIEWBOX_HEIGHT})."
        )
    return {"kind": "marker", "x": x, "y": y}


def validate_area_geometry(payload: Any) -> dict[str, Any]:
    """Sprawdza geometrię pomalowanego obszaru na mapie ciała.

    Oczekiwany kształt:
    {"kind": "area", "strokes": [{"points": [x0, y0, x1, y1, ...], "radius": r}]}
    — współrzędne w układzie viewBox sylwetki, promień pędzla w tych samych
    jednostkach.
    """
    if not isinstance(payload, dict):
        raise ValueError("Geometria musi być obiektem JSON.")
    strokes = payload.get("strokes")
    if not isinstance(strokes, list) or not strokes:
        raise ValueError("Obszar wymaga niepustej listy kresek (strokes).")
    if len(strokes) > MAX_AREA_STROKES:
        raise ValueError(f"Zbyt wiele kresek (maks. {MAX_AREA_STROKES}).")
    normalized: list[dict[str, Any]] = []
    for stroke in strokes:
        if not isinstance(stroke, dict):
            raise ValueError("Kreska musi być obiektem JSON.")
        points = stroke.get("points")
        if (
            not isinstance(points, list)
            or len(points) < 2
            or len(points) % 2 != 0
        ):
            raise ValueError("Kreska wymaga parzystej listy punktów [x, y, ...].")
        if len(points) > MAX_STROKE_POINTS:
            raise ValueError(
                f"Kreska ma zbyt wiele punktów (maks. {MAX_STROKE_POINTS})."
            )
        try:
            coords = [float(value) for value in points]
            radius = float(stroke["radius"])
        except (KeyError, TypeError, ValueError) as exc:
            raise ValueError("Kreska wymaga liczbowych punktów i promienia.") from exc
        for index in range(0, len(coords), 2):
            if not (
                0 <= coords[index] <= BODY_VIEWBOX_WIDTH
                and 0 <= coords[index + 1] <= BODY_VIEWBOX_HEIGHT
            ):
                raise ValueError(
                    f"Punkt kreski poza mapą (x: 0–{BODY_VIEWBOX_WIDTH}, "
                    f"y: 0–{BODY_VIEWBOX_HEIGHT})."
                )
        if not (MIN_BRUSH_RADIUS <= radius <= MAX_BRUSH_RADIUS):
            raise ValueError(
                f"Promień pędzla poza zakresem "
                f"{MIN_BRUSH_RADIUS:g}–{MAX_BRUSH_RADIUS:g}."
            )
        normalized.append({"points": coords, "radius": radius})
    return {"kind": "area", "strokes": normalized}


def validate_part_geometry(payload: Any) -> dict[str, Any]:
    """Sprawdza geometrię zaznaczonej części ciała.

    Oczekiwany kształt: {"kind": "part", "part": "left_forearm"}
    — identyfikator z listy ALLOWED_BODY_PARTS.
    """
    if not isinstance(payload, dict):
        raise ValueError("Geometria musi być obiektem JSON.")
    part = payload.get("part")
    if not isinstance(part, str) or part not in ALLOWED_BODY_PARTS:
        raise ValueError("Nieznana część ciała.")
    return {"kind": "part", "part": part}


def validate_geometry(payload: Any) -> dict[str, Any]:
    """Rozpoznaje rodzaj geometrii i deleguje do właściwej walidacji."""
    if not isinstance(payload, dict):
        raise ValueError("Geometria musi być obiektem JSON.")
    kind = payload.get("kind")
    if kind == "marker":
        return validate_marker_geometry(payload)
    if kind == "area":
        return validate_area_geometry(payload)
    if kind == "part":
        return validate_part_geometry(payload)
    raise ValueError(
        "Nieobsługiwany rodzaj geometrii (dozwolone: marker, area, part)."
    )


def extension_for_mime(mime: str | None) -> str | None:
    if mime is None:
        return None
    return ALLOWED_IMAGE_MIMES.get(mime.lower())


def is_photo_size_allowed(size: int) -> bool:
    return 0 < size <= MAX_PHOTO_SIZE_BYTES


def sniff_image_mime(data: bytes) -> str | None:
    """Rozpoznaje prawdziwy typ obrazka po pierwszych bajtach pliku.

    Zwraca MIME (JPEG/PNG/WebP) albo None, gdy zawartość nie jest obrazkiem —
    dzięki temu plik .exe z fałszywym nagłówkiem Content-Type zostanie odrzucony.
    """
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None
