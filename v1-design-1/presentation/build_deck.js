// Builds the presentation.   cd presentation && node build_deck.js
// Rules followed: white background, dark text, every font >= 24 pt, bullet points only, slide numbers,
// diagrams/figures on every content slide, numbered citations [n] matching the References slides.
const fs = require('fs')
const path = require('path')
const pptxgen = require('pptxgenjs')

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.333 x 7.5 in
pres.title = 'MPC for Automated Reverse Docking of an Articulated Tractor-Trailer'
pres.author = 'Group B9'

const INK = '14212B', MUTED = '44546A', TEAL = '0E7C86', TEAL_T = 'E8F3F4', AMBER = 'A8661A', AMBER_T = 'FBF1E3'
const RED = 'B83227', RED_T = 'FBEAE8', GREEN = '1E7A45', GREEN_T = 'E8F4ED', LINE = 'D3DCE3', ROW = 'F4F8F9'
const HEAD = 'Cambria', BODY = 'Calibri'
const MIN_PT = 24

const A = (n) => path.join(__dirname, 'assets', n)
const manifest = JSON.parse(fs.readFileSync(A('manifest.json'), 'utf8'))
const pngSize = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }

// ------------------------------------------------------------------ helpers
let slideNo = 0
const at = {} // title -> slide number, checked against the pipeline slide's cross-references
const mark = (k) => { at[k] = slideNo }
function base(title, section, opts = {}) {
  const s = pres.addSlide()
  slideNo++
  if (title) at[title] = slideNo
  s.background = { color: 'FFFFFF' }
  if (title) {
    s.addText(title, { x: 0.6, y: 0.32, w: 12.1, h: 0.85, fontFace: HEAD, fontSize: opts.titleSize || 34, bold: true, color: INK,
      margin: 0, valign: 'middle', isTextBox: true })
  }
  if (section) {
    s.addText(section, { x: 0.6, y: 6.9, w: 9.0, h: 0.45, fontFace: BODY, fontSize: 24, color: MUTED, margin: 0, valign: 'middle', isTextBox: true })
  }
  s.slideNumber = { x: 11.75, y: 6.9, w: 1.0, h: 0.45, fontFace: BODY, fontSize: 24, color: TEAL, bold: true, align: 'right' }
  return s
}

function text(s, t, x, y, w, h, o = {}) {
  const size = o.fontSize || 24
  if (size < MIN_PT) throw new Error(`font ${size} < ${MIN_PT}: ${String(t).slice(0, 40)}`)
  s.addText(t, { x, y, w, h, fontFace: o.fontFace || BODY, fontSize: size, color: o.color || INK, bold: !!o.bold, italic: !!o.italic,
    align: o.align || 'left', valign: o.valign || 'top', margin: o.margin ?? 0, isTextBox: true, fill: o.fill, lineSpacingMultiple: o.lsm })
}

// items: string | {t: string | runs[], color, bold, lead}; `lead` renders a bold prefix
function bullets(s, items, x, y, w, h, o = {}) {
  const size = o.fontSize || 24
  const runs = []
  items.forEach((it, i) => {
    const item = typeof it === 'string' ? { t: it } : it
    const last = i === items.length - 1
    const po = { bullet: o.numbered ? { type: 'number' } : true, paraSpaceAfter: o.space ?? 10, fontSize: size, color: item.color || o.color || INK }
    if (item.lead) {
      runs.push({ text: item.lead, options: { ...po, bold: true, color: item.leadColor || item.color || o.color || INK } })
      runs.push({ text: item.t, options: { fontSize: size, color: item.color || o.color || INK, breakLine: !last } })
    } else {
      runs.push({ text: item.t, options: { ...po, bold: !!item.bold, breakLine: !last } })
    }
  })
  s.addText(runs, { x, y, w, h, fontFace: BODY, fontSize: size, color: o.color || INK, valign: 'top', margin: 0, isTextBox: true })
}

// equation image at natural size (rendered at >= 26 pt, so it stays >= 24 pt on the slide)
function eq(s, name, x, y, o = {}) {
  const m = manifest[name]
  if (!m) throw new Error('missing ' + name)
  s.addImage({ path: A(name), x, y, w: m.w, h: m.h, altText: o.alt || 'equation' })
  return { w: m.w, h: m.h }
}

function figure(s, name, x, y, alt) {
  const m = manifest[name]
  s.addImage({ path: A(name), x, y, w: m.w, h: m.h, altText: alt })
  return m
}

function picture(s, file, x, y, w, h, alt, o = {}) { // contain-fit into the box
  const p = pngSize(A(file))
  const r = p.w / p.h
  let W = w, H = w / r
  if (H > h) { H = h; W = h * r }
  const X = o.align === 'left' ? x : x + (w - W) / 2
  const Y = o.valign === 'top' ? y : y + (h - H) / 2
  s.addImage({ path: A(file), x: X, y: Y, w: W, h: H, altText: alt, rounding: false })
  return { x: X, y: Y, w: W, h: H }
}

function card(s, x, y, w, h, fill, o = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: o.line ? { color: o.line, width: 1.5 } : { type: 'none' } })
}

function badge(s, label, x, y, d, fill, o = {}) { // motif: number in a filled circle
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { type: 'none' } })
  s.addText(String(label), { x, y, w: d, h: d, fontFace: BODY, fontSize: o.fontSize || 24, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', margin: 0, isTextBox: true })
}

function arrow(s, x1, y1, x2, y2, color = MUTED) {
  s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color, width: 2.5, endArrowType: 'triangle' } })
}

function label(s, t, x, y, w, color = MUTED) { text(s, t, x, y, w, 0.45, { color, italic: false }) }

// ------------------------------------------------------------------ 1 title
{
  const s = base(null, null)
  text(s, 'Robotics · Semester 3 · Group B9', 0.6, 0.5, 8, 0.45, { color: TEAL, bold: true })
  text(s, 'Model Predictive Control for Automated Reverse Docking', 0.6, 0.95, 12.1, 1.4,
    { fontFace: HEAD, fontSize: 40, bold: true, valign: 'top' })
  text(s, 'Trajectory tracking and constraint management of an articulated tractor-trailer, with step-by-step driver guidance', 0.6, 2.4, 12.1, 0.95, { fontSize: 26, color: MUTED })
  card(s, 0.6, 3.6, 6.0, 2.95, TEAL_T)
  bullets(s, [
    { lead: 'Harshith KV', t: '  AID25119' }, { lead: 'G Venugopalan', t: '  AID25115' },
    { lead: 'Rithvik Arulprakash', t: '  AID25148' }, { lead: 'Vipin Sudhakar', t: '  AID25166' },
  ], 0.95, 3.85, 5.5, 2.6, { space: 14 })
  picture(s, 'crop_guide_stage.png', 6.95, 3.55, 5.8, 3.1, 'Simulated tractor-trailer reversing with the NMPC look-ahead drawn ahead of it')
  s.addNotes('Title. Group B9. Same project as our first review, now completed: a model-predictive controller that reverses a tractor-trailer into a parking bay without jackknifing, and turns its output into instructions a human driver can follow.')
}

// ------------------------------------------------------------------ 2 real-world motivation (videos from the first review)
{
  const s = base('Introduction: reverse docking in real yards', 'Introduction')
  const cover = (f) => 'data:image/png;base64,' + fs.readFileSync(A('old/' + f)).toString('base64')
  const W1 = 7.6, H1 = W1 * 414 / 866
  s.addMedia({ type: 'video', path: A('old/media1.mp4'), cover: cover('image1.png'), x: 0.6, y: 1.4, w: W1, h: H1 })
  text(s, 'Reversing to a warehouse dock', 0.6, 1.5 + H1, W1, 0.45, { color: MUTED })
  bullets(s, [
    'Long trailer, tight bays, blind spots',
    'Every docking ends in reverse',
  ], 0.6, 2.25 + H1, W1, 1.2, { space: 8 })
  const H2 = 5.0, W2 = H2 * 480 / 854
  s.addMedia({ type: 'video', path: A('old/media2.mp4'), cover: cover('image2.png'), x: 8.6 + (4.15 - W2) / 2, y: 1.4, w: W2, h: H2 })
  s.addNotes('Two clips from our first review. Left: a tractor-trailer reversing to a warehouse dock. Right: a crowded truck lot. In both, the final manoeuvre is a reverse, where the driver cannot see the trailer end and the vehicle is unstable. Click a clip to play it.')
}

// ------------------------------------------------------------------ 2 introduction
{
  const s = base('The core challenge: kinematic instability', 'Introduction')
  bullets(s, [
    { lead: 'Forward: ', t: 'the trailer self-aligns (stable)', leadColor: GREEN },
    { lead: 'Reverse: ', t: 'an inverted pendulum; hitch angle ψ grows exponentially', leadColor: RED },
    'Uncorrected, the rig folds: a jackknife',
    { lead: 'Goal: ', t: 'dock in reverse with ψ inside safe limits', leadColor: INK },
    { lead: 'This project: ', t: 'a co-pilot that says how to steer, how fast and how far', leadColor: TEAL },
  ], 0.6, 1.45, 7.2, 5.1, { space: 16 })
  picture(s, 'lot_Cross.png', 8.15, 1.35, 4.6, 4.75, 'Parking yard with the rig at the gate and ten bays, some occupied')
  text(s, 'Our yard: green = free bays', 7.9, 6.2, 5.1, 0.45, { color: MUTED, align: 'center' })
  s.addNotes('Forward driving is self-stabilising; reversing behaves like balancing an inverted pendulum: a small hitch-angle error grows until the rig folds. Our objective from the first review is unchanged: dock in reverse while keeping the hitch angle inside safe limits. What is new is that the system now also guides a human driver. The picture is our simulated yard.')
}

// ------------------------------------------------------------------ 4 non-minimum phase
{
  const s = base('The “non-minimum phase” dilemma', 'Introduction')
  const steps = [
    ['Goal: swing the trailer one way', TEAL_T, TEAL],
    ['First: turn the tractor the other way', AMBER_T, AMBER],
    ['Then: follow the trailer round', TEAL_T, TEAL],
  ]
  steps.forEach(([t, fill, c], i) => {
    const y = 1.45 + i * 1.2
    card(s, 0.6, y, 6.6, 0.95, fill)
    badge(s, i + 1, 0.8, y + 0.2, 0.55, c)
    text(s, t, 1.55, y, 5.5, 0.95, { valign: 'middle' })
    if (i < 2) arrow(s, 1.075, y + 0.97, 1.075, y + 1.18, INK)
  })
  card(s, 0.6, 5.2, 6.6, 1.4, RED_T)
  text(s, 'A reactive PID steers straight at the error ⇒ wrong way first ⇒ jackknife', 0.85, 5.2, 6.2, 1.4, { valign: 'middle' })
  figure(s, 'nonmin.png', 7.3, 1.45, 'Reversing with constant steering: tractor heading goes down while trailer heading goes up')
  text(s, 'Same steering input, reversing: headings move apart', 7.3, 5.65, 5.6, 0.9, { color: MUTED, align: 'center' })
  s.addNotes('Reversing is non-minimum phase: to move the trailer one way you must first turn the tractor the other way. The chart is from our model: reversing with a constant 10-degree steer, the tractor heading turns one way while the trailer heading turns the other. A controller that only reacts to the present error steers the wrong way and folds the rig. This is why we need a controller that looks ahead.')
}

// ------------------------------------------------------------------ 5 historical approaches
{
  const s = base('Historical approaches & their limits', 'Introduction')
  const cols = [
    ['PID', ['Reacts to present error', 'Blind to the future']],
    ['Fuzzy logic', ['Hand-written rules', 'No hard guarantees']],
    ['Geometric paths', ['Ideal curves', 'Ignore steering lock and ψ']],
  ]
  cols.forEach(([h, items], i) => {
    const x = 0.6 + i * 4.15
    card(s, x, 1.45, 3.8, 3.2, RED_T)
    text(s, h, x + 0.3, 1.6, 3.3, 0.55, { fontSize: 28, bold: true, color: RED })
    bullets(s, items, x + 0.3, 2.3, 3.3, 2.3, { space: 10 })
  })
  arrow(s, 6.67, 4.75, 6.67, 5.1, INK)
  card(s, 0.6, 5.15, 12.1, 1.45, TEAL)
  text(s, 'Our approach: plan on the real model (Hybrid A*), then look ahead with hard limits (NMPC)', 0.9, 5.15, 11.5, 1.45, { valign: 'middle', color: 'FFFFFF', bold: true })
  s.addNotes('Why the classic controllers are not enough. PID only reacts, so it cannot make the counter-intuitive first move. Fuzzy rules work in practice but give no guarantee that the hitch limit is respected. Geometric planners draw curves the vehicle cannot follow. Our answer combines a planner that uses the real vehicle model with a predictive controller that enforces the hitch limit as a hard constraint.')
}

// ------------------------------------------------------------------ 3-4 literature review
const TH = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: TEAL }, fontSize: 24, valign: 'middle' } })
const cellOpts = (fill) => ({ fill: { color: fill }, fontSize: 24, color: INK, valign: 'middle' })
{
  const s = base('Literature review (1/2): the three closest works', 'Literature review')
  const rows = [
    [TH('#'), TH('Title'), TH('Authors'), TH('Year'), TH('Venue')],
    [
      { text: '[1]', options: { ...cellOpts(TEAL_T), bold: true, color: TEAL } },
      { text: [{ text: 'Parking Assistance for Trailer-Truck Transport Vehicles Using Sensor Fusion and Motion Planning ' }, { text: '(base paper)', options: { bold: true, color: TEAL } }], options: cellOpts(TEAL_T) },
      { text: 'G. Alenchery et al. (7 authors)', options: cellOpts(TEAL_T) },
      { text: '2026', options: cellOpts(TEAL_T) },
      { text: 'arXiv 2605.02716', options: cellOpts(TEAL_T) },
    ],
    [
      { text: '[2]', options: { ...cellOpts('FFFFFF'), bold: true } },
      { text: 'An Intrinsically Stable MPC Approach for Anti-Jackknifing Control of Tractor-Trailer Vehicles', options: cellOpts('FFFFFF') },
      { text: 'M. Beglini, T. Belvedere, L. Lanari, G. Oriolo', options: cellOpts('FFFFFF') },
      { text: '2022', options: cellOpts('FFFFFF') },
      { text: 'IEEE/ASME T-Mech 27(6)', options: cellOpts('FFFFFF') },
    ],
    [
      { text: '[3]', options: { ...cellOpts(ROW), bold: true } },
      { text: 'Robust Tube-Based Decentralized Nonlinear MPC of an Autonomous Tractor-Trailer System', options: cellOpts(ROW) },
      { text: 'E. Kayacan, E. Kayacan, H. Ramon, W. Saeys', options: cellOpts(ROW) },
      { text: '2015', options: cellOpts(ROW) },
      { text: 'IEEE/ASME T-Mech 20(1)', options: cellOpts(ROW) },
    ],
  ]
  s.addTable(rows, { x: 0.6, y: 1.4, w: 12.1, colW: [0.75, 5.35, 3.1, 1.0, 1.9], fontFace: BODY, fontSize: 24, color: INK,
    border: { type: 'solid', pt: 1, color: LINE }, margin: 0.07, rowH: [0.55, 1.45, 1.45, 1.45] })
  s.addNotes('Three works closest to ours. [1] is our base paper (arXiv, May 2026). [2] is the anti-jackknife MPC from Sapienza Rome. [3] is robust NMPC for an agricultural tractor-trailer.')
}
{
  const s = base('Literature review (2/2): outcomes and limitations', 'Literature review')
  const B = (arr, fill, color = INK) => ({ text: arr.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < arr.length - 1, color } })), options: { ...cellOpts(fill), valign: 'top' } })
  const rows = [
    [TH('#'), TH('Outcomes'), TH('Limitations')],
    [{ text: '[1]', options: { ...cellOpts(TEAL_T), bold: true, color: TEAL } },
      B(['Layered design: sensor fusion → Hybrid A* → NMPC → LQR', 'A* + B-spline path on a tractor-trailer model (CLI simulation)'], TEAL_T),
      B(['NMPC only proposed, not implemented', 'Jackknifing observed in tests', 'No quantitative results'], TEAL_T)],
    [{ text: '[2]', options: { ...cellOpts('FFFFFF'), bold: true } },
      B(['Reverse tracking without hitch divergence (I/O linearisation + IS-MPC)', 'Simulation and prototype experiments'], 'FFFFFF'),
      B(['Needs a given reference trajectory', 'No obstacle-aware parking', 'No driver-facing output'], 'FFFFFF')],
    [{ text: '[3]', options: { ...cellOpts(ROW), bold: true } },
      B(['Robust NMPC + moving-horizon estimation', '5–8 cm error on straight lines (field)'], ROW),
      B(['Forward driving only', 'No hitch-angle (jackknife) constraint'], ROW)],
  ]
  s.addTable(rows, { x: 0.6, y: 1.4, w: 12.1, colW: [0.75, 5.75, 5.6], fontFace: BODY, fontSize: 24, color: INK,
    border: { type: 'solid', pt: 1, color: LINE }, margin: 0.07, rowH: [0.55, 1.7, 1.6, 1.3] })
  s.addNotes('Key point: [1] proposes exactly our pipeline, Hybrid A* plus NMPC, but only implemented A* and reports jackknifing. [2] solves reverse tracking but needs a given trajectory. [3] is forward-only with no hitch constraint.')
}
{
  const s = base('Base paper [1]: proposed vs. built', 'Literature review')
  const H = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: TEAL } } })
  const R = (a, b, c, fill) => [
    { text: a, options: { bold: true, fill: { color: fill } } },
    { text: b, options: { fill: { color: fill } } },
    { text: c, options: { fill: { color: fill }, color: GREEN, bold: true } },
  ]
  s.addTable([
    [H('Layer'), H('In [1]'), H('This project')],
    R('Path planning', 'A* + B-spline', 'Hybrid A* on (x, y, θ₀, ψ)', 'FFFFFF'),
    R('Tracking', 'NMPC proposed, not built', 'NMPC built, hard |ψ| ≤ 60°', ROW),
    R('Jackknife', 'observed in tests', '0 limit violations', 'FFFFFF'),
    R('Output', 'autonomy concept', 'driver instructions', ROW),
    R('Evaluation', 'qualitative', '110 scenarios, measured', 'FFFFFF'),
  ], { x: 0.6, y: 1.45, w: 12.1, colW: [2.8, 4.3, 5.0], fontFace: BODY, fontSize: 24, color: INK,
    border: { type: 'solid', pt: 1, color: LINE }, margin: 0.08, rowH: 0.62, valign: 'middle' })
  text(s, 'Sensing (camera / LiDAR fusion in [1]) is left as future work: we assume a known pose', 0.6, 5.75, 12.1, 0.9, { color: MUTED })
  s.addNotes('Change since our first review: we originally cited Shah (2019), a feedback controller for reverse docking. Once we found [1], it matched our pipeline, Hybrid A* plus NMPC, so it became the base paper. The table shows what [1] proposed and what we actually built and measured. Shah\'s idea of analysing the motion in distance travelled rather than time survives in our instability analysis.')
}

// ------------------------------------------------------------------ 5 research gaps
{
  const s = base('Research gaps', 'Research gaps')
  const gaps = [
    ['Proposed, not built', 'NMPC and a hitch limit are only proposed in [1]'],
    ['No hard jackknife guarantee', '[1] observed jackknifing; [3] has no hitch constraint'],
    ['Planning kept separate', '[2], [3] track a given path; no obstacle-aware parking'],
    ['No driver output, no metrics', 'No human-executable guidance; no measured evaluation'],
  ]
  gaps.forEach(([h, b], i) => {
    const x = i % 2 ? 6.85 : 0.6, y = i < 2 ? 1.45 : 4.1
    card(s, x, y, 5.9, 2.4, i === 1 ? RED_T : TEAL_T)
    badge(s, i + 1, x + 0.3, y + 0.3, 0.62, i === 1 ? RED : TEAL)
    text(s, h, x + 1.15, y + 0.33, 4.5, 0.55, { fontSize: 26, bold: true })
    text(s, b, x + 1.15, y + 0.98, 4.5, 1.3, { color: INK })
  })
  s.addNotes('Four gaps. The biggest: the NMPC layer in the base paper was never built, and without it the rig jackknifed.')
}

// ------------------------------------------------------------------ 6 objectives
{
  const s = base('Objectives', 'Objectives')
  const objs = [
    'Model the tractor-trailer kinematics and quantify why reversing is unstable',
    'Plan collision-free, kinematically feasible paths (Hybrid A*) into four bay layouts',
    'Track the path with NMPC under a hard hitch-angle limit |ψ| ≤ 60°',
    'Turn the optimal controls into driver instructions: gear, speed, wheel turns, distance',
    'Certify on 110 scenarios against an unaided-driver baseline',
  ]
  objs.forEach((o, i) => {
    const y = 1.5 + i * 1.0
    badge(s, i + 1, 0.65, y, 0.62, TEAL)
    text(s, o, 1.55, y + 0.02, 11.1, 0.9, { valign: 'top' })
  })
  s.addNotes('Five objectives; each maps to a methodology block and a result.')
}

// ------------------------------------------------------------------ 7 problem statement
{
  const s = base('Problem statement', 'Problem statement')
  const rows = [
    ['GIVEN', 1.45, 0.75], ['FIND', 2.4, 0.75], ['SUBJECT TO', 3.35, 1.45], ['DELIVER', 5.0, 0.95],
  ]
  rows.forEach(([l, y, h]) => {
    card(s, 0.6, y, 2.6, h, TEAL_T)
    text(s, l, 0.6, y, 2.6, h, { bold: true, color: TEAL, align: 'center', valign: 'middle' })
  })
  text(s, 'Yard map (walls, parked rigs), gate pose, target bay pose', 3.5, 1.45, 9.2, 0.75, { valign: 'middle' })
  eq(s, 'eq_problem.png', 3.5, 2.5, { alt: 'find U of t such that X of 0 equals X gate and X of T approximately X bay' })
  text(s, 'Ẋ = f(X, U)  and  |v| ≤ 2 m/s', 3.5, 3.38, 9.2, 0.5, {})
  eq(s, 'eq_cons.png', 3.5, 4.12, { alt: 'absolute psi at most 60 degrees, steering at most 35 degrees, clearance at least 0.25 m' })
  text(s, 'Instructions a human can follow: gear · speed · wheel turns · hold distance', 3.5, 5.0, 9.2, 0.95, { valign: 'middle' })
  s.addNotes('Formally: find the input history U(t) = (speed, steering) that takes the rig from the gate to the bay, obeying the kinematics, never exceeding 60 degrees of hitch angle or 35 degrees of steering, and keeping 25 cm from obstacles. The answer must be something a person can execute.')
}

// ------------------------------------------------------------------ 8 methodology overview
{
  const s = base('Methodology: the pipeline', 'Methodology')
  const boxes = [
    ['Yard & model', '4 layouts, seeded fill', 'slides 14–18'],
    ['Hybrid A* planner', 'collision-free path', 'slides 19–20'],
    ['NMPC tracker', 'hard |ψ| ≤ 60°', 'slides 21–22'],
    ['Driver advisor', 'wheel turns, km/h', 'slide 23'],
    ['Certify & view', '110 scenarios', 'slides 24–25'],
  ]
  const W = 2.1, G = 0.4
  boxes.forEach(([h, c, sl], i) => {
    const x = 0.6 + i * (W + G)
    card(s, x, 1.9, W, 1.4, i === 2 ? TEAL : '1B5E66')
    text(s, h, x + 0.08, 1.9, W - 0.16, 1.4, { bold: true, color: 'FFFFFF', align: 'center', valign: 'middle' })
    text(s, c, x, 3.5, W, 1.0, { align: 'center' })
    text(s, sl, x, 4.55, W, 0.45, { align: 'center', color: TEAL, bold: true })
    if (i < boxes.length - 1) arrow(s, x + W + 0.05, 2.6, x + W + G - 0.05, 2.6, INK)
  })
  card(s, 0.6, 5.3, 12.1, 1.3, AMBER_T)
  text(s, 'Offline: every free bay is planned, driven in closed loop and certified; the viewer replays certified runs', 0.9, 5.3, 11.6, 1.3, { valign: 'middle' })
  s.addNotes('Five blocks. Maths for each block is on the slides shown under it. Everything runs offline and is replayed, so a live demo cannot stall.')
  mark('pipeline')
}

// ------------------------------------------------------------------ system architecture (replaces the first-review SIL diagram)
{
  const s = base('System architecture (software-in-the-loop)', 'Methodology')
  const cols = [
    ['Python core', 'NumPy · SciPy', ['Kinematic model', 'Hybrid A* planner', 'NMPC tracker', 'Driver advisor']],
    ['Certify & export', '110 free bays', ['Guided run', 'Unaided run', '5 pass checks', 'JSON plan library']],
    ['React viewer', 'Three.js · Vite', ['3-D yard', 'Guidance bar', 'Instruments', 'Live maths']],
  ]
  cols.forEach(([h, sub, items], i) => {
    const x = 0.6 + i * 4.25
    card(s, x, 1.45, 3.6, 0.95, i === 1 ? TEAL : '1B5E66')
    text(s, h, x, 1.45, 3.6, 0.95, { align: 'center', valign: 'middle', bold: true, color: 'FFFFFF', fontSize: 26 })
    text(s, sub, x, 2.5, 3.6, 0.45, { align: 'center', color: MUTED })
    card(s, x, 3.05, 3.6, 2.35, TEAL_T)
    bullets(s, items, x + 0.3, 3.2, 3.1, 2.1, { space: 4 })
    if (i < 2) arrow(s, x + 3.65, 1.92, x + 4.2, 1.92, INK)
  })
  card(s, 0.6, 5.6, 12.1, 1.05, AMBER_T)
  text(s, 'Changed since review 1: CasADi + 60 Hz WebSockets → certified runs, replayed', 0.85, 5.6, 11.6, 1.05, { valign: 'middle' })
  s.addNotes('Our first review showed a live CasADi solver streaming to the browser over WebSockets at 60 Hz. That was hard to install on Windows and could not keep up. The final system solves everything offline in plain Python with NumPy and SciPy, certifies every bay, and exports a JSON library. The React and Three.js viewer replays certified runs, so the demo needs no install and cannot stall.')
  mark('arch')
}

// ------------------------------------------------------------------ 9 vehicle model & notation
{
  const s = base('State-space formulation: state, input, geometry', 'Methodology · model')
  eq(s, 'eq_state.png', 0.6, 1.38, { alt: 'X equals x1, y1, theta0, psi transposed; U equals v, delta transposed' })
  eq(s, 'eq_psi_def.png', 8.1, 1.42, { alt: 'psi equals theta0 minus theta1' })
  text(s, '(hitch angle)', 10.2, 1.45, 2.5, 0.45, { color: MUTED })
  figure(s, 'geometry.png', 0.5, 2.25, 'Tractor-trailer geometry with rear axle, hitch, trailer axle, L1, L2, theta0, psi and delta')
  text(s, 'Car-like tractor + one trailer, hitch offset d [2]', 0.6, 6.0, 6.4, 0.45, { color: MUTED })
  const P = (a, b) => [{ text: a, options: { fontSize: 24 } }, { text: b, options: { fontSize: 24, align: 'right', bold: true } }]
  const rows = [
    [{ text: 'Parameter', options: { bold: true, color: 'FFFFFF', fill: { color: TEAL } } }, { text: 'Value', options: { bold: true, color: 'FFFFFF', fill: { color: TEAL }, align: 'right' } }],
    P('L₁ tractor wheelbase', '4.0 m'), P('L₂ hitch → trailer axle', '8.0 m'), P('d hitch ahead of axle', '0.5 m'),
    P('δmax steering lock', '35°'), P('ψcrit hard hitch limit', '60°'), P('v yard speed', '≤ 2 m/s'),
  ]
  s.addTable(rows, { x: 7.3, y: 2.35, w: 5.4, colW: [3.85, 1.55], fontFace: BODY, fontSize: 24, color: INK,
    border: { type: 'solid', pt: 1, color: LINE }, margin: 0.06, rowH: 0.5 })
  s.addNotes('Four states: rear-axle position x1,y1, tractor heading theta0 and hitch angle psi. Two inputs: speed v (negative in reverse) and steering delta. Parameters are a 4 m tractor and an 8 m trailer.')
}

// ------------------------------------------------------------------ 10 kinematic model
{
  const s = base('Control inputs & system kinematics', 'Methodology · model')
  eq(s, 'eq_xdot.png', 0.8, 1.45); eq(s, 'eq_ydot.png', 4.0, 1.45); eq(s, 'eq_thdot.png', 7.2, 1.33)
  const e = eq(s, 'eq_psidot.png', 0.8, 2.35, { alt: 'psi dot equals v tan delta over L1 minus v sin psi over L2 minus v d tan delta cos psi over L1 L2' })
  const term = (f0, f1, t, c) => {
    const x0 = 0.8 + e.w * f0, x1 = 0.8 + e.w * f1
    s.addShape(pres.shapes.RECTANGLE, { x: x0, y: 2.35 + e.h + 0.05, w: x1 - x0, h: 0.06, fill: { color: c }, line: { type: 'none' } })
    text(s, t, x0 - 0.4, 2.35 + e.h + 0.14, x1 - x0 + 0.8, 0.45, { color: c, bold: true, align: 'center' })
  }
  term(0.14, 0.29, 'steering', TEAL); term(0.41, 0.57, 'hitch', RED); term(0.68, 1.0, 'offset', MUTED)
  bullets(s, [
    { lead: 'Steering term: ', t: 'the driver’s only lever on ψ', leadColor: TEAL },
    { lead: 'Hitch term −v sinψ / L₂: ', t: 'restoring when v > 0, destabilising when v < 0', leadColor: RED },
    { lead: 'Every term ∝ v: ', t: 'the path depends on distance s, not speed, so speed is chosen separately', leadColor: INK },
    'Integrated with RK4; one model shared by planner, NMPC and viewer [2]',
  ], 0.6, 3.95, 12.1, 2.8, { space: 10 })
  s.addNotes('The heart of the problem is psi-dot. Its hitch term, minus v sin psi over L2, has the sign of minus v: going forward it pulls psi back to zero, reversing it pushes psi away. Because every term is proportional to v, dividing by speed gives a model in distance travelled, which is why the base paper parameterises in space.')
}

// ------------------------------------------------------------------ 11 instability
{
  const s = base('Why reversing is unstable', 'Methodology · model')
  label(s, 'Straight line (δ = 0), small ψ:', 0.6, 1.4, 6.4)
  eq(s, 'eq_lin.png', 0.6, 1.85, { alt: 'psi dot approximately minus v over L2 times psi; lambda equals minus v over L2' })
  bullets(s, [
    { lead: 'v > 0: ', t: 'λ < 0, ψ decays (stable)', leadColor: GREEN },
    { lead: 'v < 0: ', t: 'λ = |v|/L₂ > 0, ψ grows ×e every 8 m', leadColor: RED },
  ], 0.6, 2.7, 6.5, 1.2, { space: 6 })
  label(s, 'Exact solution in distance s:', 0.6, 3.95, 6.4)
  eq(s, 'eq_exact.png', 0.6, 4.4, { alt: 'd psi d s equals sin psi over L2, so tan of psi over 2 equals tan of psi0 over 2 times e to the s over L2' })
  bullets(s, [{ lead: '2° error: ', t: '60° at 28 m, jackknife at 30 m', leadColor: RED }], 0.6, 5.3, 6.5, 0.9)
  figure(s, 'instability.png', 7.2, 1.45, 'Hitch angle versus distance: reverse grows past 60 degrees at 28 m, forward decays')
  text(s, 'Closed form matches the simulator exactly', 7.2, 5.7, 5.6, 0.45, { color: MUTED, align: 'center' })
  s.addNotes('Linearise at psi = 0 with zero steering: psi-dot = -(v/L2) psi. The eigenvalue is -v/L2, negative forward and positive in reverse. Written in distance the equation is separable: tan(psi/2) grows like e^(s/L2). With L2 = 8 m a 2-degree error hits 60 degrees after 28 m. Our simulator gives 28.0 m and 30.3 m, identical to the closed form.')
}

// ------------------------------------------------------------------ 12 critical steering
{
  const s = base('How much steering can hold a hitch angle?', 'Methodology · model')
  label(s, 'Steady state (ψ̇ = 0):', 0.6, 1.4, 6.4)
  eq(s, 'eq_hold.png', 0.6, 1.85, { alt: 'tan delta hold equals L1 over L2 times sin psi over 1 minus d over L2 cos psi' })
  label(s, 'Maximum of the right-hand side:', 0.6, 2.95, 6.4)
  eq(s, 'eq_crit.png', 0.6, 3.4, { alt: 'cos psi star equals d over L2, so delta critical equals 26.6 degrees' })
  bullets(s, [
    { lead: 'Above 26.6°: ', t: 'no equilibrium, the rig folds', leadColor: RED },
    { lead: 'At ψ = 60°: ', t: 'hold 24°, 11° of lock left to recover', leadColor: AMBER },
    { lead: 'So: ', t: 'NMPC hard limit 60°; planner stays ≤ 52°', leadColor: TEAL },
  ], 0.6, 4.3, 6.5, 2.4, { space: 10 })
  figure(s, 'holding.png', 7.2, 1.45, 'Steering needed to hold a hitch angle, peaking at 26.6 degrees; at 60 degrees it is 24 degrees')
  s.addNotes('Set psi-dot to zero to find the steering that holds a given hitch angle. The curve peaks at 26.6 degrees of steering, at psi near 86 degrees. At 60 degrees you need 24 degrees just to hold, leaving 11 degrees of our 35-degree lock to pull the trailer back. That is the mathematical reason for choosing 60 degrees as the hard limit.')
}

// ------------------------------------------------------------------ 13 regulator
{
  const s = base('Hitch-angle regulator (feedback linearisation)', 'Methodology · model')
  label(s, 'Choose δ by inverting the ψ̇ equation:', 0.6, 1.4, 6.4)
  eq(s, 'eq_reg.png', 0.6, 1.85, { alt: 'tan delta equals L1 times sin psi over L2 minus sign v k psi minus psi desired, over 1 minus d over L2 cos psi' })
  eq(s, 'eq_reg_cl.png', 0.6, 2.95, { alt: 'so psi dot equals minus absolute v k times psi minus psi desired' })
  eq(s, 'eq_reg_s.png', 0.6, 3.65, { alt: 'psi of s minus psi desired proportional to e to the minus k s, k = 0.5 per metre' })
  bullets(s, [
    { lead: 'Stable in both gears: ', t: 'error ×1/e every 2 m', leadColor: TEAL },
    'Builds the planner’s motion primitives',
    'NMPC’s last-resort fallback',
  ], 0.6, 4.45, 6.5, 2.2, { space: 8 })
  figure(s, 'regulator.png', 7.2, 1.45, 'Regulated hitch angle converges to zero within 10 m while the open-loop angle grows')
  s.addNotes('Substituting this steering law into the psi-dot equation cancels the unstable hitch term and leaves psi-dot = -|v| k (psi - psi_des), which is stable whatever the sign of v. With k = 0.5 per metre the error shrinks by e every 2 m. This makes reversing behave like driving forward and is the building block of the planner.')
}

// ------------------------------------------------------------------ 14 Hybrid A*
{
  const s = base('Hybrid A* planner: search and cost', 'Methodology · planner')
  bullets(s, [
    'Search state (x, y, θ₀, ψ) on a 0.5 m × 5° × 12° lattice [4]',
    '10 motion primitives per node: 2 gears × ψdes ∈ {0, ±25°, ±45°}, 2 m each',
    'Pruned if |ψ| > 52° or clearance < 0.35 m (signed-distance field)',
  ], 0.6, 1.4, 12.1, 1.65, { space: 6 })
  eq(s, 'eq_cost.png', 0.6, 3.05, { alt: 'g equals sum of path length times gear cost plus steering, steering change, hitch and gear-switch penalties' })
  bullets(s, [
    { lead: 'c_gear: ', t: '1.0 forward, 1.4 reverse' },
    { lead: 'ψdes, Δψdes: ', t: 'gentle, steady steering' },
    { lead: '|ψ| / ψplan: ', t: 'keep the hitch straight' },
    { lead: 'switch: ', t: '+6 per gear change' },
  ], 0.6, 4.0, 6.4, 2.7, { space: 4 })
  figure(s, 'primitives.png', 7.3, 4.05, 'Ten motion primitives from one pose: five forward, five reverse')
  text(s, 'Primitives from one pose', 7.3, 6.2, 5.4, 0.45, { color: MUTED, align: 'center' })
  s.addNotes('Hybrid A* searches continuous poses snapped to a lattice. Each expansion runs the regulator for 2 m towards one of five hitch set-points, forward or reverse, on the real model. Branches that exceed 52 degrees or come within 35 cm of an obstacle are discarded. The cost adds distance, a reverse premium and penalties for sharp or changing steering, hitch angle and gear changes.')
}

// ------------------------------------------------------------------ 15 heuristic, flat output, analytic shot
{
  const s = base('Hybrid A* planner: heuristic and final approach', 'Methodology · planner')
  label(s, 'Flat output: trailer-axle curvature fixes ψ', 0.6, 1.4, 7.4)
  eq(s, 'eq_flat.png', 0.6, 1.85, { alt: 'kappa1 equals tan psi over L2, equivalently psi equals arctan of L2 kappa1' })
  label(s, 'Heuristic (cost-to-go estimate):', 0.6, 2.75, 7.4)
  eq(s, 'eq_heur.png', 0.6, 3.2, { alt: 'h equals epsilon times max of trailer Dubins distance and grid distance plus 3 absolute psi, epsilon 3' })
  bullets(s, [
    { lead: 'Trailer axle ≈ a car ', t: 'whose “steering” is ψ ⇒ Dubins path [5], ρ = 10 m' },
    { lead: 'ε = 3: ', t: 'weighted A*, plans in 0.1–6 s' },
    { lead: 'Analytic shot: ', t: 'Dubins path simulated on the real model; kept only if collision-free and it ends in the bay' },
  ], 0.6, 3.95, 7.4, 2.8, { space: 8 })
  figure(s, 'dubins.png', 8.2, 1.5, 'Shortest Dubins path for the trailer axle: turn, straight, turn')
  s.addNotes('The trailer axle is a flat output: its path curvature alone fixes the hitch angle, psi = arctan(L2 kappa). So the trailer axle behaves like a car whose steering is psi, and the shortest Dubins path of the trailer axle is a good cost-to-go estimate. Near the goal we try an analytic shot: simulate that Dubins path on the real model and accept it only if it is collision-free and lands in the bay.')
}

// ------------------------------------------------------------------ 16 NMPC objective
{
  const s = base('NMPC: the prediction horizon and objective', 'Methodology · NMPC')
  label(s, 'Our formulation:', 0.6, 1.35, 12)
  eq(s, 'eq_word.png', 0.6, 1.8, { alt: 'J equals sum of X minus X ref squared weighted by Q plus U squared weighted by R plus delta U squared weighted by S' })
  label(s, 'Implemented: horizon 24 × 0.4 s = 9.6 s, 8 steering blocks', 0.6, 2.6, 12)
  eq(s, 'eq_ocp.png', 0.6, 3.05, { alt: 'minimise over u1 to u8 of J, the sum over 24 steps of stage cost plus terminal cost plus R sum u squared plus S sum of u differences squared' })
  eq(s, 'eq_stage.png', 0.6, 4.35, { alt: 'stage cost weights trailer position 0.6, trailer heading 1.5, hitch 15, tractor position 0.15, tractor heading 0.3' })
  eq(s, 'eq_term.png', 0.6, 5.1, { alt: 'terminal cost weights and R 0.02, S 3' })
  text(s, 'p₁ = trailer axle: the main target, because in reverse the tractor axle is non-minimum-phase [2]', 0.6, 5.85, 12.1, 0.9, {})
  s.addNotes('Top line is the cost from our formulation document: tracking error, control effort and control smoothness. Below is exactly what the code minimises: the trailer axle position and heading are weighted most, the hitch angle deviation is weighted 15, the steering itself is cheap and changes of steering are expensive, so the wheel does not jerk. The trailer axle is the main target because, in reverse, the tractor rear axle initially moves the wrong way: it is the non-minimum-phase output.')
}

// ------------------------------------------------------------------ 17 NMPC constraints & solution
{
  const s = base('Preventing the jackknife: NMPC hard constraints', 'Methodology · NMPC')
  label(s, 'Single shooting, RK4 prediction:', 0.6, 1.35, 12)
  eq(s, 'eq_dyn.png', 0.6, 1.8, { alt: 'X k plus 1 equals RK4 of X k, v k and saturated planned steering plus correction u' })
  label(s, 'Hard constraints at every step k:', 0.6, 2.55, 12)
  eq(s, 'eq_cons.png', 0.6, 3.0, { alt: 'absolute psi at most 60 degrees, correction at most 35 degrees, clearance at least 0.25 m' })
  // receding-horizon diagram
  text(s, 'horizon 9.6 s = 8 × 1.2 s', 0.6, 3.8, 6.2, 0.45, { color: TEAL, bold: true })
  for (let j = 0; j < 8; j++) {
    const x = 0.6 + j * 0.76
    s.addShape(pres.shapes.RECTANGLE, { x, y: 4.35, w: 0.7, h: 0.6, fill: { color: j === 0 ? TEAL : TEAL_T }, line: { color: TEAL, width: 1 } })
    text(s, `u${'₁₂₃₄₅₆₇₈'[j]}`, x, 4.35, 0.7, 0.6, { align: 'center', valign: 'middle', color: j === 0 ? 'FFFFFF' : INK, bold: j === 0 })
  }
  arrow(s, 0.95, 5.05, 0.95, 5.45, TEAL)
  text(s, 'apply u₁ for 0.25 s, then re-solve', 0.6, 5.5, 6.2, 0.45, { color: INK })
  bullets(s, [
    { lead: '8 unknowns: ', t: 'steering corrections' },
    { lead: 'SLSQP [6] ', t: '(SciPy [8]), warm start' },
    { lead: 'Fallback: ', t: 'ψ-only, then regulator' },
    { lead: '94–154 ms ', t: 'per solve (≤ 250 ms)', leadColor: TEAL },
  ], 7.2, 3.85, 5.55, 2.6, { space: 12 })
  s.addNotes('The optimiser chooses eight steering corrections, each held for 1.2 s, around the planner steering. States are predicted with RK4 and the hitch limit, steering lock and clearance are hard inequality constraints, solved with SciPy SLSQP. Only the first 0.25 s is applied, then the problem is re-solved from the new state: receding horizon. If no feasible solution exists we keep the hitch limit and drop clearance; failing that, the stable regulator takes over. Measured: 94 to 154 ms per solve, inside the 250 ms control period.')
}

// ------------------------------------------------------------------ 18 driver guidance
{
  const s = base('From optimal control to driver instructions', 'Methodology · advisor')
  picture(s, 'crop_gbar.png', 0.6, 1.35, 12.1, 1.2, 'Guidance bar: step 5 of 9, counter-steer right, steering 1.23 turns right against advised 1 turn right, speed 1.9 km/h against 2 km/h, 4 m more')
  label(s, 'Steering-wheel turns (20:1 ratio):', 0.6, 2.75, 7.2)
  eq(s, 'eq_turns.png', 0.6, 3.2, { alt: 'n turns equals delta times 20 over 360 degrees; 35 degrees of lock is 1.94 turns' })
  card(s, 8.2, 2.75, 4.5, 1.2, AMBER_T)
  text(s, 'Reverse · 2 km/h\n1 turn right · 9 m', 8.4, 2.75, 4.2, 1.2, { valign: 'middle', bold: true, align: 'center' })
  label(s, 'Speed schedule along the path:', 0.6, 4.05, 12)
  eq(s, 'eq_speed.png', 0.6, 4.5, { alt: 'v of s is at most the minimum of a steering-based cap, acceleration limit and braking limit' })
  bullets(s, [
    'Quantised to ¼ turn; phases < 4 m merged ⇒ 6–16 instructions',
    'Each: gear · km/h · wheel turns · hold distance · hitch margin',
  ], 0.6, 5.45, 12.1, 1.3, { space: 6 })
  s.addNotes('The NMPC outputs a road-wheel angle every quarter second; nobody can follow that. We convert to steering-wheel turns at a 20 to 1 ratio, round to quarter turns, and merge short phases, giving 6 to 16 instructions per manoeuvre. Speed is slowed where steering is large and respects acceleration and braking limits. The strip at the top is the live guidance bar from our app.')
}

// ------------------------------------------------------------------ 19 test scenarios
{
  const s = base('Test scenarios: 4 layouts × 6 random fills', 'Results')
  const cell = (file, x, y, w, h, t, alt) => { const r = picture(s, file, x, y, w, h, alt, { align: 'left' }); return r }
  let r = cell('lot_Cross.png', 0.6, 1.4, 2.4, 2.35, '', 'Cross layout')
  text(s, 'Cross 90°\n24 free bays', r.x + r.w + 0.3, 2.05, 3.0, 1.0, {})
  r = cell('lot_Angled.png', 6.85, 1.4, 2.4, 2.35, '', 'Angled layout')
  text(s, 'Angled 60°\n24 free bays', r.x + r.w + 0.3, 2.05, 3.0, 1.0, {})
  picture(s, 'lot_Parallel.png', 0.6, 4.05, 5.9, 1.6, 'Parallel layout', { align: 'left', valign: 'top' })
  text(s, 'Parallel · 24 free bays', 0.6, 5.75, 5.9, 0.45, {})
  picture(s, 'lot_Tandem.png', 6.85, 4.05, 5.9, 1.6, 'Tandem layout', { align: 'left', valign: 'top' })
  text(s, 'Tandem (forward in) · 38 free bays', 6.85, 5.75, 5.9, 0.45, {})
  text(s, '110 free bays: every one planned, driven and checked', 0.6, 6.3, 12.1, 0.45, { color: MUTED })
  s.addNotes('Four layouts, each filled at random six times with parked rigs: 110 free bays. Three layouts need reversing; tandem is a forward pull-in, which acts as a control case.')
}

// ------------------------------------------------------------------ 20 evaluation protocol
{
  const s = base('Evaluation protocol', 'Results')
  const flow = ['Plan (Hybrid A*)', 'Guided run (NMPC)', 'Unaided run (same path)', 'Certify']
  flow.forEach((f, i) => {
    const x = 0.6 + i * 3.12
    card(s, x, 1.45, 2.75, 1.05, i === 3 ? TEAL : TEAL_T)
    text(s, f, x + 0.1, 1.45, 2.55, 1.05, { align: 'center', valign: 'middle', bold: true, color: i === 3 ? 'FFFFFF' : INK })
    if (i < 3) arrow(s, x + 2.8, 1.97, x + 3.07, 1.97, INK)
  })
  text(s, 'Unaided = tractor-only path follower: no hitch model, no look-ahead, no limit', 0.6, 2.75, 12.1, 0.5, { color: MUTED })
  const checks = ['No jackknife', '|ψ| ≤ 60° at every instant', '≥ 0.10 m from every obstacle', '≤ 0.8 m from the bay centre', '≤ 10° heading, ≤ 12° hitch']
  checks.forEach((c, i) => {
    const y = 3.5 + i * 0.6
    badge(s, '✓', 0.65, y + 0.02, 0.45, GREEN)
    text(s, c, 1.3, y, 5.8, 0.5, { valign: 'middle' })
  })
  card(s, 7.6, 3.5, 5.1, 2.9, AMBER_T)
  text(s, 'Only certified bays are offered to the driver; the rest show as “too tight”', 7.9, 3.5, 4.6, 2.9, { valign: 'middle' })
  s.addNotes('Every free bay goes through the same pipeline. The guided run must pass all five checks to be offered; the unaided run uses the identical path and vehicle, only without the hitch model, so the comparison is fair.')
}

// ------------------------------------------------------------------ 21 headline results
{
  const s = base('Results at a glance', 'Results')
  const stats = [
    ['98/110', 'bays certified for guidance', TEAL, TEAL_T],
    ['60/60', 'unaided reverses jackknife', RED, RED_T],
    ['0', 'hitch-limit violations with NMPC', GREEN, GREEN_T],
    ['53.3°', 'worst hitch angle (limit 60°)', AMBER, AMBER_T],
  ]
  stats.forEach(([n, l, c, t], i) => {
    const x = 0.6 + i * 3.08
    card(s, x, 1.5, 2.85, 3.6, t)
    text(s, n, x, 1.75, 2.85, 1.2, { fontSize: 54, bold: true, color: c, align: 'center', valign: 'middle', fontFace: HEAD })
    text(s, l, x + 0.2, 3.1, 2.45, 1.8, { align: 'center' })
  })
  text(s, 'Min. clearance 0.25 m · plans in 0.1–6 s · NMPC 94–154 ms per solve', 0.6, 5.5, 12.1, 0.9, { color: MUTED, align: 'center' })
  s.addNotes('98 of 110 bays pass every check; 12 are flagged as too tight rather than offered. Without guidance every one of the 60 reversing runs jackknifes. With NMPC the hitch limit was never violated; the worst case was 53.3 degrees against the 60-degree limit.')
}

// ------------------------------------------------------------------ 22 results by layout
{
  const s = base('Results by layout', 'Results')
  s.addChart(pres.charts.BAR, [
    { name: 'NMPC guidance', labels: ['Cross', 'Angled', 'Parallel', 'Tandem'], values: [20, 23, 17, 38] },
    { name: 'Unaided', labels: ['Cross', 'Angled', 'Parallel', 'Tandem'], values: [0, 0, 0, 38] },
  ], {
    x: 0.5, y: 1.35, w: 7.2, h: 5.4, barDir: 'col', barGrouping: 'clustered', chartColors: [TEAL, RED],
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 24, dataLabelColor: INK,
    catAxisLabelFontSize: 24, valAxisLabelFontSize: 24, catAxisLabelColor: INK, valAxisLabelColor: MUTED, catAxisLabelFontFace: BODY, valAxisLabelFontFace: BODY,
    valAxisMaxVal: 45, valAxisMinVal: 0, valAxisMajorUnit: 15, valGridLine: { color: 'E3E9ED', size: 1 }, catGridLine: { style: 'none' },
    showLegend: true, legendPos: 'b', legendFontSize: 24, legendFontFace: BODY, legendColor: INK,
    showValAxisTitle: true, valAxisTitle: 'bays parked', valAxisTitleFontSize: 24, valAxisTitleColor: MUTED, barGapWidthPct: 60,
  })
  const H = (t, a = 'left') => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: TEAL }, align: a } })
  const R = (a, b, c) => [{ text: a }, { text: b, options: { align: 'right' } }, { text: c, options: { align: 'right' } }]
  s.addTable([
    [H('Median error'), H('lateral', 'right'), H('heading', 'right')],
    R('Cross', '0.58 m', '2.0°'), R('Angled', '0.17 m', '4.2°'), R('Parallel', '0.72 m', '6.4°'), R('Tandem', '0.10 m', '3.2°'),
  ], { x: 8.0, y: 1.5, w: 4.7, colW: [2.1, 1.3, 1.3], fontFace: BODY, fontSize: 24, color: INK, border: { type: 'solid', pt: 1, color: LINE }, margin: 0.06, rowH: 0.5 })
  card(s, 8.0, 4.3, 4.7, 2.3, RED_T)
  text(s, 'Unaided parks only in tandem (forward in): reversing is where guidance matters', 8.2, 4.3, 4.3, 2.3, { valign: 'middle' })
  s.addNotes('Guidance parks every certified bay in every layout. The unaided driver parks only the tandem bays, which are driven forward, and jackknifes on every reversing layout. Median parking error is 10 to 72 cm laterally and 2 to 6 degrees of heading.')
}

// ------------------------------------------------------------------ 23 one run in detail
{
  const s = base('One run in detail: cross layout, bay 6', 'Results')
  figure(s, 'compare.png', 0.35, 1.35, 'Hitch angle versus time: NMPC stays within plus or minus 40 degrees; unaided exceeds 60 and jackknifes at 57 s')
  const rows = [
    ['Same start, path and vehicle', INK, false],
    ['Guided: peak |ψ| 40°', TEAL, true],
    ['Parked 0.58 m, 4.7° off', TEAL, false],
    ['Unaided: past 60° at 55 s', RED, true],
    ['Jackknife at 57 s (75°)', RED, false],
  ]
  rows.forEach(([t, c, b], i) => text(s, t, 8.35, 1.6 + i * 0.95, 4.4, 0.8, { color: c, bold: b, valign: 'middle' }))
  s.addNotes('Same scenario, two drivers. Both follow the same forward set-up. Once reversing starts, the unaided hitch angle runs away and folds at 57 seconds. The NMPC deliberately lets psi go to about minus 40 degrees to swing the trailer, then brings it back, and parks 58 cm from the centre line.')
}

// ------------------------------------------------------------------ 24 guidance on vs off
{
  const s = base('Guidance ON vs OFF, same bay', 'Results')
  picture(s, 'crop_parked.png', 0.6, 1.4, 5.9, 4.3, 'With guidance the rig is parked in bay 6')
  picture(s, 'crop_unaided.png', 6.85, 1.4, 5.9, 4.3, 'Without guidance the rig jackknifes before reaching the bay')
  text(s, 'ON: parked, 0.58 m off-centre', 0.6, 5.85, 5.9, 0.5, { color: GREEN, bold: true, align: 'center' })
  text(s, 'OFF: jackknife after 57 s', 6.85, 5.85, 5.9, 0.5, { color: RED, bold: true, align: 'center' })
  s.addNotes('Screenshots from our app at the end of each run: left with NMPC guidance, parked in bay 6; right, the unaided driver folded the rig short of the bays.')
}

// ------------------------------------------------------------------ 25 driver interface
{
  const s = base('The driver guidance interface', 'Results')
  const r = picture(s, 'app_guide.png', 0.6, 1.35, 9.3, 5.35, 'Application screenshot during step 5 of 9 with guidance bar, look-ahead, instruments, live maths and step table', { align: 'left', valign: 'top' })
  const k = r.w / 1600 // inches per CSS pixel of the 1600 x 900 capture
  const marks = [[184, 104], [560, 376], [1376, 152], [1376, 400], [560, 800]]
  marks.forEach(([cx, cy], i) => badge(s, i + 1, r.x + cx * k - 0.24, r.y + cy * k - 0.24, 0.48, AMBER))
  const legend = ['Instruction vs advised', 'NMPC look-ahead', 'Instruments', 'Live maths', 'Step table']
  legend.forEach((t, i) => {
    badge(s, i + 1, 10.15, 1.5 + i * 1.02, 0.48, AMBER)
    text(s, t, 10.75, 1.45 + i * 1.02, 2.0, 0.95, { valign: 'top' })
  })
  s.addNotes('Our web app during a run. (1) the current instruction with live steering and speed against the advised values, (2) the NMPC 9.6-second look-ahead drawn in the yard, (3) steering wheel, speedometer and hitch gauge, (4) the kinematic equations evaluated live, with the hitch term flagged destabilising, (5) the full instruction table. Playback can be slowed to quarter speed or paused at each step.')
}

// ------------------------------------------------------------------ syllabus alignment (updated from review 1)
{
  const s = base('Academic alignment: syllabus integration', 'Syllabus')
  const units = [
    ['Unit 1 · Rigid-body transforms: rear axle → hitch → trailer frames', 'eq_frames.png', 'hitch and trailer axle positions from the tractor pose'],
    ['Unit 2 · Kinematics of wheeled mobile robots', 'eq_nonholo.png', 'non-holonomic no-slip constraint'],
    ['Unit 3 · Advanced feedback control', 'eq_ctrl.png', 'feedback linearisation and NMPC with a hard hitch limit'],
  ]
  units.forEach(([h, e, alt], i) => {
    const y = 1.4 + i * 1.78
    card(s, 0.6, y, 12.1, 1.6, TEAL_T)
    badge(s, i + 1, 0.85, y + 0.2, 0.55, TEAL)
    text(s, h, 1.65, y + 0.2, 10.8, 0.55, { bold: true, valign: 'middle' })
    eq(s, e, 1.65, y + 0.85, { alt })
  })
  s.addNotes('How the project maps to the course. Unit 1: the hitch and trailer-axle positions are chained rigid-body transforms of the tractor pose; we use them for drawing and for collision checking of both bodies. Unit 2: the wheels roll without sliding, which gives the non-holonomic kinematic model. Unit 3: the feedback-linearising hitch regulator and the NMPC with a hard hitch-angle constraint.')
}

// ------------------------------------------------------------------ 26 limitations & future scope
{
  const s = base('Limitations & future scope', 'Limitations & future scope')
  card(s, 0.6, 1.4, 5.9, 5.3, RED_T)
  text(s, 'Limitations', 0.9, 1.6, 5.3, 0.55, { fontSize: 28, bold: true, color: RED })
  bullets(s, [
    'Runs precomputed, then replayed',
    'Kinematic model: no tyre slip or load transfer',
    'Roomy aisles (32–40 m); 12/110 bays not certified',
    'One trailer, simulated yard',
  ], 0.9, 2.3, 5.4, 4.3, { space: 12 })
  card(s, 6.85, 1.4, 5.9, 5.3, TEAL_T)
  text(s, 'Future scope', 7.15, 1.6, 5.3, 0.55, { fontSize: 28, bold: true, color: TEAL })
  bullets(s, [
    'Live solver: server or in-browser',
    'Faster NMPC (acados / IPOPT) for tight yards',
    'Camera / LiDAR pose feedback, as in [1]',
    'Driver-in-the-loop trials with reaction delay',
  ], 7.15, 2.3, 5.4, 4.3, { space: 12 })
  s.addNotes('Honest limits: the runs are computed offline and replayed; the model ignores tyre slip, which is acceptable at yard speeds; aisles are generous; 12 bays could not be certified. Next steps: a live solver, a faster NLP solver for tighter yards, closing the loop with real sensing, and trials with human drivers.')
}

// ------------------------------------------------------------------ 27 conclusion
{
  const s = base('Conclusion', 'Conclusion')
  bullets(s, [
    { lead: 'Instability: ', t: 'a 2° error hits 60° in 28 m' },
    { lead: 'Hybrid A* + NMPC ', t: 'with a hard 60° hitch limit' },
    { lead: '98/110 parked; ', t: '60/60 unaided jackknife' },
    { lead: 'Human output: ', t: 'gear, km/h, wheel turns' },
    { lead: 'Built and measured ', t: 'what [1] proposed' },
  ], 0.6, 1.5, 7.4, 5.2, { space: 18 })
  picture(s, 'crop_parked.png', 8.35, 1.5, 4.4, 4.4, 'Rig parked in bay 6 under guidance')
  s.addNotes('In one sentence: we turned the Hybrid A* plus NMPC architecture that the base paper proposed into a working, measured system that keeps the hitch angle inside a hard limit and tells a human driver exactly what to do.')
}

// ------------------------------------------------------------------ 28-29 references
const refs = [
  ['[1]', 'G. Alenchery et al., “Parking Assistance for Trailer-Truck Transport Vehicles Using Sensor Fusion and Motion Planning,” arXiv:2605.02716 [cs.RO], 2026.'],
  ['[2]', 'M. Beglini, T. Belvedere, L. Lanari, G. Oriolo, “An Intrinsically Stable MPC Approach for Anti-Jackknifing Control of Tractor-Trailer Vehicles,” IEEE/ASME Trans. Mechatronics, 27(6), 4417–4428, 2022.'],
  ['[3]', 'E. Kayacan, E. Kayacan, H. Ramon, W. Saeys, “Robust Tube-Based Decentralized Nonlinear Model Predictive Control of an Autonomous Tractor-Trailer System,” IEEE/ASME Trans. Mechatronics, 20(1), 447–456, 2015.'],
  ['[4]', 'D. Dolgov, S. Thrun, M. Montemerlo, J. Diebel, “Path Planning for Autonomous Vehicles in Unknown Semi-structured Environments,” Int. J. Robotics Research, 29(5), 485–501, 2010.'],
  ['[5]', 'L. E. Dubins, “On Curves of Minimal Length with a Constraint on Average Curvature, and with Prescribed Initial and Terminal Positions and Tangents,” American J. Mathematics, 79(3), 497–516, 1957.'],
  ['[6]', 'D. Kraft, “A Software Package for Sequential Quadratic Programming,” DFVLR-FB 88-28, German Aerospace Center (DLR), 1988.'],
  ['[7]', 'J. B. Rawlings, D. Q. Mayne, M. M. Diehl, Model Predictive Control: Theory, Computation, and Design, 2nd ed., Nob Hill Publishing, 2017.'],
  ['[8]', 'P. Virtanen et al., “SciPy 1.0: Fundamental Algorithms for Scientific Computing in Python,” Nature Methods, 17, 261–272, 2020.'],
]
for (const [part, list] of [['1/2', refs.slice(0, 4)], ['2/2', refs.slice(4)]]) {
  const s = base(`References (${part})`, 'References')
  const body = []
  list.forEach(([n, r], i) => {
    body.push({ text: n + '  ', options: { bold: true, color: TEAL, fontSize: 24, paraSpaceAfter: 14 } })
    body.push({ text: r, options: { fontSize: 24, color: INK, breakLine: i < list.length - 1 } })
  })
  s.addText(body, { x: 0.6, y: 1.4, w: 12.1, h: 5.3, fontFace: BODY, fontSize: 24, valign: 'top', margin: 0, isTextBox: true })
  s.addNotes('References cited on the slides as [n].')
}

// ------------------------------------------------------------------ 30 thank you
{
  const s = base(null, null)
  text(s, 'Thank you', 0.6, 1.4, 7.0, 1.3, { fontFace: HEAD, fontSize: 54, bold: true })
  text(s, 'Questions?', 0.6, 2.7, 7.0, 0.8, { fontSize: 32, color: TEAL, bold: true })
  text(s, 'Group B9\nHarshith KV · G Venugopalan\nRithvik Arulprakash · Vipin Sudhakar', 0.6, 3.7, 6.9, 1.6, {})
  text(s, 'Live demo: run_demo.bat → any layout → any green bay', 0.6, 5.4, 6.9, 0.9, { color: MUTED })
  picture(s, 'crop_guide_stage.png', 7.8, 1.45, 4.95, 4.9, 'Tractor-trailer reversing with the NMPC look-ahead')
  s.addNotes('Offer the live demo: pick a layout, pick a green bay, show guidance, then switch to Unaided on the same bay.')
}

// the pipeline slide quotes these numbers; fail the build if slides move
const expect = {
  'State-space formulation: state, input, geometry': 14, 'Hitch-angle regulator (feedback linearisation)': 18,
  'Hybrid A* planner: search and cost': 19, 'Hybrid A* planner: heuristic and final approach': 20,
  'NMPC: the prediction horizon and objective': 21, 'Preventing the jackknife: NMPC hard constraints': 22,
  'From optimal control to driver instructions': 23, 'Test scenarios: 4 layouts × 6 random fills': 24, 'Evaluation protocol': 25,
}
for (const [k, n] of Object.entries(expect)) if (at[k] !== n) throw new Error(`slide "${k}" is ${at[k]}, pipeline slide says ${n}`)

const out = path.join(__dirname, 'Robotics_SEM3_Final_Group_B9.pptx')
pres.writeFile({ fileName: out }).then(() => console.log(`wrote ${out} (${slideNo} slides)`))
