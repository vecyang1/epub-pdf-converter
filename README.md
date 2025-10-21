# EPUB → PDF Web Converter

This project provides a lightweight Flask web app that batch-converts the EPUB books found under `convert/` into PDF files. It targets mixed Chinese/English content and embedded images by rendering the EPUB HTML with headless Chromium (via Playwright).

## Open-source options reviewed
- **Helias/EPUB-to-PDF** – Telegram bot wrapping Calibre's `ebook-convert` for reliable layout handling. Good match if you can install Calibre CLI: <https://github.com/Helias/EPUB-to-PDF>
- **TruthHun/converter** – Uses Calibre to turn HTML/Markdown into EPUB/MOBI/PDF: <https://github.com/TruthHun/converter>
- **rava-dosa/epub2pdf** – Pure-Python pipeline built around WeasyPrint. Works well but needs the GTK/Pango stack, which is heavy to install in this environment: <https://github.com/rava-dosa/epub2pdf>

Given the current machine already runs Chrome-based tooling, the Playwright approach keeps dependencies in Python while preserving fonts and images.

## Project structure
```
convert/        # Drop your .epub (files or unpacked folders) here
output/         # Generated PDFs appear here
app.py          # Flask app + EPUB→HTML→PDF conversion pipeline
requirements.txt
venv/           # Local virtual environment (optional)
templates/
```

## Environment setup
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium  # one-time browser download (~130 MB)
```

## Run the web app
```bash
source venv/bin/activate
flask --app app run --reload
```
Open <http://127.0.0.1:5000> to see all EPUB files under `convert/`. Hit **转换** to generate a PDF; once finished a download link appears.

## How conversion works
1. EPUB is parsed with [EbookLib](https://github.com/aerkalov/ebooklib) so chapter order, text encoding, and CSS are preserved.
2. Each XHTML document is re-linked so internal resources (images, fonts, styles) resolve against the extracted EPUB directory.
3. A consolidated HTML document is generated with your CSS plus sensible defaults for Chinese fonts and responsive images.
4. [Playwright](https://playwright.dev/python) launches headless Chromium to render the HTML and print it to PDF, which produces high-fidelity output for mixed-language content and inline media.

## Notes on fonts & images
- Ensure the OS has CJK fonts installed (the template references `Noto Sans CJK SC` and `PingFang SC` but Chromium will fallback automatically).
- Remote resources inside EPUBs will be loaded if URLs are reachable; offline media such as images are embedded automatically after extraction.

## Troubleshooting
- **Chromium download blocked**: run `playwright install chromium --force` after checking network access.
- **Missing fonts (garbled Chinese)**: install a Unicode font and re-run the conversion (`Noto Sans CJK` is recommended).
- **Large books timeout**: increase the conversion timeout in `_render_pdf` by changing `page.goto(..., wait_until="networkidle")` to extend `goto` or use `page.wait_for_timeout(...)`.

## Converting programmatically
If you prefer CLI usage without the web UI:
```bash
source venv/bin/activate
python - <<'PY'
from pathlib import Path
from app import convert_epub, CONVERT_DIR

for epub_path in CONVERT_DIR.glob('*.epub'):
    pdf_path = convert_epub(epub_path)
    print('Converted:', pdf_path)
PY
```
