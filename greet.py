#!/usr/bin/env python3
"""Print a greeting for a person, in a chosen tone."""

import argparse

GREETINGS = {
    "friendly": "Hello, {name}!",
    "formal": "Good day, {name}.",
    "casual": "Hey, {name}!",
}


def name_type(value):
    name = value.strip()
    if not name:
        raise argparse.ArgumentTypeError("name must not be empty or whitespace-only")
    return name


def build_parser():
    parser = argparse.ArgumentParser(
        prog="greet.py",
        description="Print a greeting for a person, in a chosen tone.",
    )
    parser.add_argument(
        "--name",
        type=name_type,
        default="World",
        help="name to greet (default: %(default)s)",
    )
    parser.add_argument(
        "--tone",
        choices=sorted(GREETINGS),
        default="friendly",
        help="tone of the greeting (default: %(default)s)",
    )
    return parser


def greet(name, tone="friendly"):
    return GREETINGS[tone].format(name=name)


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(greet(args.name, args.tone))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
