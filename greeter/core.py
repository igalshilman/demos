def greet(name: str) -> str:
    if not isinstance(name, str) or not name.strip():
        raise ValueError("name must not be empty")
    return f"Hello, {name}! It's great to meet you!"
