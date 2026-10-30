import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = str(Path(__file__).resolve().parent.parent / "greeter.py")


def run(*args):
    return subprocess.run(
        [sys.executable, SCRIPT, *args],
        capture_output=True,
        text=True,
    )


class GreeterTests(unittest.TestCase):
    def test_default_greeting(self):
        result = run()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, world!\n")
        self.assertEqual(result.stderr, "")

    def test_supplied_name(self):
        result = run("--name", "Ada")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")

    def test_quoted_multiword_name(self):
        result = run("--name", "Ada Lovelace")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada Lovelace!\n")

    def test_whitespace_is_trimmed(self):
        result = run("--name", "  Ada  ")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")

    def test_blank_names_are_rejected(self):
        for blank in ("", "   ", "\t\n"):
            with self.subTest(name=blank):
                result = run("--name", blank)
                self.assertNotEqual(result.returncode, 0)
                self.assertEqual(result.stdout, "")
                self.assertIn("usage:", result.stderr)
                self.assertIn("--name", result.stderr)
                self.assertIn("empty or blank", result.stderr)
                self.assertNotIn("Traceback", result.stderr)

    def test_help(self):
        result = run("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertIn("--name NAME", result.stdout)
        self.assertIn("greeting", result.stdout)
        self.assertEqual(result.stderr, "")

    def test_unknown_argument(self):
        result = run("--bogus")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("usage:", result.stderr)
        self.assertIn("unrecognized arguments: --bogus", result.stderr)
        self.assertNotIn("Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
