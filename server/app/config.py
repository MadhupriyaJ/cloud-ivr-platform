import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


# Load shared environment variables from repository root.
ENV_PATH = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=ENV_PATH)


@dataclass(frozen=True)
class Settings:
    hospital_name: str
    voice: str
    host: str
    port: int
    openai_realtime_model: str
    openai_api_key: str | None
    azure_openai_api_key: str | None
    azure_openai_endpoint: str | None
    azure_openai_deployment: str | None
    azure_openai_api_version: str
    azure_speech_api_key: str | None
    azure_speech_region: str | None
    azure_speech_endpoint: str | None


def _clean_env(name: str, default: str | None = None) -> str | None:
    """
    Read and normalize environment values.

    Why:
    - `.env` values may contain accidental spaces or wrapping quotes.
    - Normalization prevents silent auth failures from formatting issues.
    """
    raw = os.getenv(name, default)
    if raw is None:
        return None
    value = raw.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        value = value[1:-1].strip()
    return value


def load_settings() -> Settings:
    return Settings(
        hospital_name=(_clean_env("HOSPITAL_NAME", "City Care Hospital") or "City Care Hospital"),
        voice=(_clean_env("VOICE", "alloy") or "alloy"),
        host=(_clean_env("WEB_IVR_HOST", "0.0.0.0") or "0.0.0.0"),
        port=int((_clean_env("WEB_IVR_PORT", "8010") or "8010")),
        openai_realtime_model=(
            _clean_env("OPENAI_REALTIME_MODEL", "gpt-4o-realtime-preview-2024-10-01")
            or "gpt-4o-realtime-preview-2024-10-01"
        ),
        openai_api_key=_clean_env("OPENAI_API_KEY"),
        azure_openai_api_key=_clean_env("AZURE_OPENAI_API_KEY"),
        azure_openai_endpoint=_clean_env("AZURE_OPENAI_ENDPOINT"),
        azure_openai_deployment=_clean_env("AZURE_OPENAI_DEPLOYMENT"),
        azure_openai_api_version=(_clean_env("AZURE_OPENAI_API_VERSION", "2024-10-01-preview") or "2024-10-01-preview"),
        azure_speech_api_key=_clean_env("AZURE_SPEECH_API"),
        azure_speech_region=_clean_env("AZURE_SPEECH_REGION"),
        azure_speech_endpoint=_clean_env("AZURE_SPEECH_ENDPOINT"),
    )
