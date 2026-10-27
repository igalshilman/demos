import subprocess
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "hello.py"


def run_hello(*args):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
    )


class HelloCliTest(unittest.TestCase):
    def test_prints_hello(self):
        result = run_hello()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "hello\n")

    def test_help_mentions_hello_and_does_not_greet(self):
        result = run_hello("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertIn("hello", result.stdout)
        self.assertNotEqual(result.stdout, "hello\n")
        self.assertFalse(result.stdout.startswith("hello"))


if __name__ == "__main__":
    unittest.main()
