"""Recursive-descent evaluator for arithmetic expressions.

Grammar::

    expr    := term (('+' | '-') term)*
    term    := factor (('*' | '/') factor)*
    factor  := ('+' | '-') factor | primary
    primary := NUMBER | '(' expr ')'
    NUMBER  := digits ['.' [digits]] | '.' digits

Whitespace between tokens is ignored. All arithmetic uses ``Decimal`` with
28 significant digits; ``eval`` is never used.
"""

import decimal
import re
from decimal import Decimal
from typing import List, NamedTuple

from .errors import DivisionByZeroError, InvalidExpressionError

PRECISION = 28

_NUMBER = re.compile(r"[0-9]+(?:\.[0-9]*)?|\.[0-9]+")
_OPERATORS = "+-*/"
_PARENS = "()"


class _Token(NamedTuple):
    kind: str  # "num", "op", "lparen", "rparen" or "end"
    text: str
    position: int


def _tokenize(expression: str) -> List[_Token]:
    tokens: List[_Token] = []
    i = 0
    length = len(expression)
    while i < length:
        char = expression[i]
        if char.isspace():
            i += 1
            continue
        match = _NUMBER.match(expression, i)
        if match:
            tokens.append(_Token("num", match.group(), i))
            i = match.end()
        elif char in _OPERATORS:
            tokens.append(_Token("op", char, i))
            i += 1
        elif char == "(":
            tokens.append(_Token("lparen", char, i))
            i += 1
        elif char == ")":
            tokens.append(_Token("rparen", char, i))
            i += 1
        else:
            raise InvalidExpressionError(f"unexpected character {char!r}", i)
    tokens.append(_Token("end", "", length))
    return tokens


def _describe(token: _Token) -> str:
    if token.kind == "end":
        return "end of expression"
    return repr(token.text)


class _Parser:
    def __init__(self, tokens: List[_Token]) -> None:
        self._tokens = tokens
        self._index = 0

    @property
    def _current(self) -> _Token:
        return self._tokens[self._index]

    def _advance(self) -> _Token:
        token = self._tokens[self._index]
        self._index += 1
        return token

    def parse(self) -> Decimal:
        value = self._expr()
        token = self._current
        if token.kind == "rparen":
            raise InvalidExpressionError("unmatched ')'", token.position)
        if token.kind != "end":
            raise InvalidExpressionError(
                f"unexpected {_describe(token)}, expected an operator",
                token.position,
            )
        return value

    def _expr(self) -> Decimal:
        value = self._term()
        while self._current.kind == "op" and self._current.text in "+-":
            op = self._advance().text
            right = self._term()
            value = value + right if op == "+" else value - right
        return value

    def _term(self) -> Decimal:
        value = self._factor()
        while self._current.kind == "op" and self._current.text in "*/":
            op = self._advance()
            right = self._factor()
            if op.text == "*":
                value = value * right
            else:
                if right.is_zero():
                    raise DivisionByZeroError()
                value = value / right
        return value

    def _factor(self) -> Decimal:
        token = self._current
        if token.kind == "op" and token.text in "+-":
            self._advance()
            operand = self._factor()
            return -operand if token.text == "-" else +operand
        return self._primary()

    def _primary(self) -> Decimal:
        token = self._current
        if token.kind == "num":
            self._advance()
            return Decimal(token.text)
        if token.kind == "lparen":
            self._advance()
            value = self._expr()
            closing = self._current
            if closing.kind != "rparen":
                if closing.kind == "end":
                    raise InvalidExpressionError(
                        "unmatched '('", token.position
                    )
                raise InvalidExpressionError(
                    f"unexpected {_describe(closing)}, expected ')'",
                    closing.position,
                )
            self._advance()
            return value
        if token.kind == "end":
            raise InvalidExpressionError(
                "unexpected end of expression, expected a number or '('",
                token.position,
            )
        raise InvalidExpressionError(
            f"unexpected {_describe(token)}, expected a number or '('",
            token.position,
        )


def evaluate(expression: str) -> Decimal:
    """Evaluate an arithmetic expression and return the result as a Decimal.

    Raises ``InvalidExpressionError`` for malformed input and
    ``DivisionByZeroError`` when dividing by zero.
    """
    if not isinstance(expression, str):
        raise TypeError("expression must be a string")
    if not expression.strip():
        raise InvalidExpressionError("empty expression")

    try:
        with decimal.localcontext() as context:
            context.prec = PRECISION
            tokens = _tokenize(expression)
            return _Parser(tokens).parse()
    except RecursionError:
        raise InvalidExpressionError("expression is nested too deeply") from None
    except ArithmeticError as exc:
        # Includes decimal.Overflow and friends; zero division is checked
        # explicitly above, so anything left is a range problem.
        raise InvalidExpressionError(f"arithmetic error: {exc.__class__.__name__}") from None
