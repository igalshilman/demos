import argparse


def build_parser():
    parser = argparse.ArgumentParser(description="Print a friendly greeting.")
    parser.add_argument(
        "--name",
        default="friend",
        help="name of the person to greet (default: friend)",
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(f"Hello, {args.name}!")


if __name__ == "__main__":
    main()
