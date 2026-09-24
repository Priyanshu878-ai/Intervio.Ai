import os
import tempfile
from typing import Optional, Set
from fastapi import HTTPException, UploadFile, status

ALLOWED_AUDIO_EXTENSIONS: Set[str] = {".wav", ".mp3", ".ogg", ".m4a", ".webm"}
ALLOWED_VIDEO_EXTENSIONS: Set[str] = {".mp4", ".webm", ".mov", ".avi"}

MAX_AUDIO_BYTES: int = 25 * 1024 * 1024  # 25 MB
MAX_VIDEO_BYTES: int = 100 * 1024 * 1024  # 100 MB
MAX_ANSWER_TEXT_LENGTH: int = 10_000


def validate_and_save_upload(
    upload_file: Optional[UploadFile],
    allowed_extensions: Set[str],
    max_bytes: int,
    default_suffix: str,
) -> Optional[str]:
    """
    Validates uploaded file against allowed extensions and maximum payload size.
    Streams chunks into a temporary file to avoid unbounded memory consumption.
    Cleans up any allocated temporary file if size limit is exceeded.
    """
    if not upload_file or not upload_file.filename:
        return None

    filename = upload_file.filename
    ext = os.path.splitext(filename)[1].lower() or default_suffix
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension '{ext}'. Allowed extensions: {', '.join(sorted(allowed_extensions))}",
        )

    bytes_read = 0
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    try:
        while True:
            chunk = upload_file.file.read(1024 * 1024)  # 1 MB chunk
            if not chunk:
                break
            bytes_read += len(chunk)
            if bytes_read > max_bytes:
                tmp_name = tmp.name
                tmp.close()
                if os.path.exists(tmp_name):
                    try:
                        os.remove(tmp_name)
                    except Exception:
                        pass
                raise HTTPException(
                    status_code=413,
                    detail=f"File exceeds maximum allowed size limit of {max_bytes // (1024 * 1024)}MB",
                )
            tmp.write(chunk)
        tmp.close()
        return tmp.name
    except Exception:
        tmp_name = tmp.name
        tmp.close()
        if os.path.exists(tmp_name):
            try:
                os.remove(tmp_name)
            except Exception:
                pass
        raise


def validate_answer_text(text: Optional[str]) -> Optional[str]:
    """
    Validates candidate answer text length and returns stripped string.
    """
    if not text:
        return None
    trimmed = text.strip()
    if len(trimmed) > MAX_ANSWER_TEXT_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Answer text exceeds maximum allowed length of {MAX_ANSWER_TEXT_LENGTH} characters",
        )
    return trimmed
