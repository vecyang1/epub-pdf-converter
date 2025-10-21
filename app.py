import json
import os
import platform
import queue
import shutil
import subprocess
import tempfile
import threading
import traceback
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Dict, Optional

from flask import (
    Flask,
    abort,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import desc
from werkzeug.utils import secure_filename
import warnings
from ebooklib import epub, ITEM_DOCUMENT, ITEM_STYLE
from bs4 import BeautifulSoup, XMLParsedAsHTMLWarning
from playwright.sync_api import sync_playwright

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

warnings.filterwarnings("ignore", category=XMLParsedAsHTMLWarning)

app = Flask(__name__, static_folder="static", template_folder="templates")
app.config.update(
    SECRET_KEY=os.environ.get("EPUB_PDF_SECRET", "epub-pdf-secret"),
    SQLALCHEMY_DATABASE_URI=f"sqlite:///{BASE_DIR / 'epub_pdf.db'}",
    SQLALCHEMY_TRACK_MODIFICATIONS=False,
    MAX_CONTENT_LENGTH=1024 * 1024 * 150,  # 150 MB upload limit
    EPUB_PDF_SYNC=os.environ.get("EPUB_PDF_SYNC", "").lower() in {"1", "true", "yes"},
)

db = SQLAlchemy(app)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JobStatus:
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELED = "canceled"


class User(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    display_name = db.Column(db.String(120))
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)


class Job(db.Model):
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey("user.id"), nullable=False, index=True)
    original_filename = db.Column(db.String(255))
    stored_filename = db.Column(db.String(255))
    pdf_filename = db.Column(db.String(255))
    status = db.Column(db.String(24), default=JobStatus.QUEUED, index=True)
    size_bytes = db.Column(db.Integer)
    error_message = db.Column(db.Text)
    settings_json = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=utc_now)
    updated_at = db.Column(db.DateTime, default=utc_now, onupdate=utc_now)
    completed_at = db.Column(db.DateTime)
    last_progress = db.Column(db.String(120))

    user = db.relationship("User", backref=db.backref("jobs", lazy=True))

    @property
    def job_dir(self) -> Path:
        job_dir = STORAGE_DIR / self.id
        job_dir.mkdir(exist_ok=True, parents=True)
        return job_dir

    @property
    def source_path(self) -> Path:
        return self.job_dir / (self.stored_filename or "source.epub")

    @property
    def pdf_path(self) -> Path:
        if not self.pdf_filename:
            return self.job_dir / "output.pdf"
        return self.job_dir / self.pdf_filename

    def settings(self) -> Dict[str, Any]:
        if not self.settings_json:
            return {}
        try:
            return json.loads(self.settings_json)
        except json.JSONDecodeError:
            return {}


with app.app_context():
    db.create_all()

job_queue: "queue.Queue[str]" = queue.Queue()
worker_thread: Optional[threading.Thread] = None
_worker_lock = threading.Lock()


@app.before_request
def ensure_user():
    get_current_user()


def get_current_user() -> User:
    user_id = session.get("user_id")
    if user_id:
        user = db.session.get(User, user_id)
        if user:
            return user
    user = User(id=str(uuid.uuid4()))
    db.session.add(user)
    db.session.commit()
    session["user_id"] = user.id
    return user


@app.route("/")
def index():
    user = get_current_user()
    return render_template("index.html", display_name=user.display_name or "新用户")


@app.route("/api/session", methods=["GET"])
def api_session():
    user = get_current_user()
    return jsonify({
        "userId": user.id,
        "displayName": user.display_name,
    })


@app.route("/api/profile", methods=["POST"])
def api_profile():
    user = get_current_user()
    data = request.get_json() or {}
    name = (data.get("displayName") or "").strip()
    user.display_name = name[:120] if name else None
    db.session.commit()
    return jsonify({"success": True, "displayName": user.display_name})


@app.route("/api/jobs", methods=["GET"])
def api_jobs():
    user = get_current_user()
    jobs = (
        Job.query.filter_by(user_id=user.id)
        .order_by(desc(Job.created_at))
        .all()
    )
    return jsonify({"jobs": [serialize_job(job) for job in jobs]})


@app.route("/api/jobs", methods=["POST"])
def api_create_job():
    user = get_current_user()
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "Missing file upload"}), 400

    job = Job(
        id=str(uuid.uuid4()),
        user_id=user.id,
        original_filename=file.filename or "upload.epub",
        stored_filename="source.epub",
        status=JobStatus.QUEUED,
        settings_json=json.dumps(parse_settings(request.form)),
    )
    db.session.add(job)

    job_dir = job.job_dir
    source_path = job.source_path
    file.stream.seek(0)
    file.save(source_path)
    job.size_bytes = source_path.stat().st_size

    try:
        ensure_epub_archive(source_path)
    except ValueError as exc:
        shutil.rmtree(job_dir, ignore_errors=True)
        db.session.rollback()
        message = f"{exc}" if exc.args else "Uploaded file is not a valid EPUB archive."
        app.logger.warning(
            "Upload rejected: not a valid EPUB archive (job_id=%s, filename=%s, size=%s, reason=%s)",
            job.id,
            file.filename,
            job.size_bytes,
            exc,
        )
        return jsonify({"error": message}), 400

    db.session.commit()

    enqueue_job(job.id)

    return jsonify({"job": serialize_job(job)}), 202


@app.route("/api/jobs/<job_id>/retry", methods=["POST"])
def api_retry_job(job_id):
    job = get_job_for_user(job_id)
    if job.status not in {JobStatus.FAILED, JobStatus.COMPLETED, JobStatus.CANCELED}:
        abort(409, "当前状态无法重试")

    if job.pdf_path.exists():
        job.pdf_path.unlink()
    job.status = JobStatus.QUEUED
    job.error_message = None
    job.completed_at = None
    job.updated_at = utc_now()
    db.session.commit()

    enqueue_job(job.id)
    return jsonify({"job": serialize_job(job)})


@app.route("/api/jobs/<job_id>", methods=["DELETE"])
def api_delete_job(job_id):
    job = get_job_for_user(job_id)
    if job.status == JobStatus.PROCESSING:
        job.status = JobStatus.CANCELED
        job.updated_at = utc_now()
        db.session.commit()
        return jsonify({"job": serialize_job(job), "message": "任务已标记为取消"})

    cleanup_job(job)
    return jsonify({"success": True})


@app.route("/api/jobs", methods=["DELETE"])
def api_clear_jobs():
    user = get_current_user()
    jobs = Job.query.filter_by(user_id=user.id).all()
    for job in jobs:
        cleanup_job(job, commit=False)
    db.session.commit()
    return jsonify({"success": True})


@app.route("/api/jobs/<job_id>/download", methods=["GET"])
def api_download(job_id):
    job = get_job_for_user(job_id)
    if job.status != JobStatus.COMPLETED or not job.pdf_path.exists():
        abort(404)
    return send_file(job.pdf_path, as_attachment=True, download_name=f"{job.original_filename.rsplit('.', 1)[0]}.pdf")


@app.route("/api/jobs/<job_id>/reveal", methods=["POST"])
def api_reveal(job_id):
    job = get_job_for_user(job_id)
    if job.status != JobStatus.COMPLETED or not job.pdf_path.exists():
        abort(404, "PDF 尚未生成")

    try:
        reveal_in_explorer(job.pdf_path)
    except Exception as exc:  # pragma: no cover - platform specific
        abort(500, f"无法打开文件夹: {exc}")

    return jsonify({"success": True})


@app.route("/health")
def health():
    return {"status": "ok"}


def get_job_for_user(job_id: str) -> Job:
    user = get_current_user()
    job = db.session.get(Job, job_id)
    if not job or job.user_id != user.id:
        abort(404)
    return job


def parse_settings(form_data) -> Dict[str, Any]:
    settings: Dict[str, Any] = {}
    page_size = form_data.get("pageSize") or "A4"
    if page_size not in {"A4", "Letter", "Legal"}:
        page_size = "A4"
    settings["pageSize"] = page_size

    margin = form_data.get("margin")
    try:
        margin_value = float(margin)
        if not 0 <= margin_value <= 50:
            raise ValueError
    except (TypeError, ValueError):
        margin_value = 15.0
    settings["marginMm"] = margin_value
    return settings


def serialize_job(job: Job) -> Dict[str, Any]:
    download_url = None
    if job.status == JobStatus.COMPLETED and job.pdf_path.exists():
        download_url = url_for("api_download", job_id=job.id)

    return {
        "id": job.id,
        "originalFilename": job.original_filename,
        "status": job.status,
        "error": job.error_message,
        "createdAt": job.created_at.isoformat(),
        "updatedAt": (job.updated_at.isoformat() if job.updated_at else None),
        "completedAt": (job.completed_at.isoformat() if job.completed_at else None),
        "sizeBytes": job.size_bytes,
        "settings": job.settings(),
        "downloadUrl": download_url,
    }


def enqueue_job(job_id: str) -> None:
    app.logger.info("Queueing job %s", job_id)
    if app.config.get("EPUB_PDF_SYNC") or app.config.get("TESTING"):
        process_job(job_id)
    else:
        start_worker()
        job_queue.put(job_id)


def start_worker():
    global worker_thread
    with _worker_lock:
        if worker_thread and worker_thread.is_alive():
            return
        worker_thread = threading.Thread(target=worker_loop, daemon=True)
        worker_thread.start()


def worker_loop():
    while True:
        job_id = job_queue.get()
        try:
            process_job(job_id)
        except Exception as exc:  # pragma: no cover - logged for debugging
            app.logger.exception("Job %s failed: %s", job_id, exc)
        finally:
            job_queue.task_done()


def process_job(job_id: str) -> None:
    with app.app_context():
        job = db.session.get(Job, job_id)
        if not job:
            return
        if job.status == JobStatus.CANCELED:
            return

        job.status = JobStatus.PROCESSING
        job.error_message = None
        job.updated_at = utc_now()
        db.session.commit()

        output_path = job.pdf_path
        output_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            convert_to_pdf(job.source_path, output_path, job.settings())
            db.session.refresh(job)
            if job.status == JobStatus.CANCELED:
                output_path.unlink(missing_ok=True)
                job.error_message = job.error_message or "任务已取消"
                job.updated_at = utc_now()
            else:
                job.status = JobStatus.COMPLETED
                job.pdf_filename = output_path.name
                job.completed_at = utc_now()
                job.updated_at = utc_now()
        except Exception:
            job.status = JobStatus.FAILED
            job.error_message = traceback.format_exc()
            job.updated_at = utc_now()
        finally:
            db.session.commit()


def cleanup_job(job: Job, commit: bool = True) -> None:
    job_dir = job.job_dir
    if job_dir.exists():
        shutil.rmtree(job_dir, ignore_errors=True)
    db.session.delete(job)
    if commit:
        db.session.commit()


def convert_to_pdf(source_path: Path, output_path: Path, settings: Dict[str, Any]) -> None:
    if not source_path.exists():
        raise FileNotFoundError("EPUB 文件不存在")

    page_size = settings.get("pageSize", "A4")
    margin_mm = float(settings.get("marginMm", 15.0))

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        extract_dir = tmpdir_path / "extracted"
        extract_dir.mkdir(parents=True, exist_ok=True)

        if source_path.is_dir():
            temp_epub = tmpdir_path / "source.epub"
            with zipfile.ZipFile(temp_epub, "w") as zip_out:
                for item in source_path.rglob("*"):
                    if item.is_file():
                        zip_out.write(item, item.relative_to(source_path))
            archive_path = temp_epub
        else:
            archive_path = source_path

        with zipfile.ZipFile(archive_path, "r") as zip_ref:
            zip_ref.extractall(extract_dir)

        book = epub.read_epub(str(archive_path))
        rendered_html = assemble_html(book, extract_dir)
        pdf_bytes = render_pdf_with_chromium(
            rendered_html,
            page_size=page_size,
            margin_mm=margin_mm,
        )

    output_path.write_bytes(pdf_bytes)


def is_epub_archive(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 4:
        return False
    try:
        if not zipfile.is_zipfile(path):
            return False
        with zipfile.ZipFile(path, "r") as zf:
            names = {name.lower() for name in zf.namelist()}
            if "meta-inf/container.xml" not in names:
                return False
            mimetype = zf.read("mimetype").decode("utf-8", errors="ignore").strip().lower() if "mimetype" in names else ""
            if mimetype and mimetype != "application/epub+zip":
                return False
        return True
    except Exception:
        return False


def ensure_epub_archive(path: Path) -> None:
    if path.is_dir():
        temp_file = path.with_suffix(".tmp.epub")
        if temp_file.exists():
            temp_file.unlink()
        repack_epub_directory(path, temp_file)
        shutil.rmtree(path, ignore_errors=True)
        shutil.move(temp_file, path)
        ensure_epub_archive(path)
        return

    if is_epub_archive(path):
        return

    if not zipfile.is_zipfile(path):
        raise ValueError("Uploaded file is not a valid EPUB archive. Please choose an .epub file.")

    with tempfile.TemporaryDirectory() as tmp:
        tmpdir = Path(tmp)
        with zipfile.ZipFile(path, "r") as zf:
            try:
                zf.extractall(tmpdir)
            except Exception as exc:
                raise ValueError("Failed to unpack the uploaded archive.") from exc

        inner_epub_dirs = sorted(p for p in tmpdir.rglob("*.epub") if p.is_dir())
        if inner_epub_dirs:
            repack_epub_directory(inner_epub_dirs[0], path)
            ensure_epub_archive(path)
            return

        inner_epubs = sorted(p for p in tmpdir.rglob("*.epub") if p.is_file())
        if inner_epubs:
            target = inner_epubs[0]
            shutil.copyfile(target, path)
            ensure_epub_archive(path)
            return

        if is_epub_directory(tmpdir):
            repack_epub_directory(tmpdir, path)
            ensure_epub_archive(path)
            return

    raise ValueError("Uploaded file is not a valid EPUB archive. Please choose an .epub file.")


def is_epub_directory(directory: Path) -> bool:
    if not directory.exists():
        return False
    meta = list(directory.rglob("META-INF/container.xml"))
    mimetype = list(directory.rglob("mimetype"))
    if not meta or not mimetype:
        return False
    try:
        content = mimetype[0].read_text(encoding="utf-8", errors="ignore").strip().lower()
    except Exception:
        content = ""
    return content in {"application/epub+zip", ""}


def repack_epub_directory(source_dir: Path, output_path: Path) -> None:
    temp_epub = output_path.with_suffix(".tmp")
    if temp_epub.exists():
        temp_epub.unlink()

    rel_root = source_dir
    if source_dir.is_dir():
        children = [child for child in source_dir.iterdir() if not child.name.startswith("__MACOSX")]
        if len(children) == 1 and children[0].is_dir():
            rel_root = children[0]
    else:
        raise ValueError("EPUB directory repack expected a folder")

    with zipfile.ZipFile(temp_epub, "w") as zf:
        mimetype_file = next((p for p in rel_root.rglob("mimetype") if p.is_file()), None)
        if mimetype_file:
            zf.write(mimetype_file, "mimetype", compress_type=zipfile.ZIP_STORED)
        for file in sorted(rel_root.rglob("*")):
            if not file.is_file():
                continue
            arcname = file.relative_to(rel_root)
            if str(arcname) == "mimetype":
                continue
            zf.write(file, str(arcname))

    if output_path.exists():
        if output_path.is_dir():
            shutil.rmtree(output_path, ignore_errors=True)
        else:
            output_path.unlink()
    shutil.move(temp_epub, output_path)


def reveal_in_explorer(target: Path) -> None:
    target = target.resolve()
    if not target.exists():
        raise FileNotFoundError(f"路径不存在: {target}")

    if os.environ.get("EPUB_PDF_TEST_MODE"):
        return

    system = platform.system()
    if system == "Darwin":
        subprocess.Popen(["open", "-R", str(target)])
    elif system == "Windows":
        subprocess.Popen(["explorer", "/select,", str(target)])
    else:
        subprocess.Popen(["xdg-open", str(target.parent)])


def assemble_html(book: epub.EpubBook, extract_dir: Path) -> str:
    styles = []
    body_parts = []

    for item in book.get_items():
        if item is None:
            continue
        if item.get_type() == ITEM_STYLE:
            styles.append(_decode_bytes(item.get_content()))

    for item in book.get_items_of_type(ITEM_DOCUMENT):
        if item is None or not hasattr(item, "get_content"):
            continue
        body_content = _decode_bytes(item.get_content())
        soup = BeautifulSoup(body_content, "lxml")
        name = getattr(item, "get_name", lambda: "")()
        doc_dir = PurePosixPath(name or "").parent

        for tag in soup.find_all(src=True):
            src = tag.get("src")
            if not src:
                continue
            resolved = resolve_resource(doc_dir, src)
            tag["src"] = resolved

        for tag in soup.find_all(href=True):
            href = tag.get("href")
            if not href:
                continue
            resolved = resolve_resource(doc_dir, href)
            tag["href"] = resolved

        body = soup.body or soup
        body_parts.append(str(body))

    style_block = "\n".join(styles)
    base_href = extract_dir.as_uri().rstrip('/') + '/'
    assembled_html = f"""
    <!DOCTYPE html>
    <html lang=\"zh-CN\">
    <head>
      <meta charset=\"utf-8\">
      <base href=\"{base_href}\">
      <style>
        body {{ font-family: 'Noto Sans CJK SC', 'PingFang SC', 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 40px; }}
        img {{ max-width: 100%; height: auto; margin: 1rem 0; }}
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


def render_pdf_with_chromium(html: str, page_size: str, margin_mm: float) -> bytes:
    if os.environ.get("EPUB_PDF_TEST_MODE"):
        return b"%PDF-1.4\n% Stub PDF generated for tests\n"

    with tempfile.TemporaryDirectory() as tmpdir:
        html_path = Path(tmpdir) / "book.html"
        html_path.write_text(html, encoding="utf-8")

        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            page.goto(html_path.as_uri(), wait_until="networkidle")
            page.add_style_tag(content=f"@page {{ size: {page_size}; margin: {margin_mm}mm; }}")
            pdf_bytes = page.pdf(format=page_size, print_background=True, margin={
                "top": f"{margin_mm}mm",
                "bottom": f"{margin_mm}mm",
                "left": f"{margin_mm}mm",
                "right": f"{margin_mm}mm",
            })
            browser.close()

    return pdf_bytes


def resolve_resource(doc_dir: PurePosixPath, link: str) -> str:
    href_path = PurePosixPath(link)
    if href_path.is_absolute() or href_path.anchor:
        return href_path.as_posix()
    if str(href_path).startswith("data:"):
        return link
    normalized = doc_dir.joinpath(href_path).as_posix()
    return normalized


def _decode_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "gb18030", "shift_jis"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="ignore")


if __name__ == "__main__":
    start_worker()
    app.run(debug=True)
