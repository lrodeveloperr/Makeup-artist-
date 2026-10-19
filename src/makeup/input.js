// Pointer input for applying makeup (contract §2 input rules):
// - one captured primary pointer at a time; other fingers and non-primary mouse buttons are ignored
// - the tool and colour are captured at pointer-down and kept for the whole gesture
// - every sample (including coalesced ones) is applied; the applicator interpolates fast moves
// - pointer-up commits; cancel, lost capture, host pause or resize end the gesture at its last valid sample
// - the lens selector and face gems apply on a tap (press and release without dragging), not on a drag
// - a finger covers what it touches, so on touch the tool works at its tip, held a little above the finger (as
//   Haircut's clipper): strokes paint there, and a lens or gem is aimed there and goes on where the finger lifts
//   (press, aim, release); a mouse or a pen works right at the pointer
const TAP_SLOP = 10; // CSS pixels a lens or gem tap may move (mouse and pen)
const TOUCH_TIP = 72; // CSS pixels above the finger where the tool works, at most 12 % of the face's height

// canvas: the face canvas; applicator: Applicator; selection(): { tool, colour } ('lens' for lenses, 'gem' for gems), or null
// while the face takes no input (review, an open panel, a pause);
// onChange(): the face changed and needs a redraw; onCommit(change): a stroke or lens change was stored;
// feedback (optional): follows each stroke as it happens, for its sound: down(selection), move(x, y, contact, time)
// for every sample (contact: the tool is on the skin; the mascara wand: passing through lashes, coated or not;
// time: when the sample was taken, ms, so samples delivered together on a busy frame keep their own timing), up()
// aim (optional): where a finger's tool is working, for showing the tool in hand: aim(x, y, selection) in canvas CSS
// pixels while a finger is down, aim(null) when it lifts or the gesture ends
export function attachInput(canvas, applicator, { selection, onChange, onCommit, feedback, aim }) {
  let active = null;
  const local = (e, tip = 0) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top - tip]; };

  const finish = (commit) => {
    if (!active) return;
    const a = active;
    active = null;
    if (canvas.hasPointerCapture?.(a.id)) canvas.releasePointerCapture(a.id);
    if (a.tip) aim?.(null);
    if (a.tap) {
      if (!commit || a.moved) return;
      if (a.tap.tool === 'lens' && applicator.tapLens(a.x, a.y, a.tap.colour)) { onChange(); onCommit({ lens: true }); }
      const stroke = a.tap.tool === 'gem' && applicator.tapGem(a.x, a.y, a.tap.colour);
      if (stroke) { onChange(); onCommit({ stroke }); }
      return;
    }
    feedback?.up();
    const stroke = applicator.end(a.g); // valid work up to the last applied sample is kept either way
    if (stroke) { onChange(); onCommit({ stroke }); }
  };

  const down = (e) => {
    if (!e.isPrimary || e.button !== 0 || active) return;
    e.preventDefault();
    const sel = selection();
    if (!sel) return;
    const tip = e.pointerType === 'touch' ? Math.min(TOUCH_TIP, canvas.clientHeight * 0.12) : 0;
    const [x, y] = local(e, tip);
    canvas.setPointerCapture(e.pointerId);
    if (tip) aim?.(x, y, sel);
    if (sel.tool === 'lens' || sel.tool === 'gem') { active = { id: e.pointerId, tap: sel, x, y, moved: false, tip }; return; }
    const g = applicator.begin(sel.tool, sel.colour);
    if (!g) return;
    active = { id: e.pointerId, g, tip, sel };
    feedback?.down(sel);
    const changed = applicator.move(g, x, y);
    feedback?.move(x, y, g.painter ? !!g.seg : !!g.onLash, e.timeStamp);
    if (changed) onChange();
  };
  const move = (e) => {
    if (!active || e.pointerId !== active.id) return;
    const events = e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e];
    let changed = false;
    for (const ev of events) {
      const [x, y] = local(ev, active.tip);
      if (active.tap) {
        if (active.tip) { active.x = x; active.y = y; } // a finger aims the lens or gem; it goes on where it lifts
        else if (Math.hypot(x - active.x, y - active.y) > TAP_SLOP) active.moved = true;
        continue;
      }
      const g = active.g, moved = applicator.move(g, x, y);
      feedback?.move(x, y, g.painter ? !!g.seg : !!g.onLash, ev.timeStamp);
      changed = moved || changed;
    }
    if (active.tip) aim?.(...local(e, active.tip), active.tap || active.sel);
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
