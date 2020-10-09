import {
  assertEquals,
} from "https://deno.land/std@0.74.0/testing/asserts.ts";
import { StringReader } from "https://deno.land/std@0.74.0/io/readers.ts";
import {
  Scanner,
  Token,
  scanWhitespace,
  scanIdents,
  scanInts,
  scanFloats,
  scanStrings,
  scanComments,
  defaultTokens,
} from "./scanner.ts";

type ScanReturn = [Token, string, number, number, number, number];

async function assertTokens(
  reader: string | Deno.Reader,
  expected: ScanReturn[],
  options = {},
) {
  const actual: ScanReturn[] = [];
  const scanner = new Scanner(
    typeof reader === "string" ? new StringReader(reader) : reader,
    options,
  );
  for await (const token of scanner) {
    assertEquals(scanner.currentToken, token)
    actual.push(
      [token, scanner.contents, ...scanner.startPos, ...scanner.endPos],
    );
  }
  assertEquals(actual, expected);
}

Deno.test("token", async () => {
  await assertTokens(
    `{}[]!`,
    [
      [Token.token, "{", 1, 1, 1, 1],
      [Token.token, "}", 1, 2, 1, 2],
      [Token.token, "[", 1, 3, 1, 3],
      [Token.token, "]", 1, 4, 1, 4],
      [Token.token, "!", 1, 5, 1, 5],
      [Token.eof, "", 1, 5, 1, 5],
    ],
  );
});

Deno.test("whitespace", async () => {
  await assertTokens(
    `{} [] !`,
    [
      [Token.token, "{", 1, 1, 1, 1],
      [Token.token, "}", 1, 2, 1, 2],
      [Token.whitespace, " ", 1, 3, 1, 3],
      [Token.token, "[", 1, 4, 1, 4],
      [Token.token, "]", 1, 5, 1, 5],
      [Token.whitespace, " ", 1, 6, 1, 6],
      [Token.token, "!", 1, 7, 1, 7],
      [Token.eof, "", 1, 7, 1, 7],
    ],
    { mode: defaultTokens | scanWhitespace },
  );
});

Deno.test("identifiers", async () => {
  await assertTokens(
    `foo`,
    [
      [Token.identifier, "foo", 1, 1, 1, 3],
      [Token.eof, "", 1, 3, 1, 3],
    ],
  );
  await assertTokens(
    `foo bar`,
    [
      [Token.identifier, "foo", 1, 1, 1, 3],
      [Token.identifier, "bar", 1, 5, 1, 7],
      [Token.eof, "", 1, 7, 1, 7],
    ],
  );
  await assertTokens(
    `foo.bar`,
    [
      [Token.identifier, "foo", 1, 1, 1, 3],
      [Token.token, ".", 1, 4, 1, 4],
      [Token.identifier, "bar", 1, 5, 1, 7],
      [Token.eof, "", 1, 7, 1, 7],
    ],
  );
  await assertTokens(
    `foo bar`,
    [
      [Token.identifier, "foo", 1, 1, 1, 3],
      [Token.whitespace, " ", 1, 4, 1, 4],
      [Token.identifier, "bar", 1, 5, 1, 7],
      [Token.eof, "", 1, 7, 1, 7],
    ],
    { mode: defaultTokens | scanWhitespace },
  );
});

Deno.test("strings", async () => {
  await assertTokens(
    `"foo"`,
    [[Token.string, '"foo"', 1, 1, 1, 5], [Token.eof, "", 1, 5, 1, 5]],
  );
  await assertTokens(
    `"foo" "bar"`,
    [
      [Token.string, '"foo"', 1, 1, 1, 5],
      [Token.string, '"bar"', 1, 7, 1, 11],
      [Token.eof, "", 1, 11, 1, 11],
    ],
  );
  await assertTokens(
    "`foo` 'bar'",
    [
      [Token.string, "`foo`", 1, 1, 1, 5],
      [Token.string, "'bar'", 1, 7, 1, 11],
      [Token.eof, "", 1, 11, 1, 11],
    ],
  );
  await assertTokens(
    "'☃︎'`☃︎`\"☃︎\"",
    [
      [Token.string, "'☃︎'", 1, 1, 1, 4],
      [Token.string, "`☃︎`", 1, 5, 1, 8],
      [Token.string, '"☃︎"', 1, 9, 1, 12],
      [Token.eof, "", 1, 12, 1, 12],
    ],
  );
});

Deno.test("escaped strings", async () => {
  await assertTokens(
    '"hello \\"world\\""',
    [
      [Token.string, '"hello \\"world\\""', 1, 1, 1, 17],
      [Token.eof, "", 1, 17, 1, 17],
    ],
  );
  await assertTokens(
    "`hello \\`world\\``",
    [
      [Token.string, "`hello \\`world\\``", 1, 1, 1, 17],
      [Token.eof, "", 1, 17, 1, 17],
    ],
  );
  await assertTokens(
    "'hello \\'world\\''",
    [
      [Token.string, "'hello \\'world\\''", 1, 1, 1, 17],
      [Token.eof, "", 1, 17, 1, 17],
    ],
  );
});

Deno.test("numbers", async () => {
  await assertTokens(
    `123`,
    [[Token.int, "123", 1, 1, 1, 3], [Token.eof, "", 1, 3, 1, 3]],
  );
  await assertTokens(
    `+123`,
    [[Token.int, "+123", 1, 1, 1, 4], [Token.eof, "", 1, 4, 1, 4]],
  );
  await assertTokens(
    `-123`,
    [[Token.int, "-123", 1, 1, 1, 4], [Token.eof, "", 1, 4, 1, 4]],
  );
  await assertTokens(
    `1000000`,
    [[Token.int, "1000000", 1, 1, 1, 7], [Token.eof, "", 1, 7, 1, 7]],
  );
  await assertTokens(
    `0xfff`,
    [[Token.int, "0xfff", 1, 1, 1, 5], [Token.eof, "", 1, 5, 1, 5]],
  );
  await assertTokens(
    `0XdEaDbEeF`,
    [[Token.int, "0XdEaDbEeF", 1, 1, 1, 10], [Token.eof, "", 1, 10, 1, 10]],
  );
  await assertTokens(
    `2.0`,
    [[Token.float, "2.0", 1, 1, 1, 3], [Token.eof, "", 1, 3, 1, 3]],
  );
  await assertTokens(
    `0.41`,
    [[Token.float, "0.41", 1, 1, 1, 4], [Token.eof, "", 1, 4, 1, 4]],
  );
  await assertTokens(
    `0.132e5`,
    [[Token.float, "0.132e5", 1, 1, 1, 7], [Token.eof, "", 1, 7, 1, 7]],
  );
  await assertTokens(
    `6.02e23 1 14 0b11110000`,
    [
      [Token.float, "6.02e23", 1, 1, 1, 7],
      [Token.int, "1", 1, 9, 1, 9],
      [Token.int, "14", 1, 11, 1, 12],
      [Token.int, "0b11110000", 1, 14, 1, 23],
      [Token.eof, "", 1, 23, 1, 23],
    ],
  );
  await assertTokens(
    `9999999999999999999999999999999999999999`,
    [
      [Token.int, "9999999999999999999999999999999999999999", 1, 1, 1, 40],
      [Token.eof, "", 1, 40, 1, 40],
    ],
  );
  await assertTokens(
    `0123456789.`,
    [[Token.float, "0123456789.", 1, 1, 1, 11], [Token.eof, "", 1, 11, 1, 11]],
  );
  await assertTokens(
    `1E1`,
    [[Token.float, "1E1", 1, 1, 1, 3], [Token.eof, "", 1, 3, 1, 3]],
  );
  await assertTokens(
    `1E-1`,
    [[Token.float, "1E-1", 1, 1, 1, 4], [Token.eof, "", 1, 4, 1, 4]],
  );
  await assertTokens(
    `1E+1`,
    [[Token.float, "1E+1", 1, 1, 1, 4], [Token.eof, "", 1, 4, 1, 4]],
  );
  await assertTokens(
    `.1`,
    [[Token.float, ".1", 1, 1, 1, 2], [Token.eof, "", 1, 2, 1, 2]],
  );
});

Deno.test("bad numbers", async () => {
  await assertTokens(
    `1.1.1`,
    [
      [Token.float, "1.1", 1, 1, 1, 3],
      [Token.float, ".1", 1, 4, 1, 5],
      [Token.eof, "", 1, 5, 1, 5],
    ],
  );
  await assertTokens(
    `127.0.0.1`,
    [
      [Token.float, "127.0", 1, 1, 1, 5],
      [Token.float, ".0", 1, 6, 1, 7],
      [Token.float, ".1", 1, 8, 1, 9],
      [Token.eof, "", 1, 9, 1, 9],
    ],
  );
});

Deno.test("comments", async () => {
  await assertTokens(
    `// a comment token`,
    [
      [Token.comment, "// a comment token", 1, 1, 1, 18],
      [Token.eof, "", 1, 18, 1, 18],
    ],
    { mode: defaultTokens | scanComments },
  );
  await assertTokens(
    `/* a block comment token */`,
    [
      [Token.comment, "/* a block comment token */", 1, 1, 1, 27],
      [Token.eof, "", 1, 27, 1, 27],
    ],
    { mode: defaultTokens | scanComments },
  );
  await assertTokens(
    `// a comment token\n`,
    [
      [Token.comment, "// a comment token", 1, 1, 1, 18],
      [Token.whitespace, "\n", 2, 0, 2, 0],
      [Token.eof, "", 2, 0, 2, 0],
    ],
    { mode: defaultTokens | scanComments | scanWhitespace },
  );
  await assertTokens(
    `// a comment token\n`,
    [
      [Token.comment, "// a comment token", 1, 1, 1, 18],
      [Token.eof, "", 2, 0, 2, 0],
    ],
    { mode: defaultTokens | scanComments },
  );
  await assertTokens(
    `/* a block \ncomment token */`,
    [
      [Token.comment, "/* a block \ncomment token */", 1, 1, 2, 16],
      [Token.eof, "", 2, 16, 2, 16],
    ],
    { mode: defaultTokens | scanComments },
  );
});

Deno.test("multiple token types", async () => {
  await assertTokens(
    `this is 5 tokens!`,
    [
      [Token.identifier, "this", 1, 1, 1, 4],
      [Token.identifier, "is", 1, 6, 1, 7],
      [Token.int, "5", 1, 9, 1, 9],
      [Token.identifier, "tokens", 1, 11, 1, 16],
      [Token.token, "!", 1, 17, 1, 17],
      [Token.eof, "", 1, 17, 1, 17],
    ],
  );
  await assertTokens(
    `(x . (y . (z . NIL)))`,
    [
      [Token.token, "(", 1, 1, 1, 1],
      [Token.identifier, "x", 1, 2, 1, 2],
      [Token.token, ".", 1, 4, 1, 4],
      [Token.token, "(", 1, 6, 1, 6],
      [Token.identifier, "y", 1, 7, 1, 7],
      [Token.token, ".", 1, 9, 1, 9],
      [Token.token, "(", 1, 11, 1, 11],
      [Token.identifier, "z", 1, 12, 1, 12],
      [Token.token, ".", 1, 14, 1, 14],
      [Token.identifier, "NIL", 1, 16, 1, 18],
      [Token.token, ")", 1, 19, 1, 19],
      [Token.token, ")", 1, 20, 1, 20],
      [Token.token, ")", 1, 21, 1, 21],
      [Token.eof, "", 1, 21, 1, 21],
    ],
  );
});

Deno.test("default mode does not scanComments", async () => {
  await assertTokens(
    `// a comment token`,
    [
      [Token.eof, "", 1, 18, 1, 18],
    ],
    { mode: defaultTokens },
  );
});

Deno.test("turning off scanIdents skips idents", async () => {
  await assertTokens(
    `here are some idents`,
    [
      [Token.eof, "", 1, 20, 1, 20],
    ],
    { mode: defaultTokens ^ scanIdents },
  );
  await assertTokens(
    `here are some idents`,
    [
      [Token.whitespace, " ", 1, 5, 1, 5],
      [Token.whitespace, " ", 1, 9, 1, 9],
      [Token.whitespace, " ", 1, 14, 1, 14],
      [Token.eof, "", 1, 20, 1, 20],
    ],
    { mode: scanWhitespace },
  );
});

Deno.test("repeated EOF calls", async () => {
  const scanner = new Scanner(new StringReader(""));
  for (let i = 0; i < 5; i += 1) {
    let token = await scanner.scan();
    assertEquals(token, Token.eof);
    assertEquals(scanner.startPos, [1, 0]);
    assertEquals(scanner.endPos, [1, 0]);
  }
});
