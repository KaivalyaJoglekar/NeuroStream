from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    aws_access_key_id: str
    aws_secret_access_key: str
    aws_region: str = "us-east-1"
    s3_export_bucket: str = "neurostream-exports"
    presigned_url_expiry: int = 3600
    port: int = 8007

    class Config:
        env_file = ".env"


settings = Settings()
