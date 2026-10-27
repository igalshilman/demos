# A demo project

Built by the factory.

## Calculator CLI

`calculator.py` is a small calculator that evaluates a single arithmetic
expression given on the command line. It uses only the Python standard
library, so there is nothing to install.

### Usage

```sh
python calculator.py "2 + 3 * 4"      # 14
python calculator.py "(2 + 3) * 4"    # 20
python calculator.py "7 / 2"          # 3.5
python calculator.py "1.5 * -2"       # -3.0
python calculator.py --help
```

Pass exactly one argument, and quote it so your shell does not split it.
On success the result is printed on its own line and the exit status is 0.

If the expression starts with `-`, put `--` before it so it is not read as an
option:

```sh
python calculator.py -- "-(1 + 2)"    # -3
```

### Supported syntax

- Integer and decimal literals (`42`, `3.14`, `.5`)
- Binary `+`, `-`, `*` and `/` with the usual precedence (`*` and `/` bind
  tighter than `+` and `-`, and operators group left to right)
- `/` is true division, so `6 / 3` prints `2.0`
- Unary `+` and `-`
- Parentheses and whitespace

Expressions are parsed with Python's `ast` module and only these constructs
are accepted. Names, function calls, attribute access, strings, booleans and
all other operators (such as `**`, `//` and `%`) are rejected, and `eval` is
never used.

The same logic is available from Python as `calculator.evaluate(expression)`.

### Errors

Invalid syntax, empty or unsupported expressions, division by zero, and
results that are not finite (for example `1e999`) print a short message to
standard error, print nothing to standard output, and exit with status 2:

```console
$ python calculator.py "1 / 0"
error: division by zero
```

Wrong argument counts also exit with status 2 and show the usage message.

### Tests

```sh
python -m unittest discover -s tests
```
