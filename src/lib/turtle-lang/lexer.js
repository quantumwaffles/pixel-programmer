/**
 * Turtle language lexer
 * Supported commands (case-insensitive):
 *   forward n        - move forward n pixels (may be abbreviated to any leading substring e.g. f, fo, for ...)
 *   back n           - move backward n pixels (b, ba, bac, back)
 *   left n           - rotate left n units (l, le, lef, left)
 *   right n          - rotate right n units (r, ri, rig, righ, right)
 *   pen up|down      - raise or lower the pen
 *   hsv h s v        - set HSV color; each param: offset (+n|-n), absolute (n), or '_' ignore
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

/** @typedef {{mode:'offset'|'absolute'|'ignore', value:number|null}} HSVParam */

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
	if (/^[+-]/.test(raw)) {
		// Offset form +n / -n (n can be float)
		const num = Number(raw);
		if (!Number.isFinite(num)) throw new Error(`Invalid HSV offset: ${raw}`);
		return { mode: 'offset', value: num };
	}
	// Absolute value
	const num = Number(raw);
	if (!Number.isFinite(num)) throw new Error(`Invalid HSV absolute value: ${raw}`);
	return { mode: 'absolute', value: num };
}

/** Normalize identifier to canonical lower-case */
function ident(s) { return s.toLowerCase(); }

/** Split source into trimmed, comment-stripped logical lines */
function preprocessLines(source) {
	return source
		.replace(/\r\n?/g, '\n')
		.split('\n')
		.map(l => {
			// Remove comments starting with # or //
			const hash = l.indexOf('#');
			const slashes = l.indexOf('//');
			let cut = l.length;
			if (hash !== -1) cut = Math.min(cut, hash);
			if (slashes !== -1) cut = Math.min(cut, slashes);
			return l.slice(0, cut).trim();
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

/** Main parse function (formerly lex) */
export function parse(source) {
	if (typeof source !== 'string') throw new TypeError('parse() requires a string');
	const lines = preprocessLines(source);
	/** @type {any[]} */
	const tokens = [];

	lines.forEach((line, lineIndex) => {
		if (!line) return; // skip empty
		const parts = line.split(/\s+/);
		let head = ident(parts[0]);
		head = resolveAbbrev(head);

		const emit = (tok) => tokens.push(tok);

		switch (head) {
			case 'forward':
			case 'back': {
				if (parts.length !== 2) throw syntaxError(`${head} requires 1 numeric argument`, lineIndex, line.length);
				const value = Number(parts[1]);
				if (!Number.isFinite(value)) throw syntaxError(`Invalid number: ${parts[1]}`, lineIndex, line.indexOf(parts[1]));
				emit({ type: 'MOVE', direction: head, value });
				break;
			}
			case 'left':
			case 'right': {
				if (parts.length !== 2) throw syntaxError(`${head} requires 1 numeric argument`, lineIndex, line.length);
				const value = Number(parts[1]);
				if (!Number.isFinite(value)) throw syntaxError(`Invalid number: ${parts[1]}`, lineIndex, line.indexOf(parts[1]));
				emit({ type: 'TURN', direction: head, value });
				break;
			}
			case 'pen': {
				if (parts.length !== 2) throw syntaxError('pen requires one argument: up|down', lineIndex, line.length);
				const state = ident(parts[1]);
				if (state !== 'up' && state !== 'down') throw syntaxError(`Invalid pen state: ${parts[1]}`, lineIndex, line.indexOf(parts[1]));
				emit({ type: 'PEN', state });
				break;
			}
			case 'hsv': {
				if (parts.length !== 4) throw syntaxError('hsv requires 3 params: h s v', lineIndex, line.length);
				try {
					const h = parseHSVParam(parts[1]);
					const s = parseHSVParam(parts[2]);
					const v = parseHSVParam(parts[3]);
					emit({ type: 'HSV', h, s, v });
				} catch (e) {
					throw syntaxError(e.message, lineIndex, line.indexOf('hsv'));
				}
				break;
			}
			default:
				throw syntaxError(`Unknown command: ${parts[0]}`, lineIndex, 0);
		}
	});

	return tokens;
}

// Backwards compatibility shim
export function lex(source) { return parse(source); }

// Convenience default export
export default { parse, lex };

// If run directly (simple debug), you can uncomment below:
// console.log(parse(`
//   forward 10\nback 5\nleft 90\nright 45\npen down\nhsv +10 _ 50\nhsv 120 -5 +3\n`));

