import io
import os
import subprocess
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from decimal import Decimal

from calculator.cli import format_result, main

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_main(*args):
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        code = main(list(args))
    return code, out.getvalue(), err.getvalue()


class FormatResultTests(unittest.TestCase):
    def test_integer_has_no_decimal_point(self):
        self.assertEqual(format_result(Decimal("5")), "5")
        self.assertEqual(format_result(Decimal("5.000")), "5")
        self.assertEqual(format_result(Decimal("-12")), "-12")

    def test_trailing_zeros_stripped(self):
        self.assertEqual(format_result(Decimal("2.50")), "2.5")
        self.assertEqual(format_result(Decimal("0.1000")), "0.1")

    def test_non_integer_fixed_point(self):
        self.assertEqual(format_result(Decimal("0.3")), "0.3")
        self.assertEqual(format_result(Decimal("-1.25")), "-1.25")

    def test_no_exponent_notation(self):
        self.assertEqual(format_result(Decimal("1E+3")), "1000")
        self.assertEqual(format_result(Decimal("1E-7")), "0.0000001")
        self.assertEqual(format_result(Decimal("1.5E+2")), "150")

    def test_negative_zero(self):
        self.assertEqual(format_result(Decimal("-0")), "0")
        self.assertEqual(format_result(Decimal("-0.000")), "0")
        self.assertEqual(format_result(Decimal("0.00")), "0")


class MainTests(unittest.TestCase):
    def test_success(self):
        code, out, err = run_main("2+3*4")
        self.assertEqual((code, out, err), (0, "14\n", ""))

    def test_decimal_result(self):
        code, out, err = run_main("0.1 + 0.2")
        self.assertEqual((code, out, err), (0, "0.3\n", ""))

    def test_leading_minus(self):
        code, out, err = run_main("-3+2")
        self.assertEqual((code, out, err), (0, "-1\n", ""))

    def test_multiple_args_joined(self):
        code, out, err = run_main("2", "+", "3")
        self.assertEqual((code, out, err), (0, "5\n", ""))

    def test_multiple_args_with_leading_minus(self):
        code, out, err = run_main("-3", "+", "2")
        self.assertEqual((code, out, err), (0, "-1\n", ""))

    def test_invalid_expression(self):
        code, out, err = run_main("2 +")
        self.assertEqual(code, 1)
        self.assertEqual(out, "")
        self.assertTrue(err.startswith("error: "))
        self.assertTrue(err.endswith("\n"))
        self.assertNotIn("Traceback", err)

    def test_garbage_input(self):
        code, out, err = run_main("abc")
        self.assertEqual(code, 1)
        self.assertEqual(out, "")
        self.assertTrue(err.startswith("error: "))

    def test_division_by_zero(self):
        code, out, err = run_main("1/0")
        self.assertEqual(code, 1)
        self.assertEqual(out, "")
        self.assertTrue(err.startswith("error: "))
        self.assertNotIn("Traceback", err)

    def test_no_arguments(self):
        code, out, err = run_main()
        self.assertEqual(code, 2)
        self.assertEqual(out, "")
        self.assertIn("usage:", err)

    def test_blank_argument(self):
        code, out, err = run_main("   ")
        self.assertEqual(code, 2)
        self.assertIn("usage:", err)

    def test_help(self):
        for flag in ("-h", "--help"):
            code, out, err = run_main(flag)
            self.assertEqual(code, 0)
            self.assertIn("usage:", out)
            self.assertEqual(err, "")


class SubprocessTests(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, "-m", "calculator", *args],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
        )

    def test_success(self):
        proc = self.run_cli("2 + 3 * 4")
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout, "14\n")
        self.assertEqual(proc.stderr, "")

    def test_leading_minus_quoted_and_separate(self):
        for args in (("-3+2",), ("-3", "+", "2")):
            proc = self.run_cli(*args)
            self.assertEqual(proc.returncode, 0)
            self.assertEqual(proc.stdout, "-1\n")

    def test_parentheses_and_decimals(self):
        proc = self.run_cli("(1.5 + 2.5) / 4")
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout, "1\n")

    def test_division_by_zero(self):
        proc = self.run_cli("1/0")
        self.assertEqual(proc.returncode, 1)
        self.assertEqual(proc.stdout, "")
        self.assertTrue(proc.stderr.startswith("error: "))
        self.assertNotIn("Traceback", proc.stderr)

    def test_invalid(self):
        proc = self.run_cli("2 +")
        self.assertEqual(proc.returncode, 1)
        self.assertTrue(proc.stderr.startswith("error: "))
        self.assertNotIn("Traceback", proc.stderr)

    def test_no_arguments(self):
        proc = self.run_cli()
        self.assertEqual(proc.returncode, 2)
        self.assertIn("usage:", proc.stderr)

    def test_help(self):
        proc = self.run_cli("--help")
        self.assertEqual(proc.returncode, 0)
        self.assertIn("usage:", proc.stdout)


if __name__ == "__main__":
    unittest.main()
