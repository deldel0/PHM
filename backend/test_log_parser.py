import json
import re
from datetime import datetime
from pathlib import PureWindowsPath
from typing import Any


class LogParseError(ValueError):
    """Raised when a recognized test-log value cannot be parsed."""


_FIELD_ALIASES = {
    "testprogram": ("test_program", "testprogram"),
    "serialno": ("serial_no", "text"),
    "modelname": ("model_name", "text"),
    "dateprocess": ("tested_at", "datetime"),
    "testdate": ("tested_at", "datetime"),
    "testresult": ("result", "text"),
}
_DATE_FORMATS = (
    "%Y/%m/%d %I:%M:%S %p",
    "%Y/%m/%d %H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
)
# Sequence headers: "(UUT Test seq.17) : desc ---- (1'265) ---- FAIL" and
# "STEP.14(UUT Test seq.14) : desc ... FAIL" where STEP.n is a report line number.
_SEQUENCE_HEADER = re.compile(
    r"^\s*(?:STEP\.\d+)?\s*\((?:Pre Test|UUT Test) seq\.(?P<sequence>\d+)\)\s*:\s*(?P<rest>.*)$"
)
_SEQUENCE_VERDICT = re.compile(r"\b(?P<verdict>PASS|FAIL)\s*$")
_SEQUENCE_DURATION = re.compile(r"\(\s*\d+'\d+\s*\)?$")
_STEP_LINE = re.compile(r"^\s*Step:\s*(?P<step>\d+)")


def _normalize_label(label: str) -> str:
    return re.sub(r"[\W_]+", "", label.casefold())


def _parse_datetime(value: str, label: str) -> str:
    for date_format in _DATE_FORMATS:
        try:
            return datetime.strptime(value, date_format).isoformat()
        except ValueError:
            continue
    raise LogParseError(f"Invalid {label}: {value!r}")


def _parse_testprogram(value: str) -> tuple[str, str | None, str | None]:
    """Split "PROGRAM  ATS2-2-4" into program, station group, and station.

    The trailing token is a station such as "ATS2-2-4"; its group is every
    segment but the last ("ATS2-2"). A two-segment token is a group only.
    """
    tokens = value.split()
    if not tokens:
        return "", None, None

    program = tokens[0]
    if len(tokens) < 2:
        return program, None, None

    station = tokens[1]
    segments = re.split(r"[-_]", station)
    if len(segments) >= 3:
        station_group = "-".join(segments[:-1])
        return program, station_group, station
    if len(segments) == 2:
        return program, station, None
    return program, None, None


def _strip_sequence_tail(text: str) -> str:
    """Drop the "---- (1'265)" padding and duration tail of a sequence header."""
    text = text.rstrip(" \t-")
    text = _SEQUENCE_DURATION.sub("", text)
    return text.rstrip(" \t-")


def _find_step(lines: list[str], start: int) -> int | None:
    """Read the "Step:   N" line that follows a sequence header, if present."""
    for line in lines[start : start + 2]:
        if _SEQUENCE_HEADER.match(line) or line.startswith("====="):
            break
        match = _STEP_LINE.match(line)
        if match:
            return int(match.group("step"))
    return None


def _parse_fail_items(
    text: str, normalized_fields: dict[str, str]
) -> list[dict[str, Any]]:
    """Keep only the first failed sequence, or an explicit "Fail Item" label."""
    lines = text.splitlines()

    for index, line in enumerate(lines):
        header = _SEQUENCE_HEADER.match(line)
        if header is None:
            continue
        verdict = _SEQUENCE_VERDICT.search(header.group("rest"))
        if verdict is None or verdict.group("verdict") != "FAIL":
            continue
        return [
            {
                "sequence": int(header.group("sequence")),
                "step": _find_step(lines, index + 1),
                "description": _strip_sequence_tail(
                    header.group("rest")[: verdict.start()]
                ),
            }
        ]

    for label, value in normalized_fields.items():
        is_fail_item = "fail" in label and (
            "item" in label or "測項" in label or label.endswith("項")
        )
        if is_fail_item and value:
            return [{"sequence": None, "step": None, "description": value}]

    return []


def parse_folder_context(relative_path: str) -> dict[str, str]:
    """Read line, station group, and station from LINE\\GROUP\\STATION\\file.txt."""
    parts = PureWindowsPath(relative_path).parts
    if len(parts) != 4 or not parts[-1].lower().endswith(".txt"):
        raise LogParseError(
            "Expected a relative path in LINE\\GROUP\\STATION\\file.txt format"
        )

    return {
        "line": parts[0],
        "station_group": parts[1],
        "station": parts[2],
    }


def parse_test_log(text: str, relative_path: str | None = None) -> dict[str, Any]:
    """Parse a key/value ATE text log into JSON-serializable normalized data."""
    normalized_fields: dict[str, str] = {}

    for line in text.splitlines():
        if ":" not in line:
            continue
        label, value = line.split(":", 1)
        label = label.strip()
        value = value.strip()
        if not label:
            continue

        normalized_fields[_normalize_label(label)] = value

    record: dict[str, Any] = {
        "schema_version": 2,
        "test_program": None,
        "serial_no": None,
        "model_name": None,
        "tested_at": None,
        "result": None,
        "line": None,
        "station_group": None,
        "station": None,
        "fail_items": [],
    }

    for label, (field_name, parser) in _FIELD_ALIASES.items():
        value = normalized_fields.get(label)
        if value is None or value == "":
            continue
        if parser == "testprogram":
            program, station_group, station = _parse_testprogram(value)
            record["test_program"] = program or None
            record["station_group"] = station_group
            record["station"] = station
        elif parser == "datetime":
            record[field_name] = _parse_datetime(value, label)
        else:
            record[field_name] = value

    record["fail_items"] = _parse_fail_items(text, normalized_fields)

    if relative_path is not None:
        context = parse_folder_context(relative_path)
        record["line"] = context["line"]
        record["station_group"] = record["station_group"] or context["station_group"]
        record["station"] = record["station"] or context["station"]
        record["source_file"] = relative_path

    return record

# test


# if __name__ == "__main__":
#     with open(
#         r"D:\dove\A2230206846570-02-36-18-November-2026.txt",
#         encoding="utf-8",
#         errors="ignore",
#     ) as report_file:
#         text = report_file.read()

#     record = parse_test_log(
#         text,
#         r"CD02\ATS2-2\ATS2-2-4\A2230206846570-02-36-18-November-2026.txt",
#     )
#     print(json.dumps(record, ensure_ascii=False, indent=2))


# result formatting example:
# {
#   "schema_version": 2,
#   "test_program": "ECD18010040-B-00-FAT-05",
#   "serial_no": "A2230206846570",
#   "model_name": "ECD18010040-B",
#   "tested_at": "2026-11-18T02:36:26",
#   "result": "FAIL",
#   "line": "CD02",
#   "station_group": "ATS2-2",
#   "station": "ATS2-2-4",
#   "fail_items": [
#     {
#       "sequence": 17,
#       "step": 17,
#       "description": "DES DMM Measurement(5.3 Check Present after UUT1 insert)"
#     }
#   ],
#   "source_file": "CD02\\ATS2-2\\ATS2-2-4\\A2230206846570-02-36-18-November-2026.txt"
# }