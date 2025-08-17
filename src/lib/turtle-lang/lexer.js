/**
 * Turtle language lexer
 * Supported commands (case-insensitive):
 *   forward n        - move forward n pixels (may be abbreviated to any leading substring e.g. f, fo, for ...)
 *   back n           - move backward n pixels (b, ba, bac, back)
 *   left n           - rotate left n units (l, le, lef, left)
 *   right n          - rotate right n units (r, ri, rig, righ, right)
 *   pen up|down      - raise or lower the pen
 *   hsv h s v        - set HSV color; each param: offset (+n|-n), absolute (n), or '_' ignore
 *   repeat N:        - start an indented block repeated N times (ends when indentation decreases)
 *   repeat until EXPR: - loop while expression is false (check before each iteration)
 *   if EXPR:         - conditionally execute an indented block when expression is non-zero
 *   break            - exit the nearest enclosing repeat loop
 *   continue         - skip to next iteration of nearest enclosing repeat loop
 *                     (Old { } block style removed in favor of Python-like indentation)
 *   var name = value - declare/assign numeric variable (value can be number / variable / arithmetic expression)
 *   name = value      - re-assign existing variable
 *   Simple arithmetic expressions allowed anywhere a single numeric argument is expected:
 *      +  -  *  /  parentheses and unary +/- (e.g. forward size*2, repeat (n+4)/2 { ... })
 *   Variables (identifiers) can be used where a single numeric argument is expected: forward x, left angle, repeat count, etc.
 *
 * Returns an array of instruction tokens rather than low-level lexical tokens to keep things practical.
 * Each token has a type field plus other fields:
 *   MOVE:  { type:'MOVE', direction:'forward'|'back', value:Number }
 *   TURN:  { type:'TURN', direction:'left'|'right', value:Number }
 *   PEN:   { type:'PEN', state:'up'|'down' }
 *   HSV:   { type:'HSV', h:HSVParam, s:HSVParam, v:HSVParam }
 * HSVParam: { mode:'offset'|'absolute'|'ignore', value:Number|null }
 *
 * Throws an Error on invalid syntax with line / column information.
 */

/** @typedef {{mode:'offset'|'absolute'|'ignore', value:number|null|{ref:string}}} HSVParam */

/** Create an error with line/column context */
function syntaxError(message, line, col) {
	const err = new Error(`${message} (line ${line + 1}, col ${col + 1})`);
	err.line = line + 1;
	err.col = col + 1;
	return err;
}

/** Parse a single HSV parameter token string */
function parseHSVParam(raw) {
	if (raw === '_' || raw === null || raw === undefined) {
		return { mode: 'ignore', value: null };
	}
	// Offset form +n / -n or +var / -var
	if (/^[+-]/.test(raw)) {
		const sign = raw[0];
		const body = raw.slice(1);
		if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(body)) {
			return { mode: 'offset', value: { ref: ident(body), sign } };
		}
		const num = Number(raw);
		if (!Number.isFinite(num)) throw new Error(`Invalid HSV offset: ${raw}`);
		return { mode: 'offset', value: num };
	}
	// Identifier absolute
	if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) {
		return { mode: 'absolute', value: { ref: ident(raw) } };
	}
	// Absolute numeric value
	const num = Number(raw);
	if (!Number.isFinite(num)) throw new Error(`Invalid HSV absolute value: ${raw}`);
	return { mode: 'absolute', value: num };
}

/** Normalize identifier to canonical lower-case */
function ident(s) { return s.toLowerCase(); }

/** Split source into trimmed, comment-stripped logical lines */
function preprocessLines(source) {
	const rawLines = source.replace(/\r\n?/g,'\n').split('\n');
	return rawLines.map(line => {
		let i=0; let indent=0;
		while (i < line.length) {
			const ch = line[i];
			if (ch === ' ') { indent++; i++; continue; }
			if (ch === '\t') { indent += 4; i++; continue; }
			break;
		}
		let content = line.slice(i);
		// Strip comments (# or //) but ignore if inside expression (no string literals so fine)
		const hash = content.indexOf('#');
		const slashes = content.indexOf('//');
		let cut = content.length;
		if (hash !== -1) cut = Math.min(cut, hash);
		if (slashes !== -1) cut = Math.min(cut, slashes);
		content = content.slice(0, cut).trimEnd();
		return { indent, content: content.trimStart() };
	});
}

function resolveAbbrev(word) {
	const cmds = ['forward','back','left','right'];
	if (!word) return word;
	const matches = cmds.filter(c => c.startsWith(word));
	if (matches.length === 1) return matches[0];
	// If exact match among multiples, prefer it
	if (matches.includes(word)) return word;
	if (matches.length === 0) return word; // unchanged; handled later as unknown
	throw new Error(`Ambiguous command abbreviation '${word}'`);
}

// Parse a token that should be either a number or identifier reference
function parseNumberOrRef(raw, line, col) {
	const num = Number(raw);
	if (raw !== '' && Number.isFinite(num)) return num;
	if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(raw)) return { ref: ident(raw) };
	throw syntaxError(`Expected number or identifier, got '${raw}'`, line, col);
}

// Expression tokenizer and parser (simple recursive descent)
function tokenizeExpr(str) {
	const tokens = []; let i=0;
	while (i < str.length) {
		const ch = str[i];
		if (/\s/.test(ch)) { i++; continue; }
		// Multi / single char operators (comparison + arithmetic incl. modulus)
		if (/[()+\-*\/%<>!=]/.test(ch)) {
			// attempt to read two-char comparison operators
			const two = str.slice(i,i+2);
			if (['==','!=','<=','>='].includes(two)) { tokens.push({ type:'op', value: two }); i+=2; continue; }
			if (/[<>]/.test(ch)) { tokens.push({ type:'op', value: ch }); i++; continue; }
			if (/[()+\-*\/%]/.test(ch)) { tokens.push({ type:'op', value: ch }); i++; continue; }
			// lone ! or = not allowed in expressions
			if (ch === '!' || ch === '=') throw new Error(`Unexpected '${ch}' in expression`);
		}
		if (/[0-9.]/.test(ch)) {
			let start=i; while (i<str.length && /[0-9._]/.test(str[i])) i++; // allow underscores ignored
			const raw = str.slice(start,i).replace(/_/g,'');
			if (raw === '' || raw === '.') throw new Error('Invalid number literal');
			tokens.push({ type:'num', value: raw });
			continue;
		}
		if (/[a-zA-Z_]/.test(ch)) {
			let start=i; while (i<str.length && /[a-zA-Z0-9_]/.test(str[i])) i++;
			tokens.push({ type:'id', value: ident(str.slice(start,i)) });
			continue;
		}
		throw new Error(`Unexpected character '${ch}' in expression`);
	}
	return tokens;
}

function parseExpressionString(str, line, col) {
	str = str.trim();
	if (!str) throw syntaxError('Empty expression', line, col);
	// Fast path: single token number or identifier
	if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(str)) return { ref: ident(str) };
	const numFast = Number(str); if (Number.isFinite(numFast)) return numFast;
	let tokens;
	try { tokens = tokenizeExpr(str); } catch (e) { throw syntaxError(e.message, line, col); }
	let pos=0;
	function peek(){ return tokens[pos]; }
	function consume(){ return tokens[pos++]; }
	function parsePrimary(){
		const t = peek(); if(!t) throw syntaxError('Unexpected end of expression', line, col);
		if (t.type==='op' && (t.value==='+'||t.value==='-')) { // unary
			consume(); return { kind:'unary', op:t.value, value: parsePrimary() };
		}
		if (t.type==='num'){ consume(); return { kind:'num', value: Number(t.value) }; }
		if (t.type==='id'){ consume(); return { kind:'var', name:t.value }; }
		if (t.type==='op' && t.value==='('){
			consume();
			// Allow full comparison-level expression inside parentheses so (a > b) works
			const expr = parseComparison();
			const t2 = consume();
			if(!t2||t2.type!=='op'||t2.value!==')') throw syntaxError('Expected )', line, col);
			return expr;
		}
		throw syntaxError(`Unexpected token in expression`, line, col);
	}
	function parseMulDiv(){
		let node = parsePrimary();
		while (true){ const t=peek(); if(t && t.type==='op' && (t.value==='*'||t.value==='/'||t.value==='%')){ consume(); node={ kind:'bin', op:t.value, left:node, right:parsePrimary() }; } else break; }
		return node;
	}
	function parseAddSub(){
		let node = parseMulDiv();
		while (true){ const t=peek(); if(t && t.type==='op' && (t.value==='+'||t.value==='-')){ consume(); node={ kind:'bin', op:t.value, left:node, right:parseMulDiv() }; } else break; }
		return node;
	}
	function parseComparison(){
		let node = parseAddSub();
		while (true){ const t=peek(); if(t && t.type==='op' && ['==','!=','<','>','<=','>='].includes(t.value)){ consume(); node={ kind:'bin', op:t.value, left:node, right:parseAddSub() }; } else break; }
		return node;
	}
		const ast = parseComparison();
		if (pos !== tokens.length) {
			const remaining = tokens.slice(pos).map(t=>t.value||t.type).join(' ');
			throw syntaxError(`Unexpected extra tokens in expression: '${str}' -> leftover: ${remaining}`, line, col);
		}
	return { expr: ast };
}

function parseValueExpression(str, line, col) {
	try { return parseExpressionString(str, line, col); } catch (e) { if (e.line) throw e; throw syntaxError(e.message, line, col); }
}

/** Main parse function (formerly lex) */
export function parse(source) {
	if (typeof source !== 'string') throw new TypeError('parse() requires a string');
	const lines = preprocessLines(source);
	let i = 0;

	function parseBlock(parentIndent) {
		/** @type {any[]} */
		const out = [];
		while (i < lines.length) {
			const { indent, content } = lines[i];
			if (!content) { i++; continue; }
			if (indent <= parentIndent) break; // block ended
			const parts = content.split(/\s+/);
			let headRaw = ident(parts[0]);
			headRaw = resolveAbbrev(headRaw);

			if (headRaw === 'var') {
				if (parts.length < 4 || parts[2] !== '=') throw syntaxError('Invalid var declaration. Use: var name = value', i, 0);
				const name = ident(parts[1]);
				if (!/^[a-z_][a-z0-9_]*$/i.test(name)) throw syntaxError(`Invalid variable name: ${parts[1]}`, i, 0);
				const valueToken = parseValueExpression(content.slice(content.indexOf(parts[3])), i, 0);
				out.push({ type: 'VAR', name, value: valueToken, reassign: false });
				i++; continue;
			}

			if (/^[a-z_][a-z0-9_]*$/i.test(parts[0]) && parts.length >= 3 && parts[1] === '=') {
				const name = ident(parts[0]);
				const rhsIndex = content.indexOf('=') + 1;
				const valueToken = parseValueExpression(content.slice(rhsIndex), i, rhsIndex);
				out.push({ type: 'VAR', name, value: valueToken, reassign: true });
				i++; continue;
			}

			if (headRaw === 'repeat') {
				const colonPos = content.lastIndexOf(':');
				if (colonPos === -1) throw syntaxError("Expected ':' after repeat", i, 0);
				const bodyHeader = content.slice(0, colonPos); // without trailing ':'
				// Match 'repeat until <expr>' (case-insensitive)
				const untilMatch = /^repeat\s+until\s+(.+)$/i.exec(bodyHeader);
				if (untilMatch) {
					const exprStr = untilMatch[1].trim();
					if (!exprStr) throw syntaxError('repeat until requires an expression', i, 0);
					const untilExpr = parseValueExpression(exprStr, i, 0);
					i++;
					const body = parseBlock(indent);
					out.push({ type:'REPEAT', mode:'until', until: untilExpr, count: null, body });
					continue;
				}
				// Else count form: extract expression after 'repeat'
				const countMatch = /^repeat\s+(.+)$/i.exec(bodyHeader);
				if (!countMatch) throw syntaxError('Malformed repeat statement', i, 0);
				const exprStr = countMatch[1].trim();
				if (!exprStr) throw syntaxError('repeat requires a count', i, 0);
				const countExpr = parseValueExpression(exprStr, i, 0);
				i++;
				const body = parseBlock(indent);
				out.push({ type:'REPEAT', mode:'count', count: countExpr, until:null, body });
				continue;
			}

			if (headRaw === 'if') {
				const colonPos = content.lastIndexOf(':');
				if (colonPos === -1) throw syntaxError("Expected ':' after if expression", i, 0);
				const exprStr = content.slice(content.indexOf(parts[1]), colonPos).trim();
				if (!exprStr) throw syntaxError('if requires an expression', i, 0);
				const testExpr = parseValueExpression(exprStr, i, 0);
				i++;
				const body = parseBlock(indent);
				out.push({ type: 'IF', test: testExpr, body });
				continue;
			}

			if (headRaw === 'break') {
				if (parts.length !== 1) throw syntaxError('break takes no arguments', i, 0);
				out.push({ type: 'BREAK' });
				i++; continue;
			}

			if (headRaw === 'continue') {
				if (parts.length !== 1) throw syntaxError('continue takes no arguments', i, 0);
				out.push({ type: 'CONTINUE' });
				i++; continue;
			}

			switch (headRaw) {
				case 'forward':
				case 'back': {
						if (parts.length < 2) throw syntaxError(`${headRaw} requires 1 argument`, i, 0);
						// Avoid using indexOf(parts[1]) because argument's first character may appear in command (e.g. forward w)
						let argStart = content.indexOf(parts[0]) + parts[0].length;
						while (argStart < content.length && /\s/.test(content[argStart])) argStart++;
						const value = parseValueExpression(content.slice(argStart), i, argStart);
					out.push({ type: 'MOVE', direction: headRaw, value });
					i++; break;
				}
				case 'left':
				case 'right': {
						if (parts.length < 2) throw syntaxError(`${headRaw} requires 1 argument`, i, 0);
						let argStart = content.indexOf(parts[0]) + parts[0].length;
						while (argStart < content.length && /\s/.test(content[argStart])) argStart++;
						const value = parseValueExpression(content.slice(argStart), i, argStart);
					out.push({ type: 'TURN', direction: headRaw, value });
					i++; break;
				}
				case 'pen': {
					if (parts.length !== 2) throw syntaxError('pen requires one argument: up|down', i, 0);
					const state = ident(parts[1]);
					if (state !== 'up' && state !== 'down') throw syntaxError('Invalid pen state', i, 0);
					out.push({ type: 'PEN', state });
					i++; break;
				}
				case 'hsv': {
					if (parts.length !== 4) throw syntaxError('hsv requires 3 params: h s v', i, 0);
					try {
						const h = parseHSVParam(parts[1]);
						const s = parseHSVParam(parts[2]);
						const v = parseHSVParam(parts[3]);
						out.push({ type: 'HSV', h, s, v });
					} catch (e) {
						throw syntaxError(e.message, i, 0);
					}
					i++; break;
				}
				default:
					throw syntaxError(`Unknown command: ${parts[0]}`, i, 0);
			}
		}
		return out;
	}

	return parseBlock(-1);
}

// Backwards compatibility shim
export function lex(source) { return parse(source); }

// Convenience default export
export default { parse, lex };

// If run directly (simple debug), you can uncomment below:
// console.log(parse(`
//   forward 10\nback 5\nleft 90\nright 45\npen down\nhsv +10 _ 50\nhsv 120 -5 +3\n`));

