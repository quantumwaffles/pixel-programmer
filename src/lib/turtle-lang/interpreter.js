// Turtle language interpreter
// Consumes tokens from parser (parse()) or a source string and produces drawing operations.
// Integrates optionally with pixel-canvas p5 instance API (penSet, penMove, penUp, penDown, penGet).

import { parse } from './lexer.js';

/** @typedef {{type:'MOVE',direction:'forward'|'back',value:number|{ref:string}}} MoveTok */
/** @typedef {{type:'TURN',direction:'left'|'right',value:number|{ref:string}}} TurnTok */
/** @typedef {{type:'PEN',state:'up'|'down'}} PenTok */
/** @typedef {{mode:'offset'|'absolute'|'ignore', value:number|null}} HSVParam */
/** @typedef {{type:'HSV',h:HSVParam,s:HSVParam,v:HSVParam}} HSVTok */
/** @typedef {{type:'VAR',name:string,value:any,reassign:boolean}} VarTok */
/** @typedef {{type:'REPEAT',mode:'count',count:any,until:null,body:Token[]}|{type:'REPEAT',mode:'until',count:null,until:any,body:Token[]}} RepeatTok */
/** @typedef {{type:'IF',test:any,body:Token[]}} IfTok */
/** @typedef {{type:'BREAK'}} BreakTok */
/** @typedef {{type:'CONTINUE'}} ContinueTok */
/** @typedef {MoveTok|TurnTok|PenTok|HSVTok|VarTok|RepeatTok|IfTok|BreakTok|ContinueTok} Token */

/** @typedef {{h:number,s:number,v:number}} HSV */

/** @typedef {{
 *  startX?:number,
 *  startY?:number,
 *  heading?:number, // degrees, 0 = +X (east), 90 = -Y (up)
 *  initialHSV?:HSV,
 *  initialPenDown?:boolean,
 *  width?:number, // optional grid bounds (cells)
 *  height?:number,
 *  canvas?:any, // pixel-canvas p5 instance with penSet/penMove/penDown/penUp
 *  onPixel?:(x:number,y:number,color:HSV)=>void,
 *  record?:boolean // whether to return operations list
 * }} InterpretOptions */

/** @typedef {{op:'plot',x:number,y:number,color:HSV}|{op:'move',x:number,y:number}|{op:'pen',down:boolean}|{op:'turn',heading:number}|{op:'hsv',color:HSV}} Operation */

/** @typedef {{
 *  finalX:number,
 *  finalY:number,
 *  finalHeading:number,
 *  penDown:boolean,
 *  color:HSV,
 *  operations:Operation[]
 * }} InterpretResult */

// Utility: clamp value between min and max
const clamp = (v, min, max) => v < min ? min : (v > max ? max : v);

// Wrap hue to 0..360
const wrapHue = h => ((h % 360) + 360) % 360;

function applyHSVParam(current, param, component, vars) {
    if (param.mode === 'ignore') return current;
    if (param.mode === 'offset') {
        let raw = param.value;
        let delta;
        if (typeof raw === 'number') delta = raw;
        else if (raw && raw.ref) {
            const base = vars[raw.ref];
            if (!Number.isFinite(base)) throw new Error(`Undefined variable '${raw.ref}' in hsv`);
            delta = (raw.sign === '-') ? -base : base;
        } else delta = 0;
        let val = current + delta;
        if (component === 'h') return wrapHue(val);
        return clamp(val, 0, 100);
    }
    // absolute
    let v = param.value;
    if (v && v.ref) {
        const resolved = vars[v.ref];
        if (!Number.isFinite(resolved)) throw new Error(`Undefined variable '${v.ref}' in hsv`);
        v = resolved;
    }
    if (component === 'h') return wrapHue(v);
    return clamp(v, 0, 100);
}

/** Rasterize a line from (x0,y0) to (x1,y1) visiting integer cell coordinates. Uses Bresenham. */
function rasterLine(x0, y0, x1, y1, visit) {
    x0 = Math.round(x0); y0 = Math.round(y0);
    x1 = Math.round(x1); y1 = Math.round(y1);
    let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
    let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
        visit(x0, y0);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
}

/** Interpret turtle program (string or tokens). */
export function interpret(sourceOrTokens, options = /** @type {InterpretOptions} */({})) {
    /** @type {Token[]} */
    const tokens = typeof sourceOrTokens === 'string' ? parse(sourceOrTokens) : sourceOrTokens;
    const {
        startX = 0,
        startY = 0,
        heading = 0,
        initialHSV = { h: 0, s: 0, v: 100 },
        initialPenDown = false,
        width,
        height,
        canvas,
        onPixel,
        record = true
    } = options;

    let x = startX;
    let y = startY;
    let dir = heading; // degrees
    let penDown = initialPenDown;
    let color = { ...initialHSV };
    /** @type {Operation[]} */
    const ops = [];
    /** @type {Record<string, number>} */
    const vars = Object.create(null);

    function evalValue(node) {
        if (node == null) return NaN;
        if (typeof node === 'number') return node;
        if (node.ref) return vars[node.ref];
        if (node.expr) return evalExpr(node.expr);
        if (node.kind) return evalExpr(node); // fallthrough for AST stored directly
        return NaN;
    }

    function evalExpr(ast) {
        switch (ast.kind) {
            case 'num': return ast.value;
            case 'var': return vars[ast.name];
            case 'unary': {
                const v = evalExpr(ast.value);
                return ast.op === '-' ? -v : +v;
            }
            case 'bin': {
                const a = evalExpr(ast.left); const b = evalExpr(ast.right);
                switch (ast.op) {
                    case '+': return a + b;
                    case '-': return a - b;
                    case '*': return a * b;
                    case '/': return b === 0 ? NaN : a / b;
                    case '%': return b === 0 ? NaN : a % b;
                    case '==': return a === b ? 1 : 0;
                    case '!=': return a !== b ? 1 : 0;
                    case '<': return a < b ? 1 : 0;
                    case '<=': return a <= b ? 1 : 0;
                    case '>': return a > b ? 1 : 0;
                    case '>=': return a >= b ? 1 : 0;
                }
            }
        }
        return NaN;
    }

    // Removed clampPos: allow unbounded movement when width/height omitted.

    // Sync canvas pen location/state if provided
    function syncCanvasPen() {
        if (!canvas) return;
        canvas.penSet && canvas.penSet(Math.round(x), Math.round(y));
        if (penDown) canvas.penDown && canvas.penDown(); else canvas.penUp && canvas.penUp();
        canvas.setHeading && canvas.setHeading(dir);
    }

    syncCanvasPen();

    function execList(list) {
        for (let idx = 0; idx < list.length; idx++) {
            const t = list[idx];
            switch (t.type) {
                case 'VAR': {
                    let val = evalValue(t.value);
                    if (!Number.isFinite(val)) throw new Error(`Undefined variable or invalid value in assignment to ${t.name}`);
                    if (t.reassign) {
                        if (!(t.name in vars)) throw new Error(`Cannot reassign undeclared variable '${t.name}'`);
                        vars[t.name] = val;
                    } else {
                        vars[t.name] = val; // declaration
                    }
                    break;
                }
                case 'REPEAT': {
                    if (t.mode === 'count') {
                        let countVal = evalValue(t.count);
                        if (!Number.isFinite(countVal)) throw new Error('Invalid repeat count');
                        const times = Math.floor(countVal);
                        for (let k = 0; k < times; k++) {
                            const br = execList(t.body);
                            if (br === 'break') break; // break out of repeat
                            if (br === 'continue') continue; // next iteration
                        }
                    } else { // until mode
                        while (true) {
                            let condVal = evalValue(t.until);
                            if (!Number.isFinite(condVal)) throw new Error('Invalid until expression');
                            if (condVal !== 0) break; // stop when expression becomes true/non-zero
                            const br = execList(t.body);
                            if (br === 'break') break; // stop loop
                            if (br === 'continue') continue; // re-evaluate condition
                        }
                    }
                    break;
                }
                case 'IF': {
                    let testVal = evalValue(t.test);
                    if (Number.isFinite(testVal) && testVal !== 0) {
                        const br = execList(t.body);
                        if (br === 'break') return 'break';
                        if (br === 'continue') return 'continue';
                    }
                    break;
                }
                case 'BREAK':
                    return 'break';
                case 'CONTINUE':
                    return 'continue';
                case 'PEN': {
                    penDown = t.state === 'down';
                    if (record) ops.push({ op: 'pen', down: penDown });
                    syncCanvasPen();
                    break;
                }
                case 'TURN': {
                    // Adjust: left should rotate counter-clockwise (decrease heading), right clockwise (increase)
                    let turnVal = evalValue(t.value);
                    if (!Number.isFinite(turnVal)) throw new Error('Invalid turn value');
                    const delta = t.direction === 'left' ? -turnVal : turnVal;
                    dir = wrapHue(dir + delta);
                    if (record) ops.push({ op: 'turn', heading: dir });
                    if (canvas && canvas.setHeading) canvas.setHeading(dir);
                    break;
                }
                case 'HSV': {
                    color = {
                        h: applyHSVParam(color.h, t.h, 'h', vars),
                        s: applyHSVParam(color.s, t.s, 's', vars),
                        v: applyHSVParam(color.v, t.v, 'v', vars)
                    };
                    if (record) ops.push({ op: 'hsv', color: { ...color } });
                    break;
                }
                case 'MOVE': {
                    let mv = evalValue(t.value);
                    if (!Number.isFinite(mv)) throw new Error('Invalid move value');
                    const dist = t.direction === 'forward' ? mv : -mv;
                    const rad = dir * Math.PI / 180;
                    const targetX = x + dist * Math.cos(rad);
                    const targetY = y + dist * Math.sin(rad);
                    if (penDown) {
                        let lastCell = `${Math.round(x)},${Math.round(y)}`;
                        rasterLine(x, y, targetX, targetY, (cx, cy) => {
                            if (typeof width === 'number' && (cx < 0 || cx >= width)) return;
                            if (typeof height === 'number' && (cy < 0 || cy >= height)) return;
                            const key = `${cx},${cy}`;
                            if (key !== lastCell) {
                                if (onPixel) onPixel(cx, cy, color);
                                if (canvas && canvas.drawPixel) canvas.drawPixel(cx, cy, color);
                                if (record) ops.push({ op: 'plot', x: cx, y: cy, color: { ...color } });
                                lastCell = key;
                            }
                        });
                    }
                    x = targetX; y = targetY; // no clamp => infinite plane
                    syncCanvasPen();
                    if (record) ops.push({ op: 'move', x: Math.round(x), y: Math.round(y) });
                    break;
                }
                default:
                    throw new Error(`Unknown token type: ${(t).type}`);
            }
        }
        return undefined;
    }

    execList(tokens);

    return {
        finalX: Math.round(x),
        finalY: Math.round(y),
        finalHeading: dir,
        penDown,
        color,
        operations: record ? ops : [],
        variables: { ...vars }
    };
}

/** Async interpreter variant that executes commands with an optional delay between each top-level instruction.
 *  Options: same as interpret plus delayMs (number, default 0). Delay applies after each executed token (including inside nested repeats).
 */
export async function interpretAsync(sourceOrTokens, options = /** @type {InterpretOptions & { delayMs?: number }} */({})) {
    /** @type {Token[]} */
    const tokens = typeof sourceOrTokens === 'string' ? parse(sourceOrTokens) : sourceOrTokens;
    const {
        startX = 0,
        startY = 0,
        heading = 0,
        initialHSV = { h: 0, s: 0, v: 100 },
        initialPenDown = false,
        width,
        height,
        canvas,
        onPixel,
        record = true,
        delayMs = 0
    } = options;

    let x = startX;
    let y = startY;
    let dir = heading;
    let penDown = initialPenDown;
    let color = { ...initialHSV };
    /** @type {Operation[]} */
    const ops = [];
    /** @type {Record<string, number>} */
    const vars = Object.create(null);

    function evalValue(node) {
        if (node == null) return NaN;
        if (typeof node === 'number') return node;
        if (node.ref) return vars[node.ref];
        if (node.expr) return evalExpr(node.expr);
        if (node.kind) return evalExpr(node); // fallthrough for AST stored directly
        return NaN;
    }

    function evalExpr(ast) {
        switch (ast.kind) {
            case 'num': return ast.value;
            case 'var': return vars[ast.name];
            case 'unary': {
                const v = evalExpr(ast.value);
                return ast.op === '-' ? -v : +v;
            }
            case 'bin': {
                const a = evalExpr(ast.left); const b = evalExpr(ast.right);
                switch (ast.op) {
                    case '+': return a + b;
                    case '-': return a - b;
                    case '*': return a * b;
                    case '/': return b === 0 ? NaN : a / b;
                    case '%': return b === 0 ? NaN : a % b;
                    case '==': return a === b ? 1 : 0;
                    case '!=': return a !== b ? 1 : 0;
                    case '<': return a < b ? 1 : 0;
                    case '<=': return a <= b ? 1 : 0;
                    case '>': return a > b ? 1 : 0;
                    case '>=': return a >= b ? 1 : 0;
                }
            }
        }
        return NaN;
    }

    function syncCanvasPen() {
        if (!canvas) return;
        canvas.penSet && canvas.penSet(Math.round(x), Math.round(y));
        if (penDown) canvas.penDown && canvas.penDown(); else canvas.penUp && canvas.penUp();
        canvas.setHeading && canvas.setHeading(dir);
    }

    syncCanvasPen();

    // Return value: possible control signal 'break' | 'continue'
    async function execToken(t) {
        switch (t.type) {
            case 'VAR': {
                let val = evalValue(t.value);
                if (!Number.isFinite(val)) throw new Error(`Undefined variable or invalid value in assignment to ${t.name}`);
                if (t.reassign) {
                    if (!(t.name in vars)) throw new Error(`Cannot reassign undeclared variable '${t.name}'`);
                    vars[t.name] = val;
                } else {
                    vars[t.name] = val;
                }
                break;
            }
            case 'REPEAT': {
                // Loops no longer introduce their own delays; delays only occur after MOVE/TURN tokens.
                if (t.mode === 'count') {
                    let countVal = evalValue(t.count);
                    if (!Number.isFinite(countVal)) throw new Error('Invalid repeat count');
                    const times = Math.floor(countVal);
                    outerCount: for (let k = 0; k < times; k++) {
                        for (const inner of t.body) {
                            const signal = await execToken(inner);
                            if (signal === 'break') break outerCount;
                            if (signal === 'continue') continue outerCount;
                        }
                    }
                } else { // until mode
                    outerUntil: while (true) {
                        let condVal = evalValue(t.until);
                        if (!Number.isFinite(condVal)) throw new Error('Invalid until expression');
                        if (condVal !== 0) break; // condition met => stop
                        for (const inner of t.body) {
                            const signal = await execToken(inner);
                            if (signal === 'break') break outerUntil;
                            if (signal === 'continue') continue outerUntil; // re-check condition
                        }
                    }
                }
                return; // container; no delay itself
            }
            case 'IF': {
                let testVal = evalValue(t.test);
                if (Number.isFinite(testVal) && testVal !== 0) {
                    for (const inner of t.body) {
                        const signal = await execToken(inner);
                        if (signal === 'break') return; // propagate to enclosing repeat
                        if (signal === 'continue') return; // propagate continue
                    }
                }
                return; // container; no delay itself
            }
            case 'BREAK':
                return 'break';
            case 'CONTINUE':
                return 'continue';
            case 'PEN': {
                penDown = t.state === 'down';
                if (record) ops.push({ op: 'pen', down: penDown });
                syncCanvasPen();
                break;
            }
            case 'TURN': {
                let turnVal = evalValue(t.value);
                if (!Number.isFinite(turnVal)) throw new Error('Invalid turn value');
                const delta = t.direction === 'left' ? -turnVal : turnVal;
                dir = wrapHue(dir + delta);
                if (record) ops.push({ op: 'turn', heading: dir });
                if (canvas && canvas.setHeading) canvas.setHeading(dir);
                break;
            }
            case 'HSV': {
                color = {
                    h: applyHSVParam(color.h, t.h, 'h', vars),
                    s: applyHSVParam(color.s, t.s, 's', vars),
                    v: applyHSVParam(color.v, t.v, 'v', vars)
                };
                if (record) ops.push({ op: 'hsv', color: { ...color } });
                break;
            }
            case 'MOVE': {
                let mv = evalValue(t.value);
                if (!Number.isFinite(mv)) throw new Error('Invalid move value');
                const dist = t.direction === 'forward' ? mv : -mv;
                const rad = dir * Math.PI / 180;
                const targetX = x + dist * Math.cos(rad);
                const targetY = y + dist * Math.sin(rad);
                if (penDown) {
                    let lastCell = `${Math.round(x)},${Math.round(y)}`;
                    rasterLine(x, y, targetX, targetY, (cx, cy) => {
                        if (typeof width === 'number' && (cx < 0 || cx >= width)) return;
                        if (typeof height === 'number' && (cy < 0 || cy >= height)) return;
                        const key = `${cx},${cy}`;
                        if (key !== lastCell) {
                            if (onPixel) onPixel(cx, cy, color);
                            if (canvas && canvas.drawPixel) canvas.drawPixel(cx, cy, color);
                            if (record) ops.push({ op: 'plot', x: cx, y: cy, color: { ...color } });
                            lastCell = key;
                        }
                    });
                }
                x = targetX; y = targetY;
                syncCanvasPen();
                if (record) ops.push({ op: 'move', x: Math.round(x), y: Math.round(y) });
                break;
            }
            default:
                throw new Error(`Unknown token type: ${(t).type}`);
        }
    }

    function shouldDelay(t) { return t.type === 'MOVE' || t.type === 'TURN'; }

    for (const t of tokens) {
        const signal = await execToken(t);
        if (signal === 'break' || signal === 'continue') {
            // break/continue only relevant inside loops; ignore at top-level
        }
        if (delayMs > 0 && shouldDelay(t)) await new Promise(r => setTimeout(r, delayMs));
    }

    return {
        finalX: Math.round(x),
        finalY: Math.round(y),
        finalHeading: dir,
        penDown,
        color,
        operations: record ? ops : [],
        variables: { ...vars }
    };
}

/** Create a stepper for requestAnimationFrame-driven execution.
 * Usage:
 *   const stepper = createStepper(source, opts);
 *   while(!stepper.done()) stepper.step(); (or drive via RAF with timing)
 */
export function createStepper(sourceOrTokens, options = /** @type {InterpretOptions} */({})) {
    /** @type {Token[]} */
    const rootTokens = typeof sourceOrTokens === 'string' ? parse(sourceOrTokens) : sourceOrTokens;
    const {
        startX = 0,
        startY = 0,
        heading = 0,
        initialHSV = { h: 0, s: 0, v: 100 },
        initialPenDown = false,
        width,
        height,
        canvas,
        onPixel,
        record = true
    } = options;

    let x = startX;
    let y = startY;
    let dir = heading;
    let penDown = initialPenDown;
    let color = { ...initialHSV };
    /** @type {Operation[]} */
    const ops = [];
    /** @type {Record<string, number>} */
    const vars = Object.create(null);

    // Execution cursors
    let mainIndex = 0;
    /** @type {{ body: Token[]; index: number; remaining: number; kind:'repeat'|'if'; mode?:'count'|'until'; until?:any; breakFlag?:boolean }}[] */
    const frames = [];
    let finished = false;

    function evalValue(node) {
        if (node == null) return NaN;
        if (typeof node === 'number') return node;
        if (node.ref) return vars[node.ref];
        if (node.expr) return evalExpr(node.expr);
        if (node.kind) return evalExpr(node);
        return NaN;
    }
    function evalExpr(ast) {
        switch (ast.kind) {
            case 'num': return ast.value;
            case 'var': return vars[ast.name];
            case 'unary': {
                const v = evalExpr(ast.value); return ast.op === '-' ? -v : +v;
            }
            case 'bin': {
                const a = evalExpr(ast.left); const b = evalExpr(ast.right);
                switch (ast.op) { case '+': return a + b; case '-': return a - b; case '*': return a * b; case '/': return b === 0 ? NaN : a / b; case '%': return b === 0 ? NaN : a % b; case '==': return a === b ? 1 : 0; case '!=': return a !== b ? 1 : 0; case '<': return a < b ? 1 : 0; case '<=': return a <= b ? 1 : 0; case '>': return a > b ? 1 : 0; case '>=': return a >= b ? 1 : 0; }
            }
        }
        return NaN;
    }
    function syncCanvasPen() {
        if (!canvas) return;
        canvas.penSet && canvas.penSet(Math.round(x), Math.round(y));
        if (penDown) canvas.penDown && canvas.penDown(); else canvas.penUp && canvas.penUp();
        canvas.setHeading && canvas.setHeading(dir);
    }
    syncCanvasPen();

    function nextToken() {
        // If inside a frame, pull from top frame
        while (true) {
            if (frames.length) {
                const fr = frames[frames.length - 1];
                if (fr.index >= fr.body.length) { // body finished
                    if (fr.kind === 'repeat' && fr.mode === 'until') {
                        // Only continue if condition still false and not broken
                        if (fr.breakFlag) { frames.pop(); continue; }
                        let condVal = evalValue(fr.until);
                        if (!Number.isFinite(condVal)) throw new Error('Invalid until expression');
                        if (condVal !== 0) { frames.pop(); continue; } // done
                        fr.index = 0; // another iteration
                        continue;
                    } else {
                        fr.remaining--;
                        if (fr.remaining > 0) { fr.index = 0; continue; }
                        frames.pop();
                        continue; // move up level
                    }
                }
                return fr.body[fr.index++];
            } else {
                if (mainIndex >= rootTokens.length) return null;
                return rootTokens[mainIndex++];
            }
        }
    }

    function execToken(tok) {
        switch (tok.type) {
            case 'VAR': {
                let val = evalValue(tok.value);
                if (!Number.isFinite(val)) throw new Error(`Undefined variable or invalid value in assignment to ${tok.name}`);
                if (tok.reassign) {
                    if (!(tok.name in vars)) throw new Error(`Cannot reassign undeclared variable '${tok.name}'`);
                    vars[tok.name] = val;
                } else vars[tok.name] = val;
                break;
            }
            case 'REPEAT': {
                if (tok.mode === 'count') {
                    let countVal = evalValue(tok.count);
                    if (!Number.isFinite(countVal)) throw new Error('Invalid repeat count');
                    const times = Math.floor(countVal);
                    if (times > 0) frames.push({ body: tok.body, index: 0, remaining: times, kind: 'repeat', mode: 'count' });
                } else { // until
                    // Evaluate condition first; only push frame if condition false
                    let condVal = evalValue(tok.until);
                    if (!Number.isFinite(condVal)) throw new Error('Invalid until expression');
                    if (condVal === 0) {
                        frames.push({ body: tok.body, index: 0, remaining: Infinity, kind: 'repeat', mode: 'until', until: tok.until });
                    }
                }
                break; // repeat itself counts as a step
            }
            case 'IF': {
                let testVal = evalValue(tok.test);
                if (Number.isFinite(testVal) && testVal !== 0) frames.push({ body: tok.body, index: 0, remaining: 1, kind: 'if' });
                break;
            }
            case 'BREAK': {
                // Find nearest repeat frame; discard inner frames first
                for (let i = frames.length - 1; i >= 0; i--) {
                    const fr = frames[i];
                    if (fr.kind === 'repeat') {
                        fr.index = fr.body.length; // finish current body immediately
                        if (fr.mode === 'count') {
                            fr.remaining = 1; // after decrement => 0 => exit loop
                        } else if (fr.mode === 'until') {
                            fr.breakFlag = true; // signal to exit without further condition checks
                        }
                        frames.length = i + 1; // truncate nested frames above
                        break;
                    }
                }
                break;
            }
            case 'CONTINUE': {
                // Fast-forward nearest repeat frame's current iteration
                for (let i = frames.length - 1; i >= 0; i--) {
                    const fr = frames[i];
                    if (fr.kind === 'repeat') {
                        fr.index = fr.body.length; // finish this iteration; nextToken will handle continuation
                        frames.length = i + 1; // drop nested frames inside
                        break;
                    }
                }
                break;
            }
            case 'PEN': {
                penDown = tok.state === 'down';
                if (record) ops.push({ op: 'pen', down: penDown });
                syncCanvasPen();
                break;
            }
            case 'TURN': {
                let turnVal = evalValue(tok.value);
                if (!Number.isFinite(turnVal)) throw new Error('Invalid turn value');
                const delta = tok.direction === 'left' ? -turnVal : turnVal;
                dir = wrapHue(dir + delta);
                if (record) ops.push({ op: 'turn', heading: dir });
                canvas && canvas.setHeading && canvas.setHeading(dir);
                break;
            }
            case 'HSV': {
                color = {
                    h: applyHSVParam(color.h, tok.h, 'h', vars),
                    s: applyHSVParam(color.s, tok.s, 's', vars),
                    v: applyHSVParam(color.v, tok.v, 'v', vars)
                };
                if (record) ops.push({ op: 'hsv', color: { ...color } });
                break;
            }
            case 'MOVE': {
                let mv = evalValue(tok.value);
                if (!Number.isFinite(mv)) throw new Error('Invalid move value');
                const dist = tok.direction === 'forward' ? mv : -mv;
                const rad = dir * Math.PI / 180;
                const targetX = x + dist * Math.cos(rad);
                const targetY = y + dist * Math.sin(rad);
                if (penDown) {
                    let lastCell = `${Math.round(x)},${Math.round(y)}`;
                    rasterLine(x, y, targetX, targetY, (cx, cy) => {
                        if (typeof width === 'number' && (cx < 0 || cx >= width)) return;
                        if (typeof height === 'number' && (cy < 0 || cy >= height)) return;
                        const key = `${cx},${cy}`;
                        if (key !== lastCell) {
                            if (onPixel) onPixel(cx, cy, color);
                            if (canvas && canvas.drawPixel) canvas.drawPixel(cx, cy, color);
                            if (record) ops.push({ op: 'plot', x: cx, y: cy, color: { ...color } });
                            lastCell = key;
                        }
                    });
                }
                x = targetX; y = targetY;
                syncCanvasPen();
                if (record) ops.push({ op: 'move', x: Math.round(x), y: Math.round(y) });
                break;
            }
            default:
                throw new Error(`Unknown token type: ${(tok).type}`);
        }
    }

    function step() {
        if (finished) return { done: true };
        let moved = false;
        while (!moved) {
            const tok = nextToken();
            if (!tok) { finished = true; return { done: true }; }
            execToken(tok);
            if (tok.type === 'MOVE' || tok.type === 'TURN') {
                moved = true; // yield control to allow frame delay only after movement
            } else {
                // continue consuming instantaneous tokens (VAR, IF container insertion, REPEAT setup, PEN, HSV, BREAK/CONTINUE)
                continue;
            }
            break;
        }
        return { done: false };
    }
    function done() { return finished; }
    function getState() { return { x: Math.round(x), y: Math.round(y), heading: dir, penDown, color: { ...color }, vars: { ...vars }, ops }; }
    function result() { if (!finished) return null; const st = getState(); return { finalX: st.x, finalY: st.y, finalHeading: st.heading, penDown: st.penDown, color: st.color, operations: record ? [...ops] : [], variables: st.vars }; }
    return { step, done, getState, result };
}

export default { interpret, interpretAsync, createStepper };
