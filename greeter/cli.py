import argparse
import sys
from typing import Optional, Sequence

from greeter.core import greet


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="greeter",
        description="Generate a friendly greeting.",
    )
    parser.add_argument(
        "--name",
        "-n",
        required=True,
        help="Name of the person to greet",
    )
    return parser


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        message = greet(args.name)
    except ValueError:
        print("error: name must not be empty", file=sys.stderr)
        return 2
    print(message)
    return 0
