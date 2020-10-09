const MIN_READ = 2;

/**
 * A Token represents the type of syntax the scanner has encountered, these
 * will be determined by the settings provided to Scanner (for example by
 * default `whitespace` and `comment` tokens won't be returned).
 *
 * The EOF token is only returned once, when the reader has been fully
 * consumed.
 */
export enum Token {
  /**
   * The reader has been fully consumed. There is no more data to tokenize.
   */
  eof = -1,
  /**
   * A generic character which isn't one of the other tokens, may be an
   * operator
   */
  token,
  /**
   * Determined by `isWhitespace`, only returned if `scanWhitespace` is set
   */
  whitespace,
  /**
   * Determined by `isIdent`, only returned if `scanIdents` is set
   */
  identifier,
  /**
   * Determined by `isKeyword`, only returned if `scanIdents` is set
   */
  keyword,
  /**
   * Determined by `isDecimal`, `isBinary`, `isHex`, `isOctal`, only returned
   * if `scanInts` is set
   */
  int,
  /**
   * Determined by `isDecimal`, `isBinary`, `isHex`, `isOctal` & `isENotation`,
   * only returned if `scanFloats` is set.
   */
  float,
  /**
   * Determined by `isStringDelimiter`, only returned if `scanStrings` is set.
   */
  string,
  /**
   * Determined by `isComment`, `isBlockCommentOpen`, `isBlockCommentClose`,
   * only returned if `scanStrings` is set.
   */
  comment,
}

export const scanWhitespace = 1 << -Token.whitespace;
export const scanIdents = 1 << -Token.identifier;
export const scanInts = 1 << -Token.int;
export const scanFloats = 1 << -Token.float; // includes Ints and hexadecimal floats
export const scanStrings = 1 << -Token.string;
export const scanComments = 1 << -Token.comment;
export const defaultTokens = scanIdents | scanFloats | scanStrings;

async function defaultRead(
  reader: Deno.Reader,
  buffer: Uint8Array,
  decoder: TextDecoder,
): Promise<string | null> {
  const chunkLength = await reader.read(buffer);
  if (chunkLength === null || chunkLength === 0) {
    return null;
  }
  return decoder.decode(buffer.slice(0, chunkLength));
}

const isWhitespace = (ch: string) =>
  ch == " " || ch == "\t" || ch == "\n" || ch == "\r";
const isIdent = (ch: string, i: number) =>
  (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") ||
  (i > 0 && (ch === "_" || (ch >= "0" && ch <= "9")));
const isStringDelimiter = (ch: string) =>
  ch === '"' || ch === "'" || ch === "`";
const isDecimal = (ch: string) => ch >= "0" && ch <= "9";
const isSign = (ch: string) => ch === "+" || ch === "-";
const isHex = (ch: string, i: number) =>
  i === 0
    ? ch === "0"
    : i === 1
    ? (ch === "x" || ch === "X")
    : ((ch >= "0" && ch <= "9") || (ch >= "A" && ch <= "F") ||
      (ch >= "a" && ch <= "f"));
const isOctal = (ch: string, i: number) =>
  i === 0
    ? ch === "0"
    : i === 1
    ? (ch === "o" || ch === "O")
    : (ch >= "0" && ch <= "8");
const isBinary = (ch: string, i: number) =>
  i === 0
    ? ch === "0"
    : i === 1
    ? (ch === "b" || ch === "B")
    : (ch === "0" || ch === "1");
const isENotation = (ch: string) => (ch === "E" || ch === "e");
const isComment = (ch: string, i: number) =>
  i === 0 || i === 1 ? ch === "/" : ch !== "\n";
const isBlockCommentOpen = (ch: string, i: number) =>
  i === 0 ? ch === "/" : i === 1 ? ch === "*" : false;
const isBlockCommentClose = (ch: string, i: number) =>
  i === 0 ? ch === "*" : i === 1 ? ch === "/" : false;
const isKeyword = (token: string) => token === null;

interface ScannerInit {
  minRead?: number;
  /**
   * By default Scanner will read UTF-8 data from the Reader. You can override
   * the default text decoder to a different format by passing in a TextDecoder
   * instance.
   */
  decoder?: TextDecoder;
  chunkBuffer?: Uint8Array;
  read?: typeof defaultRead;
  /**
   * Determines what will be considered whitespace.
   */
  isWhitespace?: typeof isWhitespace;
  /**
   * Determines what will be considered an "identifier". By default this is
   * `A-Za-z0-9_`, but the leading character must be A-Za-z.
   *
   * For languages without idents, always return false.
   */
  isIdent?: typeof isIdent;
  /**
   * Idents will be passed into this function to determine if they are keywords
   * or not. By default this will always return false, but it might be useful
   * for languages which have reserved keywords as it will cause the Scanner to
   * return `Token.keyword` as opposed to `Token.ident`.
   */
  isKeyword?: typeof isKeyword;
  /**
   * Determines what gets consumed as strings. By default the characters `, ',
   * and " are string delimiters.
   */
  isStringDelimiter?: typeof isStringDelimiter;
  /**
   * Determines what is a decimal. Default is 0-9
   */
  isDecimal?: typeof isDecimal;
  /**
   * Determines what is a sign, default is - and +
   */
  isSign?: typeof isSign;
  /**
   * Determines what is hex, default is `0x` or `0X` followed by `0-9A-F`
   */
  isHex?: typeof isHex;
  /**
   * Determines what is octal, default is `0o` or `0O` followed by `0-8`
   */
  isOctal?: typeof isOctal;
  /**
   * Determines what is binary, default is `0b` or `0B` followed by 1s or 0s
   */
  isBinary?: typeof isBinary;
  /**
   * Determines what is E notation (e.g. 1e10), default is `E` or `e`
   */
  isENotation?: typeof isENotation;
  /**
   * Determines what a line level comment looks like, default is `//`
   */
  isComment?: typeof isComment;
  /**
   * Determines the block comment opener, default is `/*`. For languages that
   * don't support block comments return false.
   */
  isBlockCommentOpen?: typeof isBlockCommentOpen;
  /**
   * Determines the block comment opener, default is `*\/`.
   */
  isBlockCommentClose?: typeof isBlockCommentClose;
  mode?: number;
}

/**
 * Scanner consumes a reader, which is tokenized through repeated calls to
 * `const token = await scanner.scan()`.
 *
 * It also can be used like an Iterator: `for await(const token of scanner)`.
 *
 * The contents of the token can be read from the mutable `scanner.contents`
 * string, and positional data can be read via `scanner.startPos` &
 * `scanner.endPos`.
 *
 * By default, it will skip Whitespace and Comments, but this can be changed by
 * setting `mode`. All Token types can be customised with the `is*` prefixed
 * functions.
 *
 * It will throw a `SyntaxError` for unterminated comment or string literals.
 *
 * https://deno.land/std@0.64.0/io/readers.ts
 */
export class Scanner {
  private readonly decoder: TextDecoder;
  private readonly chunkBuffer: Uint8Array;
  private readonly read: typeof defaultRead;
  private readonly isIdent: typeof isIdent;
  private readonly isKeyword: typeof isKeyword;
  private readonly isWhitespace: typeof isWhitespace;
  private readonly isStringDelimiter: typeof isStringDelimiter;
  private readonly isComment: typeof isComment;
  private readonly isBlockCommentOpen: typeof isBlockCommentOpen;
  private readonly isBlockCommentClose: typeof isBlockCommentClose;
  private readonly isDecimal: typeof isDecimal;
  private readonly isSign: typeof isSign;
  private readonly isHex: typeof isHex;
  private readonly isOctal: typeof isOctal;
  private readonly isBinary: typeof isBinary;
  private readonly isENotation: typeof isENotation;
  private readonly mode: number;

  #buffer = "";
  #bufPos = 0;

  #line = 1;
  #column = 0;

  public contents = "";
  public currentToken: Token | null = null;

  public startPos: [number, number] = [0, 0];
  get endPos(): [number, number] {
    return [this.#line, this.#column];
  }

  constructor(private reader: Deno.Reader, init: ScannerInit = {}) {
    this.decoder = init.decoder || new TextDecoder("utf-8");
    this.chunkBuffer = init.chunkBuffer || new Uint8Array(init.minRead || 512);
    this.read = init.read || defaultRead;
    this.isWhitespace = init.isWhitespace || isWhitespace;
    this.isIdent = init.isIdent || isIdent;
    this.isStringDelimiter = init.isStringDelimiter || isStringDelimiter;
    this.isDecimal = init.isDecimal || isDecimal;
    this.isSign = init.isSign || isSign;
    this.isHex = init.isHex || isHex;
    this.isOctal = init.isOctal || isOctal;
    this.isBinary = init.isBinary || isBinary;
    this.isENotation = init.isENotation || isENotation;
    this.isComment = init.isComment || isComment;
    this.isBlockCommentOpen = init.isBlockCommentOpen || isBlockCommentOpen;
    this.isBlockCommentClose = init.isBlockCommentClose || isBlockCommentClose;
    this.isKeyword = init.isKeyword || isKeyword;
    this.mode = init.mode || defaultTokens;
  }

  private async peek(): Promise<string | null> {
    if (this.#bufPos >= this.#buffer.length) {
      this.#bufPos = 0;
      this.#buffer = "";
      while (this.#buffer.length < MIN_READ) {
        const chunk = await this.read(
          this.reader,
          this.chunkBuffer,
          this.decoder,
        );
        if (chunk === null) break;
        this.#buffer += chunk;
      }
    }
    return this.#buffer[this.#bufPos] || null;
  }

  private async next(): Promise<string | null> {
    const ch = await this.peek();
    this.#bufPos += 1;
    if (ch === "\n") {
      this.#line += 1;
      this.#column = 0;
    } else {
      this.#column += 1;
    }
    return ch;
  }

  /**
   * Reads the next Token from the buffer and returns it. The token types it
   * reports are configurable via `mode` and the respective `is*` functions.
   *
   * This will throw a `SyntaxError` if the next token is an unterminated
   * String literal or Block Comment.
   *
   * It will return `Token.eof` when the buffer is consumed.
   */
  async scan(): Promise<Token> {
    let ch = await this.next();
    let peek = await this.peek();
    this.startPos = [this.#line, this.#column];
    if (!ch) {
      this.contents = "";
      // EOF does not advance the column, so roll it back
      this.#column -= 1;
      this.startPos = [this.#line, this.#column];
      return this.currentToken = Token.eof
    }
    if (this.isWhitespace(ch)) {
      this.contents = ch;
      while (true) {
        ch = await this.peek();
        if (!ch || !this.isWhitespace(ch)) break;
        this.contents += await this.next();
      }
      if (!(this.mode & scanWhitespace)) return this.scan();
      return this.currentToken = Token.whitespace;
    } else if (this.isIdent(ch, 0)) {
      this.contents = ch;
      for (let i = 1; true; i += 1) {
        ch = await this.peek();
        if (!ch || !this.isIdent(ch, i)) break;
        this.contents += await this.next();
      }
      if (!(this.mode & scanIdents)) return this.scan();
      return this.currentToken = this.isKeyword(this.contents) ? Token.keyword : Token.identifier;
    } else if (this.isStringDelimiter(ch)) {
      const delim = this.contents = ch;
      while (true) {
        ch = await this.peek();
        if (!ch || ch === "\n") throw new Error("literal not terminated");
        this.contents += await this.next();
        if (ch === "\\") {
          const ch = await this.peek();
          if (ch === delim) {
            this.contents += await this.next();
          }
        }
        if (ch === delim) break;
      }
      if (!(this.mode & scanStrings)) return this.scan();
      return this.currentToken = Token.string;
    } else if (
      this.isDecimal(ch) || this.isSign(ch) ||
      (ch === "." && peek && this.isDecimal(peek))
    ) {
      if (!(this.mode & (scanInts | scanFloats))) return this.scan();
      this.contents = ch;
      let isFloat = ch === ".";
      let check: typeof isDecimal | typeof isHex | null = null;
      let i = 1;
      // Integer part
      if (!isFloat) {
        for (; ch; i += 1) {
          ch = await this.peek();
          if (!ch) break;
          if (ch === "." && (this.mode & scanFloats)) {
            isFloat = true;
            this.contents += await this.next();
            break;
          }
          if (!check) {
            if (this.isHex(ch, i)) {
              check = this.isHex;
            } else if (this.isOctal(ch, i)) {
              check = this.isOctal;
            } else if (this.isBinary(ch, i)) {
              check = this.isBinary;
            } else if (this.isDecimal(ch)) {
              check = this.isDecimal;
            }
          }
          if (!check || (check && !check(ch, i))) {
            break;
          }
          this.contents += await this.next();
        }
      }
      // fractional part
      if (isFloat) {
        for (; ch; i += 1) {
          ch = await this.peek();
          if (!ch || !this.isDecimal(ch)) break;
          this.contents += await this.next();
        }
      }
      // E notation
      ch = await this.peek();
      if (ch && this.isENotation(ch) && (this.mode & scanFloats)) {
        isFloat = true;
        this.contents += await this.next();
        ch = await this.peek();
        if (ch && this.isSign(ch)) {
          this.contents += await this.next();
        }
        while (true) {
          ch = await this.peek();
          if (!ch || !this.isDecimal(ch)) break;
          this.contents += await this.next();
        }
      }
      if (this.contents.length === 1 && this.isSign(this.contents)) {
        return this.currentToken = Token.token;
      }
      return this.currentToken = isFloat ? Token.float : Token.int;
    } else if (this.isComment(ch, 0) || this.isBlockCommentOpen(ch, 0)) {
      this.contents = ch;
      let blockComment = peek && this.isBlockCommentOpen(ch, 0) &&
        this.isBlockCommentOpen(peek, 1);
      for (let i = 1; true; i += 1) {
        ch = await this.peek();
        if (!blockComment && (!ch || !this.isComment(ch, i))) break;
        this.contents += await this.next();
        if (blockComment) {
          if (!ch) throw new Error("comment not terminated");
          peek = await this.peek();
          if (
            ch && peek && this.isBlockCommentClose(ch, 0) &&
            this.isBlockCommentClose(peek, 1)
          ) {
            this.contents += await this.next();
            break;
          }
        }
      }
      if (!(this.mode & scanComments)) return this.scan();
      return this.currentToken = Token.comment;
    }
    if (!ch) {
      this.contents = "";
      return this.currentToken = Token.eof;
    }
    this.contents = ch;
    return this.currentToken = Token.token;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Token> {
    while (true) {
      const tok = await this.scan();
      yield tok;
      if (tok === Token.eof) return;
    }
  }
}
