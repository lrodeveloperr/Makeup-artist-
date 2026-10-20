// Pointer input for applying makeup (contract §2 input rules):
// - one captured primary pointer at a time; other fingers and non-primary mouse buttons are ignored
// - the tool and colour are captured at pointer-down and kept for the whole gesture
// - every sample (including coalesced ones) is applied; the applicator interpolates fast moves
// - pointer-up commits; cancel, lost capture, host pause or resize end the gesture at its last valid sample
// - the lens selector and face gems apply on a tap (press and release without dragging), not on a drag
// - a finger covers what it touches, so on touch the tool works at its tip, held a little above the finger (as
//   Haircut's clipper): strokes paint there, and a lens or gem is aimed there and goes on where the finger lifts
//   (press, aim, release); a mouse or a pen works right at the pointer, where its tool is shown from the moment it is
//   over the face
// - a finger first aims (owner, 20 October 2026: on a phone it was hard to time where a stroke began): touching shows
//   the tool and where its tip is without painting; sliding paints, from where the tip was; a touch that lifts
//   without sliding leaves one dab there
const TAP_SLOP = 10; // CSS pixels a lens or gem tap may move (mouse and pen)
const TOUCH_TIP = 44; // CSS pixels above the finger where the tool works, at most 7 % of the face's height (clear of
// the fingertip, close enough to feel held)
const TOUCH_SLIDE = 6; // CSS pixels a finger slides before it paints (less is a touch to aim, then a dab)

// canvas: the face canvas; applicator: Applicator; selection(): { tool, colour } ('lens' for lenses, 'gem' for gems), or null
// while the face takes no input (review, an open panel, a pause);
// onChange(): the face changed and needs a redraw; onCommit(change): a stroke or lens change was stored;
// feedback (optional): follows each stroke as it happens, for its sound: down(selection), move(x, y, contact, time)
// for every sample (contact: the tool is on the skin; the mascara wand: passing through lashes, coated or not;
// time: when the sample was taken, ms, so samples delivered together on a busy frame keep their own timing), up()
// aim (optional): where the tool is working, for showing the tool in hand: aim(x, y, selection, kind) in canvas CSS
// pixels (kind: 'touch', or 'mouse' for a mouse or a pen) while a finger is down, and while a mouse or pen is over the
// face, pressed or not, so the player aims before painting; aim(null) when it lifts or leaves, or the face takes no
// input
export function attachInput(canvas, applicator, { selection, onChange, onCommit, feedback, aim }) {
  let active = null;
  const local = (e, tip = 0) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top - tip]; };

  const finish = (commit) => {
    if (!active) return;
    // a finger that touched and lifted without sliding leaves one dab where the tip was
    if (active.aiming && commit) start(active.id, active.sel, active.kind, active.tip, ...active.aiming, performance.now());
    const a = active;
    active = null;
    if (canvas.hasPointerCapture?.(a.id)) canvas.releasePointerCapture(a.id);
    if (a.kind === 'touch' || !commit) aim?.(null); // a mouse stays over the face: its tool stays in hand
    if (a.aiming || a.done) return; // (an aim cancelled before it painted: nothing to store)
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
    const kind = e.pointerType === 'touch' ? 'touch' : 'mouse', tip = kind === 'touch' ? Math.min(TOUCH_TIP, canvas.clientHeight * 0.07) : 0;
    const [x, y] = local(e, tip);
    canvas.setPointerCapture(e.pointerId);
    aim?.(x, y, sel, kind);
    if (sel.tool === 'lens' || sel.tool === 'gem') { active = { id: e.pointerId, tap: sel, x, y, moved: false, tip, kind }; return; }
    // a finger aims first: the stroke begins once it slides, from where the tip was
    if (kind === 'touch') { active = { id: e.pointerId, aiming: [x, y], from: [e.clientX, e.clientY], tip, sel, kind }; return; }
    start(e.pointerId, sel, kind, tip, x, y, e.timeStamp);
  };
  // the stroke begins at (x, y)
  const start = (id, sel, kind, tip, x, y, time) => {
    const g = applicator.begin(sel.tool, sel.colour);
    if (!g) { active = { id, done: true, tip, sel, kind }; return; }
    active = { id, g, tip, sel, kind };
    feedback?.down(sel);
    const changed = applicator.move(g, x, y);
    feedback?.move(x, y, g.painter ? !!g.seg : !!g.onLash, time);
    if (changed) onChange();
  };
  // a mouse or pen over the face, not pressed: its tool follows it (a finger has no hover)
  const hover = (e) => {
    const sel = e.pointerType !== 'touch' && e.isPrimary && selection();
    if (sel) aim?.(...local(e), sel, 'mouse'); else aim?.(null);
  };
  const move = (e) => {
    if (!active) { hover(e); return; }
    if (e.pointerId !== active.id) return;
    if (active.aiming) {
      // still aiming: the tool follows the finger; once the finger slides, the stroke starts where the tip was
      if (Math.hypot(e.clientX - active.from[0], e.clientY - active.from[1]) < TOUCH_SLIDE) { aim?.(...local(e, active.tip), active.sel, active.kind); return; }
      const [x, y] = active.aiming;
      start(active.id, active.sel, active.kind, active.tip, x, y, e.timeStamp);
    }
    if (active.done) { aim?.(...local(e, active.tip), active.sel, active.kind); return; } // a colour that can't be used
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
    aim?.(...local(e, active.tip), active.tap || active.sel, active.kind);
    if (changed) onChange();
  };
  const up = (e) => { if (active && e.pointerId === active.id) finish(true); };
  const cancel = (e) => { if (active && e.pointerId === active.id) finish(false); };
  const leave = () => { if (!active) aim?.(null); };

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('lostpointercapture', cancel);
  canvas.addEventListener('pointerleave', leave);
  const menu = (e) => e.preventDefault(); // a long press is a stroke, not a context menu
  canvas.addEventListener('contextmenu', menu);
  return {
    // end any gesture now (host pause, resize, opening a panel); a new pointer-down is needed to continue. The tool in
    // hand goes too (until the pointer moves over the face again)
    interrupt: () => { finish(false); aim?.(null); },
    detach() {
      finish(false);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('lostpointercapture', cancel);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('contextmenu', menu);
    },
  };
}
