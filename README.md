# A demo project

Built by the factory.

## Greeting CLI

`greeting_cli.py` is a tiny command-line tool that prints a random greeting.

### Usage

The flag is spelled exactly `--great` (not `--greet`):

```console
$ python greeting_cli.py --great
Hello!
```

Each run prints one line, chosen at random from: `Hello!`, `Hi there!`, `Greetings!`.

Running with no arguments, or with `--help`, prints the help text and exits 0:

```console
$ python greeting_cli.py
$ python greeting_cli.py --help
```

Unknown options (including the misspelling `--greet`) print an argument error to stderr and exit with a nonzero status.

### Requirements

Python 3 and its standard library only. There are no third-party dependencies to install.

### Running the tests

```console
python -m unittest discover -s tests
```
