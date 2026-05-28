import base64
import os
import warnings
from typing import Optional

import httpx


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

    def upload_file_bytes(self, file_name: str, file_bytes: bytes) -> dict[str, str]:
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

        res = httpx.post(
            f"{self._airalogy_base_url}/airalogy/upload",
            headers={"AIRALOGY-API-KEY": self._airalogy_api_key},
            files={"file": (file_name, file_bytes)},
            data={"airalogy_protocol_id": self._require_protocol_id()},
        )
        if res.status_code != 200:
            raise Exception(f"Failed to upload, error: {res.content}")

        return res.json()

    def upload_file_base64(self, file_name: str, file_base64: str) -> dict[str, str]:
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
