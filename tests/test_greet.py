import pytest

import greet


def test_default_greeting(capsys):
    assert greet.main([]) == 0
    captured = capsys.readouterr()
    assert captured.out == "Hello, World!\n"


@pytest.mark.parametrize("name", ["Ada", "Grace"])
def test_custom_name(capsys, name):
    assert greet.main(["--name", name]) == 0
    captured = capsys.readouterr()
    assert captured.out == f"Hello, {name}!\n"
