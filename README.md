# A demo project

Built by the factory.

## Greeting CLI

`cli.py` is a small, dependency-free command-line program (Python standard library only).

### Usage

```
python cli.py --greet                  # Hello, World!
python cli.py --greet --name Ada       # Hello, Ada!
python cli.py --name "Ada Lovelace" --greet   # Hello, Ada Lovelace!
python cli.py --help                   # show help
```

Options:

- `--name NAME`: the name to greet. Defaults to `World`.
- `--greet`: print the greeting.

If `--greet` is not given, the program prints its help text to stdout and exits
with status 0, even when `--name` is supplied.

Unknown arguments, or `--name` without a value, print an error to stderr and
exit with status 2.

### Tests

```
python -m unittest discover -s tests
```
