import os
import zipfile
import tempfile
import shutil
from pathlib import Path, PurePosixPath

from flask import Flask, render_template, redirect, url_for, send_file, flash
from ebooklib import epub, ITEM_DOCUMENT, ITEM_STYLE
import warnings
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent
CONVERT_DIR = BASE_DIR / "convert"
OUTPUT_DIR = BASE_DIR / "output"
OUTPUT_DIR.mkdir(exist_ok=True)

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

app = Flask(__name__)
app.secret_key = os.environ.get("EPUB_PDF_SECRET", "epub-pdf-secret")


def list_epubs():
    return sorted(CONVERT_DIR.glob("*.epub"))


def _decode_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "gb18030", "shift_jis"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


def _prepare_html(book: epub.EpubBook, extract_dir: Path) -> str:
    styles = []
    body_parts = []

    for item in book.get_items():
        if item.get_type() == ITEM_STYLE:
            styles.append(_decode_bytes(item.get_content()))

    for item in book.get_items_of_type(ITEM_DOCUMENT):
        body_content = _decode_bytes(item.get_content())
        soup = BeautifulSoup(body_content, "lxml")
        doc_dir = PurePosixPath(item.get_name()).parent

        for tag in soup.find_all(src=True):
            src = tag.get("src")
            if not src:
                continue
            resolved = _resolve_resource(doc_dir, src)
            tag["src"] = resolved

        for tag in soup.find_all(href=True):
            href = tag.get("href")
            if not href:
                continue
            resolved = _resolve_resource(doc_dir, href)
            tag["href"] = resolved

        body = soup.body or soup
        body_parts.append(str(body))

    style_block = "\n".join(styles)
    base_href = extract_dir.as_uri().rstrip('/') + '/'
    assembled_html = f"""
    <!DOCTYPE html>
    <html lang=\"en\">
    <head>
      <meta charset=\"utf-8\">
      <base href=\"{base_href}\">
      <style>
        body {{ font-family: 'Noto Sans CJK SC', 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 1in; }}
        img {{ max-width: 100%; height: auto; }}
        table {{ width: 100%; border-collapse: collapse; }}
        {style_block}
      </style>
    </head>
    <body>
      {''.join(body_parts)}
    </body>
    </html>
    """
    return assembled_html


def _resolve_resource(doc_dir: PurePosixPath, link: str) -> str:
    href_path = PurePosixPath(link)
    if href_path.is_absolute() or href_path.anchor:
        return href_path.as_posix()
    if str(href_path).startswith("data:"):
        return link
    normalized = doc_dir.joinpath(href_path).as_posix()
    return normalized


def convert_epub(epub_path: Path) -> Path:
    book = epub.read_epub(str(epub_path))
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        if epub_path.is_dir():
            shutil.copytree(epub_path, tmpdir_path, dirs_exist_ok=True)
        else:
            with zipfile.ZipFile(epub_path, 'r') as zip_ref:
                zip_ref.extractall(tmpdir_path)

        rendered_html = _prepare_html(book, tmpdir_path)
        pdf_bytes = _render_pdf(rendered_html)

    output_path = OUTPUT_DIR / f"{epub_path.stem}.pdf"
    output_path.write_bytes(pdf_bytes)
    return output_path


def _render_pdf(html: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmpdir:
        html_path = Path(tmpdir) / "book.html"
        html_path.write_text(html, encoding='utf-8')

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(html_path.as_uri(), wait_until="networkidle")
            pdf_bytes = page.pdf(format="A4", print_background=True)
            browser.close()

    return pdf_bytes


@app.route('/')
def index():
    epubs = list_epubs()
    converted = {pdf.stem: pdf for pdf in OUTPUT_DIR.glob('*.pdf')}
    return render_template('index.html', epubs=epubs, converted=converted)


@app.route('/convert/<path:filename>', methods=['POST'])
def convert_route(filename):
    epub_path = (CONVERT_DIR / filename).resolve()
    if not epub_path.exists() or epub_path.suffix.lower() != '.epub':
        flash('EPUB file not found.')
        return redirect(url_for('index'))

    try:
        pdf_path = convert_epub(epub_path)
        flash(f'Converted {epub_path.name} → {pdf_path.name}', 'success')
    except Exception as exc:
        flash(f'Failed to convert {epub_path.name}: {exc}', 'error')
    return redirect(url_for('index'))


@app.route('/download/<path:filename>')
def download(filename):
    pdf_path = (OUTPUT_DIR / filename).resolve()
    if not pdf_path.exists() or pdf_path.suffix.lower() != '.pdf':
        flash('PDF not found.')
        return redirect(url_for('index'))
    return send_file(pdf_path, as_attachment=True)


if __name__ == '__main__':
    app.run(debug=True)
