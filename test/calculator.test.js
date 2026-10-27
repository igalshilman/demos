import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { evaluate, CalcError } from "../src/calculator.js";

const CLI = fileURLToPath(new URL("../src/calculator.js", import.meta.url));

function cli(...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

describe("evaluate", () => {
  test("each operator", () => {
    assert.equal(evaluate("2 + 3"), 5);
    assert.equal(evaluate("7 - 10"), -3);
    assert.equal(evaluate("6 * 7"), 42);
    assert.equal(evaluate("8 / 2"), 4);
  });

  test("precedence", () => {
    assert.equal(evaluate("2 + 3 * 4"), 14);
    assert.equal(evaluate("2 * 3 + 4"), 10);
    assert.equal(evaluate("10 - 6 / 3"), 8);
    assert.equal(evaluate("2 + 3 * 4 - 8 / 2"), 10);
  });

  test("left associativity", () => {
    assert.equal(evaluate("10 - 3 - 2"), 5);
    assert.equal(evaluate("100 / 10 / 5"), 2);
    assert.equal(evaluate("2 * 6 / 4"), 3);
    assert.equal(evaluate("8 / 4 * 2"), 4);
    assert.equal(evaluate("1 - 2 + 3"), 2);
  });

  test("decimals", () => {
    assert.equal(evaluate("1.5 + 2.25"), 3.75);
    assert.equal(evaluate("0.5 * 4"), 2);
    assert.equal(evaluate("3.5 - 0.5"), 3);
  });

  test("fractional division", () => {
    assert.equal(evaluate("7 / 2"), 3.5);
    assert.equal(evaluate("1 / 4"), 0.25);
    assert.equal(evaluate("1 / 3"), 1 / 3);
  });

  test("whitespace", () => {
    assert.equal(evaluate("2+3*4"), 14);
    assert.equal(evaluate("   2   +\t3 *  4  "), 14);
    assert.equal(evaluate("42"), 42);
    assert.equal(evaluate(" 7 "), 7);
  });

  const bad = {
    "empty": "",
    "whitespace only": "   ",
    "invalid character": "2 + a",
    "parentheses": "(1 + 2)",
    "exponent notation": "1e3 + 1",
    "missing right operand": "2 +",
    "missing left operand": "* 3",
    "unary minus": "-3 + 1",
    "consecutive operators": "2 + * 3",
    "trailing operator": "2 * 3 /",
    "trailing token": "2 3",
    "number then number after op": "2 + 3 4",
    "double dot": "1.2.3",
    "trailing dot": "5. + 1",
    "leading dot": ".5 + 1",
    "division by zero": "1 / 0",
    "division by zero decimal": "1 / 0.0",
    "division by computed zero": "5 / 0 * 2",
  };
  for (const [name, expr] of Object.entries(bad)) {
    test(`rejects ${name}`, () => {
      assert.throws(() => evaluate(expr), CalcError);
    });
  }

  test("error messages are descriptive", () => {
    assert.throws(() => evaluate("1 / 0"), /division by zero/);
    assert.throws(() => evaluate(""), /empty expression/);
    assert.throws(() => evaluate("2 & 3"), /invalid character '&' at position 3/);
    assert.throws(() => evaluate("2 +"), /expected a number but found end of expression/);
    assert.throws(() => evaluate("2 3"), /unexpected '3' at position 3/);
  });

  test("rejects overflowing results", () => {
    const big = "9".repeat(300);
    assert.throws(() => evaluate(`${big} * ${big}`), /out of range/);
  });
});

describe("CLI", () => {
  test("prints result to stdout and exits 0", () => {
    const r = cli("2 + 3 * 4");
    assert.equal(r.code, 0);
    assert.equal(r.out, "14\n");
    assert.equal(r.err, "");
  });

  test("prints fractional results", () => {
    const r = cli("7 / 2");
    assert.equal(r.code, 0);
    assert.equal(r.out, "3.5\n");
  });

  test("prints decimal results", () => {
    assert.equal(cli("1.5 * 2").out, "3\n");
    assert.equal(cli("0.25 + 0.5").out, "0.75\n");
  });

  test("malformed expression: stderr, nonzero exit, empty stdout", () => {
    const r = cli("2 +");
    assert.equal(r.code, 1);
    assert.equal(r.out, "");
    assert.match(r.err, /^error: .*expected a number/);
  });

  test("invalid character", () => {
    const r = cli("2 $ 3");
    assert.equal(r.code, 1);
    assert.equal(r.out, "");
    assert.match(r.err, /invalid character '\$'/);
  });

  test("empty string argument", () => {
    const r = cli("");
    assert.equal(r.code, 1);
    assert.equal(r.out, "");
    assert.match(r.err, /empty expression/);
  });

  test("division by zero", () => {
    const r = cli("5 / 0");
    assert.equal(r.code, 1);
    assert.equal(r.out, "");
    assert.match(r.err, /division by zero/);
  });

  test("no arguments prints usage", () => {
    const r = cli();
    assert.notEqual(r.code, 0);
    assert.equal(r.out, "");
    assert.match(r.err, /Usage:/);
  });

  test("extra arguments print usage", () => {
    const r = cli("2 + 3", "4");
    assert.notEqual(r.code, 0);
    assert.equal(r.out, "");
    assert.match(r.err, /Usage:/);
  });

  test("unquoted expression split into several args prints usage", () => {
    const r = cli("2", "+", "3");
    assert.notEqual(r.code, 0);
    assert.match(r.err, /Usage:/);
  });
});
