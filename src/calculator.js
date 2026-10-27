#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

export class CalcError extends Error {}

const USAGE = 'Usage: calc "<expression>"   (e.g. calc "2 + 3 * 4")';

function tokenize(input) {
  const tokens = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+(\.[0-9]+)?/.exec(input.slice(i));
      const text = match[0];
      const next = input[i + text.length];
      if (next === "." || (next !== undefined && /[0-9]/.test(next))) {
        throw new CalcError(`invalid number at position ${i + 1}`);
      }
      tokens.push({ type: "num", value: Number(text), pos: i + 1 });
      i += text.length;
    } else if ("+-*/".includes(ch)) {
      tokens.push({ type: "op", value: ch, pos: i + 1 });
      i++;
    } else {
      throw new CalcError(`invalid character '${ch}' at position ${i + 1}`);
    }
  }
  return tokens;
}

function describe(token) {
  return token ? `'${token.value}' at position ${token.pos}` : "end of expression";
}

// Grammar:  expr := term (('+' | '-') term)*
//           term := number (('*' | '/') number)*
export function evaluate(input) {
  const tokens = tokenize(input);
  if (tokens.length === 0) throw new CalcError("empty expression");

  let pos = 0;
  const peek = () => tokens[pos];

  function number() {
    const token = peek();
    if (!token || token.type !== "num") {
      throw new CalcError(`expected a number but found ${describe(token)}`);
    }
    pos++;
    return token.value;
  }

  function term() {
    let left = number();
    while (peek() && (peek().value === "*" || peek().value === "/")) {
      const op = tokens[pos++];
      const right = number();
      if (op.value === "*") {
        left *= right;
      } else {
        if (right === 0) throw new CalcError("division by zero");
        left /= right;
      }
    }
    return left;
  }

  function expr() {
    let left = term();
    while (peek() && (peek().value === "+" || peek().value === "-")) {
      const op = tokens[pos++];
      const right = term();
      left = op.value === "+" ? left + right : left - right;
    }
    return left;
  }

  const result = expr();
  if (pos < tokens.length) {
    throw new CalcError(`unexpected ${describe(peek())}`);
  }
  if (!Number.isFinite(result)) throw new CalcError("result out of range");
  return result;
}

export function run(args, stdout = process.stdout, stderr = process.stderr) {
  if (args.length !== 1) {
    stderr.write(`${USAGE}\n`);
    return 2;
  }
  try {
    const result = evaluate(args[0]);
    stdout.write(`${Object.is(result, -0) ? 0 : result}\n`);
    return 0;
  } catch (err) {
    if (!(err instanceof CalcError)) throw err;
    stderr.write(`error: ${err.message}\n`);
    return 1;
  }
}

function isMain() {
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isMain()) {
  process.exitCode = run(process.argv.slice(2));
}
