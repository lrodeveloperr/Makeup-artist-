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
// - a finger is assisted (owner, 20 October 2026: on a touch screen there is almost no margin for error, since the
//   tool works the moment it is dragged): each tool paints only in its own small zones of the face, a stroke stays in
//   the zone it starts in, and a gem goes on only where gems sit (the applicator's `zones`); a mouse or a pen is free
const TAP_SLOP = 10; // CSS pixels a lens or gem tap may move (mouse and pen)
// Where a finger's tool works (owner, 20 October 2026: a one-finger game; the sweet spot is slightly above the
// finger or thumb, where the tool is seen and felt in hand, and not too high). As an offset cursor (Potter et al.,
// 1988; Vogel and Baudisch's Shift, 2007): just clear of the fingertip as the player sees it. The reported point is the
// middle of the contact and the fingertip reaches about half the contact's height above it, so: half the contact's
// height + 25 px, from 48 px (a forefinger, about 8 mm: between the 44 px the owner found too low and the 54 px found
// too high) to 66 px (a thumb, about 10.5 mm); 51 px where the device gives no contact size; at most 16 % of the face's
// height (a tiny embed)
const touchTip = (e, height) => Math.min(Math.min(Math.max((e.height > 1 ? e.height / 2 : 26) + 25, 48), 66), height * 0.16);

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
// lean (optional): lean(selection, x) -> how far the finger's tool leans, in pixels across for each pixel down from its
// tip (x: the finger in canvas CSS pixels); its tip is set back by that much, so the tool's handle runs down into the
// finger rather than beside it; reach (optional): reach(selection) -> how high a finger's tool is held, as a share of
// the usual height
export function attachInput(canvas, applicator, { selection, onChange, onCommit, feedback, aim, lean, reach }) {
  let active = null;
  // where the tool works, in canvas CSS pixels: tip [across, up] from the pointer (a finger's tool is above it)
  const local = (e, tip = [0, 0]) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left - tip[0], e.clientY - r.top - tip[1]]; };

  const finish = (commit) => {
    if (!active) return;
    const a = active;
    active = null;
    if (canvas.hasPointerCapture?.(a.id)) canvas.releasePointerCapture(a.id);
    if (a.kind === 'touch' || !commit) aim?.(null); // a mouse stays over the face: its tool stays in hand
    if (a.tap) {
      if (!commit || a.moved) return;
      if (a.tap.tool === 'lens' && applicator.tapLens(a.x, a.y, a.tap.colour)) { onChange(); onCommit({ lens: true }); }
      const stroke = a.tap.tool === 'gem' && applicator.tapGem(a.x, a.y, a.tap.colour, a.kind === 'touch');
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
    const kind = e.pointerType === 'touch' ? 'touch' : 'mouse', up = kind === 'touch' ? touchTip(e, canvas.clientHeight) * (reach ? reach(sel) : 1) : 0;
    const tip = [up * (up && lean ? lean(sel, local(e)[0]) : 0), up];
    const [x, y] = local(e, tip);
    canvas.setPointerCapture(e.pointerId);
    aim?.(x, y, sel, kind);
    if (sel.tool === 'lens' || sel.tool === 'gem') { active = { id: e.pointerId, tap: sel, x, y, moved: false, tip, kind }; return; }
    const g = applicator.begin(sel.tool, sel.colour, kind === 'touch');
    if (!g) return;
    active = { id: e.pointerId, g, tip, sel, kind };
    feedback?.down(sel);
    const changed = applicator.move(g, x, y);
    feedback?.move(x, y, g.painter ? !!g.seg : !!g.onLash, e.timeStamp);
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
    const events = e.getCoalescedEvents?.().length ? e.getCoalescedEvents() : [e];
    let changed = false;
    for (const ev of events) {
      const [x, y] = local(ev, active.tip);
      if (active.tap) {
        if (active.tip[1]) { active.x = x; active.y = y; } // a finger aims the lens or gem; it goes on where it lifts
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
