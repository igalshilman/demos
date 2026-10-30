import subprocess
import sys
import unittest
from pathlib import Path

GREETER = Path(__file__).resolve().parent.parent / "greeter.py"


def run_greeter(*args):
    return subprocess.run(
        [sys.executable, str(GREETER), *args],
        capture_output=True,
        text=True,
    )


class GreeterTests(unittest.TestCase):
    def test_default_greeting(self):
        result = run_greeter()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, World!\n")

    def test_supplied_name(self):
        result = run_greeter("--name", "Ada")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")

    def test_quoted_multiword_name(self):
        result = run_greeter("--name", "Ada Lovelace")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada Lovelace!\n")

    def test_help(self):
        result = run_greeter("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertIn("--name", result.stdout)

    def test_missing_name_value(self):
        result = run_greeter("--name")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("expected one argument", result.stderr)


if __name__ == "__main__":
    unittest.main()
