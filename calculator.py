#!/usr/bin/env python3
"""A small command-line calculator.

Usage: python calculator.py "2 + 3 * 4"
"""

import argparse
import ast
import math
import operator
import sys

_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
}

_UNARY_OPERATORS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


class CalculatorError(Exception):
    """Raised when an expression cannot be evaluated."""


def _eval_node(node):
    if isinstance(node, ast.Constant):
        # bool is a subclass of int, so check the exact type.
        if type(node.value) in (int, float):
            return node.value
        raise CalculatorError("unsupported expression: only numbers are allowed")
    if isinstance(node, ast.BinOp) and type(node.op) in _BINARY_OPERATORS:
        left = _eval_node(node.left)
        right = _eval_node(node.right)
        return _BINARY_OPERATORS[type(node.op)](left, right)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _UNARY_OPERATORS:
        return _UNARY_OPERATORS[type(node.op)](_eval_node(node.operand))
    raise CalculatorError("unsupported expression")


def evaluate(expression):
    """Evaluate an arithmetic expression and return an int or float.

    Raises CalculatorError for invalid syntax, unsupported constructs,
    division by zero, or non-finite results.
    """
    if not isinstance(expression, str):
        raise CalculatorError("expression must be a string")
    expression = expression.strip()
    if not expression:
        raise CalculatorError("empty expression")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError:
        raise CalculatorError("invalid syntax") from None
    except (ValueError, RecursionError, MemoryError):
        raise CalculatorError("invalid expression") from None

    try:
        result = _eval_node(tree.body)
    except ZeroDivisionError:
        raise CalculatorError("division by zero") from None
    except OverflowError:
        raise CalculatorError("result is not finite") from None
    except RecursionError:
        raise CalculatorError("expression is too deeply nested") from None

    if isinstance(result, float) and not math.isfinite(result):
        raise CalculatorError("result is not finite")
    return result


def _build_parser():
    parser = argparse.ArgumentParser(
        prog="calculator.py",
        description=(
            "Evaluate a single arithmetic expression using numbers, "
            "parentheses, unary +/- and the binary operators + - * /."
        ),
        epilog=(
            'Example: python calculator.py "2 + 3 * 4". '
            "If the expression begins with '-', separate it with --: "
            'python calculator.py -- "-(1 + 2)".'
        ),
    )
    parser.add_argument("expression", help="the arithmetic expression, quoted")
    return parser


def main(argv=None):
    args = _build_parser().parse_args(argv)
    try:
        result = evaluate(args.expression)
        output = str(result)
    except CalculatorError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    except ValueError:
        print("error: result is too large to display", file=sys.stderr)
        return 2
    print(output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
