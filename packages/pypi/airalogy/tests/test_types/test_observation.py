from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from airalogy.types import Observation, ObservationSeriesRef, ObservationSource


def test_observation_validates_typed_value_and_collector_source():
    observation = Observation[float](
        value="23.4",
        observed_at="2026-07-19T20:30:05+08:00",
        received_at="2026-07-19T20:30:06+08:00",
        source={
            "kind": "collector",
            "connector": "lab_sensor_gateway",
            "collector": "room_temperature",
            "device_id": "thermometer-01",
        },
        unit="Cel",
    )

    assert observation.value == 23.4
    assert observation.source.connector == "lab_sensor_gateway"
    assert observation.observed_at.utcoffset() is not None


def test_observation_rejects_naive_timestamps():
    with pytest.raises(ValidationError, match="must include a timezone"):
        Observation[int](
            value=1,
            observed_at=datetime(2026, 7, 19, 20, 30),
            received_at=datetime.now(timezone.utc),
            source={
                "kind": "collector",
                "connector": "sensor",
                "collector": "temperature",
            },
        )


def test_manual_observation_source_requires_reason():
    with pytest.raises(ValidationError, match="require collector and reason"):
        ObservationSource(kind="manual", collector="room_temperature")


def test_observation_series_ref_requires_a_stable_reference():
    with pytest.raises(ValidationError, match="requires file_id, source_uri, or blob_id"):
        ObservationSeriesRef[float](
            started_at="2026-07-19T20:00:00+08:00",
            ended_at="2026-07-19T20:30:00+08:00",
            point_count=360,
            source={
                "kind": "collector",
                "connector": "lab_sensor_gateway",
                "collector": "incubator_temperature",
            },
        )


def test_observation_series_ref_accepts_connector_uri():
    value = ObservationSeriesRef[float](
        source_uri="connector://lab_sensor_gateway/run-001",
        started_at="2026-07-19T20:00:00+08:00",
        ended_at="2026-07-19T20:30:00+08:00",
        point_count=360,
        source={
            "kind": "collector",
            "connector": "lab_sensor_gateway",
            "collector": "incubator_temperature",
        },
    )

    assert value.source_uri == "connector://lab_sensor_gateway/run-001"
    assert value.point_count == 360
