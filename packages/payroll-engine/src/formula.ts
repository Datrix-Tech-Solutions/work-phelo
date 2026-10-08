import { PayrollEngineError } from './types';

type Token = { t: 'n'; v: number } | { t: 'id'; v: string } | { t: 'op'; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ t: 'n', v: parseFloat(src.slice(i, j)) });
      i = j;
    } else if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j) });
      i = j;
    } else if ('+-*/(),'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
    } else {
      throw new PayrollEngineError(`Unexpected "${ch}"`);
    }
  }
  return out;
}

/** Names used in a formula, lower-cased, excluding function names. */
export function formulaRefs(src: string | undefined): string[] {
  try {
    const tokens = tokenize(src ?? '');
    const out: string[] = [];
    tokens.forEach((tok, i) => {
      const next = tokens[i + 1];
      if (tok.t === 'id' && !(next && next.t === 'op' && next.v === '(')) {
        out.push(tok.v.toLowerCase());
      }
    });
    return out;
  } catch {
    return [];
  }
}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
};

/** Evaluates a formula without eval: + - * /, brackets, min/max/round/floor/ceil. */
export function evaluateFormula(src: string | undefined, lookup: (name: string) => number): number {
  const tokens = tokenize(src ?? '');
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const isOp = (tok: Token | undefined, v: string) => tok?.t === 'op' && tok.v === v;

  const expectClose = () => {
    if (!isOp(next(), ')')) throw new PayrollEngineError('Missing closing bracket');
  };

  function expr(): number {
    let v = term();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = next().v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = unary();
    while (isOp(peek(), '*') || isOp(peek(), '/')) {
      const op = next().v;
      const r = unary();
      if (op === '/' && r === 0) throw new PayrollEngineError('Division by zero');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function unary(): number {
    if (isOp(peek(), '-')) {
      next();
      return -unary();
    }
    if (isOp(peek(), '+')) {
      next();
      return unary();
    }
    return primary();
  }
  function primary(): number {
    const tok = next();
    if (!tok) throw new PayrollEngineError('The formula ends too early');
    if (tok.t === 'n') return tok.v;
    if (tok.t === 'id') {
      if (isOp(peek(), '(')) {
        next();
        const args: number[] = [];
        if (!isOp(peek(), ')')) {
          do {
            args.push(expr());
          } while (isOp(peek(), ',') && next());
        }
        expectClose();
        const fn = FUNCTIONS[tok.v.toLowerCase()];
        if (!fn) throw new PayrollEngineError(`Unknown function "${tok.v}"`);
        return fn(...args);
      }
      return lookup(tok.v);
    }
    if (isOp(tok, '(')) {
      const v = expr();
      expectClose();
      return v;
    }
    throw new PayrollEngineError(`Unexpected "${tok.v}"`);
  }

  const value = expr();
  if (pos < tokens.length) throw new PayrollEngineError(`Unexpected "${tokens[pos].v}"`);
  if (!Number.isFinite(value)) throw new PayrollEngineError('The result is not a number');
  return value;
}
