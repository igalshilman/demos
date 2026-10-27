import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "greeting_cli.py"
GREETINGS = {"Hello!", "Hi there!", "Greetings!"}


def run_cli(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        timeout=30,
    )


class GreetingFlagTests(unittest.TestCase):
    def test_great_prints_one_known_greeting(self):
        result = run_cli("--great")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        self.assertTrue(result.stdout.endswith("\n"))
        self.assertEqual(len(result.stdout.splitlines()), 1)
        self.assertIn(result.stdout[:-1], GREETINGS)


class HelpTests(unittest.TestCase):
    def assert_help(self, result):
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage", result.stdout.lower())
        self.assertIn("--great", result.stdout)

    def test_no_args_shows_help(self):
        self.assert_help(run_cli())

    def test_help_flag_shows_help(self):
        self.assert_help(run_cli("--help"))


class InvalidArgumentTests(unittest.TestCase):
    def assert_rejected(self, *args):
        result = run_cli(*args)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("usage", result.stderr.lower())
        self.assertIn("error", result.stderr.lower())
        self.assertEqual(result.stdout, "")

    def test_misspelled_flag_is_rejected(self):
        self.assert_rejected("--greet")

    def test_unknown_option_is_rejected(self):
        self.assert_rejected("--unknown")

    def test_unexpected_positional_is_rejected(self):
        self.assert_rejected("hello")

    def test_great_with_unknown_option_is_rejected(self):
        self.assert_rejected("--great", "--greet")


if __name__ == "__main__":
    unittest.main()
