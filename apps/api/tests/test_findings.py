import pytest

from app.services.findings import (
    MAX_AREA_STROKES,
    MAX_PHOTO_SIZE_BYTES,
    MAX_STROKE_POINTS,
    extension_for_mime,
    is_photo_size_allowed,
    validate_area_geometry,
    validate_geometry,
    validate_marker_geometry,
    validate_part_geometry,
)


def test_validate_marker_geometry_accepts_valid_marker():
    geometry = validate_marker_geometry({"kind": "marker", "x": 200, "y": 450})
    assert geometry == {"kind": "marker", "x": 200.0, "y": 450.0}


def test_validate_marker_geometry_accepts_edges():
    geometry = validate_marker_geometry({"kind": "marker", "x": 0, "y": 900})
    assert geometry == {"kind": "marker", "x": 0.0, "y": 900.0}


def test_validate_marker_geometry_rejects_non_dict():
    with pytest.raises(ValueError):
        validate_marker_geometry([1, 2])


def test_validate_marker_geometry_rejects_unknown_kind():
    with pytest.raises(ValueError):
        validate_marker_geometry({"kind": "polygon", "x": 10, "y": 10})


def test_validate_marker_geometry_rejects_missing_coordinates():
    with pytest.raises(ValueError):
        validate_marker_geometry({"kind": "marker", "x": 10})


def test_validate_marker_geometry_rejects_out_of_bounds():
    with pytest.raises(ValueError):
        validate_marker_geometry({"kind": "marker", "x": -5, "y": 10})
    with pytest.raises(ValueError):
        validate_marker_geometry({"kind": "marker", "x": 10, "y": 901})


def test_validate_area_geometry_accepts_valid_strokes():
    geometry = validate_area_geometry(
        {
            "kind": "area",
            "strokes": [
                {"points": [100, 200, 110.5, 210, 120, 220], "radius": 8},
                {"points": [50, 60], "radius": 4},
            ],
        }
    )
    assert geometry == {
        "kind": "area",
        "strokes": [
            {"points": [100.0, 200.0, 110.5, 210.0, 120.0, 220.0], "radius": 8.0},
            {"points": [50.0, 60.0], "radius": 4.0},
        ],
    }


def test_validate_area_geometry_rejects_non_dict():
    with pytest.raises(ValueError):
        validate_area_geometry([1, 2])


def test_validate_area_geometry_rejects_missing_strokes():
    with pytest.raises(ValueError):
        validate_area_geometry({"kind": "area"})
    with pytest.raises(ValueError):
        validate_area_geometry({"kind": "area", "strokes": []})


def test_validate_area_geometry_rejects_too_many_strokes():
    strokes = [{"points": [1, 1], "radius": 4}] * (MAX_AREA_STROKES + 1)
    with pytest.raises(ValueError):
        validate_area_geometry({"kind": "area", "strokes": strokes})


def test_validate_area_geometry_rejects_odd_or_short_points():
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [10], "radius": 4}]}
        )
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [10, 10, 20], "radius": 4}]}
        )


def test_validate_area_geometry_rejects_too_many_points():
    points = [0] * (MAX_STROKE_POINTS + 2)
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": points, "radius": 4}]}
        )


def test_validate_area_geometry_rejects_out_of_bounds():
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [-1, 10], "radius": 4}]}
        )
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [10, 901], "radius": 4}]}
        )


def test_validate_area_geometry_rejects_bad_radius():
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [10, 10], "radius": 0.5}]}
        )
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [10, 10], "radius": 100}]}
        )
    with pytest.raises(ValueError):
        validate_area_geometry(
            {"kind": "area", "strokes": [{"points": [10, 10]}]}
        )


def test_validate_part_geometry_accepts_valid_part():
    geometry = validate_part_geometry({"kind": "part", "part": "left_forearm"})
    assert geometry == {"kind": "part", "part": "left_forearm"}


def test_validate_part_geometry_rejects_unknown_part():
    with pytest.raises(ValueError):
        validate_part_geometry({"kind": "part", "part": "left_pinky"})
    with pytest.raises(ValueError):
        validate_part_geometry({"kind": "part"})
    with pytest.raises(ValueError):
        validate_part_geometry({"kind": "part", "part": 7})
    with pytest.raises(ValueError):
        validate_part_geometry([1, 2])


def test_validate_geometry_dispatches_by_kind():
    marker = validate_geometry({"kind": "marker", "x": 1, "y": 2})
    assert marker["kind"] == "marker"
    area = validate_geometry(
        {"kind": "area", "strokes": [{"points": [1, 2], "radius": 4}]}
    )
    assert area["kind"] == "area"
    part = validate_geometry({"kind": "part", "part": "chest"})
    assert part["kind"] == "part"
    with pytest.raises(ValueError):
        validate_geometry({"kind": "polygon"})
    with pytest.raises(ValueError):
        validate_geometry([1, 2])


def test_extension_for_mime_allows_images():
    assert extension_for_mime("image/jpeg") == ".jpg"
    assert extension_for_mime("image/png") == ".png"
    assert extension_for_mime("image/webp") == ".webp"


def test_extension_for_mime_rejects_other_types():
    assert extension_for_mime("application/pdf") is None
    assert extension_for_mime(None) is None


def test_photo_size_limit():
    assert is_photo_size_allowed(1) is True
    assert is_photo_size_allowed(MAX_PHOTO_SIZE_BYTES) is True
    assert is_photo_size_allowed(MAX_PHOTO_SIZE_BYTES + 1) is False
    assert is_photo_size_allowed(0) is False
