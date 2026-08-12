from __future__ import annotations

import json
import random
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont, ImageOps


APP_DIR = Path(__file__).resolve().parents[1]
STATIC_DIR = APP_DIR / "static"
FRAME_DIR = STATIC_DIR / "frame"
FONT_DIR = STATIC_DIR / "fonts"
OUTPUT_DIR = STATIC_DIR / "magazines"


class MagazineRenderError(RuntimeError):
    pass


@dataclass(frozen=True)
class MagazineTemplate:
    key: str
    name: str
    version: int
    width: int
    height: int
    render_scale: int
    capacity: int
    font: str
    accent: str
    svg_path: Path
    photo_slots: list[dict]
    content_slots: list[dict]
    comment_slots: list[dict]
    comment_icon_slots: list[dict]

    @property
    def output_width(self) -> int:
        return self.width * self.render_scale

    @property
    def output_height(self) -> int:
        return self.height * self.render_scale


def load_templates() -> dict[str, MagazineTemplate]:
    templates: dict[str, MagazineTemplate] = {}
    for manifest_path in sorted(FRAME_DIR.glob("*/manifest.json")):
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        svg_path = manifest_path.parent / data["svg"]
        if not svg_path.is_file():
            continue
        template = MagazineTemplate(
            key=data["key"],
            name=data["name"],
            version=int(data["version"]),
            width=int(data["width"]),
            height=int(data["height"]),
            render_scale=int(data.get("render_scale", 2)),
            capacity=int(data["capacity"]),
            font=data["font"],
            accent=data.get("accent", "#409CB7"),
            svg_path=svg_path,
            photo_slots=data["photo_slots"],
            content_slots=data["content_slots"],
            comment_slots=data["comment_slots"],
            comment_icon_slots=data["comment_icon_slots"],
        )
        templates[template.key] = template
    return templates


def _static_photo_path(photo_url: str) -> Path:
    prefix = "/static/"
    if not photo_url.startswith(prefix):
        raise MagazineRenderError(f"Only local static photos are supported: {photo_url}")
    candidate = (STATIC_DIR / photo_url.removeprefix(prefix)).resolve()
    if STATIC_DIR.resolve() not in candidate.parents:
        raise MagazineRenderError("Invalid photo path.")
    if not candidate.is_file():
        raise MagazineRenderError(f"Photo file does not exist: {photo_url}")
    return candidate


def _font(path: Path, size: int, scale: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=max(1, size * scale))


def _wrap(draw: ImageDraw.ImageDraw, text: str, font, max_width: int, max_lines: int) -> list[str]:
    text = " ".join((text or "").split())
    if not text:
        return []
    lines: list[str] = []
    current = ""
    for char in text:
        candidate = current + char
        if current and draw.textlength(candidate, font=font) > max_width:
            lines.append(current.rstrip())
            current = char.lstrip()
            if len(lines) == max_lines:
                break
        else:
            current = candidate
    if len(lines) < max_lines and current:
        lines.append(current.rstrip())
    consumed = "".join(lines)
    if len(consumed) < len(text) and lines:
        while lines[-1] and draw.textlength(lines[-1] + "…", font=font) > max_width:
            lines[-1] = lines[-1][:-1]
        lines[-1] += "…"
    return lines


def _draw_lines(draw, lines, xy, font, fill, line_gap):
    x, y = xy
    for line in lines:
        draw.text((x, y), line, font=font, fill=fill)
        y += font.size + line_gap
    return y


def _paste_cover(image: Image.Image, photo_path: Path, box: dict, scale: int) -> None:
    width = round(box["width"] * scale)
    height = round(box["height"] * scale)
    with Image.open(photo_path) as source:
        source = ImageOps.exif_transpose(source).convert("RGB")
        fitted = ImageOps.fit(source, (width, height), method=Image.Resampling.LANCZOS)
        image.paste(fitted, (round(box["x"] * scale), round(box["y"] * scale)))


def _featured_photo(page: dict) -> dict | None:
    photos = page.get("photos") or []
    if not photos:
        return None
    photo = next((item for item in photos if item.get("is_winner")), photos[0])
    return photo


def _select_comments(photo: dict, generation_number: int) -> list[dict]:
    comments = photo.get("comments") or []
    if len(comments) <= 3:
        return comments
    seed = f'{generation_number}:{photo["submission_id"]}'
    return random.Random(seed).sample(comments, 3)


def _render_one(template: MagazineTemplate, source: dict, pages: list[dict], output_path: Path) -> None:
    scale = template.render_scale
    font_path = FONT_DIR / template.font
    if not font_path.is_file():
        raise MagazineRenderError(
            f"Required font is missing: {font_path}. Download KyoboHandwriting2025lyb.ttf."
        )
    png = cairosvg.svg2png(
        url=str(template.svg_path),
        output_width=template.output_width,
        output_height=template.output_height,
    )
    image = Image.open(BytesIO(png)).convert("RGB")
    # Keep pristine icon artwork. Some content cleanup rectangles overlap the
    # neighboring comment icon slots, so active icons are restored last.
    frame_image = image.copy()
    draw = ImageDraw.Draw(image)
    accent = template.accent
    dark = "#3E4548"

    # Hide the sample header paths before adding actual schedule metadata.
    draw.rectangle((10 * scale, 140 * scale, 274 * scale, 284 * scale), fill="white")
    title_font = _font(font_path, 25, scale)
    meta_font = _font(font_path, 10, scale)
    participant_font = _font(font_path, 11, scale)
    draw.text((16 * scale, 154 * scale), source["title"], font=title_font, fill=accent)
    draw.text(
        (16 * scale, 224 * scale),
        f'일정 기간 | {source["start_date"]}  ~  {source["end_date"]}',
        font=meta_font,
        fill=accent,
    )
    names = " · ".join(
        participant.get("nickname")
        or (participant.get("email") or "").split("@", 1)[0]
        or f'사용자 {participant["id"]}'
        for participant in source.get("participants", [])
    )
    participant_text = f"함께한 사람 | {names}" if names else "함께한 사람 | -"
    _draw_lines(
        draw,
        _wrap(draw, participant_text, participant_font, 255 * scale, 2),
        (16 * scale, 250 * scale),
        participant_font,
        accent,
        1 * scale,
    )
    count_font = _font(font_path, 13, scale)
    draw.ellipse(
        (287 * scale, 150 * scale, 344 * scale, 207 * scale),
        fill=accent,
    )
    draw.text(
        (315.5 * scale, 178.5 * scale),
        f'#{source["generation_number"]}',
        font=count_font,
        fill="white",
        anchor="mm",
    )

    # Remove every sample placeholder first. Active slots are painted back below;
    # unused slots stay clean instead of exposing the design-time checker/text.
    for box in template.photo_slots:
        draw.rectangle(
            (
                round(box["x"] * scale),
                round(box["y"] * scale),
                round((box["x"] + box["width"]) * scale),
                round((box["y"] + box["height"]) * scale),
            ),
            fill="white",
        )
    for box in [*template.content_slots, *template.comment_slots]:
        draw.rectangle(
            (
                round((box["x"] - 3) * scale),
                round((box["y"] - 3) * scale),
                round((box["x"] + box["width"]) * scale),
                round((box["y"] + box["height"]) * scale),
            ),
            fill="white",
        )
    active_comment_indexes = {
        index
        for index, page in enumerate(pages)
        if (photo := _featured_photo(page)) is not None and photo.get("comments")
    }
    for index, box in enumerate(template.comment_icon_slots):
        if index in active_comment_indexes:
            continue
        draw.rectangle(
            (
                round((box["x"] - 2) * scale),
                round((box["y"] - 2) * scale),
                round((box["x"] + box["width"] + 2) * scale),
                round((box["y"] + box["height"] + 2) * scale),
            ),
            fill="white",
        )

    for index, page in enumerate(pages):
        photo = _featured_photo(page)
        if photo is None:
            continue
        selected_comments = _select_comments(photo, source["generation_number"])
        _paste_cover(
            image,
            _static_photo_path(photo["photo_url"]),
            template.photo_slots[index],
            scale,
        )

        box = template.content_slots[index]
        x = round(box["x"] * scale)
        y = round(box["y"] * scale)
        width = round(box["width"] * scale)
        height = round(box["height"] * scale)
        draw.rectangle((x - 3 * scale, y - 3 * scale, x + width, y + height), fill="white")
        mission = page["mission"]
        heading_font = _font(font_path, 12 if index else 18, scale)
        body_font = _font(font_path, 7 if index else 9, scale)
        comment_font = _font(font_path, 5 if len(selected_comments) >= 2 else 6, scale)
        cursor = _draw_lines(
            draw,
            _wrap(draw, mission["title"], heading_font, width, 1),
            (x, y),
            heading_font,
            accent,
            1 * scale,
        )
        description = mission.get("description") or mission.get("place_label") or ""
        cursor = _draw_lines(
            draw,
            _wrap(draw, description, body_font, width, 2),
            (x, cursor + 1 * scale),
            body_font,
            dark,
            1 * scale,
        )
        comment_box = template.comment_slots[index]
        comment_x = round(comment_box["x"] * scale)
        comment_y = round(comment_box["y"] * scale)
        comment_width = round(comment_box["width"] * scale)
        comment_height = round(comment_box["height"] * scale)
        draw.rectangle(
            (
                comment_x - 2 * scale,
                comment_y - 2 * scale,
                comment_x + comment_width,
                comment_y + comment_height,
            ),
            fill="white",
        )
        comment_cursor = comment_y
        for comment in selected_comments:
            value = comment["content"]
            lines = _wrap(draw, value, comment_font, comment_width, 2)
            comment_cursor = _draw_lines(
                draw,
                lines,
                (comment_x, comment_cursor),
                comment_font,
                accent,
                1 * scale,
            ) + 1 * scale

    # Restore active icons after all photo/content/comment cleanup. In the
    # original layout the second content slot overlaps the icon below it by
    # several pixels, which otherwise leaves that icon visibly clipped.
    for index in active_comment_indexes:
        box = template.comment_icon_slots[index]
        icon_bounds = (
            round((box["x"] - 2) * scale),
            round((box["y"] - 2) * scale),
            round((box["x"] + box["width"] + 2) * scale),
            round((box["y"] + box["height"] + 2) * scale),
        )
        image.paste(frame_image.crop(icon_bounds), icon_bounds[:2])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    temporary = output_path.with_suffix(".tmp.webp")
    image.save(temporary, "WEBP", quality=90, method=6)
    temporary.replace(output_path)


def render_magazine(template: MagazineTemplate, source: dict, schedule_id: int) -> list[str]:
    pages = source.get("pages") or []
    if not pages:
        raise MagazineRenderError("At least one completed mission with a passed photo is required.")
    output_directory = OUTPUT_DIR / str(schedule_id) / template.key
    output_directory.mkdir(parents=True, exist_ok=True)
    urls: list[str] = []
    chunks = [pages[i : i + template.capacity] for i in range(0, len(pages), template.capacity)]
    for page_number, chunk in enumerate(chunks, start=1):
        output_path = output_directory / f"page-{page_number}.webp"
        _render_one(template, source, chunk, output_path)
        urls.append(f"/static/magazines/{schedule_id}/{template.key}/{output_path.name}")
    for stale in output_directory.glob("page-*.webp"):
        if f"/static/magazines/{schedule_id}/{template.key}/{stale.name}" not in urls:
            stale.unlink()
    return urls
