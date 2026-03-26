# backend/routes/extract.py
import openai
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from backend.schemas import ExtractionResponse
from backend.services.ai import extract_from_document, extract_from_text

router = APIRouter(prefix="/extract", tags=["extract"])


class TextExtractionRequest(BaseModel):
    text: str


@router.post("/text", response_model=ExtractionResponse)
async def extract_text(body: TextExtractionRequest):
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Request text cannot be empty")
    try:
        extracted = await extract_from_text(body.text)
        return ExtractionResponse(**extracted)
    except openai.AuthenticationError:
        raise HTTPException(status_code=500, detail="OpenAI API key is invalid or missing. Check your .env file.")
    except openai.RateLimitError:
        raise HTTPException(status_code=500, detail="OpenAI rate limit reached. Please try again in a moment.")
    except openai.APIConnectionError:
        raise HTTPException(status_code=500, detail="Could not connect to OpenAI. Check your internet connection.")
    except Exception:
        raise HTTPException(status_code=500, detail="AI parsing failed. Please try again or fill the form manually.")


@router.post("", response_model=ExtractionResponse)
async def extract_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    file_bytes = await file.read()

    try:
        extracted = await extract_from_document(file_bytes)
        return ExtractionResponse(**extracted)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except openai.AuthenticationError:
        raise HTTPException(status_code=500, detail="OpenAI API key is invalid or missing. Check your .env file.")
    except openai.RateLimitError:
        raise HTTPException(status_code=500, detail="OpenAI rate limit reached. Please try again in a moment.")
    except openai.APIConnectionError:
        raise HTTPException(status_code=500, detail="Could not connect to OpenAI. Check your internet connection.")
    except Exception as e:
        raise HTTPException(status_code=500, detail="AI extraction failed. Please try again or fill the form manually.")
