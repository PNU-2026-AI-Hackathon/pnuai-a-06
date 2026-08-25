# Magazine frames

Each frame lives in its own directory and is selected by `template_key`.

```text
frame/<template-key>/
  frame.svg
  manifest.json
```

The manifest defines canvas size, output scale, mission capacity, font filename,
and the photo/content/comment rectangles in SVG coordinates. Add another directory
with the same contract to expose a new frame automatically through
`GET /magazine-templates`; no router change is required.

`handwriting-2025-v1` uses `KyoboHandwriting2025lyb.ttf`. Download it from the
official Kyobo handwriting font page and place it in `app/static/fonts/`. Font
binaries are intentionally ignored because the font license does not permit
redistribution.

Generated files are written below `app/static/magazines/<schedule-id>/<template-key>/`
and are intentionally ignored. This directory can later be replaced by an S3
storage adapter while keeping the API response contract (`image_urls`).

Template manifests may provide a `names` object keyed by locale. Magazine generation
uses the request locale for backend-owned mission text and static labels, while
schedule titles, participant names, and comments remain in their original language.
Each schedule/template has one generated output. Regenerating it in another locale
replaces the shared record and files; `locale` reports the language used for that
stored image. Generated-magazine lookup is language-independent, so changing the app
language does not hide an existing magazine.

## Frontend selection flow

1. Call `GET /schedules/{schedule_id}/magazine/candidates?template_key=...&lang=en`
   (omit `lang` for Korean).
2. When `selection_required` is true, let the user choose up to `max_selectable` ids.
3. Pass the ordered ids as `schedule_mission_ids` to
   `POST /schedules/{schedule_id}/magazine?lang=en`. Use the same locale as the
   candidates request so the selected titles match the generated image.

If more candidates exist than the frame capacity and ids are omitted, generation
returns `409` with code `MAGAZINE_MISSION_SELECTION_REQUIRED`.
