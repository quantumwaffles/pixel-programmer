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
/** @typedef {{type:'REPEAT',count:any,body:Token[]}} RepeatTok */
/** @typedef {MoveTok|TurnTok|PenTok|HSVTok|VarTok|RepeatTok} Token */

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
const clamp = (v,min,max)=> v < min ? min : (v > max ? max : v);

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
    return clamp(val,0,100);
  }
  // absolute
  let v = param.value;
  if (v && v.ref) {
    const resolved = vars[v.ref];
    if (!Number.isFinite(resolved)) throw new Error(`Undefined variable '${v.ref}' in hsv`);
    v = resolved;
  }
  if (component === 'h') return wrapHue(v);
  return clamp(v,0,100);
}

/** Rasterize a line from (x0,y0) to (x1,y1) visiting integer cell coordinates. Uses Bresenham. */
function rasterLine(x0,y0,x1,y1, visit) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  while (true) {
    visit(x0,y0);
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
    initialHSV = { h:0, s:0, v:100 },
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
        }
      }
    }
    return NaN;
  }

  // Helper to clamp position to bounds if given
  function clampPos() {
    if (typeof width === 'number') x = clamp(x,0,width-1);
    if (typeof height === 'number') y = clamp(y,0,height-1);
  }

  // Sync canvas pen location/state if provided
  function syncCanvasPen() {
    if (!canvas) return;
    canvas.penSet && canvas.penSet(Math.round(x), Math.round(y));
    if (penDown) canvas.penDown && canvas.penDown(); else canvas.penUp && canvas.penUp();
  canvas.setHeading && canvas.setHeading(dir);
  }

  syncCanvasPen();

  function execList(list) {
    for (const t of list) {
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
          let countVal = evalValue(t.count);
          if (!Number.isFinite(countVal)) throw new Error('Invalid repeat count');
          const times = Math.floor(countVal);
          for (let k=0;k<times;k++) execList(t.body);
          break;
        }
      case 'PEN': {
        penDown = t.state === 'down';
        if (record) ops.push({ op:'pen', down:penDown });
        syncCanvasPen();
        break;
      }
      case 'TURN': {
  // Adjust: left should rotate counter-clockwise (decrease heading), right clockwise (increase)
  let turnVal = evalValue(t.value);
  if (!Number.isFinite(turnVal)) throw new Error('Invalid turn value');
  const delta = t.direction === 'left' ? -turnVal : turnVal;
  dir = wrapHue(dir + delta);
        if (record) ops.push({ op:'turn', heading:dir });
      if (canvas && canvas.setHeading) canvas.setHeading(dir);
        break;
      }
      case 'HSV': {
        color = {
          h: applyHSVParam(color.h, t.h, 'h', vars),
          s: applyHSVParam(color.s, t.s, 's', vars),
            v: applyHSVParam(color.v, t.v, 'v', vars)
        };
        if (record) ops.push({ op:'hsv', color:{...color} });
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
          rasterLine(x,y,targetX,targetY,(cx,cy)=>{
            if (typeof width === 'number' && (cx<0 || cx>=width)) return;
            if (typeof height === 'number' && (cy<0 || cy>=height)) return;
            const key = `${cx},${cy}`;
            if (key !== lastCell) {
              if (onPixel) onPixel(cx,cy,color);
              if (canvas && canvas.drawPixel) canvas.drawPixel(cx,cy,color);
              if (record) ops.push({ op:'plot', x:cx, y:cy, color:{...color} });
              lastCell = key;
            }
          });
        }
        x = targetX; y = targetY; clampPos();
        syncCanvasPen();
        if (record) ops.push({ op:'move', x:Math.round(x), y:Math.round(y) });
        break;
      }
      default:
        throw new Error(`Unknown token type: ${(t).type}`);
      }
    }
  }

  execList(tokens);

  return {
    finalX: Math.round(x),
    finalY: Math.round(y),
    finalHeading: dir,
    penDown,
    color,
    operations: record ? ops : []
  };
}

export default { interpret };
