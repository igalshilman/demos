"""Command-line interface for the calculator."""

import argparse

from .core import SUPPORTED_OPS, evaluate, format_number


def main(argv=None) -> int:
    """Evaluate one arithmetic expression and return a process exit status."""
    parser = argparse.ArgumentParser(description="Calculate a simple arithmetic expression.")
    parser.add_argument("a", type=float, help="first number")
    parser.add_argument("op", choices=SUPPORTED_OPS, help="arithmetic operator")
    parser.add_argument("b", type=float, help="second number")
    args = parser.parse_args(argv)

    try:
        result = evaluate(args.a, args.op, args.b)
    except ValueError as exc:
        parser.error(str(exc))

    print(format_number(result))
    return 0
