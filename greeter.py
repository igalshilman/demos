#!/usr/bin/env python3
"""Print a greeting for the given name."""

import argparse


def build_parser():
    parser = argparse.ArgumentParser(description="Print a greeting.")
    parser.add_argument("--name", required=True, help="name to greet")
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(f"Hello, {args.name}!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
