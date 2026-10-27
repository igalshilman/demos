"""A tiny CLI that prints a random greeting."""

import argparse
import random

GREETINGS = ("Hello!", "Hi there!", "Greetings!")


def build_parser():
    parser = argparse.ArgumentParser(
        prog="greeting_cli.py",
        description="Print a random greeting.",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--great",
        action="store_true",
        help="print a random greeting",
    )
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.great:
        print(random.choice(GREETINGS))
    else:
        parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
