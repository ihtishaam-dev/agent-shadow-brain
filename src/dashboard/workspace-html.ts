// Dependency-free local workspace. The advanced dashboard is served separately.
export const WORKSPACE_HTML = String.raw`<!doctype html>
<html lang="en" data-theme="light" data-motion="system">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>Shadow Brain · Workspace</title>
<script>
  try {
    const theme = localStorage.getItem('shadow-brain:workspace:theme');
    const motion = localStorage.getItem('shadow-brain:workspace:motion');
    if (theme === 'dark') document.documentElement.dataset.theme = theme;
    if (motion === 'reduce') document.documentElement.dataset.motion = motion;
  } catch {}
</script>
<style>
  :root {
    color-scheme: light;
    --canvas: #f4f6f9; --surface: #fff; --inset: #eef2f6; --hover: #f2f5f8;
    --ink: #182539; --muted: #4e6176; --line: #dbe2e9; --control: #8a9bae;
    --teal: #096459; --teal-fill: #076b5e; --teal-hover: #05584d; --tint: #dff1ec;
    --bad: #a32940; --bad-bg: #fbeaf0; --focus: #167b9d;
    --rail: #172539; --rail-ink: #f0f5fc; --rail-muted: #b5c5d7; --rail-line: #35475b;
    --rail-selected: #284657; --rail-highlight: #8ed9cb;
    --agent: #57539a; --agent-bg: #eeecfa; --project: var(--teal); --project-bg: var(--tint);
    --memory: #475f7e; --memory-bg: #eaf0f8;
    --graph-line: #6d8195; --graph-project: #478779; --graph-agent: #746aa5; --graph-dot: #ccd7e0; --accent-ink: #fff;
    --skeleton: #e5ebf0; --r: 9px; --ease: 175ms cubic-bezier(.2,.75,.25,1);
    --header: 62px; --sidebar: 222px; --sticky: 2; --notice: 3;
    font-family: Inter, "Segoe UI", system-ui, sans-serif;
    font-size: 15px;
  }
  html[data-theme="dark"] {
    color-scheme: dark;
    --canvas: #111b2a; --surface: #172437; --inset: #1e2e43; --hover: #23344a;
    --ink: #edf4fb; --muted: #b3c1d1; --line: #334459; --control: #74889e;
    --teal: #94e1d3; --teal-fill: #9be6d6; --teal-hover: #baf2e6; --tint: #203f43;
    --bad: #ffadbd; --bad-bg: #492a3a; --focus: #8cd6f3;
    --rail: #101a28; --rail-line: #2e4157; --rail-selected: #233e4f;
    --agent: #c7bffc; --agent-bg: #333451; --memory: #bccfea; --memory-bg: #2a3a50;
    --graph-line: #8295ac; --graph-project: #82bcb1; --graph-agent: #aaa0db; --graph-dot: #34465b; --accent-ink: #15372e;
    --skeleton: #2b3a4d;
  }
  * { box-sizing: border-box; }
  [hidden] { display: none !important; }
  body { margin: 0; color: var(--ink); background: var(--canvas); font-size: .94rem; line-height: 1.5; }
  a { color: var(--teal); text-decoration: none; }
  p, h1, h2, h3, ul, dl, dd { margin: 0; }
  p { max-width: 69ch; overflow-wrap: anywhere; }
  h1, h2, h3 { line-height: 1.22; text-wrap: balance; overflow-wrap: anywhere; }
  h1 { font-size: 2rem; letter-spacing: -.035em; font-weight: 710; }
  h2 { font-size: 1.14rem; letter-spacing: -.015em; font-weight: 690; }
  h3 { font-size: 1rem; font-weight: 650; }
  .muted { color: var(--muted); }
  .small { font-size: .86rem; }
  .mono { font: .81rem/1.52 "Cascadia Code", Consolas, monospace; overflow-wrap: anywhere; }
  .icon { width: 18px; height: 18px; flex: none; vertical-align: middle; }
  .icon.small-icon { width: 15px; height: 15px; }
  :is(a,button,input,textarea,select,summary,[tabindex]):focus-visible {
    outline: 2px solid var(--focus); outline-offset: 3px;
  }
  .skip { position: fixed; top: 10px; left: 10px; z-index: var(--notice); transform: translateY(-160%); }
  .skip:focus { transform: none; }
  .shell { display: grid; grid-template-columns: var(--sidebar) minmax(0, 1fr); min-height: 100vh; }
  .rail {
    position: sticky; top: 0; height: 100vh; height: 100dvh; display: flex; flex-direction: column;
    align-items: stretch; gap: 32px; padding: 24px 15px 18px; background: var(--rail); color: var(--rail-ink);
  }
  .brand { color: var(--rail-ink); display: flex; align-items: center; gap: 11px; padding: 0 7px; font-weight: 710; }
  .brand-mark { width: 33px; height: 33px; display: grid; place-items: center; background: #294354; color: #9ce6d6; border-radius: 8px; }
  .brand-mark .icon { width: 21px; height: 21px; }
  .brand-name { letter-spacing: -.02em; white-space: nowrap; }
  .rail-nav { display: grid; gap: 4px; }
  .nav-link { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border-radius: 7px; color: var(--rail-muted); font-weight: 580; }
  .nav-link:hover { color: var(--rail-ink); background: #24384d; }
  .nav-link[aria-current="page"] { color: var(--rail-ink); background: var(--rail-selected); }
  .nav-link[aria-current="page"] .icon { color: var(--rail-highlight); }
  .rail :focus-visible { outline-color: #9ce6d6; }
  .rail-foot { margin-top: auto; padding-top: 11px; border-top: 1px solid var(--rail-line); }
  .rail-foot .arrow { margin-left: auto; width: 14px; height: 14px; }
  .rail-build { color: var(--rail-muted); padding: 10px 10px 0; font-size: .78rem; }
  .main { min-width: 0; }
  .top {
    min-height: var(--header); display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 10px 34px; border-bottom: 1px solid var(--line); background: var(--surface);
  }
  .crumb { display: flex; align-items: center; gap: 9px; min-width: 0; }
  .crumb .icon { width: 14px; height: 14px; color: var(--muted); }
  .top-actions { display: flex; align-items: center; gap: 14px; }
  .connection { display: inline-flex; gap: 6px; align-items: center; white-space: nowrap; }
  .dot { width: 7px; height: 7px; border-radius: 50%; display: inline-block; background: currentColor; }
  .connection[data-state="connected"] .dot { color: var(--teal); }
  .connection[data-state="error"] .dot { color: var(--bad); }
  .content { max-width: 1510px; margin: 0 auto; padding: 33px 34px 52px; min-width: 0; }
  .page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; margin-bottom: 24px; }
  .page-head p { margin-top: 8px; }
  .page-head .button { align-self: center; }
  .panel { border: 1px solid var(--line); background: var(--surface); border-radius: var(--r); min-width: 0; }
  .panel-head { display: flex; justify-content: space-between; gap: 14px; align-items: center; padding: 17px 19px; border-bottom: 1px solid var(--line); }
  .panel-head p { margin-top: 3px; }
  .panel-body { padding: 18px 19px; min-width: 0; }
  .stack { display: grid; gap: 17px; align-content: start; min-width: 0; }
  .split { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); align-items: start; gap: 18px; }
  .button {
    appearance: none; color: var(--ink); background: var(--surface); border: 1px solid var(--control);
    min-height: 37px; padding: 6px 11px; font: inherit; font-size: .88rem; font-weight: 650; border-radius: 7px;
    display: inline-flex; align-items: center; justify-content: center; gap: 7px; text-align: center; line-height: 1.22;
    text-decoration: none; cursor: pointer; transition: background var(--ease), color var(--ease), border-color var(--ease);
  }
  .button:hover, .button[aria-pressed="true"] { background: var(--hover); }
  .button[aria-pressed="true"] { color: var(--teal); border-color: var(--teal); }
  .button.primary { background: var(--teal-fill); color: var(--accent-ink); border-color: var(--teal-fill); }
  .button.primary:hover { background: var(--teal-hover); border-color: var(--teal-hover); }
  .button.quiet { background: transparent; border-color: transparent; color: var(--teal); }
  .button.quiet:hover { background: var(--hover); }
  .button.icon-button { width: 37px; padding: 0; }
  .button:disabled { opacity: .65; cursor: default; }
  .button:active:not(:disabled) { transform: translateY(1px); }
  .label { display: grid; gap: 5px; font-size: .88rem; font-weight: 630; min-width: 0; }
  :is(input:not([type=checkbox]),select,textarea) {
    min-width: 0; width: 100%; color: var(--ink); background: var(--surface); font: inherit; font-weight: 450;
    border: 1px solid var(--control); border-radius: 7px; padding: 8px 10px; min-height: 38px;
  }
  :is(input,textarea)::placeholder { color: var(--muted); opacity: 1; }
  textarea { resize: vertical; }
  .search-field { position: relative; min-width: 0; }
  .search-field > [data-icon] { position: absolute; bottom: 10px; left: 10px; color: var(--muted); pointer-events: none; line-height: 1; }
  .search-field input { padding-left: 34px; }
  .inline-check { display: flex; align-items: flex-start; gap: 7px; min-height: 28px; }
  .inline-check input { accent-color: var(--teal-fill); margin-top: 4px; }
  .form-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .filters { display: grid; grid-template-columns: minmax(180px, 1.7fr) repeat(3,minmax(100px,1fr)) auto; gap: 10px; align-items: end; }
  .filter-bar { display: flex; align-items: end; gap: 10px; flex-wrap: wrap; }
  .filter-bar .label { flex: 1 1 155px; }
  .status { padding: 13px 17px; border: 1px solid var(--line); border-radius: 7px; display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; background: var(--surface); }
  .status.error { background: var(--bad-bg); color: var(--bad); border-color: transparent; }
  .status.error .button { color: var(--bad); }
  .status.error .button:hover { background: var(--surface); }
  .blank { display: grid; gap: 6px; padding: 29px 19px; }
  .blank > .icon { color: var(--teal); margin-bottom: 4px; }
  .blank a { justify-self: start; margin-top: 4px; }
  .skeleton { display: grid; gap: 12px; padding: 19px; }
  .skeleton i { width: 82%; height: 12px; display: block; border-radius: 4px; background: var(--skeleton); }
  .skeleton i:nth-child(2) { width: 63%; }
  .skeleton i:nth-child(3) { width: 71%; }
  .tag {
    background: var(--inset); color: var(--muted); padding: 3px 7px; border-radius: 5px;
    font-size: .79rem; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere;
  }
  .tag.project { background: var(--project-bg); color: var(--project); }
  .tag.agent { background: var(--agent-bg); color: var(--agent); }
  .tag.memory { background: var(--memory-bg); color: var(--memory); }
  .tags { display: flex; align-items: center; flex-wrap: wrap; gap: 5px 7px; }
  .summary {
    display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); background: var(--surface);
    border: 1px solid var(--line); border-radius: var(--r); margin-bottom: 18px;
  }
  .summary-item { display: flex; align-items: center; gap: 13px; min-width: 0; padding: 18px 19px; }
  .summary-item + .summary-item { border-left: 1px solid var(--line); }
  .tile-icon { display: grid; place-items: center; width: 37px; height: 37px; border-radius: 7px; flex: none; background: var(--tint); color: var(--teal); }
  .summary dt { color: var(--muted); font-size: .84rem; font-weight: 600; }
  .summary dd { font-size: 1.3rem; font-weight: 700; line-height: 1.12; font-variant-numeric: tabular-nums; margin-top: 4px; }
  .list { list-style: none; padding: 0; }
  .list > li + li { border-top: 1px solid var(--line); }
  .project-row { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(65px,.55fr) auto; align-items: center; gap: 12px; padding: 12px 19px; }
  .project-name { display: flex; gap: 7px; align-items: center; min-width: 0; font-weight: 650; overflow-wrap: anywhere; }
  .project-name:hover { text-decoration: underline; }
  .project-detail { margin: 3px 0 0 22px; }
  .project-count { color: var(--muted); font-size: .81rem; text-align: right; font-variant-numeric: tabular-nums; }
  .project-meter { display: block; width: 100%; height: 5px; margin-top: 4px; border-radius: 3px; overflow: hidden; background: var(--inset); }
  .project-meter span { display: block; height: 100%; background: var(--teal); border-radius: inherit; opacity: .75; }
  .event { display: grid; grid-template-columns: 27px minmax(0,1fr) auto; gap: 9px; align-items: start; padding: 12px 19px; }
  .event .tile-icon { width: 26px; height: 26px; }
  .event strong { display: block; font-size: .89rem; font-weight: 630; overflow-wrap: anywhere; }
  .event time { color: var(--muted); font-size: .77rem; }
  .event-meta { margin-top: 2px; }
  .overview-memory { display: grid; gap: 5px; padding: 12px 19px; }
  .overview-memory strong { overflow-wrap: anywhere; }
  .toolbar-end { margin-left: auto; }
  .list-footer { border-top: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 18px; }
  .memory-row { padding: 14px 19px; display: grid; gap: 8px; }
  .memory-head { display: flex; justify-content: space-between; align-items: start; gap: 10px; }
  .memory-head time { white-space: nowrap; }
  .memory-row p { max-width: 90ch; white-space: pre-wrap; }
  .memory-row details summary { color: var(--teal); font-size: .85rem; font-weight: 650; cursor: pointer; width: fit-content; max-width: 100%; }
  .memory-row details ul { padding-left: 19px; margin-top: 4px; }
  .memory-row details li { overflow-wrap: anywhere; }
  .source { display: flex; align-items: baseline; gap: 6px; color: var(--muted); min-width: 0; }
  .source .icon { align-self: center; }
  .graph-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(225px, 27%); min-width: 0; }
  .graph-stage { position: relative; min-width: 0; height: 480px; background: var(--canvas); overflow: hidden; }
  #graph-svg { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; user-select: none; }
  #graph-svg.dragging { cursor: grabbing; }
  .cluster-area { fill: var(--project-bg); fill-opacity: .49; stroke: var(--graph-project); stroke-opacity: .25; }
  .graph-node { color: var(--memory); cursor: pointer; }
  .graph-node.project { color: var(--project); }
  .graph-node.agent { color: var(--agent); }
  .graph-node .node-surface { fill: var(--surface); stroke: var(--line); stroke-width: 1.25; }
  .graph-node.project .node-surface { fill: var(--project-bg); stroke: var(--graph-project); }
  .graph-node.agent .node-surface { fill: var(--agent-bg); stroke: var(--graph-agent); }
  .graph-node.dot-node .node-surface { stroke: var(--memory); }
  .graph-node .node-glyph { fill: currentColor; }
  .graph-node text { fill: var(--ink); font-size: 12px; font-weight: 600; }
  .graph-node .node-count { fill: var(--muted); font-size: 11px; font-weight: 550; }
  .graph-node:is(:hover,:focus-visible,[aria-pressed="true"]) .node-surface { stroke: currentColor; stroke-width: 2.2; }
  .graph-node.dot-node:is(:hover,:focus-visible,[aria-pressed="true"]) .node-surface { fill: var(--memory-bg); }
  .graph-node:focus-visible { outline: none; }
  .graph-node.unrelated { opacity: .34; }
  .graph-edge { fill: none; stroke: var(--graph-line); stroke-width: 1.15; opacity: .53; }
  .graph-edge.project-edge { stroke: var(--graph-project); }
  .graph-edge.agent-edge { stroke: var(--graph-agent); stroke-dasharray: 4 3; opacity: .35; }
  .graph-edge.active { stroke: var(--teal); stroke-width: 2.1; opacity: 1; }
  .graph-edge.agent-edge.active { stroke: var(--agent); }
  .graph-edge.unrelated { opacity: .13; }
  .graph-tooltip { pointer-events: none; }
  .graph-tooltip rect { fill: var(--surface); stroke: var(--memory); }
  .graph-tooltip text { fill: var(--ink); font-size: 12px; font-weight: 650; }
  .graph-tools { position: absolute; bottom: 12px; left: 12px; display: flex; gap: 5px; align-items: center; }
  .graph-tools .button { min-height: 32px; }
  .graph-tools .icon-button { width: 32px; }
  .graph-tools output { padding: 4px 6px; background: var(--surface); color: var(--muted); border-radius: 5px; }
  .graph-inspector { min-width: 0; border-left: 1px solid var(--line); max-height: 480px; overflow-y: auto; }
  .graph-inspector .panel-body { display: grid; gap: 11px; }
  .graph-inspector p { white-space: pre-wrap; }
  .related { display: grid; gap: 5px; }
  .related .button { justify-content: start; overflow-wrap: anywhere; text-align: left; }
  .legend { display: flex; align-items: center; flex-wrap: wrap; gap: 7px 14px; padding: 11px 18px; border-top: 1px solid var(--line); color: var(--muted); font-size: .82rem; }
  .legend > span { display: inline-flex; align-items: center; gap: 5px; }
  .legend-glyph { display: inline-block; width: 9px; height: 9px; background: currentColor; flex: none; }
  .legend-glyph.project { border-radius: 2px; color: var(--project); }
  .legend-glyph.agent { border-radius: 50%; color: var(--agent); }
  .legend-glyph.memory { width: 7px; height: 7px; transform: rotate(45deg); color: var(--memory); margin-right: 2px; }
  .legend-line { display: inline-block; width: 16px; border-top: 2px solid var(--graph-line); }
  .legend-line.project-edge { border-color: var(--graph-project); }
  .legend-line.agent-edge { border-color: var(--graph-agent); border-top-style: dashed; }
  .graph-list { min-width: 0; max-height: 480px; overflow-y: auto; }
  .graph-list .graph-row { padding: 9px 12px; }
  .graph-list .button { justify-content: flex-start; text-align: left; width: 100%; }
  .graph-row .tag { margin-left: auto; }
  .context-layout { grid-template-columns: minmax(250px,.9fr) minmax(0,1.35fr); }
  .context-config { display: grid; gap: 12px; }
  .context-preview { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--inset); border-radius: 7px; padding: 13px; margin: 0; max-height: 420px; overflow: auto; }
  .context-reasons { display: grid; gap: 10px; }
  .context-reasons summary { cursor: pointer; font-weight: 650; }
  .context-reasons li { padding: 8px 0; }
  .context-reasons li strong { overflow-wrap: anywhere; }
  .context-reasons li p { margin-top: 2px; }
  .settings { max-width: 930px; }
  .setting { display: flex; align-items: center; justify-content: space-between; gap: 15px; padding: 16px 19px; }
  .setting p { margin-top: 4px; }
  .switch { display: inline-flex; align-items: center; justify-content: end; gap: 7px; min-width: 87px; min-height: 36px; border-color: transparent; background: transparent; }
  .switch-track { width: 32px; height: 18px; border-radius: 11px; position: relative; background: var(--control); }
  .switch-track::after {
    content: ""; width: 12px; height: 12px; position: absolute; left: 3px; top: 3px; border-radius: 50%;
    background: white; transition: transform var(--ease);
  }
  .switch[aria-checked="true"] .switch-track { background: var(--teal-fill); }
  .switch[aria-checked="true"] .switch-track::after { transform: translateX(14px); background: var(--accent-ink); }
  .setting select { width: 131px; flex: none; }
  .save-status { padding: 8px 19px; min-height: 35px; border-top: 1px solid var(--line); }
  .save-status[data-error="true"] { color: var(--bad); }
  .notice { margin: 0 0 16px; }
  .entered { animation: enter var(--ease) both; }
  @keyframes enter { from { opacity: .7; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
  html[data-motion="reduce"] *, html[data-motion="reduce"] *::before, html[data-motion="reduce"] *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
  @media (max-width: 1140px) {
    :root { --sidebar: 188px; }
    .top, .content { padding-left: 24px; padding-right: 24px; }
    .filters { grid-template-columns: repeat(3,minmax(0,1fr)); }
    .filters .search-field { grid-column: span 2; }
    .filters .button { grid-column: 3; grid-row: 1; }
    .overview-columns { grid-template-columns: minmax(0,1.25fr) minmax(0,1fr); }
    .event { grid-template-columns: 27px minmax(0,1fr); }
    .event time { grid-column: 2; }
  }
  @media (max-width: 900px) {
    :root { --sidebar: 66px; }
    .rail { padding-left: 10px; padding-right: 10px; }
    .rail .brand { justify-content: center; padding: 0; }
    .nav-link { justify-content: center; min-height: 41px; }
    .brand-name, .nav-label, .rail-foot .arrow, .rail-build { display: none; }
    .context-layout { grid-template-columns: minmax(0,1fr); }
  }
  @media (max-width: 690px) {
    :root { --header: 48px; font-size: 14px; }
    .shell { display: block; }
    .rail { z-index: var(--sticky); height: auto; flex-direction: row; align-items: center; gap: 7px; padding: 5px 10px; }
    .rail-nav { display: flex; gap: 3px; }
    .nav-link { padding: 7px 9px; min-height: 35px; }
    .rail-foot { margin: 0 0 0 auto; padding: 0; border: 0; }
    .brand-mark { width: 30px; height: 30px; }
    .top { padding: 7px 13px; }
    .top-actions { gap: 8px; }
    .content { padding: 22px 12px 32px; }
    h1 { font-size: 1.68rem; }
    .page-head { gap: 8px; margin-bottom: 17px; flex-wrap: wrap; }
    .summary { margin-bottom: 13px; }
    .summary-item { gap: 6px; padding: 11px 9px; }
    .summary-item .tile-icon { display: none; }
    .split { grid-template-columns: minmax(0,1fr); gap: 13px; }
    .graph-body { grid-template-columns: minmax(0,1fr); }
    .graph-stage, .graph-list { height: 365px; }
    .graph-inspector { border-left: 0; border-top: 1px solid var(--line); max-height: 340px; }
    .panel-head, .panel-body, .memory-row, .setting { padding-left: 12px; padding-right: 12px; }
    .project-row, .event { padding-left: 12px; padding-right: 12px; }
    .list-footer { flex-wrap: wrap; }
    .graph-mode { margin-left: 0; }
  }
  @media (max-width: 355px) {
    .rail { gap: 3px; }
    .nav-link { padding-left: 7px; padding-right: 7px; }
    .crumb > .muted, .crumb .icon { display: none; }
    .filters { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .filters .search-field { grid-column: 1 / -1; }
    .filters .button { grid-row: auto; grid-column: auto; }
  }
</style>
</head>
<body>
<a class="skip button" href="#main-content">Skip to content</a>
<div class="shell">
  <aside class="rail">
    <a class="brand" href="#overview" aria-label="Shadow Brain overview">
      <span class="brand-mark" data-icon="brand"></span><span class="brand-name">Shadow Brain</span>
    </a>
    <nav class="rail-nav" aria-label="Workspace">
      <a class="nav-link" href="#overview" aria-label="Overview" title="Overview" data-view="overview" aria-current="page"><span data-icon="overview"></span><span class="nav-label">Overview</span></a>
      <a class="nav-link" href="#memories" aria-label="Memories" title="Memories" data-view="memories"><span data-icon="memory"></span><span class="nav-label">Memories</span></a>
      <a class="nav-link" href="#graph" aria-label="Graph" title="Graph" data-view="graph"><span data-icon="graph"></span><span class="nav-label">Graph</span></a>
      <a class="nav-link" href="#context" aria-label="Context" title="Context" data-view="context"><span data-icon="context"></span><span class="nav-label">Context</span></a>
      <a class="nav-link" href="#features" aria-label="Features" title="Features" data-view="features"><span data-icon="settings"></span><span class="nav-label">Features</span></a>
    </nav>
    <div class="rail-foot">
      <a class="nav-link" href="/advanced" aria-label="Advanced dashboard" title="Advanced dashboard"><span data-icon="advanced"></span><span class="nav-label">Advanced tools</span><span class="arrow" data-icon="diagonal"></span></a>
      <p class="rail-build" id="rail-version">Local workspace</p>
    </div>
  </aside>
  <div class="main">
    <header class="top">
      <div class="crumb"><span class="muted">Workspace</span><span data-icon="chevron"></span><strong id="crumb">Overview</strong></div>
      <div class="top-actions">
        <span class="connection muted small" id="connection" data-state="loading"><span class="dot"></span><span id="connection-label">Connecting</span></span>
        <button type="button" class="button icon-button quiet" id="theme-toggle" aria-label="Switch to dark theme" title="Switch to dark theme"><span data-icon="moon"></span></button>
      </div>
    </header>
    <main id="main-content" class="content" tabindex="-1">
      <div class="notice" id="workspace-notice" role="status" hidden></div>
      <section id="page-overview" aria-labelledby="title-overview">
        <div class="page-head">
          <div><h1 id="title-overview" tabindex="-1">Overview</h1><p class="muted">See what your agents remember and what they’ve done recently.</p></div>
          <a href="#context" class="button primary"><span data-icon="context"></span>Assemble context</a>
        </div>
        <div id="overview-body" aria-busy="true"></div>
      </section>
      <section id="page-memories" aria-labelledby="title-memories" hidden>
        <div class="page-head"><div><h1 id="title-memories" tabindex="-1">Memories</h1><p class="muted">Search saved lessons and see why they were recalled.</p></div></div>
        <div class="stack">
          <form id="memory-form" class="panel panel-body filters" role="search" aria-label="Search memories">
            <label class="label search-field" for="memory-query">Search<span data-icon="search"></span><input id="memory-query" type="search" maxlength="500" placeholder="Search memories"></label>
            <label class="label" for="memory-project">Project<select id="memory-project"><option value="">All projects</option></select></label>
            <label class="label" for="memory-category">Category<select id="memory-category"><option value="">All categories</option></select></label>
            <label class="label" for="memory-agent">Agent<select id="memory-agent"><option value="">All agents</option></select></label>
            <button class="button primary" id="memory-search" type="submit"><span data-icon="search"></span>Search</button>
          </form>
          <div id="memory-results" class="panel" aria-busy="true"></div>
        </div>
      </section>
      <section id="page-graph" aria-labelledby="title-graph" hidden>
        <div class="page-head"><div><h1 id="title-graph" tabindex="-1">Graph</h1><p class="muted">Explore how stored memories connect to projects and agents.</p></div></div>
        <div class="stack">
          <div class="panel panel-body filter-bar">
            <label class="label search-field" for="graph-query">Find a node<span data-icon="search"></span><input id="graph-query" type="search" maxlength="200" placeholder="Filter by name"></label>
            <label class="label" for="graph-project">Project<select id="graph-project"><option value="">All projects</option></select></label>
            <label class="label" for="graph-kind">Node type<select id="graph-kind"><option value="">All types</option><option value="project">Projects</option><option value="agent">Agents</option><option value="memory">Memories</option></select></label>
            <div class="form-actions toolbar-end graph-mode" role="group" aria-label="Graph view">
              <button type="button" class="button" id="graph-mode-map" aria-pressed="true"><span data-icon="graph"></span>Map</button>
              <button type="button" class="button" id="graph-mode-list" aria-pressed="false"><span data-icon="list"></span>List</button>
            </div>
          </div>
          <div class="panel" id="graph-panel" aria-busy="true">
            <div class="panel-head"><h2>Memory relationships</h2><span id="graph-count" class="muted small" role="status"></span></div>
            <div id="graph-status"></div>
            <div class="graph-body" id="graph-body" hidden>
              <div class="graph-stage" id="graph-stage">
                <svg id="graph-svg" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Memory relationship map. Use arrow keys to navigate nodes."></svg>
                <div class="graph-tools" role="group" aria-label="Map zoom">
                  <button class="button icon-button" type="button" id="graph-out" aria-label="Zoom out" title="Zoom out"><span data-icon="minus"></span></button>
                  <button class="button icon-button" type="button" id="graph-in" aria-label="Zoom in" title="Zoom in"><span data-icon="plus"></span></button>
                  <button class="button" type="button" id="graph-fit">Fit</button>
                  <output id="graph-scale" class="small" aria-label="Zoom level">100%</output>
                </div>
              </div>
              <div id="graph-list" class="graph-list" hidden></div>
              <aside id="graph-inspector" class="graph-inspector" aria-label="Selected node details"></aside>
            </div>
            <div id="graph-legend" class="legend" hidden>
              <span><i class="legend-glyph project"></i> Project</span><span><i class="legend-glyph agent"></i> Agent</span><span><i class="legend-glyph memory"></i> Memory</span>
              <span><i class="legend-line project-edge"></i> Belongs to project</span><span><i class="legend-line agent-edge"></i> Recorded by agent</span>
            </div>
          </div>
        </div>
      </section>
      <section id="page-context" aria-labelledby="title-context" hidden>
        <div class="page-head"><div><h1 id="title-context" tabindex="-1">Context</h1><p class="muted">Build a project brief for a specific task and review what it includes.</p></div></div>
        <div class="split context-layout">
          <div class="panel">
            <div class="panel-head"><h2>Task details</h2></div>
            <form class="panel-body context-config" id="context-form">
              <label class="label" for="context-project">Project<select id="context-project" required><option value="">Select a project</option></select></label>
              <label class="label" for="context-task">Task<textarea id="context-task" rows="5" maxlength="4096" required placeholder="Describe what the agent will work on."></textarea></label>
              <label class="label" for="context-budget">Estimated token budget<input id="context-budget" type="number" inputmode="numeric" min="0" max="12000" step="1" value="2000" required></label>
              <label class="inline-check small" id="context-cross-row" hidden><input type="checkbox" id="context-cross">Include eligible memories from other projects</label>
              <div id="context-gate"></div>
              <div class="form-actions"><button class="button primary" id="context-submit" type="submit" disabled><span data-icon="context"></span>Assemble context</button></div>
            </form>
          </div>
          <div class="panel" id="context-result"><div class="panel-head"><h2>Context preview</h2></div><div id="context-output"></div></div>
        </div>
      </section>
      <section id="page-features" aria-labelledby="title-features" hidden>
        <div class="page-head"><div><h1 id="title-features" tabindex="-1">Features</h1><p class="muted">Control how Shadow Brain assembles context and updates the workspace.</p></div></div>
        <div class="stack settings">
          <div class="panel"><div class="panel-head"><h2>Workspace features</h2></div><div id="feature-list" aria-busy="true"></div><p class="save-status small muted" role="status" id="feature-status"></p></div>
          <div class="panel">
            <div class="panel-head"><h2>Display</h2></div>
            <ul class="list">
              <li class="setting"><div><h3><label for="theme-setting">Theme</label></h3><p class="small muted">Choose the workspace color scheme on this device.</p></div><select id="theme-setting"><option value="light">Light</option><option value="dark">Dark</option></select></li>
              <li class="setting"><div><h3><label for="motion-setting">Motion</label></h3><p class="small muted">Follow your system preference or reduce interface motion.</p></div><select id="motion-setting"><option value="system">System</option><option value="reduce">Reduced</option></select></li>
            </ul>
            <p id="display-status" class="save-status small muted" role="status" hidden></p>
          </div>
        </div>
      </section>
    </main>
  </div>
</div>
<script>
'use strict';

const glyphs = {
  brand: '<path d="M12 5 5 9v6l7 4 7-4V9l-7-4v7m-7-3 7 3 7-3m-7 3v7"/><circle cx="12" cy="5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="19" r="1.4" fill="currentColor"/>',
  overview: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17m-11 0V20"/>',
  memory: '<path d="M4 7.5h16M6 7.5v11a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5v-11M9 12h6"/><rect x="3" y="4" width="18" height="4" rx="1"/>',
  graph: '<path d="m6 6 6 6m0 0 6-6m-6 6v6"/><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  context: '<path d="M9 8h6m-6 4h6m-6 4h4M6 3h9l4 4v14H6zM15 3v5h4"/>',
  settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.4" fill="var(--icon-bg, var(--rail))"/><circle cx="15" cy="17" r="2.4" fill="var(--icon-bg, var(--rail))"/>',
  advanced: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="m7.5 9 3 3-3 3m5.5 0h3.5"/>',
  diagonal: '<path d="M6 18 18 6M8 6h10v10"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="m14 6-6 6 6 6"/>',
  moon: '<path d="M20 15a8.5 8.5 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19m0-14-1.5 1.5m-11 11L5 19"/>',
  project: '<path d="M3.5 7V6A1.5 1.5 0 0 1 5 4.5h4l2 2h8A1.5 1.5 0 0 1 20.5 8v10A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18Z"/>',
  agent: '<rect x="4.5" y="7" width="15" height="12" rx="3"/><path d="M12 7V4m-8 9H2m20 0h-2m-11-.5h.02m5.98 0H15m-5 3h4"/>',
  activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
  source: '<path d="M9.5 14.5 14.5 9m-6 8.5-1 1a3.5 3.5 0 0 1-5-5L7 9a3.5 3.5 0 0 1 5 0m3.5-2.5 1-1a3.5 3.5 0 0 1 5 5L17 15a3.5 3.5 0 0 1-5 0"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  warning: '<path d="m12 3 10 17H2L12 3zm0 6v4m0 3h.01"/>',
  refresh: '<path d="M19.5 9a8 8 0 1 0 .3 5.5M20 4v5h-5"/>'
};
const viewNames = { overview: 'Overview', memories: 'Memories', graph: 'Graph', context: 'Context', features: 'Features' };
const definitions = [
  { id: 'contextAssembly', label: 'Context assembly', description: 'Build a task-specific brief from saved project memories.' },
  { id: 'crossProjectContext', label: 'Cross-project context', description: 'Allow context assembly to include eligible memories from other projects when requested.' },
  { id: 'automaticBriefing', label: 'Automatic briefing', description: 'Include a context brief when a supported agent starts work in a project.' },
  { id: 'liveActivity', label: 'Live activity', description: 'Refresh the workspace activity feed automatically.' }
];
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = (name, small = false) => '<svg class="icon' + (small ? ' small-icon' : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (glyphs[name] || '') + '</svg>';
const list = (value) => Array.isArray(value) ? value : [];
const compact = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
const shorten = (value, limit) => value.length > limit ? value.slice(0, limit - 1) + '…' : value;
const number = (value) => Number(value || 0).toLocaleString();
const countLabel = (value, singular, plural = singular + 's') => number(value) + ' ' + (Number(value) === 1 ? singular : plural);
const nice = (value) => String(value ?? '').replace(/[-_]/g, ' ').replace(/^./, (char) => char.toUpperCase());
const tags = (items) => '<div class="tags">' + items.filter(([, value]) => value).map(([kind, value]) =>
  '<span class="tag ' + esc(kind) + '">' + esc(value) + '</span>').join('') + '</div>';
const DATE = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const TIME = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const state = {
  view: '', projects: [], overviewLoaded: false, overviewPending: null,
  activity: [], activityEnabled: null, activityPending: false, features: null, featurePending: null, featureSaving: false,
  memory: { query: null, request: 0, controller: null, limit: 20, offset: 0 },
  graph: { snapshot: null, project: null, mode: matchMedia('(max-width: 690px)').matches ? 'list' : 'map', selected: '', nodes: [], edges: [], layout: null, zoom: 1, panX: 0, panY: 0, request: 0, controller: null, drag: null },
  context: { pack: null, pending: false, dirty: false }
};

document.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = icon(element.dataset.icon); });

function dateMarkup(value, full = false) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const today = new Date();
  const dateText = full || date.getFullYear() !== today.getFullYear() ? DATE.format(date) : TIME.format(date);
  return '<time class="small muted" datetime="' + esc(date.toISOString()) + '" title="' + esc(date.toLocaleString()) + '">' + esc(dateText) + '</time>';
}

function blank(iconName, title, detail, action = '') {
  return '<div class="blank">' + icon(iconName) + '<h3>' + esc(title) + '</h3><p class="small muted">' + esc(detail) + '</p>' + action + '</div>';
}

function skeleton(label) {
  return '<div class="skeleton" role="status"><span class="muted small">' + esc(label) + '</span><i></i><i></i><i></i></div>';
}

function errorMarkup(message, retry) {
  return '<div class="status error" role="alert">' + icon('warning') + '<span>' + esc(message) + '</span>' +
    (retry ? '<button class="button quiet" data-retry="' + retry + '" type="button">Try again</button>' : '') + '</div>';
}

function setBusy(element, isBusy) {
  element.setAttribute('aria-busy', String(isBusy));
}

function connection(value) {
  $('connection').dataset.state = value;
  $('connection-label').textContent = value === 'connected' ? 'Local server' : value === 'error' ? 'Disconnected' : 'Connecting';
}

async function api(path, { body, signal } = {}) {
  let response;
  try {
    response = await fetch('/api/workspace/' + path, {
      headers: body ? { Accept: 'application/json', 'Content-Type': 'application/json' } : { Accept: 'application/json' },
      method: body ? 'POST' : 'GET',
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: signal || AbortSignal.timeout(12000)
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    connection('error');
    throw new Error('Could not reach the local Shadow Brain server.');
  }
  connection('connected');
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const error = new Error(response.ok ? 'The server returned an unreadable response.' : data?.error || 'The server could not complete this request.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function optionSet(id, placeholder, values, preferred) {
  const select = $(id);
  const previous = preferred ?? select.value;
  const choices = values.filter((item) => item && item.id);
  const signature = JSON.stringify(choices);
  if (select.dataset.signature !== signature) {
    select.replaceChildren(new Option(placeholder, ''), ...choices.map((item) => new Option(item.name || item.id, item.id)));
    select.dataset.signature = signature;
  }
  if (previous && Array.from(select.options).some((option) => option.value === previous)) select.value = previous;
  else select.value = '';
}

function queryPath(name, params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== '' && value != null) search.set(key, String(value)); });
  return name + (search.size ? '?' + search : '');
}

function routeLink(view, params) {
  return '#' + queryPath(view, params);
}

function renderSummary(totals) {
  return '<dl class="summary">' + [
    ['memory', 'Stored memories', totals.memories], ['project', 'Projects', totals.projects], ['agent', 'Contributing agents', totals.agents]
  ].map(([image, label, value]) => '<div class="summary-item"><span class="tile-icon">' + icon(image) +
    '</span><div><dt>' + label + '</dt><dd>' + number(value) + '</dd></div></div>').join('') + '</dl>';
}

function renderProjects(projects) {
  if (!projects.length) return blank('project', 'No projects yet', 'Projects appear after an agent stores a memory with a project scope.');
  const max = Math.max(1, ...projects.map((project) => Number(project.memories) || 0));
  return '<ul class="list">' + [...projects].sort((a, b) => b.memories - a.memories).slice(0, 8).map((project) => {
    const size = Math.max(0, Math.min(100, Math.round((Number(project.memories) || 0) / max * 100)));
    const href = routeLink('memories', { project: project.id });
    return '<li class="project-row"><div><a class="project-name" href="' + esc(href) + '">' + icon('project', true) +
      '<span>' + esc(project.name || project.id) + '</span></a>' +
      (project.updatedAt ? '<div class="project-detail">' + dateMarkup(project.updatedAt, true) + '</div>' : '') +
      '</div><div class="project-count">' + countLabel(project.memories, 'memory', 'memories') +
      '<span class="project-meter" aria-hidden="true"><span style="width:' + size + '%"></span></span></div>' +
      '<a class="button icon-button quiet" aria-label="' + esc('View memories for ' + (project.name || project.id)) + '" href="' + esc(href) + '">' + icon('chevron') + '</a></li>';
  }).join('') + '</ul>';
}

function renderOverviewMemories(memories) {
  if (!memories.length) return '';
  return '<div class="panel"><div class="panel-head"><h2>Latest memories</h2><a class="button quiet" href="#memories">Browse ' + icon('chevron', true) +
    '</a></div><ul class="list">' + memories.map((item) => '<li class="overview-memory"><div class="memory-head"><strong>' +
    esc(item.title || nice(item.category) || 'Memory') + '</strong>' + dateMarkup(item.updatedAt, true) + '</div>' +
    tags([['project', item.projectName || item.project], ['agent', item.agent], ['memory', nice(item.category)]]) + '</li>').join('') + '</ul></div>';
}

function renderActivity() {
  const target = $('activity-body');
  if (!target) return;
  const enabled = state.activityEnabled;
  $('activity-status').textContent = enabled === true ? 'Live' : enabled === false ? 'Paused' : '';
  if (enabled === false) {
    target.innerHTML = blank('activity', 'Live activity is paused', 'Turn it back on in Features to see recent events.',
      '<a class="button quiet" href="#features">Open Features ' + icon('chevron', true) + '</a>');
    return;
  }
  if (!state.activity.length) {
    target.innerHTML = blank('activity', 'No recent activity', 'Memory and agent events appear here as work happens.');
    return;
  }
  target.innerHTML = '<ul class="list">' + state.activity.slice(0, 8).map((event) => {
    const image = String(event.type ?? '').includes('memory') ? 'memory' : 'activity';
    const meta = [event.agent, event.project].filter(Boolean).join(' · ');
    return '<li class="event"><span class="tile-icon">' + icon(image, true) + '</span><div><strong>' +
      esc(event.label || nice(event.type) || 'Activity') + '</strong>' +
      (meta ? '<p class="event-meta small muted">' + esc(meta) + '</p>' : '') + '</div>' + dateMarkup(event.timestamp) + '</li>';
  }).join('') + '</ul>';
}

function renderOverview(data) {
  const sample = data.truncated ? '<p class="status small muted notice">Project and agent counts reflect the latest ' +
    number(data.inventoryLimit) + ' stored memories.</p>' : '';
  const pending = data.storageHealth?.status === 'pending' ? '<p class="status small muted notice">The memory store has pending writes.</p>' : '';
  const projectNote = state.projects.length > 8 ? 'Top projects by saved memory count' : 'Saved memories by project';
  $('overview-body').innerHTML = '<div id="overview-refresh"></div>' + pending + sample + renderSummary(data.totals || {}) +
    '<div class="split overview-columns"><div class="stack"><div class="panel"><div class="panel-head"><div><h2>Project inventory</h2>' +
    '<p class="muted small">' + projectNote + '</p></div><a class="button quiet" href="#memories">Browse ' + icon('chevron', true) +
    '</a></div>' + renderProjects(state.projects) + '</div>' + renderOverviewMemories(list(data.recentMemories)) +
    '</div><div class="panel"><div class="panel-head"><h2>Recent activity</h2><span id="activity-status" class="small muted"></span></div><div id="activity-body"></div></div></div>';
  renderActivity();
}

function syncProjectOptions() {
  const contextProject = $('context-project').value;
  const graphProject = state.view === 'graph' ? routeParams().get('project') : null;
  optionSet('context-project', 'Select a project', state.projects, contextProject || routeParams().get('project'));
  optionSet('graph-project', 'All projects', state.projects, $('graph-project').value || graphProject);
}

async function loadOverview(force = false) {
  if (state.overviewPending) return state.overviewPending;
  if (state.overviewLoaded && !force) return;
  const target = $('overview-body');
  if (!state.overviewLoaded) target.innerHTML = '<div class="panel">' + skeleton('Loading workspace…') + '</div>';
  setBusy(target, true);
  state.overviewPending = (async () => {
    try {
      const data = await api('overview');
      state.overviewLoaded = true;
      state.projects = list(data.projects);
      state.activity = list(data.activity);
      if (typeof data.features?.liveActivity === 'boolean') state.activityEnabled = data.features.liveActivity;
      if (data.version) $('rail-version').textContent = 'Version ' + data.version;
      syncProjectOptions();
      renderOverview(data);
      renderContextControls();
    } catch (error) {
      if (!state.overviewLoaded) target.innerHTML = errorMarkup(error.message, 'overview');
      else $('overview-refresh').innerHTML = '<div class="notice">' + errorMarkup('Could not refresh the workspace. Showing the last loaded overview.', 'overview') + '</div>';
      renderContextControls();
    } finally {
      setBusy(target, false);
      state.overviewPending = null;
    }
  })();
  return state.overviewPending;
}

async function refreshActivity() {
  if (document.hidden || state.view !== 'overview' || state.activityEnabled === false || state.activityPending || !state.overviewLoaded) return;
  state.activityPending = true;
  try {
    const data = await api('activity');
    if (state.features?.features?.liveActivity === false) return;
    state.activityEnabled = data.enabled;
    state.activity = list(data.activity);
    renderActivity();
  } catch {
    const status = $('activity-status');
    if (status) status.textContent = 'Refresh unavailable';
  } finally {
    state.activityPending = false;
  }
}

function sourceMarkup(values) {
  const sources = Array.from(new Set(list(values).filter((source) => typeof source === 'string' && source.trim())));
  if (!sources.length) return '<p class="source small">' + icon('source', true) + '<span>No source recorded</span></p>';
  return sources.map((source) => '<p class="source small">' + icon('source', true) + '<span class="mono">' + esc(source) + '</span></p>').join('');
}

function memoryQuery() {
  return {
    q: $('memory-query').value.trim(),
    project: $('memory-project').value,
    category: $('memory-category').value,
    agent: $('memory-agent').value
  };
}

function renderMemories(data) {
  const target = $('memory-results');
  const items = list(data.items);
  const total = Number.isFinite(data.total) ? data.total : items.length;
  const { offset } = state.memory;
  const activeFilters = Object.values(state.memory.query || {}).some(Boolean);
  const subtitle = state.memory.query?.q ? 'Ranked search results' : 'Most recent first';
  const heading = '<div class="panel-head"><div><h2>' + esc(activeFilters ? 'Results' : 'Recent memories') +
    '</h2><p class="small muted">' + subtitle + '</p></div><span class="small muted" role="status">' + countLabel(total, 'memory', 'memories') + '</span></div>' +
    (data.truncated ? '<p class="panel-body small muted">Filters and counts may be limited to ' + number(data.inventoryLimit) + ' memories.</p>' : '');
  if (!items.length) {
    target.innerHTML = heading + (activeFilters
      ? blank('search', 'No matching memories', 'Try a different query or clear one of the filters.', '<button class="button quiet" data-memory-clear type="button">Clear filters</button>')
      : blank('memory', 'No memories yet', 'Saved memories appear here after an agent stores a lesson or observation.'));
    return;
  }
  target.innerHTML = heading + '<ul class="list">' + items.map((item) => {
    const title = item.title || nice(item.category) || 'Memory';
    const reasons = list(item.reasons);
    const detail = reasons.length ? '<details><summary>Why this matched</summary><ul class="small muted">' +
      reasons.map((reason) => '<li>' + esc(reason) + '</li>').join('') + '</ul></details>' : '';
    const snippet = compact(item.snippet) && compact(item.snippet) !== compact(title) ? '<p>' + esc(item.snippet) + '</p>' : '';
    return '<li class="memory-row"><div class="memory-head"><h3>' + esc(title) + '</h3>' + dateMarkup(item.updatedAt, true) + '</div>' +
      tags([['project', item.projectName || item.project], ['agent', item.agent], ['memory', nice(item.category)]]) + snippet +
      sourceMarkup([...list(item.sources), item.source]) + detail + '</li>';
  }).join('') + '</ul>' + (offset || total > items.length ? '<div class="list-footer"><span class="muted small">' +
    number(offset + 1) + '–' + number(offset + items.length) + ' of ' + number(total) + '</span><div class="form-actions">' +
    '<button type="button" class="button" data-memory-page="prev"' + (offset ? '' : ' disabled') + '>' + icon('left', true) +
    'Previous</button><button type="button" class="button" data-memory-page="next"' + (offset + items.length < total ? '' : ' disabled') +
    '>Next' + icon('chevron', true) + '</button></div></div>' : '');
}

async function loadMemories(query, offset = 0) {
  const target = $('memory-results');
  const store = state.memory;
  const seq = ++store.request;
  store.controller?.abort();
  const controller = new AbortController();
  store.controller = controller;
  store.query = query;
  store.offset = offset;
  setBusy(target, true);
  target.innerHTML = skeleton('Loading memories…');
  try {
    const data = await api(queryPath('memories', { ...query, limit: store.limit, offset }), {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)])
    });
    if (seq !== store.request) return;
    const facets = data.facets || {};
    const toOptions = (values) => list(values).map((value) => ({ id: value, name: nice(value) }));
    const projects = list(facets.projects);
    optionSet('memory-project', 'All projects', projects.length ? projects : state.projects, query.project);
    optionSet('memory-category', 'All categories', toOptions(facets.categories), query.category);
    optionSet('memory-agent', 'All agents', toOptions(facets.agents), query.agent);
    renderMemories(data);
  } catch (error) {
    if (seq === store.request && error.name !== 'AbortError') target.innerHTML = errorMarkup(error.message, 'memories');
  } finally {
    if (seq === store.request) setBusy(target, false);
  }
}

const graphKinds = { project: 'Project', agent: 'Agent', memory: 'Memory' };
const graphEdgeLabels = { 'belongs-to': 'Belongs to project', 'recorded-by': 'Recorded by agent' };
const graphEdgeClass = { 'belongs-to': ' project-edge', 'recorded-by': ' agent-edge' };

function graphNeighbors(edges, id) {
  return edges.filter((edge) => edge.source === id || edge.target === id).map((edge) => ({
    id: edge.source === id ? edge.target : edge.source,
    edge
  }));
}

function graphPillGrid(positions, nodes, width, top, pitch, nodeWidth = pitch - 18) {
  const columns = Math.max(1, Math.floor((width - 28) / pitch));
  for (let index = 0; index < nodes.length; index += columns) {
    const row = nodes.slice(index, index + columns);
    const offset = (width - row.length * pitch) / 2 + (pitch - nodeWidth) / 2;
    row.forEach((node, column) => {
      positions.set(node.id, { x: offset + column * pitch, y: top + Math.floor(index / columns) * 45, width: nodeWidth, height: 33 });
    });
  }
  return Math.ceil(nodes.length / columns) * 45;
}

function projectCluster(hub, memories) {
  const rings = [];
  for (let start = 0, ring = 0; start < memories.length; ring++) {
    const capacity = 13 + ring * 8;
    const members = memories.slice(start, start + capacity);
    rings.push({ members, rx: 86 + ring * 32, ry: 61 + ring * 29 });
    start += members.length;
  }
  const outer = rings.at(-1);
  return { hub, rings, count: memories.length, rx: (outer?.rx || 75) + 17, ry: (outer?.ry || 36) + 17 };
}

function packClusters(clusters, viewport, agentBands) {
  let best;
  for (let columns = 1; columns <= Math.min(clusters.length, 8); columns++) {
    const rows = [];
    for (let index = 0; index < clusters.length; index += columns) rows.push(clusters.slice(index, index + columns));
    const rowWidths = rows.map((row) => row.reduce((sum, cluster) => sum + cluster.rx * 2 + 19, 0));
    const rowHeights = rows.map((row) => Math.max(...row.map((cluster) => cluster.ry)) * 2 + 20);
    const width = Math.max(agentBands.width, 36 + Math.max(...rowWidths));
    const height = 46 + agentBands.height + rowHeights.reduce((sum, value) => sum + value, 0);
    const scale = Math.min(viewport.width / width, (viewport.height - 45) / height);
    if (!best || scale > best.scale) best = { rows, rowWidths, rowHeights, width, height, scale };
  }
  return best;
}

function graphLayout(nodes, edges) {
  const positions = new Map();
  const clusters = [];
  const order = (a, b) => String(a.label || '').localeCompare(String(b.label || '')) || String(a.id).localeCompare(String(b.id));
  const projects = nodes.filter((node) => node.kind === 'project').sort(order);
  const agents = nodes.filter((node) => node.kind === 'agent').sort(order);
  const memories = nodes.filter((node) => node.kind === 'memory').sort(order);
  const byId = new Map(memories.map((node) => [node.id, node]));
  const expanded = state.graph.project && projects.length === 1 && memories.length <= 25;
  if (!projects.length || !memories.length || expanded) {
    const width = Math.max(450, Math.min(5, Math.ceil(Math.sqrt(memories.length * 1.1))) * 184 + 30);
    let height = 28;
    height += graphPillGrid(positions, projects, width, height, 178, 155);
    if (expanded) height += 14;
    height += graphPillGrid(positions, memories, width, height, 184);
    if (expanded) height += 14;
    height += graphPillGrid(positions, agents, width, height, 140, 118);
    return { positions, clusters, width, height: height + 18 };
  }

  const groupMap = new Map(projects.map((node) => [node.id, []]));
  const grouped = new Set();
  for (const edge of edges) {
    if (edge.kind !== 'belongs-to') continue;
    const memory = byId.get(edge.target);
    const group = groupMap.get(edge.source);
    if (!memory || !group || grouped.has(memory.id)) continue;
    group.push(memory);
    grouped.add(memory.id);
  }
  const groups = projects.map((node) => projectCluster(node, groupMap.get(node.id).sort(order)));
  const ungrouped = memories.filter((node) => !grouped.has(node.id));
  const split = Math.ceil(agents.length / 2);
  const topAgents = agents.slice(0, split);
  const bottomAgents = agents.slice(split);
  const agentWidth = Math.min(split, 6) * 132 + 28;
  const agentHeight = (Math.ceil(split / 6) + Math.ceil(bottomAgents.length / 6)) * 45;
  const packed = packClusters(groups, graphViewport(), { width: agentWidth, height: agentHeight });
  const { width, rows, rowWidths, rowHeights } = packed;
  let y = 14 + graphPillGrid(positions, topAgents, width, 14, 132, 112) + 18;
  rows.forEach((row, rowIndex) => {
    let x = (width - rowWidths[rowIndex]) / 2 + 9.5;
    for (const group of row) {
      const cx = x + group.rx;
      const cy = y + rowHeights[rowIndex] / 2;
      clusters.push({ cx, cy, rx: group.rx, ry: group.ry });
      positions.set(group.hub.id, { x: cx - 66, y: cy - 21, width: 132, height: 42, count: group.count });
      group.rings.forEach(({ members, rx, ry }, ringIndex) => {
        members.forEach((node, index) => {
          const angle = (index + (ringIndex % 2 ? .5 : 0)) * Math.PI * 2 / members.length - Math.PI / 2;
          positions.set(node.id, { x: cx + Math.cos(angle) * rx - 11, y: cy + Math.sin(angle) * ry - 11, width: 22, height: 22, dot: true });
        });
      });
      x += group.rx * 2 + 19;
    }
    y += rowHeights[rowIndex];
  });
  y += graphPillGrid(positions, ungrouped, width, y + 3, 184);
  y += graphPillGrid(positions, bottomAgents, width, y + 8, 132, 112);
  return { positions, clusters, width, height: y + 16 };
}

function graphEdgePath(edge, layout) {
  const a = layout.positions.get(edge.source);
  const b = layout.positions.get(edge.target);
  if (!a || !b) return '';
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  const start = 'M' + ax + ' ' + ay;
  if (edge.kind === 'belongs-to') return start + ' L' + bx + ' ' + by;
  const bend = (ay + by) / 2;
  return start + ' C' + ax + ' ' + bend + ' ' + bx + ' ' + bend + ' ' + bx + ' ' + by;
}

function graphNodeMarkup(node, position, tabIndex) {
  const { x, y, width, height } = position;
  const label = compact(node.label || node.id);
  const hasCount = Number.isFinite(position.count);
  const mark = node.kind === 'project' ? '<rect class="node-glyph" x="11" y="' + (hasCount ? 10 : 12) + '" width="8" height="8" rx="1"/>'
    : node.kind === 'agent' ? '<circle class="node-glyph" cx="15" cy="16" r="4.5"/>' : '<path class="node-glyph" d="m15 11 5 5-5 5-5-5z"/>';
  const display = shorten(label, Math.floor((width - 30) / 6.1));
  const shape = position.dot
    ? '<circle class="node-surface" cx="11" cy="11" r="9.5"/><path class="node-glyph" d="m11 7 4 4-4 4-4-4z"/>'
    : '<rect class="node-surface" width="' + width + '" height="' + height + '" rx="6"/>' + mark +
      '<text x="26" y="' + (hasCount ? 18 : 21) + '">' + esc(display) + '</text>' +
      (hasCount ? '<text class="node-count" x="26" y="33">' + countLabel(position.count, 'memory', 'memories') + '</text>' : '');
  return '<g class="graph-node ' + node.kind + (position.dot ? ' dot-node' : '') + '" role="button" aria-label="' + esc(graphKinds[node.kind] + ': ' + label) +
    '" data-node="' + esc(node.id) + '" aria-pressed="false" tabindex="' + tabIndex + '" transform="translate(' + x + ' ' + y + ')"><title>' +
    esc(label) + '</title>' + shape + '</g>';
}

function renderGraphList() {
  $('graph-list').innerHTML = '<ul class="list">' + state.graph.nodes.map((node) => '<li class="graph-row"><button type="button" class="button" data-node="' +
    esc(node.id) + '" aria-pressed="false">' + icon(node.kind, true) + '<span>' + esc(node.label || node.id) +
    '</span><span class="tag ' + node.kind + '">' + graphKinds[node.kind] + '</span></button></li>').join('') + '</ul>';
}

function renderGraphMap() {
  const graph = state.graph;
  const layout = graph.layout = graphLayout(graph.nodes, graph.edges);
  const svg = $('graph-svg');
  const clusters = layout.clusters.map(({ cx, cy, rx, ry }) => '<ellipse class="cluster-area" cx="' + cx + '" cy="' + cy +
    '" rx="' + rx + '" ry="' + ry + '"/>').join('');
  const edges = graph.edges.map((edge, i) => '<path class="graph-edge' + (graphEdgeClass[edge.kind] || '') +
    '" data-edge="' + i + '" d="' + graphEdgePath(edge, layout) + '"/>').join('');
  const nodes = graph.nodes.map((node, i) => graphNodeMarkup(node, layout.positions.get(node.id), i === 0 ? 0 : -1)).join('');
  svg.innerHTML = '<defs><pattern id="map-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="var(--graph-dot)"/></pattern></defs>' +
    '<rect width="100%" height="100%" fill="url(#map-dots)"/><g id="graph-transform"><g aria-hidden="true">' + clusters + edges + '</g>' +
    nodes + '<g class="graph-tooltip" id="graph-tooltip" aria-hidden="true"></g></g>';
  fitGraph();
}

function graphViewport() {
  const rect = $('graph-svg').getBoundingClientRect();
  return { width: Math.max(rect.width, 1), height: Math.max(rect.height, 1) };
}

function updateGraphTransform() {
  const graph = state.graph;
  const transform = $('graph-transform');
  if (!transform || graph.mode !== 'map') return;
  const { width, height } = graphViewport();
  $('graph-svg').setAttribute('viewBox', '0 0 ' + width + ' ' + height);
  transform.setAttribute('transform', 'translate(' + graph.panX + ' ' + graph.panY + ') scale(' + graph.zoom + ')');
  $('graph-scale').textContent = Math.round(graph.zoom * 100) + '%';
  $('graph-out').disabled = graph.zoom <= .06;
  $('graph-in').disabled = graph.zoom >= 2.75;
}

function fitGraph() {
  const graph = state.graph;
  if (!graph.layout || graph.mode !== 'map' || $('graph-body').hidden || state.view !== 'graph') return;
  const { width, height } = graphViewport();
  const { width: mapWidth, height: mapHeight } = graph.layout;
  const widthScale = Math.max(1, width - 24) / mapWidth;
  const heightScale = Math.max(1, height - 54) / mapHeight;
  const zoom = Math.min(1.35, widthScale, heightScale);
  graph.zoom = zoom;
  graph.panX = (width - mapWidth * zoom) / 2;
  graph.panY = Math.max(0, (height - 38 - mapHeight * zoom) / 2);
  updateGraphTransform();
}

function zoomGraph(factor, anchor) {
  const graph = state.graph;
  if (!graph.layout) return;
  const viewport = graphViewport();
  const center = anchor || { x: viewport.width / 2, y: viewport.height / 2 };
  const previous = graph.zoom;
  const target = Math.min(2.75, Math.max(Math.min(.06, previous), previous * factor));
  const ratio = target / previous;
  graph.panX = center.x - (center.x - graph.panX) * ratio;
  graph.panY = center.y - (center.y - graph.panY) * ratio;
  graph.zoom = target;
  updateGraphTransform();
}

function centerGraphNode(id) {
  const graph = state.graph;
  const position = graph.layout?.positions.get(id);
  if (!position || graph.mode !== 'map') return;
  const { width, height } = graphViewport();
  const zoom = Math.max(.8, graph.zoom);
  graph.zoom = zoom;
  graph.panX = width / 2 - (position.x + position.width / 2) * zoom;
  graph.panY = (height - 38) / 2 - (position.y + position.height / 2) * zoom;
  updateGraphTransform();
}

function renderGraphTooltip(id) {
  const graph = state.graph;
  const tooltip = $('graph-tooltip');
  if (!tooltip) return;
  const point = graph.layout.positions.get(id);
  const node = graph.nodes.find((item) => item.id === id);
  if (!point?.dot || !node) {
    tooltip.replaceChildren();
    return;
  }
  const label = shorten(compact(node.label || node.id), 48);
  const width = Math.max(70, label.length * 6.7 + 18);
  const x = Math.min(graph.layout.width - width - 2, Math.max(2, point.x + 11 - width / 2));
  const y = Math.max(1, point.y - 32);
  tooltip.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
  tooltip.innerHTML = '<rect width="' + width + '" height="26" rx="5"/><text x="9" y="17">' + esc(label) + '</text>';
}

function renderGraphInspector() {
  const graph = state.graph;
  const all = new Map(list(graph.snapshot?.nodes).map((node) => [node.id, node]));
  const selected = all.get(graph.selected);
  const inspector = $('graph-inspector');
  if (!selected) {
    inspector.innerHTML = '<div class="panel-head"><h3>Node details</h3></div>' +
      blank('graph', 'Select a node', 'See its stored details and follow its recorded connections.');
    return;
  }
  const adjacent = graphNeighbors(list(graph.snapshot.edges), selected.id).filter((item) => all.has(item.id));
  const connected = adjacent.length ? '<details open><summary>' + countLabel(adjacent.length, 'connection') + '</summary><div class="related">' +
    adjacent.map(({ id, edge }) => {
      const node = all.get(id);
      return '<button type="button" class="button quiet" data-related="' + esc(id) + '" title="' +
        esc(graphEdgeLabels[edge.kind] || nice(edge.kind) || 'Connection') + '">' + icon(node.kind, true) + '<span>' +
        esc(node.label || node.id) + '</span></button>';
    }).join('') + '</div></details>' : '<p class="muted small">No connections in this view.</p>';
  const project = state.projects.find((item) => item.id === selected.project)?.name || selected.project;
  const snippet = compact(selected.snippet) && compact(selected.snippet) !== compact(selected.label)
    ? '<p class="small">' + esc(selected.snippet) + '</p>' : '';
  inspector.innerHTML = '<div class="panel-head"><h3>Node details</h3></div><div class="panel-body">' +
    tags([[selected.kind, graphKinds[selected.kind]], ['memory', nice(selected.category)]]) + '<h3>' + esc(selected.label || selected.id) + '</h3>' +
    (project && selected.kind !== 'project' ? '<p class="muted small">' + esc(project) + '</p>' : '') + snippet +
    (selected.kind === 'memory' ? sourceMarkup([...list(selected.sources), selected.source]) : '') + connected + '</div>';
}

function selectGraphNode(id, { center = false, focus = false } = {}) {
  const graph = state.graph;
  graph.selected = id;
  const connected = new Set(graphNeighbors(graph.edges, id).map((item) => item.id));
  connected.add(id);
  const focusable = $('graph-svg').querySelector('[data-node][tabindex="0"]')?.dataset.node;
  const tabStop = id || focusable || graph.nodes[0]?.id;
  $('graph-body').querySelectorAll('[data-node]').forEach((element) => {
    const nodeId = element.dataset.node;
    element.setAttribute('aria-pressed', String(id === nodeId));
    if (element instanceof SVGElement) {
      element.classList.toggle('unrelated', !!id && !connected.has(nodeId));
      element.setAttribute('tabindex', nodeId === tabStop ? '0' : '-1');
    }
  });
  if (graph.mode === 'map') {
    $('graph-svg').querySelectorAll('[data-edge]').forEach((element) => {
      const edge = graph.edges[Number(element.dataset.edge)];
      const active = edge.source === id || edge.target === id;
      element.classList.toggle('active', active);
      element.classList.toggle('unrelated', !!id && !active);
    });
    renderGraphTooltip(id);
  }
  renderGraphInspector();
  if (center) centerGraphNode(id);
  if (focus) {
    const target = graph.mode === 'map' ? $('graph-svg') : $('graph-list');
    target.querySelector('[data-node="' + CSS.escape(id) + '"]')?.focus();
  }
}

function renderGraph() {
  const graph = state.graph;
  if (!graph.snapshot) return;
  const search = $('graph-query').value.trim().toLowerCase();
  const kind = $('graph-kind').value;
  const nodes = list(graph.snapshot.nodes).filter((node) => Object.hasOwn(graphKinds, node.kind));
  const matches = nodes.filter((node) => (!kind || node.kind === kind) &&
    (!search || [node.label, node.snippet, node.project, node.category].filter(Boolean).join(' ').toLowerCase().includes(search)));
  const ids = new Set(matches.map((node) => node.id));
  if (search && !kind) {
    matches.forEach((node) => graphNeighbors(list(graph.snapshot.edges), node.id).forEach((item) => ids.add(item.id)));
  }
  graph.nodes = nodes.filter((node) => ids.has(node.id));
  graph.edges = list(graph.snapshot.edges).filter((edge) => ids.has(edge.source) && ids.has(edge.target));
  if (graph.selected && !ids.has(graph.selected)) graph.selected = '';
  const matchingCount = search && matches.length !== graph.nodes.length ? countLabel(matches.length, 'match', 'matches') + ' · ' : '';
  $('graph-count').textContent = matchingCount + countLabel(graph.nodes.length, 'node') + ' · ' + countLabel(graph.edges.length, 'connection');
  $('graph-body').hidden = !graph.nodes.length;
  $('graph-legend').hidden = !graph.nodes.length;
  const note = graph.snapshot.truncated ? '<div class="panel-body small muted">Showing ' +
    number(graph.snapshot.shownMemories) + ' memories in this snapshot. Filter by project to explore a narrower set.</div>' : '';
  $('graph-status').innerHTML = graph.nodes.length ? note : blank('graph', search || kind ? 'No matching nodes' : 'No relationships yet',
    search || kind ? 'Change the name or node type filter.' : 'The graph fills in as project and agent memories are stored.');
  if (!graph.nodes.length) return;
  $('graph-stage').hidden = graph.mode !== 'map';
  $('graph-list').hidden = graph.mode !== 'list';
  $('graph-mode-map').setAttribute('aria-pressed', String(graph.mode === 'map'));
  $('graph-mode-list').setAttribute('aria-pressed', String(graph.mode === 'list'));
  renderGraphList();
  if (graph.mode === 'map') renderGraphMap();
  selectGraphNode(graph.selected);
}

async function loadGraph(project, force = false) {
  const graph = state.graph;
  if (!force && graph.snapshot && graph.project === project) {
    renderGraph();
    return;
  }
  const seq = ++graph.request;
  graph.controller?.abort();
  const controller = new AbortController();
  graph.controller = controller;
  graph.snapshot = null;
  graph.project = project;
  graph.selected = '';
  setBusy($('graph-panel'), true);
  $('graph-status').innerHTML = skeleton('Loading relationships…');
  $('graph-count').textContent = '';
  $('graph-body').hidden = true;
  $('graph-legend').hidden = true;
  try {
    const snapshot = await api(queryPath('graph', { project }), { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
    if (seq !== graph.request) return;
    graph.snapshot = snapshot;
    renderGraph();
  } catch (error) {
    if (seq === graph.request && error.name !== 'AbortError') $('graph-status').innerHTML = errorMarkup(error.message, 'graph');
  } finally {
    if (seq === graph.request) setBusy($('graph-panel'), false);
  }
}

function renderContextControls() {
  const input = $('context-cross');
  const toggle = state.features?.features;
  const canCross = toggle?.contextAssembly === true && toggle?.crossProjectContext === true;
  $('context-cross-row').hidden = !canCross;
  if (!canCross) input.checked = false;
  $('context-submit').disabled = !toggle?.contextAssembly || !state.projects.length || state.context.pending;
  const gate = $('context-gate');
  if (!toggle && state.featurePending) {
    gate.innerHTML = '<p class="muted small" role="status">Checking feature settings…</p>';
  } else if (!toggle) {
    gate.innerHTML = errorMarkup('Could not check context assembly settings.', 'features');
  } else if (!toggle.contextAssembly) {
    gate.innerHTML = '<p class="muted small">Context assembly is turned off. <a href="#features">Manage in Features</a></p>';
  } else if (!state.overviewLoaded && state.overviewPending) {
    gate.innerHTML = '<p class="muted small" role="status">Loading projects…</p>';
  } else if (!state.overviewLoaded) {
    gate.innerHTML = errorMarkup('Could not load projects.', 'overview');
  } else if (!state.projects.length) {
    gate.innerHTML = '<p class="muted small">Store a project memory before assembling context.</p>';
  } else {
    gate.replaceChildren();
  }
}

function contextReasonList(items, format) {
  return '<ul class="list">' + items.map(format).join('') + '</ul>';
}

function renderContext() {
  const output = $('context-output');
  const { pack, dirty } = state.context;
  if (!pack) {
    output.innerHTML = blank('context', 'Ready for a task', 'Choose a project and describe the work to see the context and its sources here.');
    return;
  }
  const entries = list(pack.entries);
  const excluded = list(pack.excluded);
  const budget = pack.budget || {};
  const warnings = list(pack.warnings);
  const allowed = state.features?.features?.contextAssembly === true;
  const canCopy = allowed && !dirty && !!pack.markdown && pack.enabled && entries.length > 0;
  const warningMarkup = warnings.map((warning) => '<p class="small muted">' + esc(warning) + '</p>').join('');
  const selection = contextReasonList(entries, (entry) => {
    const title = shorten(compact(entry.excerpt), 120) || nice(entry.category) || entry.id;
    const reason = list(entry.reasons).map((detail) => '<p class="small muted">' + esc(detail) + '</p>').join('');
    return '<li><strong>' + esc(title) + '</strong><div class="small muted">' + esc([entry.projectName, entry.agentTool, nice(entry.category)].filter(Boolean).join(' · ')) +
      '</div>' + reason + sourceMarkup(entry.sources) + '</li>';
  });
  const reasonLabels = {
    duplicate: 'Matches a memory already considered.',
    budget: 'Would exceed the selected budget.',
    limit: 'Beyond the brief’s memory limit.',
    empty: 'Contains no memory text.',
    lookback: 'Falls outside the selected time range.'
  };
  const rejections = contextReasonList(excluded, (entry) => '<li><strong class="mono">' + esc(entry.id) +
    '</strong><p class="small muted">' + esc(reasonLabels[entry.reason] || nice(entry.reason)) + '</p></li>');
  const scope = pack.scope === 'cross-project' ? 'Cross-project' : 'Selected project';
  output.innerHTML = '<div class="panel-body stack">' + (dirty ? '<p class="status small" role="status">Task details changed. Assemble again to update this preview.</p>' : '') +
    '<div class="form-actions">' + tags([['project', scope], ['memory', number(budget.estimatedTokens) + ' / ' + number(budget.tokenBudget) + ' estimated tokens']]) +
    (canCopy ? '<button class="button toolbar-end" id="context-copy" type="button">' + icon('copy') + 'Copy brief</button>' : '') + '</div>' +
    warningMarkup +
    (pack.markdown && pack.enabled && entries.length ? '<pre class="context-preview mono" id="context-text" tabindex="0" aria-label="Assembled context markdown">' + esc(pack.markdown) + '</pre>' :
      blank('context', pack.enabled ? 'No memories fit this task' : 'Context assembly is turned off', pack.enabled ? 'Try a more specific task or a larger budget.' : 'Enable it in Features to build a brief.')) +
    '<div class="context-reasons">' +
    (entries.length ? '<details open><summary>Included · ' + number(entries.length) + '</summary>' + selection + '</details>' : '') +
    (excluded.length ? '<details><summary>Excluded · ' + number(excluded.length) + '</summary>' + rejections + '</details>' : '') +
    '</div><p id="copy-status" class="small muted" role="status" hidden></p></div>';
}

async function assembleContext() {
  const store = state.context;
  const toggle = state.features?.features;
  const query = $('context-task').value.trim();
  const projectId = $('context-project').value;
  const tokenBudget = Number($('context-budget').value);
  if (store.pending || !toggle?.contextAssembly || !projectId) return;
  if (!query) {
    $('context-task').setCustomValidity('Enter a task.');
    $('context-task').reportValidity();
    return;
  }
  const body = { query, projectId, tokenBudget, includeCrossProject: toggle.crossProjectContext && $('context-cross').checked };
  store.pending = true;
  store.dirty = false;
  renderContextControls();
  setBusy($('context-result'), true);
  $('context-output').innerHTML = skeleton('Assembling context…');
  try {
    store.pack = await api('context', { body });
    renderContext();
  } catch (error) {
    store.pack = null;
    $('context-output').innerHTML = errorMarkup(error.message, 'context');
  } finally {
    store.pending = false;
    setBusy($('context-result'), false);
    renderContextControls();
  }
}

async function copyContext() {
  const store = state.context;
  const status = $('copy-status');
  if (!store.pack?.markdown || store.dirty || !status) return;
  try {
    await navigator.clipboard.writeText(store.pack.markdown);
    status.textContent = 'Brief copied.';
  } catch {
    status.textContent = 'Clipboard access is unavailable. Select and copy the preview text.';
  }
  status.hidden = false;
}

function renderFeatures() {
  const target = $('feature-list');
  if (!state.features) return;
  const current = state.features.features;
  const overrides = new Map(list(state.features.definitions).map((item) => [item.id, item]));
  target.innerHTML = '<ul class="list">' + definitions.map((definition) => {
    const display = overrides.get(definition.id) || definition;
    const on = current[definition.id] === true;
    return '<li class="setting"><div><h3 id="label-' + definition.id + '">' + esc(display.label) + '</h3><p class="muted small" id="desc-' +
      definition.id + '">' + esc(display.description) + '</p></div><button type="button" class="button switch" role="switch" aria-checked="' +
      on + '" aria-labelledby="label-' + definition.id + '" aria-describedby="desc-' + definition.id + '" data-feature="' + definition.id + '"' +
      (state.featureSaving ? ' disabled' : '') + '><span aria-hidden="true">' + (on ? 'On' : 'Off') + '</span><span class="switch-track" aria-hidden="true"></span></button></li>';
  }).join('') + '</ul>';
}

function applyFeatures(snapshot) {
  const before = state.features?.features;
  const current = snapshot.features;
  if (!current || !Number.isSafeInteger(snapshot.revision) || !definitions.every(({ id }) => typeof current[id] === 'boolean')) {
    throw new Error('The server returned unreadable feature settings.');
  }
  if (state.features && snapshot.revision < state.features.revision) return;
  state.features = snapshot;
  state.activityEnabled = current.liveActivity;
  if (before?.crossProjectContext && !current.crossProjectContext && state.context.pack?.scope === 'cross-project') state.context.dirty = true;
  renderFeatures();
  renderActivity();
  renderContextControls();
  if (state.context.pack && !state.context.pending) renderContext();
  if (current.liveActivity && before?.liveActivity !== true) void refreshActivity();
}

function featureStatus(message, error = false) {
  const target = $('feature-status');
  target.textContent = message;
  target.dataset.error = String(error);
}

async function loadFeatures(force = false) {
  if (state.featurePending) return state.featurePending;
  if (state.features && !force) return;
  const target = $('feature-list');
  if (!state.features) target.innerHTML = skeleton('Loading feature settings…');
  setBusy(target, true);
  state.featurePending = (async () => {
    try {
      applyFeatures(await api('features'));
      return true;
    } catch (error) {
      if (!state.features) target.innerHTML = errorMarkup(error.message, 'features');
      else if (!state.featureSaving) featureStatus(error.message, true);
      return false;
    } finally {
      state.featurePending = null;
      setBusy(target, false);
      renderContextControls();
    }
  })();
  renderContextControls();
  return state.featurePending;
}

async function toggleFeature(key) {
  if (state.featureSaving || !state.features || !definitions.some((definition) => definition.id === key)) return;
  state.featureSaving = true;
  $('feature-list').querySelectorAll('[data-feature]').forEach((button) => { button.disabled = true; });
  featureStatus('Saving…');
  try {
    const body = { patch: { [key]: !state.features.features[key] }, expectedRevision: state.features.revision };
    applyFeatures(await api('features', { body }));
    featureStatus('Saved.');
  } catch (error) {
    if (error.status === 409) {
      const refreshed = await loadFeatures(true);
      featureStatus(refreshed ? 'Settings changed elsewhere. Review the current settings and try again.' :
        'Settings changed elsewhere. Reload Features to see the current settings.', true);
    } else {
      featureStatus(error.message, true);
    }
  } finally {
    state.featureSaving = false;
    renderFeatures();
    if (state.view === 'features') $('feature-list').querySelector('[data-feature="' + key + '"]')?.focus();
  }
}

function setPreference(key, value, announce = true) {
  document.documentElement.dataset[key] = value;
  let persisted = true;
  if (announce) {
    try {
      localStorage.setItem('shadow-brain:workspace:' + key, value);
    } catch { persisted = false; }
    const status = $('display-status');
    status.hidden = false;
    status.textContent = persisted ? 'Display preference saved on this device.' : 'Display preference applied for this session.';
  }
  $('theme-setting').value = document.documentElement.dataset.theme;
  $('motion-setting').value = document.documentElement.dataset.motion;
  const dark = document.documentElement.dataset.theme === 'dark';
  const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
  const button = $('theme-toggle');
  button.innerHTML = icon(dark ? 'sun' : 'moon');
  button.title = label;
  button.setAttribute('aria-label', label);
  if (announce && !persisted && state.view !== 'features') {
    $('workspace-notice').hidden = false;
    $('workspace-notice').textContent = 'Display preference applied for this session.';
  }
}

function routeParams() {
  return new URLSearchParams(location.hash.split('?')[1] || '');
}

function changeView(moveFocus = false) {
  const hash = location.hash.slice(1).split('?')[0];
  const view = Object.hasOwn(viewNames, hash) ? hash : 'overview';
  const previous = state.view;
  state.view = view;
  $('crumb').textContent = viewNames[view];
  document.title = viewNames[view] + ' · Shadow Brain';
  for (const name of Object.keys(viewNames)) {
    const section = $('page-' + name);
    section.hidden = name !== view;
    section.classList.remove('entered');
    const link = document.querySelector('[data-view="' + name + '"]');
    if (name === view) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (previous !== view) $('page-' + view).classList.add('entered');
  if (moveFocus) {
    window.scrollTo(0, 0);
    $('title-' + view).focus({ preventScroll: true });
  }
  const params = routeParams();
  const project = params.get('project') || '';
  switch (view) {
    case 'overview':
      void loadOverview(previous !== '' && previous !== 'overview');
      void loadFeatures();
      break;
    case 'memories':
      if (project) optionSet('memory-project', 'All projects', state.projects, project);
      void loadMemories({ ...memoryQuery(), project: project || $('memory-project').value });
      break;
    case 'graph':
      void loadOverview();
      if (project) optionSet('graph-project', 'All projects', state.projects, project);
      void loadGraph(project || $('graph-project').value, previous !== '' && previous !== 'graph');
      break;
    case 'context':
      void loadOverview();
      void loadFeatures(previous !== '');
      renderContextControls();
      break;
    case 'features':
      featureStatus('');
      void loadFeatures(true);
      break;
  }
}

function graphSelectFromList(id, fromInspector) {
  if (!state.graph.nodes.some((node) => node.id === id)) {
    $('graph-query').value = '';
    $('graph-kind').value = '';
    renderGraph();
  }
  selectGraphNode(id, { center: fromInspector, focus: fromInspector });
}

function handleGraphKeyboard(event) {
  const target = event.target.closest('[data-node]');
  if (!target) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    selectGraphNode(target.dataset.node, { center: true });
    return;
  }
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const graph = state.graph;
  const { positions } = graph.layout;
  const points = [...positions.entries()].map(([id, point]) => ({ id, x: point.x + point.width / 2, y: point.y + point.height / 2 }));
  let next;
  if (event.key === 'Home' || event.key === 'End') {
    points.sort((a, b) => a.y - b.y || a.x - b.x);
    next = event.key === 'Home' ? points[0] : points.at(-1);
  } else {
    const current = points.find((point) => point.id === target.dataset.node);
    const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
    const sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const axis = horizontal ? 'x' : 'y';
    const other = horizontal ? 'y' : 'x';
    const score = (point) => Math.abs(point[axis] - current[axis]) + Math.abs(point[other] - current[other]) * 1.4;
    next = points.filter((point) => (point[axis] - current[axis]) * sign > 3).sort((a, b) => score(a) - score(b))[0];
  }
  if (next) selectGraphNode(next.id, { center: true, focus: true });
}

$('theme-toggle').addEventListener('click', () => setPreference('theme', document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('theme-setting').addEventListener('change', (event) => setPreference('theme', event.target.value));
$('motion-setting').addEventListener('change', (event) => setPreference('motion', event.target.value));
$('memory-form').addEventListener('submit', (event) => { event.preventDefault(); void loadMemories(memoryQuery()); });
['memory-project', 'memory-category', 'memory-agent'].forEach((id) => $(id).addEventListener('change', () => { void loadMemories(memoryQuery()); }));
$('graph-query').addEventListener('input', renderGraph);
$('graph-kind').addEventListener('change', renderGraph);
$('graph-project').addEventListener('change', (event) => { void loadGraph(event.target.value); });
['map', 'list'].forEach((mode) => $('graph-mode-' + mode).addEventListener('click', () => {
  state.graph.mode = mode;
  $('graph-mode-map').setAttribute('aria-pressed', String(mode === 'map'));
  $('graph-mode-list').setAttribute('aria-pressed', String(mode === 'list'));
  renderGraph();
}));
$('graph-fit').addEventListener('click', () => fitGraph());
$('graph-in').addEventListener('click', () => zoomGraph(1.35));
$('graph-out').addEventListener('click', () => zoomGraph(1 / 1.35));
$('graph-svg').addEventListener('keydown', handleGraphKeyboard);
$('graph-svg').addEventListener('focusin', (event) => {
  const node = event.target.closest('[data-node]');
  if (node) renderGraphTooltip(node.dataset.node);
});
$('graph-svg').addEventListener('focusout', () => renderGraphTooltip(state.graph.selected));
$('graph-svg').addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !event.isPrimary || event.target.closest('[data-node]')) return;
  const graph = state.graph;
  graph.drag = { id: event.pointerId, x: event.clientX - graph.panX, y: event.clientY - graph.panY };
  $('graph-svg').setPointerCapture(event.pointerId);
  $('graph-svg').classList.add('dragging');
});
$('graph-svg').addEventListener('pointermove', (event) => {
  const graph = state.graph;
  if (graph.drag?.id !== event.pointerId) return;
  graph.panX = event.clientX - graph.drag.x;
  graph.panY = event.clientY - graph.drag.y;
  updateGraphTransform();
});
$('graph-svg').addEventListener('lostpointercapture', () => {
  state.graph.drag = null;
  $('graph-svg').classList.remove('dragging');
});
window.addEventListener('resize', () => {
  if (state.view === 'graph' && state.graph.mode === 'map' && state.graph.nodes.length) {
    renderGraphMap();
    selectGraphNode(state.graph.selected);
  }
});

$('context-form').addEventListener('submit', (event) => { event.preventDefault(); void assembleContext(); });
$('context-form').addEventListener('input', () => {
  $('context-task').setCustomValidity('');
  const store = state.context;
  if (store.pack || store.pending) {
    if (!store.dirty) {
      store.dirty = true;
      if (!store.pending) renderContext();
    }
  }
});

document.addEventListener('click', (event) => {
  const element = event.target.closest('[data-retry],[data-memory-clear],[data-memory-page],[data-node],[data-related],[data-feature],#context-copy,.skip');
  if (!element) return;
  const data = element.dataset;
  if (data.retry) {
    switch (data.retry) {
      case 'overview': void loadOverview(true); break;
      case 'memories': void loadMemories(state.memory.query || memoryQuery(), state.memory.offset); break;
      case 'graph': void loadGraph(state.graph.project, true); break;
      case 'context': $('context-form').requestSubmit(); break;
      case 'features': void loadFeatures(true); break;
    }
  } else if (Object.hasOwn(data, 'memoryClear')) {
    ['memory-query', 'memory-project', 'memory-category', 'memory-agent'].forEach((id) => { $(id).value = ''; });
    $('memory-query').focus();
    void loadMemories(memoryQuery());
  } else if (data.memoryPage) {
    const { query, offset, limit } = state.memory;
    const step = data.memoryPage === 'next' ? limit : -limit;
    $('memory-search').focus();
    void loadMemories(query || memoryQuery(), Math.max(0, offset + step));
  } else if (data.node) {
    selectGraphNode(data.node);
  } else if (data.related) {
    graphSelectFromList(data.related, true);
  } else if (data.feature) {
    void toggleFeature(data.feature);
  } else if (element.id === 'context-copy') {
    void copyContext();
  } else if (element.classList.contains('skip')) {
    event.preventDefault();
    $('main-content').focus();
  }
});

window.addEventListener('hashchange', () => changeView(true));
document.addEventListener('visibilitychange', () => { if (!document.hidden) void refreshActivity(); });
setInterval(() => { void refreshActivity(); }, 10000);
setPreference('theme', document.documentElement.dataset.theme, false);
renderContext();
changeView();
</script>
</body>
</html>`;
