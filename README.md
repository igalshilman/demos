# A demo project

Built by the factory.

## Greeting CLI

`greet.py` prints a single greeting. It uses only the Python 3 standard
library, so there is nothing to install.

### Usage

```
python greet.py [--name NAME] [--tone {casual,formal,friendly}]
```

| Option   | Default    | Description                                    |
| -------- | ---------- | ---------------------------------------------- |
| `--name` | `World`    | Name to greet. Surrounding whitespace is removed; empty or whitespace-only names are rejected. |
| `--tone` | `friendly` | One of `friendly`, `formal` or `casual`.       |
| `--help` |            | Show help and exit.                            |

### Tones

| Tone       | Output                |
| ---------- | --------------------- |
| `friendly` | `Hello, {name}!`      |
| `formal`   | `Good day, {name}.`   |
| `casual`   | `Hey, {name}!`        |

### Examples

```
$ python greet.py
Hello, World!

$ python greet.py --name Ada
Hello, Ada!

$ python greet.py --name Ada --tone formal
Good day, Ada.

$ python greet.py --tone casual --name "José"
Hey, José!
```

Invalid input (an empty name, an unknown tone, a missing option value or an
unknown option) prints a usage error to stderr and exits with status 2.
Successful greetings and `--help` exit with status 0.

### Tests

```
python -m unittest discover -s tests
```
