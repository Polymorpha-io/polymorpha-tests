import { describe, expect, it } from "vitest";
import {
  compileExpr,
  runExpr,
  ExprError,
} from "@/components/DataPreview/modeller/safeExpr";

function run(
  src: string,
  vars: Record<string, unknown> = {},
  withRe = true,
): unknown {
  return runExpr(compileExpr(src), vars, withRe);
}

function blocked(src: string): string | null {
  return compileExpr(src).blocked;
}

describe("safeExpr python semantics", () => {
  it("does floor division and python-style modulo", () => {
    expect(run("7 // 2")).toBe(3);
    expect(run("-7 // 2")).toBe(-4);
    expect(run("-3 % 2")).toBe(1);
    expect(run("2 ** 3")).toBe(8);
  });

  it("rounds half to even like python", () => {
    expect(run("round(2.5)")).toBe(2);
    expect(run("round(3.5)")).toBe(4);
  });

  it("honours explicit digits in round(x, n)", () => {
    expect(run("round(3.14159, 2)")).toBe(3.14);
    expect(run("round(10.5, 0)")).toBe(10);
    expect(run("round(11.5, 0)")).toBe(12);
    expect(() => run("round(1.5, 'x')")).toThrow(ExprError);
  });

  it("rejects float strings in int()", () => {
    expect(run('int("3")')).toBe(3);
    expect(() => run('int("3.9")')).toThrow(ExprError);
  });

  it("supports string methods, indexing and slicing", () => {
    expect(run("x.upper()", { x: "paris" })).toBe("PARIS");
    expect(run("x.strip()", { x: "  a " })).toBe("a");
    expect(run('x.replace("o", "0")', { x: "foo" })).toBe("f00");
    expect(run("x[-1]", { x: "abc" })).toBe("c");
    expect(run("x[1:]", { x: "abc" })).toBe("bc");
    expect(run('", ".join(x)', { x: ["a", "b"] })).toBe("a, b");
  });

  it("supports ternary, in and boolean ops", () => {
    expect(run('"big" if x > 10 else "small"', { x: 20 })).toBe("big");
    expect(run('"a" in x', { x: "cat" })).toBe(true);
    expect(run("x in [1, 2]", { x: 2 })).toBe(true);
    expect(run("x and y", { x: 0, y: 99 })).toBe(0);
  });

  it("exposes the math bridge", () => {
    expect(run("math.sqrt(16)")).toBe(4);
    expect(run("math.floor(2.9)")).toBe(2);
  });

  it("exposes the re bridge when enabled", () => {
    expect(run('re.sub("o", "0", x)', { x: "foo" })).toBe("f00");
    expect(run("re.search('b', x) is not None", { x: "abc" })).toBe(true);
  });

  it("withholds re when disabled", () => {
    expect(() => run("re.search('b', x)", { x: "abc" }, false)).toThrow(
      ExprError,
    );
  });
});

describe("safeExpr injection battery", () => {
  const attacks = [
    "fetch('https://evil.test')",
    "globalThis",
    "window",
    "document.cookie",
    "localStorage",
    "process.env",
    "Function('return 1')()",
    "x.constructor",
    "x.__proto__",
    "x.constructor.constructor('return 1')()",
    "().__class__",
    "__import__('os')",
    "os.system('id')",
    "open('/etc/passwd')",
    "eval('1+1')",
    "__x",
    "x; evil()",
    "import os",
    "lambda x: x",
    "[y for y in x]",
  ];
  it.each(attacks)("neutralizes %s", (src) => {
    let threw = false;
    try {
      const c = compileExpr(src);
      if (c.blocked) return;
      runExpr(c, { x: "v" }, true);
    } catch (e) {
      threw = e instanceof ExprError;
    }
    expect(threw).toBe(true);
  });

  it("leaves no trace on globalThis", () => {
    for (const src of ["x=1", "globalThis.pwned=1", "window.pwned=1"]) {
      try {
        runExpr(compileExpr(src), { x: 1 }, true);
      } catch {
        /* expected */
      }
    }
    expect((globalThis as Record<string, unknown>).pwned).toBeUndefined();
  });

  it("reports backend-blocked names", () => {
    expect(blocked("__import__('os')")).toBe("__import__");
    expect(blocked("os.system('x')")).toBe("os");
    expect(blocked("open('f')")).toBe("open");
  });

  it("reports dunder access but not dunder strings", () => {
    expect(blocked("__x + 1")).toBe("__");
    expect(blocked("x.__proto__")).toBe("__");
    expect(blocked('x + "__"')).toBeNull();
    expect(run('x + "__"', { x: "a" })).toBe("a__");
  });

  it("never treats string contents as code", () => {
    const c = compileExpr("\"__import__('os')\" == x");
    expect(c.blocked).toBeNull();
    expect([...c.refs]).toEqual(["x"]);
    expect(run("\"__import__('os')\"", {})).toBe("__import__('os')");
    // The old regex bridge rewrote method text inside literals.
    expect(run('".upper()"', {})).toBe(".upper()");
  });

  it("supports backtick-quoted headers with spaces", () => {
    const c = compileExpr("`my col` * 2");
    expect([...c.refs]).toEqual(["my col"]);
    expect(run("`my col` * 2", { "my col": 5 })).toBe(10);
  });

  it("throws on unknown names", () => {
    expect(() => run("nope + 1", { x: 1 })).toThrow(ExprError);
  });

  it("rejects unparseable input", () => {
    expect(() => compileExpr("")).toThrow(ExprError);
    expect(() => compileExpr("(((")).toThrow(ExprError);
  });

  it("allows mid-name __ (real headers) but blocks dunders", () => {
    expect(blocked("my__col * 2")).toBeNull();
    expect(run("my__col * 2", { my__col: 21 })).toBe(42);
    expect(blocked("x__ + 1")).toBe("__");
    expect(blocked("__x + 1")).toBe("__");
  });

  it("splits with exact offsets under maxsplit", () => {
    expect(run('re.split(",", "a,b,c", 1)')).toEqual(["a", "b,c"]);
    // Alternation: the tail stays verbatim, never rejoined with the
    // first delimiter.
    expect(run('re.split(",|;", "a,b;c", 1)')).toEqual(["a", "b;c"]);
    expect(run('re.split(",|;", "a,b;c")')).toEqual(["a", "b", "c"]);
    expect(() => run('re.split("x*", "ab", 1)')).toThrow(ExprError);
  });
});
