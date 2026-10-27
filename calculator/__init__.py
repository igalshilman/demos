"""A small expression calculator built on the standard library."""

from .errors import CalculatorError, DivisionByZeroError, InvalidExpressionError
from .evaluator import evaluate

__all__ = [
    "CalculatorError",
    "DivisionByZeroError",
    "InvalidExpressionError",
    "evaluate",
]
