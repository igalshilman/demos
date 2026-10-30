# A demo project

Built by the factory.

## Greeter CLI

A tiny command-line greeter. The only prerequisite is Python 3; there are no other dependencies. The commands below use `python3`; if your `python` already points to Python 3, it works too.

Run it from the repository root:

```
python3 greeter.py
# Hello, World!

python3 greeter.py --name Ada
# Hello, Ada!
```

Quote names that contain spaces:

```
python3 greeter.py --name "Ada Lovelace"
# Hello, Ada Lovelace!
```

### Tests

From the repository root:

```
python3 -m unittest discover -s tests -v
```
