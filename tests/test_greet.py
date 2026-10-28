import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "greet.py"


def run(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={"PYTHONIOENCODING": "utf-8", "PATH": ""},
    )


class SuccessTests(unittest.TestCase):
    def assertGreeting(self, result, expected):
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, expected + "\n")
        self.assertEqual(result.stderr, "")

    def test_defaults(self):
        self.assertGreeting(run(), "Hello, World!")

    def test_supplied_name(self):
        self.assertGreeting(run("--name", "Ada"), "Hello, Ada!")

    def test_friendly(self):
        self.assertGreeting(run("--tone", "friendly"), "Hello, World!")

    def test_formal(self):
        self.assertGreeting(run("--tone", "formal"), "Good day, World.")

    def test_casual(self):
        self.assertGreeting(run("--tone", "casual"), "Hey, World!")

    def test_combined_options(self):
        self.assertGreeting(run("--name", "Ada", "--tone", "formal"), "Good day, Ada.")

    def test_combined_options_reversed_and_equals_form(self):
        self.assertGreeting(run("--tone=casual", "--name=Bob"), "Hey, Bob!")

    def test_surrounding_whitespace_stripped(self):
        self.assertGreeting(run("--name", "  \t Ada \n"), "Hello, Ada!")

    def test_internal_whitespace_preserved(self):
        self.assertGreeting(run("--name", "Ada   Lovelace"), "Hello, Ada   Lovelace!")

    def test_unicode_name(self):
        self.assertGreeting(run("--name", "José 日本 🎉"), "Hello, José 日本 🎉!")

    def test_unicode_with_tone(self):
        self.assertGreeting(run("--name", "Zoë", "--tone", "casual"), "Hey, Zoë!")


class ErrorTests(unittest.TestCase):
    def assertUsageError(self, result, *fragments):
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stdout, "")
        self.assertIn("usage:", result.stderr)
        for fragment in fragments:
            self.assertIn(fragment, result.stderr)

    def test_empty_name(self):
        self.assertUsageError(run("--name", ""), "--name", "empty")

    def test_whitespace_only_name(self):
        self.assertUsageError(run("--name", "   \t "), "--name", "empty")

    def test_invalid_tone(self):
        self.assertUsageError(run("--tone", "rude"), "--tone", "invalid choice", "rude")

    def test_invalid_tone_lists_choices(self):
        result = run("--tone", "rude")
        for tone in ("friendly", "formal", "casual"):
            self.assertIn(tone, result.stderr)

    def test_missing_name_value(self):
        self.assertUsageError(run("--name"), "--name", "expected one argument")

    def test_missing_tone_value(self):
        self.assertUsageError(run("--tone"), "--tone", "expected one argument")

    def test_unknown_option(self):
        self.assertUsageError(run("--shout"), "unrecognized arguments", "--shout")

    def test_unexpected_positional(self):
        self.assertUsageError(run("Ada"), "unrecognized arguments")


class HelpTests(unittest.TestCase):
    def test_help(self):
        for flag in ("--help", "-h"):
            with self.subTest(flag=flag):
                result = run(flag)
                self.assertEqual(result.returncode, 0)
                self.assertEqual(result.stderr, "")
                self.assertIn("usage:", result.stdout)
                self.assertIn("--name", result.stdout)
                self.assertIn("--tone", result.stdout)
                for tone in ("friendly", "formal", "casual"):
                    self.assertIn(tone, result.stdout)
                self.assertIn("World", result.stdout)


class ImportTests(unittest.TestCase):
    def test_import_has_no_side_effects(self):
        result = subprocess.run(
            [sys.executable, "-c", "import greet"],
            capture_output=True,
            text=True,
            cwd=str(SCRIPT.parent),
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")


if __name__ == "__main__":
    unittest.main()
