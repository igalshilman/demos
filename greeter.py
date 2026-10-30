"""A small command-line tool that prints a friendly greeting."""

import argparse


def non_blank_name(value):
    name = value.strip()
    if not name:
        raise argparse.ArgumentTypeError("name must not be empty or blank")
    return name


def build_parser():
    parser = argparse.ArgumentParser(
        prog="greeter.py",
        description="Print a friendly greeting. Greets the world unless a name is given.",
        epilog='Example: python greeter.py --name "Ada Lovelace"',
    )
    parser.add_argument(
        "--name",
        metavar="NAME",
        type=non_blank_name,
        default="world",
        help='name to greet (default: "world"); quote names containing spaces',
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(f"Hello, {args.name}!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
