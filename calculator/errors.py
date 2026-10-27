"""Typed errors raised by the calculator."""

from typing import Optional


class CalculatorError(Exception):
    """Base class for every error raised by the calculator."""


class InvalidExpressionError(CalculatorError):
    """The expression is malformed.

    ``position`` is the zero-based character offset of the problem in the
    original expression, or ``None`` when no single location applies.
    """

    def __init__(self, message: str, position: Optional[int] = None) -> None:
        self.message = message
        self.position = position
        if position is not None:
            message = f"{message} at position {position}"
        super().__init__(message)


class DivisionByZeroError(CalculatorError):
    """The expression divides by zero."""

    def __init__(self, message: str = "division by zero") -> None:
        super().__init__(message)
