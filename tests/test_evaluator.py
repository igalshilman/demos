import unittest
from decimal import Decimal

from calculator.errors import (
    CalculatorError,
    DivisionByZeroError,
    InvalidExpressionError,
)
from calculator.evaluator import evaluate


class ValueTests(unittest.TestCase):
    def check(self, expression, expected):
        result = evaluate(expression)
        self.assertIsInstance(result, Decimal)
        self.assertEqual(result, Decimal(expected), expression)

    def test_integers(self):
        self.check("42", "42")
        self.check("0", "0")

    def test_basic_operators(self):
        self.check("1+2", "3")
        self.check("5-8", "-3")
        self.check("6*7", "42")
        self.check("7/2", "3.5")

    def test_precedence(self):
        self.check("2+3*4", "14")
        self.check("2*3+4", "10")
        self.check("10-6/3", "8")
        self.check("2+3*4-8/2", "10")

    def test_left_associativity(self):
        self.check("10-3-2", "5")
        self.check("100/10/5", "2")
        self.check("2-3+4", "3")
        self.check("8/4*2", "4")

    def test_parentheses(self):
        self.check("(2+3)*4", "20")
        self.check("2*(3+4)", "14")
        self.check("((1+2))*((3))", "9")
        self.check("(1+2)*(3+4)/(7)", "3")
        self.check("10-(3-2)", "9")
        self.check("100/(10/5)", "50")

    def test_unary_signs(self):
        self.check("-5", "-5")
        self.check("+5", "5")
        self.check("--5", "5")
        self.check("-+-5", "5")
        self.check("---5", "-5")
        self.check("3--2", "5")
        self.check("3+-2", "1")
        self.check("3*-2", "-6")
        self.check("2*+3", "6")
        self.check("-(2+3)", "-5")
        self.check("-(-(2))", "2")

    def test_unary_binds_tighter_than_binary(self):
        self.check("-2*3", "-6")
        self.check("-2*-3", "6")
        self.check("4/-2", "-2")

    def test_decimals(self):
        self.check("1.5+2.25", "3.75")
        self.check(".5+.5", "1")
        self.check("0.5*4", "2")
        self.check("3.", "3")
        self.check("-.25", "-0.25")
        self.check("10/4", "2.5")

    def test_decimal_arithmetic_is_exact(self):
        self.check("0.1+0.2", "0.3")
        self.assertEqual(evaluate("0.1+0.2"), Decimal("0.3"))
        self.check("1.1*1.1", "1.21")
        self.check("0.3-0.1", "0.2")

    def test_precision_is_28_digits(self):
        self.assertEqual(evaluate("1/3"), Decimal("0.3333333333333333333333333333"))
        self.assertEqual(evaluate("2/3"), Decimal("0.6666666666666666666666666667"))

    def test_precision_does_not_leak_into_global_context(self):
        import decimal

        before = decimal.getcontext().prec
        evaluate("1/3")
        self.assertEqual(decimal.getcontext().prec, before)

    def test_whitespace_ignored(self):
        self.check("  1 +\t2 \n* 3 ", "7")
        self.check("( 1 + 2 ) * 3", "9")
        self.check("- 5", "-5")

    def test_large_numbers(self):
        self.check("12345678901234567890*10", "123456789012345678900")

    def test_zero_numerator(self):
        self.check("0/5", "0")


class DivisionByZeroTests(unittest.TestCase):
    def test_literal_zero(self):
        with self.assertRaises(DivisionByZeroError):
            evaluate("1/0")

    def test_decimal_zero(self):
        with self.assertRaises(DivisionByZeroError):
            evaluate("1/0.0")

    def test_zero_expression_denominator(self):
        with self.assertRaises(DivisionByZeroError):
            evaluate("5/(2-2)")

    def test_negative_zero_denominator(self):
        with self.assertRaises(DivisionByZeroError):
            evaluate("5/-0")

    def test_zero_over_zero(self):
        with self.assertRaises(DivisionByZeroError):
            evaluate("0/0")

    def test_nested(self):
        with self.assertRaises(DivisionByZeroError):
            evaluate("1+2*(3/0)")

    def test_default_message(self):
        self.assertEqual(str(DivisionByZeroError()), "division by zero")
        with self.assertRaises(DivisionByZeroError) as ctx:
            evaluate("1/0")
        self.assertEqual(str(ctx.exception), "division by zero")

    def test_is_calculator_error(self):
        self.assertTrue(issubclass(DivisionByZeroError, CalculatorError))


class InvalidExpressionTests(unittest.TestCase):
    def assertInvalid(self, expression, position=None):
        with self.assertRaises(InvalidExpressionError) as ctx:
            evaluate(expression)
        if position is not None:
            self.assertEqual(ctx.exception.position, position, expression)
            self.assertIn(str(position), str(ctx.exception))
        return ctx.exception

    def test_empty_and_blank(self):
        for expression in ["", "   ", "\t\n"]:
            error = self.assertInvalid(expression)
            self.assertIn("empty", str(error))

    def test_unknown_characters(self):
        self.assertInvalid("1 $ 2", 2)
        self.assertInvalid("abc", 0)
        self.assertInvalid("2^3", 1)
        self.assertInvalid("1,5", 1)
        self.assertInvalid("1e5", 1)

    def test_unmatched_open_paren(self):
        error = self.assertInvalid("(1+2", 0)
        self.assertIn("(", str(error))
        self.assertInvalid("2*(3+(4)", 2)

    def test_unmatched_close_paren(self):
        self.assertInvalid("1+2)", 3)
        self.assertInvalid(")", None)
        self.assertInvalid("(1))", 3)

    def test_empty_parentheses(self):
        self.assertInvalid("()", 1)
        self.assertInvalid("2*()", 3)

    def test_trailing_operator(self):
        self.assertInvalid("1+", 2)
        self.assertInvalid("1*2/", 4)
        self.assertInvalid("-", 1)

    def test_leading_binary_operator(self):
        self.assertInvalid("*2", 0)
        self.assertInvalid("/2", 0)

    def test_consecutive_binary_operators(self):
        self.assertInvalid("1**2", 2)
        self.assertInvalid("1*/2", 2)
        self.assertInvalid("1+*2", 2)

    def test_adjacent_numbers(self):
        self.assertInvalid("1 2", 2)
        self.assertInvalid("1.5 2", 4)

    def test_adjacent_number_and_paren(self):
        self.assertInvalid("2(3)", 1)
        self.assertInvalid("(2)3", 3)
        self.assertInvalid("(1)(2)", 3)

    def test_malformed_numbers(self):
        self.assertInvalid("1.2.3", 3)
        self.assertInvalid(".", 0)
        self.assertInvalid("1..2", 2)

    def test_non_ascii_digits_rejected(self):
        self.assertInvalid("\u0663", 0)

    def test_deep_nesting_becomes_invalid_expression(self):
        depth = 100000
        error = self.assertInvalid("(" * depth + "1" + ")" * depth)
        self.assertIsNone(error.position)
        self.assertInvalid("-" * depth + "1")

    def test_moderate_nesting_ok(self):
        self.assertEqual(evaluate("(" * 50 + "7" + ")" * 50), Decimal(7))


class ErrorTypeTests(unittest.TestCase):
    def test_hierarchy(self):
        self.assertTrue(issubclass(InvalidExpressionError, CalculatorError))
        self.assertTrue(issubclass(DivisionByZeroError, CalculatorError))
        self.assertTrue(issubclass(CalculatorError, Exception))

    def test_invalid_expression_error_without_position(self):
        error = InvalidExpressionError("bad")
        self.assertIsNone(error.position)
        self.assertEqual(str(error), "bad")

    def test_invalid_expression_error_with_position(self):
        error = InvalidExpressionError("bad", position=3)
        self.assertEqual(error.position, 3)
        self.assertIn("3", str(error))
        self.assertIn("bad", str(error))

    def test_position_zero_is_reported(self):
        error = InvalidExpressionError("bad", 0)
        self.assertEqual(error.position, 0)
        self.assertIn("0", str(error))

    def test_all_failures_catchable_as_calculator_error(self):
        for expression in ["", "1/0", "(", "1 2", "$"]:
            with self.assertRaises(CalculatorError):
                evaluate(expression)

    def test_non_string_input(self):
        with self.assertRaises(TypeError):
            evaluate(None)


if __name__ == "__main__":
    unittest.main()
