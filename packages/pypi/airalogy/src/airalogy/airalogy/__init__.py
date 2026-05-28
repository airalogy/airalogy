import base64
import json
import mimetypes
import os
import uuid
import warnings
from pathlib import Path
from typing import Any, Optional

import httpx


LOCAL_FILE_MAP_ENV = "AIRALOGY_LOCAL_FILE_MAP_JSON"
LOCAL_FILE_OUTPUT_DIR_ENV = "AIRALOGY_LOCAL_FILE_OUTPUT_DIR"


class Airalogy:
    def __init__(
        self,
        *,
        base_url: Optional[str] = None,
        api_key: Optional[str] = None,
        protocol_id: Optional[str] = None,
    ) -> None:
        """
        Initialize the Airalogy client.

        Explicit constructor values take precedence over environment variables.

        Required environment variables:
          - AIRALOGY_BASE_URL or AIRALOGY_ENDPOINT
          - AIRALOGY_API_KEY
          - AIRALOGY_PROTOCOL_ID (required for upload and record APIs)

        Returns:
            None

        Raises:
            ValueError: If required client configuration is not set.
        """
        legacy_endpoint = os.environ.get("AIRALOGY_ENDPOINT")
        resolved_base_url = (
            (base_url.rstrip("/") if base_url else None)
            or os.environ.get("AIRALOGY_BASE_URL")
            or legacy_endpoint
        )
        if not resolved_base_url:
            raise ValueError("AIRALOGY_BASE_URL or AIRALOGY_ENDPOINT is not set")
        if base_url is None and os.environ.get("AIRALOGY_BASE_URL") is None and legacy_endpoint:
            warnings.warn(
                "AIRALOGY_ENDPOINT is deprecated; use AIRALOGY_BASE_URL instead.",
                DeprecationWarning,
                stacklevel=2,
            )
        self._airalogy_base_url = resolved_base_url.rstrip("/")

        self._airalogy_api_key = api_key or os.environ.get("AIRALOGY_API_KEY")
        if not self._airalogy_api_key:
            raise ValueError("AIRALOGY_API_KEY is not set")

        self._airalogy_protocol_id = protocol_id or os.environ.get("AIRALOGY_PROTOCOL_ID")

    def _require_protocol_id(self) -> str:
        if not self._airalogy_protocol_id:
            raise ValueError("AIRALOGY_PROTOCOL_ID is not set")
        return self._airalogy_protocol_id

    def _local_file_map(self) -> dict[str, Any]:
        raw_map = os.environ.get(LOCAL_FILE_MAP_ENV)
        if not raw_map:
            return {}
        try:
            parsed = json.loads(raw_map)
        except json.JSONDecodeError as err:
            raise ValueError(f"{LOCAL_FILE_MAP_ENV} is not valid JSON") from err
        if not isinstance(parsed, dict):
            raise ValueError(f"{LOCAL_FILE_MAP_ENV} must be a JSON object")
        return parsed

    def _local_file_path(self, file_id: str) -> Path | None:
        entry = self._local_file_map().get(file_id)
        if isinstance(entry, str):
            return Path(entry)
        if isinstance(entry, dict) and isinstance(entry.get("path"), str):
            return Path(entry["path"])
        return None

    def _upload_file_bytes_to_local_bridge(
        self,
        file_name: str,
        file_bytes: bytes,
        output_dir: str,
    ) -> dict[str, object]:
        target_dir = Path(output_dir)
        target_dir.mkdir(parents=True, exist_ok=True)
        file_id = f"airalogy.id.file.{uuid.uuid4()}"
        normalized_file_name = Path(file_name).name or "upload.bin"
        content_type = mimetypes.guess_type(normalized_file_name)[0] or "application/octet-stream"
        metadata = {
            "id": file_id,
            "file_name": normalized_file_name,
            "name": normalized_file_name,
            "content_type": content_type,
            "size": len(file_bytes),
        }
        (target_dir / f"{file_id}.bin").write_bytes(file_bytes)
        (target_dir / f"{file_id}.json").write_text(
            json.dumps(metadata, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return metadata

    def download_file_bytes(self, file_id: str) -> bytes:
        """
        Download an Airalogy File in bytes format from Airalogy Platform.

        Parameters:
            file_id (str): Each file uploaded to Airalogy is assigned a unique ID (Airalogy File ID). The ID has a consistent format: airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

        Returns:
            bytes: The downloaded file content in bytes format.

        Raises:
            Exception: If the download fails.
        """
        local_file_path = self._local_file_path(file_id)
        if local_file_path is not None:
            return local_file_path.read_bytes()

        res = httpx.get(
            f"{self._airalogy_base_url}/airalogy/download/{file_id}",
            headers={"AIRALOGY-API-KEY": self._airalogy_api_key},
        )

        if res.status_code != 200:
            raise Exception(
                f"Failed to download file with id {file_id}, error: {res.content}"
            )

        return res.content

    def download_file_base64(self, file_id: str) -> str:
        """
        Download an Airalogy File in base64 encoded format from Airalogy Platform.

        Parameters:
            file_id (str): Each file uploaded to Airalogy is assigned a unique ID (Airalogy File ID). The ID has a consistent format: airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

        Returns:
            str: The downloaded file content in base64 encoded format.
        """
        return base64.b64encode(self.download_file_bytes(file_id)).decode()

    def get_file_url(self, file_id: str) -> str:
        """
        Get the download URL for an Airalogy File.

        Parameters:
            file_id (str): Each file uploaded to Airalogy is assigned a unique ID (Airalogy File ID). The ID has a consistent format: airalogy.id.file.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

        Returns:
            str: The download URL for the file.

        Example:
            >>> airalogy_client = Airalogy()
            >>> file_url = airalogy_client.get_file_url(file_id="airalogy.id.file.12345678-1234-1234-1234-123456789012")
            >>> print(file_url)  # Returns the actual download URL from the API

        Raises:
            Exception: If the API call fails to retrieve the file URL.
        """

        res = httpx.get(
            f"{self._airalogy_base_url}/airalogy/get_file_url/{file_id}",
            headers={"AIRALOGY-API-KEY": self._airalogy_api_key},
        )

        if res.status_code != 200:
            raise Exception(
                f"Failed to get file URL for file_id {file_id}, error: {res.content}"
            )

        response_data = res.json()
        return response_data["url"]

    def upload_file_bytes(self, file_name: str, file_bytes: bytes) -> dict[str, object]:
        """
        Upload a file in bytes format to the Airalogy service.

        Parameters:
            file_name (str): The name of the file to upload.
            file_bytes (bytes): The content of the file in bytes.

        Returns:
            response(dict): upload response
                id (str): The Airalogy File ID of the uploaded file.
                file_name (str): The name of the uploaded file.

        Raises:
            Exception: If the upload fails.
        """
        local_output_dir = os.environ.get(LOCAL_FILE_OUTPUT_DIR_ENV)
        if local_output_dir:
            return self._upload_file_bytes_to_local_bridge(
                file_name=file_name,
                file_bytes=file_bytes,
                output_dir=local_output_dir,
            )

        res = httpx.post(
            f"{self._airalogy_base_url}/airalogy/upload",
            headers={"AIRALOGY-API-KEY": self._airalogy_api_key},
            files={"file": (file_name, file_bytes)},
            data={"airalogy_protocol_id": self._require_protocol_id()},
        )
        if res.status_code != 200:
            raise Exception(f"Failed to upload, error: {res.content}")

        return res.json()

    def upload_file_base64(self, file_name: str, file_base64: str) -> dict[str, object]:
        """
        Uploads base64 encoded content to the Airalogy service.

        Parameters:
            file_name (str): The name of the file to upload.
            file_base64 (str): The base64 encoded content of the file.

        Returns:
            response(dict): upload response
                id (str): The airalogy_file_id of the uploaded asset.
                file_name (str): The name of the uploaded asset.

        Raises:
            Exception: If the upload fails.
        """
        return self.upload_file_bytes(
            file_name=file_name, file_bytes=base64.b64decode(file_base64)
        )

    def download_records_json(self, record_ids: list[str]) -> str:
        """
        Retrieve airalogy records based on the provided record IDs.

        Parameters:
            airalogy_record_ids (list[str]): The IDs of the records to retrieve. record id format: airalogy.id.record.xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

        Returns:
            data(str): The retrieved records data in JSON string format.

        Raises:
            Exception: If the retrieval of the records fails.
        """

        res: httpx.Response = httpx.post(
            f"{self._airalogy_base_url}/airalogy/get_records",
            json={
                "airalogy_protocol_id": self._require_protocol_id(),
                "airalogy_record_ids": record_ids,
            },
            headers={"AIRALOGY-API-KEY": self._airalogy_api_key},
        )

        if res.status_code != 200:
            raise Exception(f"Failed to get Airalogy Records. Error: {res.content}")

        return res.content.decode()
