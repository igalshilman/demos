# calc

A small command-line calculator. Pure standard library, Python 3.9+.

## Install

```sh
pip install .            # or: pip install -e ".[dev]" for development
```

## Usage

Evaluate an expression:

```sh
$ calc "2 + 3 * 4"
14
$ python -m calc 7/2
3.5
```

Run `calc` with no arguments for an interactive prompt (type `quit`, `exit`
or press Ctrl-D to leave):

```sh
$ calc
calc 0.1.0 - type 'quit' or Ctrl-D to exit
> 1 + 2
3
```

Or pipe in one expression per line:

```sh
$ printf '1 + 1\n10 / 4\n' | calc
2
2.5
```

Blank lines are skipped, and processing stops at `quit` or `exit`.
`calc --version` prints the version.

## Operators and precedence

From highest to lowest precedence:

1. Parentheses `( )`
2. Exponentiation `**` (right-associative)
3. Unary `+` and `-`
4. Multiplication, division, floor division and modulo: `*`, `/`, `//`, `%`
5. Addition and subtraction: `+`, `-`

See `calc/evaluator.py` for the authoritative grammar.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Evaluation error (`error: <message>` on stderr); with piped input, at least one line failed |
| 2 | Invalid command-line usage |

## Tests

```sh
pip install -e ".[dev]"
pytest
```
