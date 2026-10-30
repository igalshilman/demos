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


class GreeterTests(unittest.TestCase):
    def test_default_greeting(self):
        result = run_greeter()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, World!\n")

    def test_named_greeting(self):
        result = run_greeter("--name", "Ada")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada!\n")

    def test_name_with_spaces(self):
        result = run_greeter("--name", "Ada Lovelace")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Ada Lovelace!\n")

    def test_help(self):
        result = run_greeter("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("usage:", result.stdout)
        self.assertIn("--name", result.stdout)

    def test_unknown_argument_rejected(self):
        result = run_greeter("--bogus")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("unrecognized arguments", result.stderr)

    def test_import_does_not_run_cli(self):
        result = subprocess.run(
            [sys.executable, "-c", "import greeter"],
            capture_output=True,
            text=True,
            cwd=os.path.dirname(SCRIPT),
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
