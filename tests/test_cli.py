import pytest

from greeter.cli import build_parser, main


def test_main_prints_greeting(capsys):
    assert main(["--name", "Ada"]) == 0
    out = capsys.readouterr().out
    assert out.strip() == "Hello, Ada! It's great to meet you!"


def test_short_option(capsys):
    assert main(["-n", "Ada"]) == 0
    assert "Ada" in capsys.readouterr().out


def test_missing_name_exits_with_status_2(capsys):
    with pytest.raises(SystemExit) as exc:
        main([])
    assert exc.value.code == 2
    assert "--name" in capsys.readouterr().err


@pytest.mark.parametrize("name", ["", "   "])
def test_empty_name_returns_2_with_error(name, capsys):
    assert main(["--name", name]) == 2
    captured = capsys.readouterr()
    assert captured.out == ""
    assert captured.err.strip() == "error: name must not be empty"


def test_parser_prog():
    assert build_parser().prog == "greeter"
