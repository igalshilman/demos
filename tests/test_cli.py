import io
import subprocess
import sys

import pytest

from calc import cli
from calc.cli import format_result, main


class FakeStdin(io.StringIO):
    def __init__(self, text="", tty=False):
        super().__init__(text)
        self._tty = tty

    def isatty(self):
        return self._tty


def piped(monkeypatch, text):
    monkeypatch.setattr(sys, "stdin", FakeStdin(text))


def test_expression_argument(capsys):
    assert main(["2 + 3 * 4"]) == 0
    assert capsys.readouterr().out == "14\n"


def test_expression_split_across_arguments(capsys):
    assert main(["2", "+", "3", "*", "4"]) == 0
    assert capsys.readouterr().out == "14\n"


def test_float_result(capsys):
    assert main(["7/2"]) == 0
    assert capsys.readouterr().out == "3.5\n"


def test_integral_float_prints_as_int(capsys):
    assert main(["6/3"]) == 0
    assert capsys.readouterr().out == "2\n"


def test_error_goes_to_stderr(capsys):
    assert main(["1/0"]) == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err.startswith("error: ")
    assert captured.err.endswith("\n")


def test_syntax_error(capsys):
    assert main(["2 +"]) == 1
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err.startswith("error: ")


def test_version(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--version"])
    assert exc.value.code == 0
    assert capsys.readouterr().out.strip() == "calc 0.1.0"


def test_invalid_usage_exits_2(capsys):
    with pytest.raises(SystemExit) as exc:
        main(["--bogus"])
    assert exc.value.code == 2


@pytest.mark.parametrize(
    "value, expected",
    [
        (14, "14"),
        (-3, "-3"),
        (3.5, "3.5"),
        (2.0, "2"),
        (-0.0, "0"),
        (1e20, "100000000000000000000"),
        (0.1 + 0.2, "0.3"),
        (1 / 3, "0.333333333333"),
        (float("inf"), "inf"),
        (float("-inf"), "-inf"),
        (float("nan"), "nan"),
    ],
)
def test_format_result(value, expected):
    assert format_result(value) == expected


def test_piped_input(monkeypatch, capsys):
    piped(monkeypatch, "1 + 1\n\n   \n  7/2  \n")
    assert main([]) == 0
    captured = capsys.readouterr()
    assert captured.out == "2\n3.5\n"
    assert captured.err == ""


def test_piped_no_banner_or_prompt(monkeypatch, capsys):
    piped(monkeypatch, "1+1\n")
    main([])
    out = capsys.readouterr().out
    assert "calc 0.1.0" not in out
    assert ">" not in out


def test_piped_stops_at_quit(monkeypatch, capsys):
    piped(monkeypatch, "1+1\nquit\n2+2\n")
    assert main([]) == 0
    assert capsys.readouterr().out == "2\n"


def test_piped_stops_at_exit(monkeypatch, capsys):
    piped(monkeypatch, "1+1\nexit\n2+2\n")
    assert main([]) == 0
    assert capsys.readouterr().out == "2\n"


def test_piped_error_continues_and_returns_1(monkeypatch, capsys):
    piped(monkeypatch, "1+1\n1/0\n3+3\n")
    assert main([]) == 1
    captured = capsys.readouterr()
    assert captured.out == "2\n6\n"
    assert captured.err.startswith("error: ")


def test_piped_empty_input(monkeypatch, capsys):
    piped(monkeypatch, "")
    assert main([]) == 0
    assert capsys.readouterr().out == ""


def test_interactive_banner_prompt_and_eof(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", FakeStdin(tty=True))
    answers = iter(["2 + 3", "", "1/0"])

    def fake_input(prompt=""):
        print(prompt, end="")
        try:
            return next(answers)
        except StopIteration:
            raise EOFError

    monkeypatch.setattr("builtins.input", fake_input)
    assert main([]) == 0
    captured = capsys.readouterr()
    assert captured.out.startswith("calc 0.1.0 - type 'quit' or Ctrl-D to exit\n> ")
    assert "5\n" in captured.out
    assert captured.err.startswith("error: ")


def test_interactive_quit(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", FakeStdin(tty=True))
    monkeypatch.setattr("builtins.input", lambda prompt="": "quit")
    assert main([]) == 0


def test_interactive_keyboard_interrupt(monkeypatch, capsys):
    monkeypatch.setattr(sys, "stdin", FakeStdin(tty=True))

    def fake_input(prompt=""):
        raise KeyboardInterrupt

    monkeypatch.setattr("builtins.input", fake_input)
    assert main([]) == 0
    assert capsys.readouterr().out.endswith("\n")


def test_python_dash_m():
    result = subprocess.run(
        [sys.executable, "-m", "calc", "7/2"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0
    assert result.stdout == "3.5\n"


def test_python_dash_m_error_exit_code():
    result = subprocess.run(
        [sys.executable, "-m", "calc", "1/0"],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 1
    assert result.stderr.startswith("error: ")
