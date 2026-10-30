import os
import subprocess
import sys
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "greeting.py")


def run_cli(*args):
    return subprocess.run(
        [sys.executable, SCRIPT, *args],
        capture_output=True,
        text=True,
    )


class GreetingCliTest(unittest.TestCase):
    def test_default_greeting(self):
        result = run_cli()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, World!\n")

    def test_named_greeting(self):
        result = run_cli("--name", "Ada")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")

    def test_multiword_name(self):
        result = run_cli("--name", "Ada Lovelace")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada Lovelace!\n")

    def test_help(self):
        result = run_cli("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("--name", result.stdout)

    def test_unknown_argument_fails(self):
        result = run_cli("--bogus")
        self.assertNotEqual(result.returncode, 0)


if __name__ == "__main__":
    unittest.main()
