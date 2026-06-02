from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str = "postgresql://wavefinder:wavefinder@localhost:5432/wavefinder"
    data_dir: Path = Path("./data")
    models_dir: Path = Path("./models")
    coastline_cache_dir: Path = Path("./data/coastline")

    # Chip spec (v1)
    chip_size_px: int = 512
    gsd_m: float = 10.0  # Sentinel-2 ~10m
    overlap_fraction: float = 0.25
    coast_buffer_m: float = 200.0
    max_shore_span_km: float = 25.0
    pin_score_threshold: float = 0.2
    pin_dedup_m: float = 100.0

    # Planetary Computer STAC (no key required for basic use)
    stac_url: str = "https://planetarycomputer.microsoft.com/api/stac/v1"

    # Optional fallback for labeling chips (copy from apps/web/.env)
    mapbox_access_token: str | None = None

    @property
    def chip_size_m(self) -> float:
        return self.chip_size_px * self.gsd_m


settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
settings.models_dir.mkdir(parents=True, exist_ok=True)
settings.coastline_cache_dir.mkdir(parents=True, exist_ok=True)
