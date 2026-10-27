"""A small, safe arithmetic calculator."""

from .evaluator import CalcError, evaluate

__all__ = ["CalcError", "evaluate", "__version__"]
__version__ = "0.1.0"
