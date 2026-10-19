// Pointer input for applying makeup (contract §2 input rules):
// - one captured primary pointer at a time; other fingers and non-primary mouse buttons are ignored
// - the tool and colour are captured at pointer-down and kept for the whole gesture
// - every sample (including coalesced ones) is applied; the applicator interpolates fast moves
// - pointer-up commits; cancel, lost capture, host pause or resize end the gesture at its last valid sample
// - the lens selector applies on a tap (press and release without dragging), not on a drag
const TAP_SLOP = 10; // CSS pixels a lens tap may move

// canvas: the face canvas; applicator: Applicator; selection(): { tool, colour } ('lens' for lenses);
// onChange(): the face changed and needs a redraw; onCommit(change): a stroke or lens change was stored
export function attachInput(canvas, applicator, { selection, onChange, onCommit }) {
  let active = null;
  const local = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  const finish = (commit) => {
    if (!active) return;
    const a = active;
    active = null;
    if (canvas.hasPointerCapture?.(a.id)) canvas.releasePointerCapture(a.id);
    if (a.lens) {
      if (commit && !a.moved && applicator.tapLens(a.x, a.y, a.lens)) { onChange(); onCommit({ lens: true }); }
      return;
    }
    const stroke = applicator.end(a.g); // valid work up to the last applied sample is kept either way
    if (stroke) { onChange(); onCommit({ stroke }); }
  };

  const down = (e) => {
    if (!e.isPrimary || e.button !== 0 || active) return;
    e.preventDefault();
    const sel = selection();
    const [x, y] = local(e);
    canvas.setPointerCapture(e.pointerId);
    if (sel.tool === 'lens') { active = { id: e.pointerId, lens: sel.colour, x, y, moved: false }; return; }
    const g = applicator.begin(sel.tool, sel.colour);
    if (!g) return;
    active = { id: e.pointerId, g };
    if (applicator.move(g, x, y)) onChange();
  };
  const move = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const events = e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e];
    let changed = false;
    for (const ev of events) {
      const [x, y] = local(ev);
      if (active.lens) { if (Math.hypot(x - active.x, y - active.y) > TAP_SLOP) active.moved = true; continue; }
      changed = applicator.move(active.g, x, y) || changed;
    }
    if (changed) onChange();
  };
  const up = (e) => { if (active && e.pointerId === active.id) finish(true); };
  const cancel = (e) => { if (active && e.pointerId === active.id) finish(false); };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  const menu = (e) => e.preventDefault(); // a long press is a stroke, not a context menu
  canvas.addEventListener('contextmenu', menu);
  return {
    // end any gesture now (host pause, resize, opening a panel); a new pointer-down is needed to continue
    interrupt: () => finish(false),
    detach() {
      finish(false);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', cancel);
      canvas.removeEventListener('contextmenu', menu);
    },
  };
}
