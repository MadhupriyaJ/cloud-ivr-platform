import uvicorn

from app import create_app
from app.config import load_settings


app = create_app()


if __name__ == "__main__":
    settings = load_settings()
    uvicorn.run("run:app", host=settings.host, port=settings.port )
