import argparse


def main(argv=None):
    parser = argparse.ArgumentParser(description="A tiny greeting CLI.")
    parser.add_argument("--hello", action="store_true", help="print a greeting")
    args = parser.parse_args(argv)
    if args.hello:
        print("Hello!")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
