import contextlib
import io
import os
import subprocess
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import calculator  # noqa: E402
from calculator import CalculatorError, evaluate  # noqa: E402

SCRIPT = os.path.join(ROOT, "calculator.py")


class EvaluateTests(unittest.TestCase):
    def test_basic_operations(self):
        self.assertEqual(evaluate("1 + 2"), 3)
        self.assertEqual(evaluate("5 - 8"), -3)
        self.assertEqual(evaluate("6 * 7"), 42)
        self.assertEqual(evaluate("8 / 2"), 4)

    def test_true_division(self):
        self.assertEqual(evaluate("7 / 2"), 3.5)
        self.assertIsInstance(evaluate("6 / 3"), float)

    def test_integer_results_stay_integers(self):
        self.assertIsInstance(evaluate("2 + 3"), int)

    def test_precedence(self):
        self.assertEqual(evaluate("2 + 3 * 4"), 14)
        self.assertEqual(evaluate("2 * 3 + 4"), 10)
        self.assertEqual(evaluate("10 - 4 / 2"), 8)

    def test_left_associativity(self):
        self.assertEqual(evaluate("10 - 3 - 2"), 5)
        self.assertEqual(evaluate("100 / 10 / 5"), 2)

    def test_grouping(self):
        self.assertEqual(evaluate("(2 + 3) * 4"), 20)
        self.assertEqual(evaluate("((1 + 2) * (3 + 4))"), 21)
        self.assertEqual(evaluate("(((5)))"), 5)

    def test_unary_signs(self):
        self.assertEqual(evaluate("-3"), -3)
        self.assertEqual(evaluate("+3"), 3)
        self.assertEqual(evaluate("--3"), 3)
        self.assertEqual(evaluate("-+-3"), 3)
        self.assertEqual(evaluate("2 * -3"), -6)
        self.assertEqual(evaluate("-(1 + 2)"), -3)
        self.assertEqual(evaluate("4 - -2"), 6)

    def test_decimals(self):
        self.assertAlmostEqual(evaluate("1.5 + 2.25"), 3.75)
        self.assertAlmostEqual(evaluate(".5 * 4"), 2.0)
        self.assertAlmostEqual(evaluate("3. + 1"), 4.0)
        self.assertAlmostEqual(evaluate("0.1 + 0.2"), 0.3)

    def test_whitespace(self):
        self.assertEqual(evaluate("  1+2  "), 3)
        self.assertEqual(evaluate("1\t+\t2"), 3)
        self.assertEqual(evaluate("( 1 + 2 )*3"), 9)

    def test_single_number(self):
        self.assertEqual(evaluate("42"), 42)


class ErrorTests(unittest.TestCase):
    def assertRejected(self, expression):
        with self.assertRaises(CalculatorError, msg=expression):
            evaluate(expression)

    def test_empty(self):
        for expr in ("", "   ", "\t"):
            self.assertRejected(expr)

    def test_malformed(self):
        for expr in ("1 +", "* 2", "1 2", "(1 + 2", "1 + 2)", "()", "1 ++* 2",
                     "1 +\n2", "1 = 2", "1;2", "1 +\x00 2"):
            self.assertRejected(expr)

    def test_unsupported_operators(self):
        for expr in ("2 ** 3", "7 // 2", "7 % 2", "~1", "1 << 2", "1 & 1",
                     "1 | 1", "1 ^ 1", "2 @ 3", "not 1", "1 < 2",
                     "1 and 2", "1 if 1 else 2"):
            self.assertRejected(expr)

    def test_unsupported_literals(self):
        for expr in ("True", "False", "None", "'a'", "'1' + '2'", "b'x'",
                     "1j", "3 + 2j", "...", "True + 1", "-True"):
            self.assertRejected(expr)

    def test_names_and_calls(self):
        for expr in ("x", "x + 1", "abs(-1)", "pow(2, 3)", "(1).real",
                     "int.__add__", "[1, 2]", "(1, 2)", "{1: 2}", "1 if x else 2",
                     "lambda: 1", "[x for x in range(3)]", "f'{1}'"):
            self.assertRejected(expr)

    def test_code_execution_attempts(self):
        marker = "calculator_test_marker_should_not_exist"
        attempts = (
            "__import__('os').system('echo hi')",
            "__import__('os').system('touch %s')" % marker,
            "open('/etc/passwd').read()",
            "exec('x = 1')",
            "eval('1 + 1')",
            "().__class__.__bases__[0].__subclasses__()",
            "[c for c in ().__class__.__mro__]",
        )
        for expr in attempts:
            self.assertRejected(expr)
        self.assertFalse(os.path.exists(marker))

    def test_division_by_zero(self):
        for expr in ("1 / 0", "1 / 0.0", "1 / (2 - 2)", "0 / 0", "-1 / 0"):
            with self.assertRaisesRegex(CalculatorError, "division by zero"):
                evaluate(expr)

    def test_nonfinite(self):
        for expr in ("1e999", "-1e999", "1e308 * 10", "1e999 - 1e999",
                     "1e999 * 0", "1e308 + 1e308"):
            with self.assertRaisesRegex(CalculatorError, "not finite"):
                evaluate(expr)

    def test_huge_int_division_overflow(self):
        expr = "1" + "0" * 400 + " / 1"
        with self.assertRaises(CalculatorError):
            evaluate(expr)

    def test_deeply_nested(self):
        with self.assertRaises(CalculatorError):
            evaluate("(" * 5000 + "1" + ")" * 5000)

    def test_non_string(self):
        with self.assertRaises(CalculatorError):
            evaluate(None)
        with self.assertRaises(CalculatorError):
            evaluate(5)


class MainTests(unittest.TestCase):
    def test_main_returns_codes(self):
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(calculator.main(["1 + 1"]), 0)
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(calculator.main(["1 / 0"]), 2)


class CliTests(unittest.TestCase):
    def run_cli(self, *args):
        return subprocess.run(
            [sys.executable, SCRIPT, *args],
            capture_output=True,
            text=True,
            timeout=30,
        )

    def assertCliError(self, proc, text=None):
        self.assertEqual(proc.returncode, 2, proc.stderr)
        self.assertEqual(proc.stdout, "")
        self.assertNotEqual(proc.stderr, "")
        self.assertNotIn("Traceback", proc.stderr)
        if text:
            self.assertIn(text, proc.stderr)

    def test_success(self):
        proc = self.run_cli("2 + 3 * 4")
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout, "14\n")
        self.assertEqual(proc.stderr, "")

    def test_decimal_output(self):
        proc = self.run_cli("7 / 2")
        self.assertEqual((proc.returncode, proc.stdout, proc.stderr), (0, "3.5\n", ""))

    def test_negative_with_separator(self):
        proc = self.run_cli("--", "-(1 + 2)")
        self.assertEqual((proc.returncode, proc.stdout, proc.stderr), (0, "-3\n", ""))

    def test_negative_number_without_separator(self):
        proc = self.run_cli("-5")
        self.assertEqual((proc.returncode, proc.stdout), (0, "-5\n"))

    def test_invalid_syntax(self):
        self.assertCliError(self.run_cli("1 +"), "error:")

    def test_empty_expression(self):
        self.assertCliError(self.run_cli(""), "empty")

    def test_unsupported(self):
        self.assertCliError(self.run_cli("__import__('os').getcwd()"), "error:")
        self.assertCliError(self.run_cli("2 ** 3"), "error:")

    def test_division_by_zero(self):
        self.assertCliError(self.run_cli("1 / 0"), "division by zero")

    def test_nonfinite(self):
        self.assertCliError(self.run_cli("1e999"), "not finite")

    def test_missing_argument(self):
        proc = self.run_cli()
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(proc.stdout, "")
        self.assertIn("usage:", proc.stderr)
        self.assertNotIn("Traceback", proc.stderr)

    def test_extra_arguments(self):
        proc = self.run_cli("1 + 1", "2 + 2")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(proc.stdout, "")
        self.assertIn("usage:", proc.stderr)
        self.assertNotIn("Traceback", proc.stderr)

    def test_help(self):
        proc = self.run_cli("--help")
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stderr, "")
        self.assertIn("usage:", proc.stdout)
        self.assertIn("expression", proc.stdout)
        self.assertIn("--", proc.stdout)


if __name__ == "__main__":
    unittest.main()
