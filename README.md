## Scanner

Take a Deno.Reader and perform [Lexical
Analysis/Tokenization](https://en.wikipedia.org/wiki/Lexical_analysis#Tokenization)
on it, returning a stream of tokens.

This library is heavily inspired by Golang's [text/scanner](https://golang.org/src/text/scanner/scanner.go)

### Usage

```typescript
import {Scanner, Token, nextTokenIs, TokenError} from 'https://deno.land/x/scanner/mod.ts'

const file = Deno.open('./my-file.language')
const scanner = new Scanner(file)
try {
  for await (const token of scanner) {
    if (token === Token.int) console.log('Found integer', scanner.contents)
    if (token === Token.ident) console.log('Found identifier', scanner.contents)
    // ... and so on
  }
} finally {
  file.close()
}
```
