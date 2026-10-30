# A demo project

Built by the factory.

## Greeting CLI

`greeter.py` prints a friendly greeting. It uses only the Python standard library.

```sh
python greeter.py                      # Hello, world!
python greeter.py --name Ada           # Hello, Ada!
python greeter.py --name "Ada Lovelace"  # Hello, Ada Lovelace!
python greeter.py --help               # show usage and options
```

- Quote names that contain spaces.
- Surrounding whitespace in a name is trimmed.
- An empty or whitespace-only name is rejected with a usage error and a nonzero exit status.

## Tests

```sh
python -m unittest discover -s tests
```
