# A demo project

Built by the factory.

## Greeting CLI

`greet.py` prints a friendly one-line greeting.

Requires Python 3.8 or newer. It uses only the standard library.

```
python greet.py --name <name>
```

If `--name` is missing, or only whitespace, it greets the world. Surrounding
whitespace in a name is trimmed. The command exits with status 0.

### Examples

```
$ python greet.py --name Ada
Hello, Ada!

$ python greet.py
Hello, World!

$ python greet.py --name "   "
Hello, World!
```
