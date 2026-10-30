# A demo project

Built by the factory.

## Greeter CLI

A tiny command-line greeter. The only prerequisite is Python 3; there are no other dependencies.

Run it from the repository root:

```
python greeter.py
# Hello, World!

python greeter.py --name Ada
# Hello, Ada!
```

Quote names that contain spaces:

```
python greeter.py --name "Ada Lovelace"
# Hello, Ada Lovelace!
```

### Tests

From the repository root:

```
python -m unittest discover -s tests -v
```
