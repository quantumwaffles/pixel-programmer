// CodeMirror 6 language support for Turtle script
// Uses a simple stream parser plus HighlightStyle via tokenTable -> tags mapping.

import { StreamLanguage, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

// Tokenizer inspired by lexer.js but simplified for highlighting only.
function turtleStream() {
  const keywords = [
    'forward','back','left','right','pen','up','down','hsv','repeat','var'
  ];
  const cmdAbbrevs = ['f','fo','for','b','ba','bac','l','le','lef','r','ri','rig'];
  const keywordSet = Object.create(null);
  for (const k of keywords) keywordSet[k] = true;

  function isIdentStart(ch){ return /[A-Za-z_]/.test(ch); }
  function isIdent(ch){ return /[A-Za-z0-9_]/.test(ch); }

  return {
    token(stream) {
      if (stream.sol()) {
        // treat indentation (spaces) just as whitespace
        while (!stream.eol() && /[ \t]/.test(stream.peek())) stream.next();
      }
      if (stream.eatSpace()) return null;

      // Comments # or // to end of line
      if (stream.match('#')) { stream.skipToEnd(); return 'comment'; }
      if (stream.match('//')) { stream.skipToEnd(); return 'comment'; }

      const ch = stream.peek();

      // Numbers (allow underscores)
      if (/[0-9]/.test(ch)) {
        let num = '';
        while (!stream.eol() && /[0-9_.]/.test(stream.peek())) num += stream.next();
        // trailing . handled simply
        return 'number';
      }

      // Operators & punctuation
      if (/[+\-*\/:()=]/.test(ch)) { stream.next(); return 'operator'; }
      if (ch === ':') { stream.next(); return 'punctuation'; }
      if (ch === '_') { stream.next(); return 'atom'; }

      // Identifiers / keywords
      if (isIdentStart(ch)) {
        let id = '';
        while (!stream.eol() && isIdent(stream.peek())) id += stream.next();
        const lower = id.toLowerCase();
        if (keywordSet[lower]) return 'keyword';
        if (cmdAbbrevs.includes(lower)) return 'keyword';
        // pen up/down second word
        if (lower === 'up' || lower === 'down') return 'atom';
        return 'variableName';
      }

      // Fallback consume one char
      stream.next();
      return null;
    }
  };
}
// Map legacy token style names -> highlight tags so HighlightStyle can style them.
const tokenTable = {
  keyword: t.keyword,
  number: t.number,
  comment: t.lineComment,
  variableName: t.variableName,
  operator: t.operator,
  atom: t.atom,
  punctuation: t.punctuation
};

export const turtleLanguage = StreamLanguage.define({
  ...turtleStream(),
  tokenTable
});

// Define our highlight palette (can be themed later)
export const turtleHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#d6b6ff', fontWeight: '600' },
  { tag: t.number, color: '#ffd479' },
  { tag: t.operator, color: '#f2a2ff' },
  { tag: t.lineComment, color: '#586e75', fontStyle: 'italic' },
  { tag: t.variableName, color: '#9cdcf2' },
  { tag: t.atom, color: '#a3f7b5' },
  { tag: t.punctuation, color: '#cccccc' }
]);

export function turtleExtension() { return [turtleLanguage, syntaxHighlighting(turtleHighlightStyle)]; }

export default turtleExtension;
