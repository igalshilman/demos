import pytest

from greeter import greet as exported_greet
from greeter.core import greet


def test_greet_normal_name():
    assert greet("Ada") == "Hello, Ada! It's great to meet you!"


def test_greet_name_with_spaces():
    assert greet("Ada Lovelace") == "Hello, Ada Lovelace! It's great to meet you!"


def test_greet_exported_from_package():
    assert exported_greet is greet


@pytest.mark.parametrize("value", [None, "", " ", "   ", "\t\n"])
def test_greet_invalid_name(value):
    with pytest.raises(ValueError, match="name must not be empty"):
        greet(value)
