# A demo project

Built by the factory.

## CLI greeter

`greeter.py` prints a single greeting line. It needs Python 3 and has no dependencies.

```console
$ python greeter.py
Hello, World!
$ python greeter.py --name Ada --tone formal
Good day, Ada.
$ python greeter.py --name "Ada Lovelace" --tone casual
Hey, Ada Lovelace!
```

Options:

- `--name NAME`: who to greet (default: `World`). Surrounding whitespace is trimmed; an empty name is rejected.
- `--tone {casual,formal,friendly}`: `friendly` (default) prints `Hello, NAME!`, `formal` prints `Good day, NAME.`, `casual` prints `Hey, NAME!`.
- `--help`: show usage.

Invalid input (an unsupported tone, an empty name, an unknown option, or a missing option value) prints an error to stderr and exits with a non-zero status.

Run the tests with:

```console
$ python -m unittest discover -s tests -v
```
