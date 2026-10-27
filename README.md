# A demo project

Built by the factory.

## Calculator CLI

```
node src/calculator.js "2 + 3 * 4"   # prints 14
npm test
```

Supports `+ - * /` on integers and decimals with the usual precedence. Errors go to stderr with exit code 1; wrong argument count prints usage with exit code 2.
