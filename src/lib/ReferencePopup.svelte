<script>
  import { onMount } from 'svelte';
  import docUrl from '$lib/docs/turtle-language.md?raw';
  import { marked } from 'marked';

  let open = $state(false);
  let html = $state('Loading...');

  onMount(async () => {
    try {
      const src = docUrl; // raw markdown via Vite ?raw
      html = marked.parse(src, { mangle:false, headerIds:true });
    } catch (e) {
      html = 'Failed to load docs: ' + (e.message || e);
    }
  });

  export function toggle(){ open = !open; }
  export function show(){ open = true; }
  export function hide(){ open = false; }

  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F1') { e.preventDefault(); show(); }
      else if (e.key === 'Escape') hide();
    });
  }
</script>

<div class="relative">
  <button class="btn btn-ghost btn-xs" onclick={() => toggle()} title="Turtle language reference (F1)">Ref</button>
  {#if open}
  <div class="fixed inset-0 bg-black/40 z-40" role="button" tabindex="0" aria-label="Close reference overlay" onclick={hide} onkeydown={(e)=> (e.key==='Enter'||e.key===' ') && (e.preventDefault(), hide())}></div>
  <div class="fixed top-6 inset-x-0 mx-auto w-[95vw] max-w-[900px] h-[80vh] z-50 flex flex-col rounded-lg shadow-xl border border-base-300 bg-base-100 overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-2 border-b border-base-300 bg-base-200/60">
        <h2 class="font-semibold text-sm tracking-wide">Turtle Script Reference</h2>
        <span class="text-[10px] opacity-60 ml-1">(Press Esc to close)</span>
        <div class="ml-auto flex items-center gap-2">
          <button class="btn btn-xs" onclick={() => hide()}>Close</button>
        </div>
      </div>
      <div class="flex-1 overflow-auto p-4 prose prose-invert max-w-none text-sm">
        {@html html}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(.prose pre) { background: var(--fallback-b1, #1e1e24); padding: .6rem .75rem; border-radius: .5rem; }
  :global(.prose code) { font-size: 0.85em; }
  :global(.prose table) { font-size: 0.75rem; }
  :global(.prose h1) { font-size: 1.4rem; }
  :global(.prose h2) { font-size: 1.1rem; margin-top:1.5rem; }
  :global(.prose h3) { font-size: 1rem; }
</style>
