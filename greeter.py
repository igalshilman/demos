#!/usr/bin/env python3
"""A small command-line greeter."""

import argparse
import sys

GREETINGS = {
    "friendly": "Hello, {name}!",
    "formal": "Good day, {name}.",
    "casual": "Hey, {name}!",
}
DEFAULT_NAME = "World"
DEFAULT_TONE = "friendly"


def greet(name=DEFAULT_NAME, tone=DEFAULT_TONE):
    """Return the greeting line for ``name`` in the given ``tone``."""
    return GREETINGS[tone].format(name=name)


def build_parser():
    parser = argparse.ArgumentParser(
        prog="greeter.py",
        description="Print a greeting.",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--name",
        default=DEFAULT_NAME,
        help="who to greet (default: %(default)s)",
    )
    parser.add_argument(
        "--tone",
        choices=sorted(GREETINGS),
        default=DEFAULT_TONE,
        help="tone of the greeting (default: %(default)s)",
    )
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    name = args.name.strip()
    if not name:
        parser.error("argument --name: name must not be empty")
    print(greet(name, args.tone))
    return 0


if __name__ == "__main__":
    sys.exit(main())
