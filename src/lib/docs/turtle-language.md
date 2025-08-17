---
title: Turtle Script Language Reference
description: Syntax and features for the Pixel Programmer Turtle scripting language.
---

# Turtle Script Reference

Turtle Script is a small, indentation‑based language (inspired by Python + classic LOGO) for drawing pixel art procedurally. This document covers every feature currently implemented.

> Quick start
```
pen down
hsv 200 80 90      # set starting color (H S V)
repeat 4:
    forward 20
    right 90
```

## Core Concepts

1. Each non‑blank line is one statement.
2. Blocks use **indentation** (spaces or tabs) after a header ending in a colon (`repeat ...:` / `if ...:`). A block ends when indentation decreases.
3. Commands are **case‑insensitive** and can be **abbreviated** to any unique leading substring (e.g. `f`, `fo`, `for` → `forward`).
4. Comments start with `#` or `//` and run to end of line.

## Commands Overview (Cheat Sheet)

| Command | Abbrevs | Args | Effect |
|---------|---------|------|--------|
| `forward N` | `f` … | distance expr | Move forward N pixels (draws if pen down) |
| `back N` | `b` … | distance expr | Move backward N pixels |
| `left N` | `l` … | angle expr | Turn left (counter‑clockwise) N degrees |
| `right N` | `r` … | angle expr | Turn right (clockwise) N degrees |
| `pen up` | — | up/down | Lift pen: movement stops drawing |
| `pen down` | — | up/down | Lower pen: movement draws |
| `hsv H S V` | — | 3 params | Adjust current color (hue 0‑360 wrap, saturation/value 0‑100 clamp) |
| `repeat N:` | — | count expr | Loop block N times |
| `repeat until EXPR:` | — | expression | Loop until expression becomes non‑zero (checked before each iteration) |
| `if EXPR:` | — | expression | Run block once if expression non‑zero |
| `break` | — | — | Exit nearest `repeat` loop |
| `continue` | — | — | Skip to next iteration of nearest `repeat` loop |
| `var name = VALUE` | — | expression | Declare variable |
| `name = VALUE` | — | expression | Reassign existing variable |

Abbreviations must remain **unambiguous**. If an abbreviation matches more than one command (e.g. `r` could only mean `right`, so OK) it is accepted; ambiguous shorter forms will raise an error.

## Expressions

You can use arithmetic or comparison expressions anywhere a numeric argument is expected (movement, angles, loop counts, HSV params via variables, etc.).

Supported:
* Literals: `10`, `3.5`, underscores inside numbers (`1_000`)
* Variables: `size`, `angle`
* Unary: `+x`, `-x`
* Binary arithmetic: `+  -  *  /  %`
* Comparisons: `==  !=  <  <=  >  >=` (result is `1` for true, `0` for false)
* Parentheses for grouping.

Examples:
```
forward (step * 2 + 5)
repeat (n+4)/2:
    right 360 / n
if a > b:
    left 45
repeat until counter == 0:
    forward 1
    counter = counter - 1
```

## Variables

Declare once with `var`:
```
var size = 12
var steps = size * 2
```
Reassign later (no `var`):
```
size = size + 4
```
Rules:
* Names: letters / digits / underscores, not starting with a digit.
* Use anywhere a number is expected.
* Using an undeclared variable in expressions or HSV adjustments raises an error.

## Loops

### Fixed Count
```
repeat 6:
    forward 10
    right 60
```
Count is floored (`repeat 3.9:` → 3). Non‑finite values error.

### Until Loop
```
var i = 0
repeat until i >= 10:
    forward 2
    i = i + 1
```
* Condition is evaluated **before** each iteration; loop stops when it becomes non‑zero.
* Inside you may use `break` (stop immediately) or `continue` (re‑check condition).

### Flow Control
```
repeat 100:
    if i % 10 == 0:
        hsv +30 _ _
    if i == 55:
        break      # exit loop
    i = i + 1
```

## Conditionals
`if EXPR:` executes its block when EXPR ≠ 0.
```
if steps > 20:
    pen up
    forward 5
    pen down
```

## Color: `hsv` Command

Syntax: `hsv H S V` where each parameter is one of:

| Form | Example | Meaning |
|------|---------|---------|
| Absolute number | `120` | Set directly (hue wraps 0‑360; s & v clamped 0‑100) |
| Absolute variable | `hueVar` | Resolve variable, then set |
| Offset `+n` / `-n` | `+15` | Add / subtract literal amount |
| Offset variable | `-shift` | Add/subtract variable value |
| Ignore `_` | `_` | Leave component unchanged |

Examples:
```
hsv 200 80 90      # set all components
hsv +40 _ -10      # hue += 40; value -= 10; keep saturation
hsv _ _ +5         # brighten value only
var hstep = 30
hsv +hstep _ _     # hue += hstep
hsv baseHue 60 80  # absolute hue from variable
```

## Pen Control
```
pen down   # begin drawing while moving
forward 10
pen up     # move without drawing
back 5
pen down
```

## Headings & Movement
* Heading 0° points to +X (east). Turning right increases heading; left decreases.
* Movement distance can be negative (though clearer to use `back`).
* The drawing plane is unbounded unless the host canvas enforces bounds.

## Error Cases
The interpreter stops with an error when it encounters:
* Unknown command / ambiguous abbreviation
* Missing arguments (e.g. `forward` with none)
* Invalid number / expression syntax
* Using an undeclared variable
* Reassigning a variable that was never declared
* Invalid `repeat` count or malformed loop header (missing colon)
* Empty expressions (`if :` or `repeat until :`)

## Style Tips
* Prefer descriptive variable names: `var side = 12`
* Keep indentation consistent (spaces or tabs, not a mixture inside a block).
* Use comments to label sections: `# draw outer ring`
* Combine color tweaks with loops: `hsv +20 _ -5`

## Full Example
```
var side = 15
pen down
hsv 30 90 90

# Square
repeat 4:
    forward side
    right 90

# Rotating spokes with hue shift
var i = 0
repeat until i == 12:
    hsv +30 _ _
    forward side / 2
    back side / 2
    right 30
    i = i + 1

# Fade and finish
hsv _ _ -30
forward 6
```

## Version
This reference matches the implementation as of the current project date (see repository history for changes).

---
Happy pixel programming!
