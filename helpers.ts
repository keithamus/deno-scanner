import { Scanner, Token } from "./scanner.ts";

export function longPosition(scanner: Scanner) {
  return `line ${scanner.startPos[0]}, column ${scanner.startPos[1]}`;
}

export function shortPosition(scanner: Scanner) {
  return `${scanner.startPos[0]}:${scanner.startPos[1]}`;
}

export class TokenError extends SyntaxError {
  constructor(
    scanner: Scanner,
    actualToken: Token,
    expectedToken?: Token,
    expectedContents?: string | void,
  ) {
    super();
    const message = `unexpected ${Token[actualToken]}`;
    let contents = "";
    if (scanner.contents) {
      contents = ` (${scanner.contents})`;
    }
    let expected = "";
    if (expectedToken) {
      expected = `; expected ${Token[expectedToken]}`;
      if (typeof expectedContents === "string") {
        expected += ` ${expectedContents}`;
      }
    }
    this.message = `${message}${contents} on ${
      longPosition(scanner)
    }${expected}`;
  }
}

export async function nextTokenIs(
  scanner: Scanner,
  expectedToken: Token,
  expectedContents?: string | void,
): Promise<string> {
  const actualToken = await scanner.scan();
  const wantsContents = typeof expectedContents === "string";
  const sameContents = !wantsContents || expectedContents === scanner.contents;
  const sameTokens = actualToken === expectedToken;
  if (!sameTokens || !sameContents) {
    throw new TokenError(scanner, actualToken, expectedToken, expectedContents);
  }
  return scanner.contents;
}
