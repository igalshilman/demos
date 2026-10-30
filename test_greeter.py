import os
import subprocess
import sys
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "greeter.py")


def run_greeter(*args):
    return subprocess.run(
        [sys.executable, SCRIPT, *args],
        capture_output=True,
        text=True,
    )


class GreeterTest(unittest.TestCase):
    def test_named_greeting(self):
        result = run_greeter("--name", "Alice")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Alice!\n")

    def test_default_greeting(self):
        result = run_greeter()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, friend!\n")

    def test_help(self):
        result = run_greeter("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("--name", result.stdout)


if __name__ == "__main__":
    unittest.main()
