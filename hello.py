import argparse


def main(argv=None):
    parser = argparse.ArgumentParser(description="hello")
    parser.parse_args(argv)
    print("hello")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
