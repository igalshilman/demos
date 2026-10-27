"""Safe arithmetic expression evaluator.

Expressions are tokenized and parsed by a recursive-descent parser; nothing is
ever passed to ``eval``, ``exec`` or ``compile``.

Grammar (lowest to highest precedence)::

    expr    := term (('+' | '-') term)*
    term    := unary (('*' | '/' | '//' | '%') unary)*
    unary   := ('+' | '-') unary | power
    power   := primary (('**' | '^') unary)?
    primary := NUMBER | '(' expr ')'
"""

import math
from typing import List, NamedTuple, Union

Number = Union[int, float]

_WHITESPACE = " \t\r\n\f\v"
_DIGITS = "0123456789"
_MAX_EXPONENT = 10000
_MAX_RESULT_BITS = 1_000_000

_NUM = "number"
_OP = "operator"
_LPAREN = "("
_RPAREN = ")"
_END = "end"


class CalcError(Exception):
    """Raised when an expression cannot be evaluated."""


class _Token(NamedTuple):
    kind: str
    value: object
    pos: int


def _tokenize(text: str) -> List[_Token]:
    tokens: List[_Token] = []
    i = 0
    n = len(text)
    while i < n:
        ch = text[i]
        if ch in _WHITESPACE:
            i += 1
        elif ch in _DIGITS or (ch == "." and i + 1 < n and text[i + 1] in _DIGITS):
            start = i
            while i < n and text[i] in _DIGITS:
                i += 1
            is_float = False
            if i < n and text[i] == ".":
                is_float = True
                i += 1
                while i < n and text[i] in _DIGITS:
                    i += 1
            literal = text[start:i]
            try:
                value: Number = float(literal) if is_float else int(literal)
            except ValueError:
                raise CalcError("result too large")
            if isinstance(value, float) and not math.isfinite(value):
                raise CalcError("result too large")
            tokens.append(_Token(_NUM, value, start))
        elif ch == "*":
            if i + 1 < n and text[i + 1] == "*":
                tokens.append(_Token(_OP, "**", i))
                i += 2
            else:
                tokens.append(_Token(_OP, "*", i))
                i += 1
        elif ch == "/":
            if i + 1 < n and text[i + 1] == "/":
                tokens.append(_Token(_OP, "//", i))
                i += 2
            else:
                tokens.append(_Token(_OP, "/", i))
                i += 1
        elif ch in "+-%^":
            tokens.append(_Token(_OP, "**" if ch == "^" else ch, i))
            i += 1
        elif ch == "(":
            tokens.append(_Token(_LPAREN, ch, i))
            i += 1
        elif ch == ")":
            tokens.append(_Token(_RPAREN, ch, i))
            i += 1
        else:
            raise CalcError("invalid character %r at position %d" % (ch, i))
    tokens.append(_Token(_END, None, n))
    return tokens


def _check(value: Number) -> Number:
    if isinstance(value, complex):
        raise CalcError("invalid operation")
    if isinstance(value, float) and not math.isfinite(value):
        raise CalcError("result too large")
    return value


def _power(base: Number, exp: Number) -> Number:
    if abs(base) > 1:
        if exp > _MAX_EXPONENT:
            raise CalcError("result too large")
        if isinstance(base, int) and isinstance(exp, int) and exp > 0:
            if base.bit_length() * exp > _MAX_RESULT_BITS:
                raise CalcError("result too large")
    return base ** exp


def _apply(op: str, left: Number, right: Number) -> Number:
    try:
        if op == "+":
            result = left + right
        elif op == "-":
            result = left - right
        elif op == "*":
            result = left * right
        elif op == "/":
            result = left / right
        elif op == "//":
            result = left // right
        elif op == "%":
            result = left % right
        else:
            result = _power(left, right)
    except ZeroDivisionError:
        raise CalcError("division by zero")
    except OverflowError:
        raise CalcError("result too large")
    return _check(result)


class _Parser:
    def __init__(self, tokens: List[_Token]) -> None:
        self._tokens = tokens
        self._index = 0

    def _peek(self) -> _Token:
        return self._tokens[self._index]

    def _next(self) -> _Token:
        token = self._tokens[self._index]
        self._index += 1
        return token

    def _is_op(self, *ops: str) -> bool:
        token = self._peek()
        return token.kind == _OP and token.value in ops

    def _unexpected(self, token: _Token) -> CalcError:
        if token.kind == _END:
            return CalcError("unexpected end of expression")
        return CalcError("unexpected %r at position %d" % (token.value, token.pos))

    def parse(self) -> Number:
        value = self._expr()
        token = self._peek()
        if token.kind != _END:
            raise self._unexpected(token)
        return value

    def _expr(self) -> Number:
        value = self._term()
        while self._is_op("+", "-"):
            op = self._next().value
            value = _apply(op, value, self._term())
        return value

    def _term(self) -> Number:
        value = self._unary()
        while self._is_op("*", "/", "//", "%"):
            op = self._next().value
            value = _apply(op, value, self._unary())
        return value

    def _unary(self) -> Number:
        if self._is_op("+", "-"):
            op = self._next().value
            operand = self._unary()
            return -operand if op == "-" else operand
        return self._power()

    def _power(self) -> Number:
        base = self._primary()
        if self._is_op("**"):
            self._next()
            return _apply("**", base, self._unary())
        return base

    def _primary(self) -> Number:
        token = self._next()
        if token.kind == _NUM:
            return token.value
        if token.kind == _LPAREN:
            value = self._expr()
            closing = self._peek()
            if closing.kind != _RPAREN:
                if closing.kind == _END:
                    raise CalcError("missing closing parenthesis")
                raise self._unexpected(closing)
            self._next()
            return value
        raise self._unexpected(token)


def evaluate(expression: str) -> Number:
    """Evaluate an arithmetic expression and return an ``int`` or ``float``.

    Raises :class:`CalcError` for any invalid input or unrepresentable result.
    """
    if not isinstance(expression, str):
        raise CalcError("expression must be a string")
    if not expression.strip(_WHITESPACE):
        raise CalcError("empty expression")
    try:
        return _Parser(_tokenize(expression)).parse()
    except CalcError:
        raise
    except RecursionError:
        raise CalcError("expression too deeply nested")
    except OverflowError:
        raise CalcError("result too large")
    except Exception:
        raise CalcError("invalid expression")
