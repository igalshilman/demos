from greet import main


def test_named(capsys):
    assert main(["--name", "Ada"]) == 0
    assert capsys.readouterr().out == "Hello, Ada!\n"


def test_missing_name(capsys):
    assert main([]) == 0
    assert capsys.readouterr().out == "Hello, World!\n"


def test_empty_name(capsys):
    assert main(["--name", ""]) == 0
    assert capsys.readouterr().out == "Hello, World!\n"


def test_whitespace_only_name(capsys):
    assert main(["--name", "   "]) == 0
    assert capsys.readouterr().out == "Hello, World!\n"


def test_padded_name_is_trimmed(capsys):
    assert main(["--name", "  Ada  "]) == 0
    assert capsys.readouterr().out == "Hello, Ada!\n"
