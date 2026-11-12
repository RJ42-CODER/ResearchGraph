import os
import shutil
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
import pypdf
from app.db.vector_store import index_paper_text

router = APIRouter(prefix="/api/papers", tags=["Papers"])

UPLOAD_DIR = "./data/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

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
    if not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    file_id = str(uuid.uuid4())[:8]
    clean_filename = file.filename
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}_{clean_filename}")
    
    # Fast binary file copy
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Offload heavy embedding extraction to background task
    background_tasks.add_task(process_and_index_pdf, save_path, file_id)

    # Return immediately to the client
    return {
        "status": "indexing_started",
        "paper_id": file_id,
        "filename": clean_filename
    }