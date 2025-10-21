import io
import os
import zipfile
from pathlib import Path

import pytest

os.environ.setdefault("EPUB_PDF_TEST_MODE", "1")
os.environ.setdefault("EPUB_PDF_SYNC", "1")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in os.sys.path:
    os.sys.path.insert(0, str(ROOT))

import app  # noqa: E402
from app import db, JobStatus


@pytest.fixture
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test.db"
    app.app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI=f"sqlite:///{db_path}",
    )

    storage_path = tmp_path / "storage"
    storage_path.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(app, "STORAGE_DIR", storage_path, raising=False)

    with app.app.app_context():
        db.drop_all()
        db.create_all()

    with app.app.test_client() as client:
        yield client


def build_epub_bytes() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("mimetype", "application/epub+zip", compress_type=zipfile.ZIP_STORED)
        zf.writestr(
            "META-INF/container.xml",
            """<?xml version='1.0' encoding='utf-8'?>
            <container version='1.0' xmlns='urn:oasis:names:tc:opendocument:xmlns:container'>
              <rootfiles>
                <rootfile full-path='OEBPS/content.opf' media-type='application/oebps-package+xml'/>
              </rootfiles>
            </container>
            """,
        )
        zf.writestr(
            "OEBPS/content.opf",
            """<?xml version='1.0' encoding='utf-8'?>
            <package xmlns='http://www.idpf.org/2007/opf' version='2.0' unique-identifier='BookId'>
              <metadata xmlns:dc='http://purl.org/dc/elements/1.1/'>
                <dc:title>测试书籍</dc:title>
                <dc:language>zh</dc:language>
                <dc:identifier id='BookId'>urn:uuid:test-epub</dc:identifier>
              </metadata>
              <manifest>
                <item id='style' href='Styles/style.css' media-type='text/css'/>
                <item id='chapter1' href='Text/ch1.xhtml' media-type='application/xhtml+xml'/>
                <item id='ncx' href='toc.ncx' media-type='application/x-dtbncx+xml'/>
              </manifest>
              <spine toc='ncx'>
                <itemref idref='chapter1'/>
              </spine>
              <guide>
                <reference type='text' title='正文' href='Text/ch1.xhtml'/>
              </guide>
            </package>
            """,
        )
        zf.writestr(
            "OEBPS/toc.ncx",
            """<?xml version='1.0' encoding='utf-8'?>
            <ncx xmlns='http://www.daisy.org/z3986/2005/ncx/' version='2005-1'>
              <head>
                <meta name='dtb:uid' content='urn:uuid:test-epub'/>
              </head>
              <docTitle><text>测试书籍</text></docTitle>
              <navMap>
                <navPoint id='navPoint-1' playOrder='1'>
                  <navLabel><text>第一章</text></navLabel>
                  <content src='Text/ch1.xhtml'/>
                </navPoint>
              </navMap>
            </ncx>
            """,
        )
        zf.writestr(
            "OEBPS/Styles/style.css",
            "body { font-family: 'Noto Sans CJK SC', sans-serif; } h1 { color: #2563eb; }",
        )
        zf.writestr(
            "OEBPS/Text/ch1.xhtml",
            """<?xml version='1.0' encoding='utf-8'?>
            <html xmlns='http://www.w3.org/1999/xhtml'>
              <head><title>第一章</title></head>
              <body><h1>第一章 起航</h1><p>这是一个中文段落，测试排版。</p></body>
            </html>
            """,
        )
    return buffer.getvalue()


def test_create_and_download_job(client):
    session_resp = client.get("/api/session")
    assert session_resp.status_code == 200

    epub_bytes = build_epub_bytes()
    data = {
        "file": (io.BytesIO(epub_bytes), "demo.epub"),
        "pageSize": "A4",
        "margin": "15",
    }
    create_resp = client.post("/api/jobs", data=data, content_type="multipart/form-data")
    assert create_resp.status_code == 202
    job_id = create_resp.get_json()["job"]["id"]

    list_resp = client.get("/api/jobs")
    assert list_resp.status_code == 200
    jobs = list_resp.get_json()["jobs"]
    assert jobs[0]["id"] == job_id
    if jobs[0]["status"] != JobStatus.COMPLETED:
        pytest.fail(f"Job failed: status={jobs[0]['status']}, error={jobs[0].get('error')}")
    assert jobs[0]["downloadUrl"]

    download_resp = client.get(jobs[0]["downloadUrl"])
    assert download_resp.status_code == 200
    assert download_resp.headers["Content-Type"].startswith("application/pdf")

    retry_resp = client.post(f"/api/jobs/{job_id}/retry")
    assert retry_resp.status_code == 200

    delete_resp = client.delete(f"/api/jobs/{job_id}")
    assert delete_resp.status_code == 200

    clear_resp = client.delete("/api/jobs")
    assert clear_resp.status_code == 200
