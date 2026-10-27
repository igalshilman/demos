import subprocess
import sys
import unittest
from pathlib import Path

CLI = Path(__file__).resolve().parent.parent / "cli.py"


def run_cli(*args):
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        capture_output=True,
        text=True,
    )


class GreetingCliTests(unittest.TestCase):
    def test_greet_with_name(self):
        result = run_cli("--greet", "--name", "Ada")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")
        self.assertEqual(result.stderr, "")

    def test_greet_default_name(self):
        result = run_cli("--greet")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, World!\n")

    def test_name_with_spaces(self):
        result = run_cli("--greet", "--name", "Ada Lovelace")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada Lovelace!\n")

    def test_name_before_greet(self):
        result = run_cli("--name", "Ada", "--greet")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")

    def test_no_greet_prints_help(self):
        result = run_cli()
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertNotIn("Hello", result.stdout)

    def test_name_without_greet_prints_help(self):
        result = run_cli("--name", "Ada")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertNotIn("Hello", result.stdout)

    def test_help(self):
        result = run_cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertIn("--name", result.stdout)
        self.assertIn("--greet", result.stdout)

    def test_unknown_argument(self):
        result = run_cli("--bogus")
        self.assertEqual(result.returncode, 2)
        self.assertNotEqual(result.stderr.strip(), "")
        self.assertEqual(result.stdout, "")

    def test_missing_name_value(self):
        result = run_cli("--greet", "--name")
        self.assertEqual(result.returncode, 2)
        self.assertNotEqual(result.stderr.strip(), "")
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
