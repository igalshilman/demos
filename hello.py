import random

import modal

app = modal.App("hello")

GREETINGS = ["Hello", "Hi there", "Hey", "Howdy", "Greetings"]


@app.function()
def hello() -> str:
    return random.choice(GREETINGS)


@app.local_entrypoint()
def main():
    print(hello.remote())
