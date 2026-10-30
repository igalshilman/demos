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


class GreeterCliTests(unittest.TestCase):
    def test_default_greeting(self):
        result = run_greeter()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, World!\n")

    def test_supplied_name(self):
        result = run_greeter("--name", "Alice")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Alice!\n")

    def test_name_with_spaces(self):
        result = run_greeter("--name", "Alice Smith")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, Alice Smith!\n")

    def test_help_succeeds(self):
        result = run_greeter("--help")
        self.assertEqual(result.returncode, 0)
        self.assertIn("--name", result.stdout)

    def test_name_without_value_fails(self):
        result = run_greeter("--name")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("--name", result.stderr)


class ImportTests(unittest.TestCase):
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
