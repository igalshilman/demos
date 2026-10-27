"""Command-line interface for the calculator."""

import sys
from decimal import Decimal

from calculator.errors import CalculatorError
from calculator.evaluator import evaluate

USAGE = (
    'usage: python -m calculator "<expression>"\n'
    "\n"
    "Evaluate an arithmetic expression and print the result.\n"
    "Supports + - * /, parentheses, unary signs and decimal numbers.\n"
    "\n"
    "examples:\n"
    '  python -m calculator "2 + 3 * 4"\n'
    '  python -m calculator "(1.5 + 2.5) / 4"\n'
    "  python -m calculator -3 + 2\n"
)


def format_result(value):
    """Format a Decimal: no exponent, no trailing zeros, no negative zero."""
    text = format(Decimal(value), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    if text in ("", "-", "-0"):
        text = "0"
    return text


def main(argv=None):
    """Run the calculator and return a process exit code."""
    args = sys.argv[1:] if argv is None else list(argv)

    if args and args[0] in ("-h", "--help"):
        sys.stdout.write(USAGE)
        return 0

    expression = " ".join(args).strip()
    if not expression:
        sys.stderr.write(USAGE)
        return 2

    try:
        result = evaluate(expression)
    except CalculatorError as exc:
        sys.stderr.write("error: {}\n".format(exc))
        return 1

    sys.stdout.write(format_result(result) + "\n")
    return 0
