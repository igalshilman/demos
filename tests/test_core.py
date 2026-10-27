import pytest

from calc.core import SUPPORTED_OPS, evaluate, format_number


def test_supported_ops():
    assert SUPPORTED_OPS == ('+', '-', '*')


@pytest.mark.parametrize(
    ('a', 'op', 'b', 'expected'),
    [
        (2, '+', 3, 5),
        (2, '-', 3, -1),
        (2, '*', 3, 6),
        (1.5, '+', 2.25, 3.75),
        (1.5, '-', 2.25, -0.75),
        (1.5, '*', 2.0, 3.0),
        (-2, '+', 3, 1),
        (-2, '-', -3, 1),
        (-2, '*', -3, 6),
        (0, '+', -4, -4),
        (0, '-', 4, -4),
        (0, '*', -4, 0),
    ],
)
def test_evaluate(a, op, b, expected):
    assert evaluate(a, op, b) == expected


@pytest.mark.parametrize('op', ['/', '^', '', 'add'])
def test_unsupported_operator(op):
    with pytest.raises(ValueError) as error:
        evaluate(2, op, 3)
    assert str(error.value) == f'unsupported operator: {op}'


@pytest.mark.parametrize(
    ('value', 'expected'),
    [
        (2, '2'),
        (2.0, '2'),
        (-3.0, '-3'),
        (0.0, '0'),
        (-0.0, '0'),
        (2.5, '2.5'),
        (-0.125, '-0.125'),
        (1e20, '100000000000000000000'),
    ],
)
def test_format_number(value, expected):
    assert format_number(value) == expected
