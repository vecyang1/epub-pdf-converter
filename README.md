# EPUB → PDF Conversion Hub

A full-featured web application for converting EPUB books (including Chinese + English text and embedded images) into printable PDF files. Users can upload directly in the browser, manage their conversion history, and fine-tune default rendering settings.

## Feature highlights
- Modern single-page dashboard with drag & drop uploads, glassmorphism styling, and responsive design.
- Built-in English/Chinese UI toggle (English by default).
- Keeps converted PDFs under `output/` using the original filename.
- Detects previously converted books and reuses cached PDFs unless “Force regenerate” is enabled.
- Drag & drop supports Finder/Explorer “package” EPUB folders by auto-zipping them on the fly (JSZip powered).
- Background conversion queue powered by Playwright + headless Chromium for high-fidelity rendering.
- Per-user history stored in SQLite, including status tracking, retries, cancellation, and bulk clearing.
- Persistent preferences (display name, default page size, margins) saved via profile settings.
- One-click “open folder” action to reveal converted PDFs in Finder/Explorer.
- Auto-refresh and manual controls to monitor job progress in real time.
- RESTful JSON API (`/api/jobs`, `/api/profile`, `/api/session`) for integration or automation.

## Open-source tooling considered
| Project | Notes |
| --- | --- |
| [Helias/EPUB-to-PDF](https://github.com/Helias/EPUB-to-PDF) | Calibre-based Telegram bot; great accuracy but requires Calibre CLI runtime. |
| [TruthHun/converter](https://github.com/TruthHun/converter) | Bulk conversions (HTML/Markdown → EPUB/MOBI/PDF) via Calibre. |
| [rava-dosa/epub2pdf](https://github.com/rava-dosa/epub2pdf) | Pure Python + WeasyPrint, but needs the GTK/Pango stack—heavy on macOS. |

This project adopts Playwright because Chromium already ships excellent CJK font support and reliably preserves layout without extra native dependencies.

## Project structure
```
app.py              # Flask app, REST API, conversion pipeline, worker queue
static/app.js       # Front-end SPA logic
templates/index.html# Modern UI shell (Tailwind via CDN)
storage/            # Generated at runtime; job-specific assets
convert/            # Optional seed EPUB files
output/             # Legacy folder (no longer used; kept for reference)
requirements.txt
README.md
```

## Getting started
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium  # one-time ~130 MB
flask --app app run --reload
```
Visit <http://127.0.0.1:5000> (or the port you selected with `--port`) to access the dashboard. Drag in EPUB files and watch the queue update. Completed jobs display download and “open folder” buttons; failed jobs can be retried with one click.

### Duplicate handling
- Conversions are cached by original filename and render settings (page size/margins).
- Uploading the same book again returns instantly with a “cached PDF” toast instead of re-running Chromium.
- Tick **Force regenerate** near the upload button to override the cache and rebuild the PDF.

## Configuration
Environment variables:
- `EPUB_PDF_SECRET` – Flask secret key (defaults to `epub-pdf-secret`).
- `EPUB_PDF_SYNC=1` – Process conversions synchronously (useful for unit tests or hosted workers).
- `EPUB_PDF_TEST_MODE=1` – Generate stub PDFs instead of launching Chromium (used in automated tests).

Default conversion settings (page size, margin) are stored per user in the browser and sent with each upload. Update them via the **个人设置** modal.

## API overview
- `GET /api/session` – returns `{ userId, displayName }`.
- `POST /api/profile` – update display name.
- `GET /api/jobs` – list jobs ordered by newest first.
- `POST /api/jobs` – upload EPUB (`multipart/form-data` with `file`, `pageSize`, `margin`).
- `POST /api/jobs/<id>/retry` – requeue a completed/failed/canceled job.
- `DELETE /api/jobs/<id>` – cancel or delete a job.
- `DELETE /api/jobs` – clear a user's job history.
- `GET /api/jobs/<id>/download` – download the generated PDF (when ready).
- `POST /api/jobs/<id>/reveal` – open the generated PDF in the OS file explorer.
- `GET /api/analytics` – aggregate success counts, queue depth, and latency metrics for dashboards.

## Testing
Set `EPUB_PDF_TEST_MODE=1` and `EPUB_PDF_SYNC=1` to bypass Chromium during tests. Example with `pytest`:
```bash
EPUB_PDF_TEST_MODE=1 EPUB_PDF_SYNC=1 pytest
```

## Roadmap ideas
- Optional authentication via magic links for multi-device history sharing.
- Email notifications or webhooks when long conversions finish.
- Automatic font pack management & preview thumbnails.
- Usage analytics dashboard (success rate, conversion latency) for ops.

Contributions and feedback are welcome—enjoy seamless EPUB conversions!
