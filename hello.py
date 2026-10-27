import argparse


def build_parser():
    return argparse.ArgumentParser(
        description="Print hello.",
        epilog="Running with no arguments prints: hello",
    )


def main(argv=None):
    build_parser().parse_args(argv)
    print("hello")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
