"""End-to-end coverage for the module entry point."""

import subprocess
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]


def run_calc(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "calc", *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


@pytest.mark.parametrize(
    ("args", "expected"),
    [
        (("2", "+", "3"), "5"),
        (("7", "-", "2"), "5"),
        (("3", "*", "4"), "12"),
        (("1.5", "+", "2.25"), "3.75"),
        (("2.5", "*", "2"), "5"),
        (("-2", "+", "-3"), "-5"),
        (("-1.5", "*", "2"), "-3"),
    ],
)
def test_arithmetic(args: tuple[str, ...], expected: str) -> None:
    result = run_calc(*args)
    assert result.returncode == 0
    assert result.stdout == expected + "\n"
    assert result.stderr == ""


@pytest.mark.parametrize(
    "args",
    [
        (),
        ("1", "+"),
        ("1", "+", "2", "3"),
        ("abc", "+", "2"),
        ("1", "+", "abc"),
        ("1", "/", "2"),
    ],
)
def test_invalid_input(args: tuple[str, ...]) -> None:
    result = run_calc(*args)
    assert result.returncode == 2
    assert result.stdout == ""
    assert "error:" in result.stderr
    assert "Traceback" not in result.stderr


def test_help() -> None:
    result = run_calc("--help")
    assert result.returncode == 0
    assert "usage:" in result.stdout
    assert "--help" in result.stdout
    assert result.stderr == ""
