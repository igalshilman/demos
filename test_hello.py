import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "hello.py"


def run_hello(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
    )


class HelloCliTest(unittest.TestCase):
    def test_default_prints_hello(self):
        result = run_hello()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "hello\n")
        self.assertEqual(result.stderr, "")

    def test_help_shows_hello_without_greeting(self):
        result = run_hello("--help")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stderr, "")
        self.assertIn("usage", result.stdout.lower())
        self.assertIn("hello", result.stdout)
        self.assertNotEqual(result.stdout, "hello\n")


if __name__ == "__main__":
    unittest.main()
