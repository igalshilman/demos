import pytest

import calc
from calc import CalcError, evaluate


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("42", 42),
        ("0", 0),
        ("007", 7),
        ("3.14", 3.14),
        (".5", 0.5),
        ("2.", 2.0),
        ("0.0", 0.0),
    ],
)
def test_literals(expr, expected):
    result = evaluate(expr)
    assert result == expected
    assert type(result) is type(expected)


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("1+2", 3),
        ("5-8", -3),
        ("6*7", 42),
        ("7/2", 3.5),
        ("7//2", 3),
        ("-7//2", -4),
        ("7%3", 1),
        ("-7%3", 2),
        ("2**10", 1024),
        ("2^10", 1024),
        ("7.5//2", 3.0),
        ("7.5%2", 1.5),
    ],
)
def test_operators(expr, expected):
    result = evaluate(expr)
    assert result == expected
    assert type(result) is type(expected)


def test_true_division_returns_float():
    result = evaluate("4/2")
    assert result == 2.0
    assert isinstance(result, float)


def test_numeric_type_rules():
    assert isinstance(evaluate("2+3"), int)
    assert isinstance(evaluate("2+3.0"), float)
    assert isinstance(evaluate("2**3"), int)
    assert isinstance(evaluate("2**-1"), float)
    assert isinstance(evaluate("6//3"), int)
    assert isinstance(evaluate("6.0//3"), float)


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("1+2*3", 7),
        ("2*3+1", 7),
        ("10-4/2", 8.0),
        ("2+3*4**2", 50),
        ("2*3%4", 2),
        ("10-3-2", 5),
        ("100/10/5", 2.0),
        ("100//7//2", 7),
        ("20%7*2", 12),
        ("2*3/4", 1.5),
    ],
)
def test_precedence_and_left_associativity(expr, expected):
    assert evaluate(expr) == expected


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("(1+2)*3", 9),
        ("2*(3+4)", 14),
        ("((2))", 2),
        ("(1+2)*(3+4)", 21),
        ("10-(3-2)", 9),
        ("(2+3)**2", 25),
        ("-(1+2)", -3),
        ("2**(1+1)", 4),
    ],
)
def test_parentheses(expr, expected):
    assert evaluate(expr) == expected


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("-3", -3),
        ("+3", 3),
        ("--3", 3),
        ("---3", -3),
        ("+-+3", -3),
        ("1--1", 2),
        ("1+-1", 0),
        ("2*-3", -6),
        ("-.5", -0.5),
        ("- 3", -3),
    ],
)
def test_unary(expr, expected):
    assert evaluate(expr) == expected


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("2**3**2", 512),
        ("2^3^2", 512),
        ("2**3^2", 512),
        ("(2**3)**2", 64),
        ("-2**2", -4),
        ("(-2)**2", 4),
        ("--2**2", 4),
        ("2**-1", 0.5),
        ("2^-1", 0.5),
        ("2**+2", 4),
        ("2**-2**2", 0.0625),
        ("2*3**2", 18),
        ("4**0.5", 2.0),
        ("0**0", 1),
    ],
)
def test_power(expr, expected):
    assert evaluate(expr) == expected


@pytest.mark.parametrize(
    "expr, expected",
    [
        ("  1 +  2 ", 3),
        ("\t1\n+\r2", 3),
        ("( 1 + 2 ) * 3", 9),
        ("2 ** 3", 8),
        ("2 * * 3", None),
    ],
)
def test_whitespace(expr, expected):
    if expected is None:
        with pytest.raises(CalcError):
            evaluate(expr)
    else:
        assert evaluate(expr) == expected


@pytest.mark.parametrize("expr", ["", "   ", "\t\n"])
def test_empty_expression(expr):
    with pytest.raises(CalcError, match="^empty expression$"):
        evaluate(expr)


@pytest.mark.parametrize(
    "expr, position",
    [
        ("a", 0),
        ("1+a", 2),
        ("1 + 2 $", 6),
        ("1e5", 1),
        ("1,5", 1),
        ("2 & 3", 2),
        ("\u00a01", 0),
        ("\u0663", 0),
    ],
)
def test_invalid_character_reports_position(expr, position):
    with pytest.raises(CalcError) as info:
        evaluate(expr)
    assert "invalid character" in str(info.value)
    assert "position %d" % position in str(info.value)


@pytest.mark.parametrize(
    "expr",
    [
        "1+",
        "*2",
        "1 2",
        "1..2",
        "1.2.3",
        ".",
        "(",
        ")",
        "()",
        "(1",
        "1)",
        "(1+2",
        "((1)",
        "1+*2",
        "1**",
        "**2",
        "1 // // 2",
        "1 / / 2",
        "2 3 + 4",
        "(1)(2)",
        "1 (2)",
        "-",
        "+",
    ],
)
def test_malformed_expressions(expr):
    with pytest.raises(CalcError):
        evaluate(expr)


@pytest.mark.parametrize(
    "expr",
    ["1/0", "1//0", "1%0", "1/0.0", "1.5//0", "1.5%0", "0**-1", "0.0**-1", "1/(2-2)"],
)
def test_division_by_zero(expr):
    with pytest.raises(CalcError, match="^division by zero$"):
        evaluate(expr)


@pytest.mark.parametrize(
    "expr",
    [
        "2**10001",
        "2^10001",
        "(-2)**10001",
        "1.5**10001",
        "2**100000000000",
        "10**400.0**2",
        "(10**4000)**10000",
        "9**9**9",
        "1" + "0" * 400 + ".0",
        "1" + "0" * 5000,
        "(10.**200)*(10.**200)",
        "10.0**400",
        "(10**5000)/(10**-1)",
        "(10**400)/1",
    ],
)
def test_result_too_large(expr):
    with pytest.raises(CalcError, match="^result too large$"):
        evaluate(expr)


def test_power_limit_boundary():
    assert evaluate("2**10000") == 1 << 10000
    assert evaluate("1**100000000") == 1
    assert evaluate("(-1)**100001") == -1
    assert evaluate("0**100000") == 0
    assert evaluate("2**-100000") == 0.0


@pytest.mark.parametrize("expr", ["(-8)**0.5", "(-1)**.5", "(-2.5)**1.5"])
def test_complex_power(expr):
    with pytest.raises(CalcError, match="^invalid operation$"):
        evaluate(expr)


def test_deep_nesting_is_a_calc_error():
    with pytest.raises(CalcError):
        evaluate("(" * 100000 + "1" + ")" * 100000)
    with pytest.raises(CalcError):
        evaluate("-" * 100000 + "1")


@pytest.mark.parametrize("value", [None, 5, 1.5, b"1+1", ["1"]])
def test_non_string_input(value):
    with pytest.raises(CalcError):
        evaluate(value)


def test_never_uses_python_evaluation():
    for expr in ["__import__('os')", "1 if 1 else 2", "[1]", "x", "1;2", "2 ** 3 ** 'a'"]:
        with pytest.raises(CalcError):
            evaluate(expr)


def test_package_exports():
    assert calc.__version__ == "0.1.0"
    assert set(calc.__all__) == {"CalcError", "evaluate", "__version__"}
    assert calc.evaluate is evaluate
    assert issubclass(CalcError, Exception)
    assert calc.evaluator.CalcError is CalcError
