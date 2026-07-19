import pytest

from airalogy.markdown import InvalidSyntaxError, parse_aimd, parse_collectors_content


def test_parse_collectors_content_normalizes_polling_metadata():
    node = parse_collectors_content(
        """
temperature:
  connector: sensor
  mode: polling
  interval: 2.5s
  manual_fallback: true
"""
    )

    assert node.collectors["temperature"] == {
        "id": "temperature",
        "connector": "sensor",
        "mode": "polling",
        "interval": "2.5s",
        "interval_ms": 2500,
        "manual_fallback": True,
        "lifecycle": {"start": "manual", "stop": "manual"},
    }


def test_parse_collectors_content_rejects_missing_poll_interval():
    with pytest.raises(InvalidSyntaxError, match="interval is required"):
        parse_collectors_content(
            """
temperature:
  connector: sensor
  mode: polling
"""
        )


def test_parse_aimd_validates_collector_connector_kind_and_field_type():
    with pytest.raises(InvalidSyntaxError, match="kind data_source"):
        parse_aimd(
            """
```connectors
sensor:
  kind: entity_source
  entity: sensor
  search: {}
```
```collectors
temperature:
  connector: sensor
```
{{var|temperature: Observation[float] | None, collector="temperature"}}
"""
        )

    with pytest.raises(InvalidSyntaxError, match=r"must use Observation\[T\]"):
        parse_aimd(
            """
```connectors
sensor:
  kind: data_source
```
```collectors
temperature:
  connector: sensor
```
{{var|temperature: float | None, collector="temperature"}}
"""
        )


def test_parse_aimd_requires_polling_fields_to_preserve_history():
    with pytest.raises(InvalidSyntaxError, match=r"must use list\[Observation\[T\]\]"):
        parse_aimd(
            """
```connectors
sensor:
  kind: data_source
```
```collectors
temperature:
  connector: sensor
  mode: polling
  interval: 1s
```
{{var|temperature: Observation[float] | None, collector="temperature"}}
"""
        )
