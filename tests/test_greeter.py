import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRIPT = os.path.join(ROOT, "greeter.py")


def run(*args):
    return subprocess.run(
        [sys.executable, SCRIPT, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )


class GreeterTest(unittest.TestCase):
    def assertGreeting(self, result, expected):
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, expected + "\n")
        self.assertEqual(result.stderr, "")

    def assertUsageError(self, result, *fragments):
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("usage:", result.stderr)
        for fragment in fragments:
            self.assertIn(fragment, result.stderr)

    def test_defaults(self):
        self.assertGreeting(run(), "Hello, World!")

    def test_each_tone(self):
        self.assertGreeting(run("--tone", "friendly"), "Hello, World!")
        self.assertGreeting(run("--tone", "formal"), "Good day, World.")
        self.assertGreeting(run("--tone", "casual"), "Hey, World!")

    def test_custom_name_with_each_tone(self):
        self.assertGreeting(run("--name", "Ada"), "Hello, Ada!")
        self.assertGreeting(run("--name", "Ada", "--tone", "formal"), "Good day, Ada.")
        self.assertGreeting(run("--tone", "casual", "--name", "Ada"), "Hey, Ada!")

    def test_equals_syntax(self):
        self.assertGreeting(run("--name=Ada", "--tone=formal"), "Good day, Ada.")

    def test_name_with_spaces(self):
        self.assertGreeting(run("--name", "Ada Lovelace"), "Hello, Ada Lovelace!")

    def test_unicode_name(self):
        self.assertGreeting(run("--name", "José Ñandú 日本"), "Hello, José Ñandú 日本!")

    def test_name_whitespace_is_trimmed(self):
        self.assertGreeting(run("--name", "  Ada \t"), "Hello, Ada!")

    def test_inner_whitespace_is_preserved(self):
        self.assertGreeting(run("--name", " Ada  Lovelace "), "Hello, Ada  Lovelace!")

    def test_empty_name_rejected(self):
        self.assertUsageError(run("--name", ""), "--name", "empty")

    def test_blank_name_rejected(self):
        self.assertUsageError(run("--name", "  \t "), "--name", "empty")

    def test_invalid_tone_rejected(self):
        self.assertUsageError(run("--tone", "angry"), "--tone", "angry", "friendly")

    def test_tone_is_case_sensitive(self):
        self.assertUsageError(run("--tone", "Formal"), "--tone")

    def test_unknown_argument_rejected(self):
        self.assertUsageError(run("--shout"), "--shout")

    def test_unexpected_positional_rejected(self):
        self.assertUsageError(run("Ada"), "Ada")

    def test_abbreviated_option_rejected(self):
        self.assertUsageError(run("--na", "Ada"), "--na")

    def test_missing_name_value(self):
        self.assertUsageError(run("--name"), "--name", "expected one argument")

    def test_missing_tone_value(self):
        self.assertUsageError(run("--tone"), "--tone", "expected one argument")

    def test_missing_value_before_another_option(self):
        self.assertUsageError(run("--name", "--tone", "formal"), "--name")

    def test_help(self):
        result = run("--help")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        for fragment in ("usage:", "--name", "--tone", "friendly", "formal", "casual", "World"):
            self.assertIn(fragment, result.stdout)

    def test_short_help(self):
        result = run("-h")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)


if __name__ == "__main__":
    unittest.main()
