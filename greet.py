"""A tiny command-line tool that prints a friendly greeting.

Usage: python greet.py --name <name>
"""

import argparse


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description="Create a friendly greeting")
    parser.add_argument(
        "--name",
        default=None,
        help="name to greet (defaults to World when missing or blank)",
    )
    return parser.parse_args(argv)


def main(argv=None) -> int:
    args = parse_args(argv)
    name = (args.name or "").strip() or "World"
    print(f"Hello, {name}!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
