#!/usr/bin/env python3
"""Print a random greeting.

Usage: python3 greet.py [--name NAME] [--tone {friendly,formal,playful}]
"""

import argparse
import random

DEFAULT_NAME = "World"
DEFAULT_TONE = "friendly"

GREETINGS = {
    "friendly": [
        "Hello, {name}! Great to see you.",
        "Hi {name}, hope you're having a wonderful day!",
        "Hey {name}, welcome!",
    ],
    "formal": [
        "Good day, {name}. It is a pleasure to make your acquaintance.",
        "Greetings, {name}. I trust you are well.",
        "Welcome, {name}. How do you do?",
    ],
    "playful": [
        "Well, well, well... if it isn't {name}!",
        "Yo {name}, ready to cause some delightful mischief?",
        "Ta-da! {name} has entered the chat!",
    ],
}


def generate_greeting(name=DEFAULT_NAME, tone=DEFAULT_TONE):
    """Return a random greeting for ``name`` in the given ``tone``."""
    return random.choice(GREETINGS[tone]).format(name=name)


def build_parser():
    parser = argparse.ArgumentParser(
        description="Print a random greeting.",
        allow_abbrev=False,
    )
    parser.add_argument(
        "--name",
        default=DEFAULT_NAME,
        help="who to greet (default: %(default)s)",
    )
    parser.add_argument(
        "--tone",
        default=DEFAULT_TONE,
        choices=sorted(GREETINGS),
        help="tone of the greeting (default: %(default)s)",
    )
    return parser


def main(argv=None):
    args = build_parser().parse_args(argv)
    print(generate_greeting(args.name, args.tone))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
