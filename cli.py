"""A small greeting command-line program."""

import argparse
import sys


def build_parser():
    parser = argparse.ArgumentParser(
        description="Print a friendly greeting.",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--name",
        default="World",
        help="name to greet (default: %(default)s)",
    )
    parser.add_argument(
        "--greet",
        action="store_true",
        help="print the greeting; without this flag, help is shown",
    )
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.greet:
        print(f"Hello, {args.name}!")
    else:
        parser.print_help(sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())
