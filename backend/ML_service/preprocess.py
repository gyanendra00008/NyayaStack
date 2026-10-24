"""
Text Preprocessing Module for Vishanti Petition ML Classification Service.

Provides text cleaning, normalization, and combination utilities
tailored for problem titles and descriptions in English and Hinglish.
"""

import re
import unicodedata
from typing import Optional


def normalize_whitespace(text: str) -> str:
    """Replaces repeated spaces, tabs, and newlines with a single space and trims edges."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def remove_noise(text: str) -> str:
    """Removes HTML tags, URLs, and non-printable control characters."""
    if not text:
        return ""
    # Strip HTML tags
    text = re.sub(r"<[^>]+>", " ", text)
    # Strip URLs
    text = re.sub(r"https?://\S+|www\.\S+", " ", text)
    # Remove control characters
    text = "".join(ch for ch in text if unicodedata.category(ch)[0] != "C" or ch == " ")
    return text


def clean_punctuation(text: str) -> str:
    """
    Cleans noisy punctuation while preserving alphanumeric words, hyphens, and whitespace.
    Retains Latin characters, numbers, and common Hinglish / Devanagari characters.
    """
    if not text:
        return ""
    # Replace disruptive punctuation symbols with space
    text = re.sub(r"[!\"#\$%&'\(\)\*\+,\./:;<=>\?@\[\\\]\^_`\{\|\}~]+", " ", text)
    return text


def preprocess_text(text: Optional[str]) -> str:
    """
    Standard text normalization pipeline:
    1. Null/empty check.
    2. Unicode normalization (NFKD).
    3. Noise removal (HTML, URLs, control chars).
    4. Lowercasing.
    5. Punctuation cleaning.
    6. Whitespace consolidation.
    
    Preserves meaningful English and Hinglish domain words.
    """
    if text is None:
        return ""
    if not isinstance(text, str):
        text = str(text)

    # 1. Unicode decomposition
    normalized = unicodedata.normalize("NFKD", text)

    # 2. Noise removal
    denoised = remove_noise(normalized)

    # 3. Lowercase conversion
    lowered = denoised.lower()

    # 4. Punctuation cleaning
    cleaned = clean_punctuation(lowered)

    # 5. Whitespace normalization
    return normalize_whitespace(cleaned)


def combine_text(title: Optional[str], description: Optional[str]) -> str:
    """
    Combines problem title and description into a single text representation
    with appropriate semantic boundary separation before classification.
    """
    title_part = (title or "").strip()
    desc_part = (description or "").strip()

    if title_part and desc_part:
        return f"{title_part}. {desc_part}"
    elif title_part:
        return title_part
    elif desc_part:
        return desc_part
    return ""
