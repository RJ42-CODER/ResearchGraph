import os
import re
import uuid
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Query
import pypdf

from app.core.config import settings
from app.db.vector_store import index_paper_text, get_ordered_paper_chunks

router = APIRouter(prefix="/api/papers", tags=["Papers"])

UPLOAD_DIR = os.path.join(settings.RESEARCHGRAPH_DATA_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """Sanitizes filename against path traversal and malicious characters."""
    base = os.path.basename(filename or "document.pdf")
    sanitized = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base)
    if not sanitized.lower().endswith(".pdf"):
        sanitized += ".pdf"
    return sanitized


def process_and_index_pdf(save_path: str, file_id: str):
    """Runs in the background so drag-and-drop is non-blocking."""
    try:
        reader = pypdf.PdfReader(save_path)
        extracted_text = ""
        for idx, page in enumerate(reader.pages):
            text = page.extract_text()
            if text:
                extracted_text += f"\n[Page {idx + 1}]\n" + text

        chunk_count = index_paper_text(paper_id=file_id, text=extracted_text)
        print(f"[ChromaDB] Indexed {chunk_count} chunks for paper {file_id}")
    except Exception as e:
        print(f"[ChromaDB Error] Background indexing failed: {e}")


@router.post("/upload")
async def upload_paper(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    raw_name = file.filename or ""
    if not raw_name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_id = str(uuid.uuid4())[:8]
    clean_filename = sanitize_filename(raw_name)
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}_{clean_filename}")

    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    total_bytes = 0
    header_checked = False

    try:
        with open(save_path, "wb") as buffer:
            chunk_size = 64 * 1024  # 64KB chunks
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break

                if not header_checked:
                    # Validate PDF magic bytes (%PDF)
                    if not chunk.startswith(b"%PDF"):
                        raise HTTPException(
                            status_code=400,
                            detail="Invalid PDF file format: missing '%PDF' header signature.",
                        )
                    header_checked = True

                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File exceeds maximum allowed upload size of {settings.MAX_UPLOAD_MB}MB.",
                    )

                buffer.write(chunk)
    except HTTPException:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(
            status_code=500,
            detail="An error occurred while uploading and saving the PDF file.",
        )
    finally:
        await file.close()

    # Offload heavy embedding extraction to background task
    background_tasks.add_task(process_and_index_pdf, save_path, file_id)

    return {
        "status": "indexing_started",
        "paper_id": file_id,
        "filename": clean_filename,
    }


@router.get("/citation-excerpt")
async def get_citation_excerpt(
    paper_id: str = Query(..., description="ID of the paper"),
    page: str = Query("1", description="Page number or citation marker"),
):
    """Retrieves an excerpt for a citation modal, looking in uploaded PDFs or indexed chunks."""
    clean_id = (paper_id or "").strip()
    if not clean_id:
        raise HTTPException(status_code=400, detail="paper_id is required.")

    # 1. Check if a matching uploaded PDF exists on disk
    target_file = None
    try:
        for fname in os.listdir(UPLOAD_DIR):
            if fname.startswith(f"{clean_id}_") and fname.lower().endswith(".pdf"):
                target_file = os.path.join(UPLOAD_DIR, fname)
                break
    except Exception:
        pass

    if target_file and os.path.isfile(target_file):
        try:
            reader = pypdf.PdfReader(target_file)
            total_pages = len(reader.pages)
            page_num = 1
            try:
                page_num = max(1, min(total_pages, int(re.sub(r"\D", "", page) or "1")))
            except Exception:
                page_num = 1

            page_text = reader.pages[page_num - 1].extract_text() or ""
            return {
                "status": "success",
                "paper_id": clean_id,
                "paper_title": os.path.basename(target_file)[len(clean_id) + 1 :],
                "page": str(page_num),
                "citation_label": f"Page {page_num}",
                "excerpt": page_text[:1200] if page_text else "No extractable text found on this page.",
                "source_type": "pdf_page",
                "total_pages": total_pages,
            }
        except Exception as e:
            print(f"Failed to read PDF page for citation excerpt: {e}")

    # 2. Fallback to vector store chunks
    chunks = get_ordered_paper_chunks(clean_id)
    if chunks:
        return {
            "status": "success",
            "paper_id": clean_id,
            "paper_title": clean_id,
            "page": page,
            "citation_label": f"Section {page}",
            "excerpt": chunks[0][:1200],
            "source_type": "vector_chunk",
            "total_pages": len(chunks),
        }

    return {
        "status": "not_found",
        "paper_id": clean_id,
        "paper_title": clean_id,
        "page": page,
        "citation_label": f"Page {page}",
        "excerpt": "No cached document or text excerpt found for this paper.",
        "source_type": "none",
        "total_pages": 0,
    }
