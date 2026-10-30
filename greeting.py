import argparse


def build_parser():
    parser = argparse.ArgumentParser(description="Print a friendly greeting.")
    parser.add_argument(
        "--name",
        default="World",
        help="name to greet (default: %(default)s)",
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(f"Hello, {args.name}!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
