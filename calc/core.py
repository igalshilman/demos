"""Arithmetic and number formatting for the calculator CLI."""

SUPPORTED_OPS = ('+', '-', '*')


def evaluate(a: float, op: str, b: float) -> float:
    """Apply a supported arithmetic operator to two numbers."""
    if op == '+':
        return a + b
    if op == '-':
        return a - b
    if op == '*':
        return a * b
    raise ValueError(f'unsupported operator: {op}')


def format_number(x: float) -> str:
    """Render integral numbers without a decimal suffix, otherwise use float repr."""
    if isinstance(x, int) or x.is_integer():
        return str(int(x))
    return repr(x)
