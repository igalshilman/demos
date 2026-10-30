import os
import subprocess
import sys
import unittest

SCRIPT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "greeter.py")


def run(*args):
    return subprocess.run(
        [sys.executable, SCRIPT, *args],
        capture_output=True,
        text=True,
    )


class GreeterTest(unittest.TestCase):
    def test_greeting(self):
        result = run("--name", "World")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello, World!\n")
        self.assertEqual(result.stderr, "")

    def test_missing_name(self):
        result = run()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertIn("usage:", result.stderr)
        self.assertIn("--name", result.stderr)

    def test_help(self):
        for flag in ("-h", "--help"):
            with self.subTest(flag=flag):
                result = run(flag)
                self.assertEqual(result.returncode, 0)
                self.assertIn("usage:", result.stdout)
                self.assertIn("--name", result.stdout)


if __name__ == "__main__":
    unittest.main()
