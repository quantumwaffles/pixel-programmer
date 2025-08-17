<script>
    import P5Canvas from "$lib/P5Canvas.svelte";
    import sketch from "$lib/sketches/pixel-canvas.js";
    import { parse } from "$lib/turtle-lang/lexer.js";
    import { interpret } from "$lib/turtle-lang/interpreter.js";
    import CodeMirrorEditor from 'svelte-codemirror-editor';
    import { EditorView, keymap, ViewPlugin, Decoration } from '@codemirror/view';
    import { Prec } from '@codemirror/state';
    import { indentWithTab } from '@codemirror/commands';

    const STORAGE_KEY = 'pixel-programmer:turtleScript';

    // Editor code content (may be overridden by localStorage on client)
    let code = $state(`// Turtle demo script exercising all features including repeat
// Abbreviations (f,r,l,b) hsv absolute/offset/ignore and nested repeat blocks

pen down
hsv 30 90 90

// Draw a square using repeat (size 15)
repeat 4 {
    f 15
    r 90
}

// Star-like pattern (rotate & change hue)
repeat 6 {
    hsv +60 _ _    // shift hue
    f 10
    l 60
}

// Move without drawing
pen up
f 5
pen down

// Nested repeats: a tiny grid stamp 3x repeated 3 times with hue shift
repeat 3 {
    hsv +40 -10 +0
    repeat 3 {
        f 4
        r 90
        f 4
        r 90
        f 4
        r 90
        f 4
        r 90 // tiny square
        r 120 // reorient
    }
}

// Final color tweak: lower value only
hsv _ _ -30
f 6
// End of demo`);

    // Lexer output
    let tokens = $state([]);
    let lexError = $state(null);
    let lexLine = $state(null);
    let lexCol = $state(null);

    // Re-lex when code changes
    $effect(() => {
        try {
            tokens = parse(code);
            lexError = null; lexLine = null; lexCol = null;
        } catch (e) {
            lexError = e.message || String(e);
            lexLine = e.line || null; lexCol = e.col || null;
            tokens = [];
        }
    });

    // Error highlight extension
    function errorLineExtension(line) {
        if (!line) return [];
        const plugin = ViewPlugin.fromClass(class {
            constructor(view){ this.decorations = this.make(view); }
            make(view){
                try {
                    const ln = Math.min(line, view.state.doc.lines);
                    const info = view.state.doc.line(ln);
                    return Decoration.set([
                        Decoration.line({ class: 'cm-error-line'}).range(info.from)
                    ]);
                } catch (_) { return Decoration.none; }
            }
            update(u){ if (u.docChanged) this.decorations = this.make(u.view); }
        }, { decorations: v => v.decorations });
        return [plugin];
    }

    const baseTheme = EditorView.theme({
        '&': { background: 'transparent' },
        '.cm-content': { padding: '8px' },
        '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace', lineHeight: '1.2' },
        '.cm-error-line': { background: 'rgba(190,30,30,0.15)' }
    }, { dark: true });

    let editorExtensions = $state([]);
    $effect(() => {
        editorExtensions = [
            Prec.highest(keymap.of([
                indentWithTab,
                { key: 'Mod-Enter', run: () => { handleRun(); return true; } },
                { key: 'Ctrl-Enter', run: () => { handleRun(); return true; } }
            ])),
            baseTheme,
            ...errorLineExtension(lexLine)
        ];
    });

    // (Tabs removed) Console display always shown below editor.

    // p5 instance reference
    let canvasInst = $state(null);
    let runError = $state(null);
    let lastRunStats = $state(null);
    let lastVars = $state({});
    let autoRun = $state(false);
    let _runTimer = null;
    let _saveTimer = null;
    let lastLoaded = false;

    // Load from localStorage (once, client only)
    $effect(() => {
        if (lastLoaded) return;
        if (typeof window === 'undefined') return; // SSR
        try {
            const saved = window.localStorage.getItem(STORAGE_KEY);
            if (saved && typeof saved === 'string') {
                code = saved;
            }
        } catch (_) { /* ignore */ }
        lastLoaded = true;
    });

    function handleRun() {
        runError = null; lastRunStats = null;
        if (!canvasInst) { runError = 'Canvas not ready'; return; }
        try {
            // Clear previous pixels
            canvasInst.clearPixels && canvasInst.clearPixels();
            // Interpret script
            const res = interpret(code, {
                canvas: canvasInst,
                startX: Math.floor(canvasInst.width / (2 * canvasInst.getPixelSize())),
                startY: Math.floor(canvasInst.height / (2 * canvasInst.getPixelSize())),
                initialPenDown: true,
                width: Math.floor(canvasInst.width / canvasInst.getPixelSize()),
                height: Math.floor(canvasInst.height / canvasInst.getPixelSize())
            });
            lastRunStats = {
                operations: res.operations.length,
                finalX: res.finalX,
                finalY: res.finalY,
                heading: res.finalHeading,
                color: res.color
            };
            lastVars = res.variables || {};
        } catch (e) {
            runError = e.message || String(e);
        }
    }

    // Auto-run effect (debounced) – must reference `code` so changes retrigger.
    $effect(() => {
        const _codeSnapshot = code; // dependency tracking
        if (!autoRun) return; // disabled
        if (lexError) return; // don't run with syntax errors
        if (!canvasInst) return; // wait for canvas
        if (_runTimer) clearTimeout(_runTimer);
        _runTimer = setTimeout(() => { handleRun(); }, 300);
        return () => { if (_runTimer) clearTimeout(_runTimer); };
    });

    // Autosave effect (debounced) referencing code
    $effect(() => {
        const _codeToSave = code;
        if (typeof window === 'undefined') return;
        if (_saveTimer) clearTimeout(_saveTimer);
        _saveTimer = setTimeout(() => {
            try { window.localStorage.setItem(STORAGE_KEY, _codeToSave); } catch (_) { /* ignore */ }
        }, 400);
        return () => { if (_saveTimer) clearTimeout(_saveTimer); };
    });
</script>

<section class="h-screen w-screen flex overflow-hidden bg-gradient-to-br from-base-200 via-base-100 to-base-200">
    <!-- Left: Code + Console (1/3) -->
    <div class="w-1/3 min-w-[340px] h-full flex flex-col border-r border-base-300 bg-base-100/70 backdrop-blur-sm">
        <div class="p-4 pb-3 border-b border-base-300">
            <h1 class="text-2xl font-bold tracking-wide text-primary">Pixel Programmer</h1>
        </div>
        <div class="flex-1 flex flex-col overflow-hidden">
            <div class="flex-1 flex flex-col min-h-0">
                <div class="p-4 sm:p-6 pb-2 flex flex-col gap-1 flex-shrink-0">
                    <h2 class="card-title text-primary/80 tracking-wide">Turtle Script</h2>
                    <div class="text-[10px] uppercase tracking-wide text-base-content/50">Editor</div>
                </div>
                <div class="px-4 flex-1 min-h-0 flex flex-col">
                    <div class="border border-base-300 rounded overflow-hidden flex-1 min-h-0">
                        <CodeMirrorEditor
                            class="font-mono text-sm leading-snug h-full"
                            bind:value={code}
                            extensions={editorExtensions}
                            placeholder={'forward 50\nback 10\nleft 90\nright 45\npen down\nhsv +10 _ 50'}
                        />
                    </div>
                    <div class="pt-3 flex flex-col gap-2">
                        <div class="flex flex-wrap gap-2 items-center">
                            <button class="btn btn-primary btn-sm" onclick={handleRun}>Run</button>
                            <button class="btn btn-outline btn-sm" onclick={() => { canvasInst?.clearPixels?.(); lastRunStats=null; runError=null; }}>Clear</button>
                            <label class="label cursor-pointer gap-1 ml-auto text-xs">
                                <span class="text-base-content/60">Auto</span>
                                <input type="checkbox" class="toggle toggle-xs" checked={autoRun} onchange={(e)=> autoRun = e.currentTarget.checked} />
                            </label>
                        </div>
                        {#if runError}
                            <div class="alert alert-error py-1 min-h-0 h-auto text-xs">{runError}</div>
                        {:else if lastRunStats}
                            <div class="text-xs text-base-content/60 space-y-1">
                                <div><span class="font-semibold">Done.</span> Ops: {lastRunStats.operations}, Pos: ({lastRunStats.finalX},{lastRunStats.finalY}), Heading: {lastRunStats.heading.toFixed(1)}°, HSV: {Math.round(lastRunStats.color.h)}/{Math.round(lastRunStats.color.s)}/{Math.round(lastRunStats.color.v)}</div>
                                <div class="opacity-60">(Ctrl+Enter to Run)</div>
                            </div>
                        {/if}
                    </div>
                </div>
            </div>
            <!-- Console pinned at bottom -->
            <div class="border-t border-base-300 bg-base-200/40 flex-shrink-0 max-h-[260px]">
                <div class="px-4 pt-3 pb-2 flex items-center gap-2 text-xs text-base-content/60">
                    <span class="font-semibold">Console</span>
                    <span class="opacity-60">Tokens</span>
                    {#if !lexError}
                        <span class="ml-auto">{tokens.length} token{tokens.length===1?'':'s'}</span>
                    {:else}
                        <span class="ml-auto text-error">error</span>
                    {/if}
                    <button class="btn btn-ghost btn-xs" onclick={() => navigator?.clipboard?.writeText(JSON.stringify(tokens, null, 2))} disabled={!!lexError}>Copy</button>
                </div>
                <div class="px-4 pb-3">
                    {#if lexError}
                        <div class="alert alert-error py-1 min-h-0 h-auto text-xs">{lexError}</div>
                    {:else}
                        <pre class="bg-base-300/60 rounded p-2 text-[11px] leading-tight overflow-auto max-h-[120px]">{JSON.stringify(tokens, null, 2)}</pre>
                        {#if Object.keys(lastVars).length}
                            <div class="mt-2">
                                <div class="text-[10px] uppercase tracking-wide text-base-content/50 mb-1">Variables</div>
                                <pre class="bg-base-300/40 rounded p-2 text-[11px] leading-tight overflow-auto max-h-[80px]">{JSON.stringify(lastVars, null, 2)}</pre>
                            </div>
                        {/if}
                    {/if}
                    <div class="mt-2 text-[10px] text-base-content/50 space-y-1">
                        <p>Supported: forward/back/left/right (abbr), pen up|down, hsv, repeat.</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <!-- Right: Canvas (2/3) -->
    <div class="flex-1 h-full flex flex-col">
        <div class="flex-1 flex items-center justify-center p-6">
            <div class="w-full h-full flex items-center justify-center">
                <P5Canvas {sketch} onInstance={(inst)=> canvasInst = inst} />
            </div>
        </div>
        <div class="text-xs text-base-content/50 text-center pb-2">
            Powered by <span class="font-semibold text-secondary">p5.js</span>
        </div>
    </div>
</section>