<script>
  import p5 from 'p5';

  // Props via runes ($props) for Svelte 5
  // Increase default canvas size
  let { sketch, width = 800, height = 800, onInstance = null } = $props();

  /** @type {HTMLElement | null} */
  let canvasParent;
  /** @type {p5 | null} */
  let p5Instance = null;

  // Create / recreate p5 instance when sketch changes or parent ready.
  $effect(() => {
    if (typeof window === 'undefined') return; // SSR guard
    if (!canvasParent || !sketch) return;

    // If already exists (e.g. HMR or sketch prop changed), remove first
    if (p5Instance) {
      p5Instance.remove();
      p5Instance = null;
    }

  const inst = new p5(sketch, canvasParent);
    inst.resizeCanvas(width, height);
    p5Instance = inst;
  if (typeof onInstance === 'function') onInstance(inst);

    // Cleanup when dependencies change or component destroyed
    return () => {
  if (typeof onInstance === 'function') onInstance(null);
  inst.remove();
      if (p5Instance === inst) p5Instance = null;
    };
  });

  // Resize canvas when width/height props change.
  $effect(() => {
    if (p5Instance && typeof width === 'number' && typeof height === 'number') {
      p5Instance.resizeCanvas(width, height);
    }
  });
</script>

<div bind:this={canvasParent}></div>

<style>
  div {
    display: inline-block;
    /* width and height are set by p5.js canvas */
  }
</style>
