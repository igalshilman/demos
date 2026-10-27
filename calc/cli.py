"""Command-line interface for the calculator."""

import argparse
import math
import sys
from typing import List, Optional, Union

from calc.evaluator import CalcError, evaluate

VERSION = "0.1.0"
BANNER = "calc {} - type 'quit' or Ctrl-D to exit".format(VERSION)
PROMPT = "> "
EXIT_WORDS = ("quit", "exit")


def format_result(value: Union[int, float]) -> str:
    if isinstance(value, int):
        return str(value)
    if not math.isfinite(value):
        return str(value)
    if value == int(value):
        return str(int(value))
    return format(value, ".12g")


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="calc",
        description="Evaluate arithmetic expressions. With no expression, "
        "start an interactive prompt (or read expressions from piped stdin).",
    )
    parser.add_argument(
        "expression",
        nargs="*",
        help="expression to evaluate, e.g. calc '2 + 3 * 4'",
    )
    parser.add_argument(
        "--version", action="version", version="calc {}".format(VERSION)
    )
    return parser


def _evaluate_and_print(expression: str) -> bool:
    """Evaluate and print one expression. Returns True on success."""
    try:
        result = evaluate(expression)
    except CalcError as exc:
        print("error: {}".format(exc), file=sys.stderr)
        return False
    print(format_result(result))
    return True


def _interactive() -> int:
    print(BANNER)
    while True:
        try:
            line = input(PROMPT)
        except EOFError:
            print()
            return 0
        except KeyboardInterrupt:
            print()
            return 0
        line = line.strip()
        if not line:
            continue
        if line in EXIT_WORDS:
            return 0
        _evaluate_and_print(line)


def _piped() -> int:
    status = 0
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        if line in EXIT_WORDS:
            break
        if not _evaluate_and_print(line):
            status = 1
    return status


def main(argv: Optional[List[str]] = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.expression:
        return 0 if _evaluate_and_print(" ".join(args.expression)) else 1
    if sys.stdin.isatty():
        return _interactive()
    return _piped()


if __name__ == "__main__":
    sys.exit(main())
