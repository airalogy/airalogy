from datetime import datetime, timezone

import pytest
from pydantic import BaseModel, ValidationError

from airalogy.types import CurrentTime


class TestCurrentTime:
    """Tests for CurrentTime type"""

    def test_pydantic_model_with_datetime_object(self):
        """Test that CurrentTime accepts valid datetime objects through Pydantic"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        # Test with timezone-aware datetime
        dt_with_tz = datetime.now(timezone.utc)
        model = TimeModel(timestamp=dt_with_tz)
        assert isinstance(model.timestamp, datetime)
        assert model.timestamp == dt_with_tz

        # Test with naive datetime
        dt_naive = datetime.now()
        model_naive = TimeModel(timestamp=dt_naive)
        assert isinstance(model_naive.timestamp, datetime)
        assert model_naive.timestamp == dt_naive

    def test_pydantic_model_with_datetime_strings(self):
        """Test that CurrentTime can parse datetime strings through Pydantic"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        # ISO format string
        model1 = TimeModel(timestamp="2023-12-25T10:30:00")
        assert isinstance(model1.timestamp, datetime)
        assert model1.timestamp.year == 2023
        assert model1.timestamp.month == 12
        assert model1.timestamp.day == 25
        assert model1.timestamp.hour == 10
        assert model1.timestamp.minute == 30

        # ISO format with timezone
        model2 = TimeModel(timestamp="2023-12-25T10:30:00+08:00")
        assert isinstance(model2.timestamp, datetime)
        assert model2.timestamp.tzinfo is not None

        # Alternative datetime string format
        model3 = TimeModel(timestamp="2023-12-25 10:30:00.123")
        assert isinstance(model3.timestamp, datetime)
        assert model3.timestamp.microsecond == 123000

    def test_invalid_datetime_inputs(self):
        """Test that CurrentTime raises ValidationError for invalid inputs through Pydantic"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        # Invalid date string should raise ValidationError
        with pytest.raises(ValidationError):
            TimeModel(timestamp="invalid-date-string")

        # Invalid date string should raise ValidationError
        with pytest.raises(ValidationError):
            TimeModel(timestamp="2023-12-35 10:30:00.123")

        with pytest.raises(ValidationError):
            TimeModel(timestamp="2023-12-25 24:30:00.123")

        # None should raise ValidationError
        with pytest.raises(ValidationError):
            TimeModel(timestamp=None)

    def test_numeric_input_conversion(self):
        """Test that numeric inputs are converted to datetime (Unix timestamp)"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        # Integer is treated as Unix timestamp
        model = TimeModel(timestamp=1672574400)  # 2023-01-01 12:00:00 UTC
        assert isinstance(model.timestamp, datetime)
        assert model.timestamp.year == 2023
        assert model.timestamp.month == 1
        assert model.timestamp.day == 1

        # Float is also treated as Unix timestamp
        model_float = TimeModel(timestamp=1672574400.5)
        assert isinstance(model_float.timestamp, datetime)
        assert model_float.timestamp.microsecond == 500000

    def test_pydantic_integration_comprehensive(self):
        """Test CurrentTime with various Pydantic model scenarios"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        # Valid datetime object
        dt = datetime(2023, 12, 25, 10, 30, 0)
        model = TimeModel(timestamp=dt)
        assert isinstance(model.timestamp, datetime)
        assert model.timestamp == dt

        # Valid ISO string
        model_str = TimeModel(timestamp="2023-12-25T10:30:00")
        assert isinstance(model_str.timestamp, datetime)
        assert model_str.timestamp.year == 2023

        # Invalid input should raise ValidationError
        with pytest.raises(ValidationError):
            TimeModel(timestamp="invalid-date")

    def test_json_schema_metadata(self):
        """Test that CurrentTime includes correct airalogy_type in JSON schema"""

        class TimeModel(BaseModel):
            current_time: CurrentTime

        schema = TimeModel.model_json_schema()

        # Check that the schema contains the airalogy_type metadata
        assert "properties" in schema
        assert "current_time" in schema["properties"]
        current_time_schema = schema["properties"]["current_time"]

        # Verify the airalogy_type is correctly set
        assert current_time_schema.get("airalogy_type") == "CurrentTime"

        # Verify the description is included
        assert "description" in current_time_schema
        assert "timezone" in current_time_schema["description"].lower()
        assert "browser" in current_time_schema["description"].lower()

    def test_serialization_deserialization(self):
        """Test JSON serialization and deserialization"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        dt = datetime(2023, 12, 25, 10, 30, 0, tzinfo=timezone.utc)
        model = TimeModel(timestamp=dt)

        # Test JSON serialization
        json_data = model.model_dump_json()
        assert isinstance(json_data, str)

        # Test JSON deserialization
        model_from_json = TimeModel.model_validate_json(json_data)
        assert isinstance(model_from_json.timestamp, datetime)
        # Note: timezone info might be handled differently during serialization
        assert model_from_json.timestamp.replace(tzinfo=None) == dt.replace(tzinfo=None)

    def test_timezone_handling(self):
        """Test timezone-aware datetime handling"""

        class TimeModel(BaseModel):
            timestamp: CurrentTime

        # UTC timezone
        dt_utc = datetime(2023, 12, 25, 10, 30, 0, tzinfo=timezone.utc)
        model_utc = TimeModel(timestamp=dt_utc)
        assert model_utc.timestamp.tzinfo == timezone.utc

        # Custom timezone offset
        from datetime import timedelta

        custom_tz = timezone(timedelta(hours=8))
        dt_custom = datetime(2023, 12, 25, 10, 30, 0, tzinfo=custom_tz)
        model_custom = TimeModel(timestamp=dt_custom)
        assert model_custom.timestamp.tzinfo == custom_tz

    def test_multiple_fields_model(self):
        """Test model with multiple CurrentTime fields"""

        class MultiTimeModel(BaseModel):
            created_at: CurrentTime
            updated_at: CurrentTime

        dt1 = datetime(2023, 12, 25, 10, 30, 0)
        dt2 = datetime(2023, 12, 25, 11, 30, 0)

        model = MultiTimeModel(created_at=dt1, updated_at=dt2)
        assert isinstance(model.created_at, datetime)
        assert isinstance(model.updated_at, datetime)
        assert model.created_at == dt1
        assert model.updated_at == dt2

        # Check schema for both fields
        schema = MultiTimeModel.model_json_schema()
        for field_name in ["created_at", "updated_at"]:
            field_schema = schema["properties"][field_name]
            assert field_schema.get("airalogy_type") == "CurrentTime"

    def test_optional_current_time(self):
        """Test CurrentTime as optional field"""
        from typing import Optional

        class OptionalTimeModel(BaseModel):
            timestamp: Optional[CurrentTime] = None

        # Test with None
        model_none = OptionalTimeModel()
        assert model_none.timestamp is None

        # Test with actual datetime
        dt = datetime(2023, 12, 25, 10, 30, 0)
        model_with_time = OptionalTimeModel(timestamp=dt)
        assert isinstance(model_with_time.timestamp, datetime)
        assert model_with_time.timestamp == dt

    def test_real_world_usage_example(self):
        """Test CurrentTime in a realistic usage scenario"""

        class LogEntry(BaseModel):
            message: str
            timestamp: CurrentTime
            level: str = "INFO"

        # Create log entry with string timestamp
        log1 = LogEntry(message="Application started", timestamp="2023-12-25T10:30:00Z")
        assert log1.message == "Application started"
        assert isinstance(log1.timestamp, datetime)
        assert log1.level == "INFO"

        # Create log entry with datetime object
        now = datetime.now(timezone.utc)
        log2 = LogEntry(message="User logged in", timestamp=now, level="DEBUG")
        assert log2.timestamp == now
        assert log2.level == "DEBUG"

        # Verify schema includes airalogy_type
        schema = LogEntry.model_json_schema()
        timestamp_schema = schema["properties"]["timestamp"]
        assert timestamp_schema.get("airalogy_type") == "CurrentTime"
