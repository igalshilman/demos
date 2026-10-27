import os
import subprocess
import sys
import unittest

CLI = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cli.py")


def run_cli(*args):
    return subprocess.run(
        [sys.executable, CLI, *args], capture_output=True, text=True
    )


class HelloCliTest(unittest.TestCase):
    def test_hello_prints_greeting(self):
        result = run_cli("--hello")
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "Hello!\n")

    def test_without_hello_prints_no_greeting(self):
        result = run_cli()
        self.assertEqual(result.returncode, 0)
        self.assertNotIn("Hello!", result.stdout)


if __name__ == "__main__":
    unittest.main()
