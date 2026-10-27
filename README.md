# Calculator

A small Python command-line calculator (version 0.1.0). From the repository root, run:

```sh
python -m calc <a> <op> <b>
```

The operators are `+`, `-`, and `*`. Numbers can be integers, decimals, or
negative. Quote `*` so your shell does not expand it as a filename:

```sh
python -m calc 2 + 3           # 5
python -m calc -1.5 '*' 2      # -3
python -m calc 7 - 2           # 5
python -m calc --help
```

Results that are whole numbers are printed without `.0`. Invalid arguments
produce an error on stderr and exit with status 2.

To run the tests, install `pytest` and use:

```sh
python -m pytest
```
