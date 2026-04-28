import io
from PIL import Image, UnidentifiedImageError
import pytesseract


def extract_text(file_bytes: bytes, content_type: str | None = None) -> str:
    if not file_bytes:
        raise ValueError("Empty file")

    # 1. Try plain text
    if content_type in {"text/plain", "text/csv", "application/json"}:
        try:
            return file_bytes.decode("utf-8").strip()
        except UnicodeDecodeError:
            pass

    # 2. Try PDF
    try:
        import fitz  # PyMuPDF

        pdf = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""

        for page in pdf:
            page_text = page.get_text()

            if page_text.strip():
                text += page_text
            else:
                # fallback to OCR per page
                pix = page.get_pixmap()
                img = Image.open(io.BytesIO(pix.tobytes("png"))).convert("L")
                text += pytesseract.image_to_string(img, config="--oem 3 --psm 6")

        if text.strip():
            return text.strip()

    except Exception:
        pass

    # 3. Try image OCR
    try:
        image = Image.open(io.BytesIO(file_bytes)).convert("L")
        return pytesseract.image_to_string(image, config="--oem 3 --psm 6").strip()

    except UnidentifiedImageError:
        pass

    raise ValueError("Unsupported file type")