/** Project Kit uses the same local workspace shell and HTTP helpers. */
import { PROJECT_FEEDBACK_MARKUP, PROJECT_FEEDBACK_SCRIPT, PROJECT_FEEDBACK_STYLE } from './project-feedback-html.js';

export const PROJECT_KIT_STYLE = String.raw`
  html[data-project-local="true"] .advanced-link { display: none; }
  .project-local-notice { display: none; }
  html[data-project-local="true"] .project-local-notice { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; padding: 8px 12px; margin-bottom: 16px; border-radius: 7px; background: var(--tint); color: var(--project); font-size: .83rem; }
  .project-local-notice a { font-weight: 680; text-decoration: underline; text-underline-offset: 3px; }
  .kit-identity { display: grid; grid-template-columns: minmax(150px,.8fr) minmax(0,1.2fr); align-items: center; gap: 16px; padding: 18px 20px; border-radius: 10px; color: var(--instrument-ink); background: var(--instrument); }
  .kit-identity p { color: var(--instrument-muted); margin-top: 5px; }
  .kit-identity .mono { color: var(--instrument-ink); }
  .kit-identity dl { display: grid; gap: 6px; min-width: 0; }
  .kit-identity dt { color: var(--instrument-muted); font-size: .78rem; }
  .kit-identity dd { margin-top: 1px; }
  .kit-identity summary { cursor: pointer; color: var(--signal); margin-top: 5px; }
  .kit-identity details[open] > summary { margin-bottom: 6px; }
  .kit-layout { grid-template-columns: minmax(280px,.88fr) minmax(0,1.25fr); }
  .kit-form { display: grid; gap: 12px; }
  .kit-form .button { justify-self: start; }
  .kit-fields { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px; }
  .kit-form-status { min-width: 0; }
  .kit-form-status:empty { display: none; }
  .kit-profile { display: grid; gap: 11px; }
  .kit-profile summary { cursor: pointer; color: var(--teal); font-weight: 650; }
  .kit-profile details[open] > summary { margin-bottom: 6px; }
  .kit-evidence, .kit-checks { max-height: 300px; overflow: auto; }
  .kit-evidence li, .kit-checks li { padding: 7px 0; }
  .kit-evidence .tags { margin-top: 4px; }
  .kit-checks .form-actions { margin-top: 3px; }
  .kit-preview { border-top: 1px solid var(--line); min-width: 0; }
  .kit-preview > .panel-head { background: var(--inset); }
  .kit-preview-file { display: grid; gap: 8px; min-width: 0; }
  .kit-file-header { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; }
  .kit-preview-file .context-preview { max-height: 440px; }
  .kit-apply-controls { border-top: 1px solid var(--line); }
  .kit-apply-controls .form-actions { margin-bottom: 6px; }
  .kit-applied-list { padding-left: 18px; margin-top: 5px; }
  @media (max-width: 985px) { .kit-layout { grid-template-columns: minmax(0,1fr); } }
  @media (max-width: 690px) {
    .kit-identity { grid-template-columns: minmax(0,1fr); gap: 10px; padding: 13px 14px; }
    .kit-preview { scroll-margin-top: 55px; }
  }
${PROJECT_FEEDBACK_STYLE}
`;

export const PROJECT_KIT_MARKUP = String.raw`
      <section id="page-project-kit" aria-labelledby="title-project-kit" hidden>
        <div class="page-head">
          <div><h1 id="title-project-kit" tabindex="-1">Project Kit</h1><p class="muted">Inspect this project, save knowledge, and prepare a skill for a coding agent.</p></div>
          <button class="button" type="button" id="kit-refresh" hidden><span data-icon="refresh"></span>Refresh profile</button>
        </div>
        <div id="kit-gate" class="panel" role="status"></div>
        <div id="kit-workbench" class="stack" hidden>
          <section id="kit-identity" class="kit-identity" aria-label="Pinned project and storage"></section>
          <div class="split kit-layout">
            <div class="stack">
              <section class="panel" aria-labelledby="kit-profile-heading">
                <div class="panel-head"><h2 id="kit-profile-heading">Observed project profile</h2></div>
                <div id="kit-profile" aria-busy="true"></div>
              </section>
              <section class="panel" aria-labelledby="kit-knowledge-heading">
                <div class="panel-head"><div><h2 id="kit-knowledge-heading">Project knowledge</h2><p class="small muted">Record a decision, constraint, or lesson you want agents to recall.</p></div></div>
                <form class="panel-body kit-form" id="kit-knowledge-form">
                  <label class="label" for="kit-knowledge-title">Title<input id="kit-knowledge-title" maxlength="160" required placeholder="Retry rules for checkout"></label>
                  <label class="label" for="kit-knowledge-content">Knowledge<textarea id="kit-knowledge-content" maxlength="8000" rows="4" required placeholder="Describe the rule and when it applies."></textarea></label>
                  <div class="kit-fields">
                    <label class="label" for="kit-knowledge-category">Category <span class="small muted">Optional</span><input id="kit-knowledge-category" maxlength="64" pattern="[A-Za-z0-9][A-Za-z0-9 _.\-]*" placeholder="knowledge"></label>
                    <label class="label" for="kit-knowledge-source">Source reference <span class="small muted">Optional</span><input id="kit-knowledge-source" maxlength="500" placeholder="docs/checkout.md"></label>
                  </div>
                  <button class="button primary" type="submit" id="kit-knowledge-save"><span data-icon="memory"></span>Save knowledge</button>
                  <div class="kit-form-status" id="kit-knowledge-status" role="status"></div>
                </form>
              </section>
            </div>
            <section class="panel" aria-labelledby="kit-skill-heading">
              <div class="panel-head"><div><h2 id="kit-skill-heading">Skill builder</h2><p class="small muted">Describe the workflow, then review the generated file before applying it.</p></div></div>
              <form class="panel-body kit-form" id="kit-skill-form">
                <label class="label" for="kit-requirement">Requirement<textarea id="kit-requirement" rows="4" maxlength="8000" required placeholder="When a checkout retry changes, verify idempotency and add a regression case."></textarea></label>
                <div class="kit-fields">
                  <label class="label" for="kit-target">Agent target<select id="kit-target"><option value="codex">Codex</option><option value="claude-code">Claude Code</option><option value="opencode">OpenCode</option><option value="deepseek-harness">DeepSeek Harness</option><option value="portable">Portable</option></select></label>
                  <label class="label" for="kit-skill-name">Skill name<input id="kit-skill-name" maxlength="63" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="Generated from requirement"></label>
                </div>
                <label class="label" for="kit-skill-knowledge">Supporting knowledge <span class="small muted">Optional reference material</span><textarea id="kit-skill-knowledge" maxlength="8000" rows="3" placeholder="Add the project rule or evidence the skill should carry."></textarea></label>
                <button class="button primary" type="submit" id="kit-preview-submit"><span data-icon="context"></span>Preview skill</button>
              </form>
              <section class="kit-preview" id="kit-preview" aria-labelledby="kit-preview-heading">
                <div class="panel-head"><h3 id="kit-preview-heading" tabindex="-1">Skill preview</h3><span id="kit-preview-state" class="small muted" role="status"></span></div>
                <div id="kit-preview-body"></div>
                <div class="panel-body kit-apply-controls" id="kit-apply-controls" hidden>
                  <div class="form-actions"><button class="button primary" type="button" id="kit-apply"><span data-icon="plus"></span>Apply local skill</button></div>
                  <p class="small muted">Writes the displayed project-relative file. Confirm the path and content above.</p>
                  <div class="kit-form-status" id="kit-apply-status" role="status"></div>
                </div>
              </section>
            </section>
          </div>
${PROJECT_FEEDBACK_MARKUP}
        </div>
      </section>
`;

export const PROJECT_KIT_SCRIPT = String.raw`
const kit = { profile: null, profileLoading: false, saving: false, savedKnowledge: '', preview: null, previewInput: null,
  previewing: false, applying: false, dirty: false, previewError: '', applied: null };

function renderKitIdentity(info) {
  const root = String(info.root || '').replace(/\\/g, '/').replace(/\/$/, '') + '/';
  const storage = String(info.storagePath || '').replace(/\\/g, '/');
  const relativeStorage = storage.startsWith(root) ? storage.slice(root.length) : 'Project-local store';
  $('kit-identity').innerHTML = '<div><h2>' + esc(info.projectName || info.projectId) + '</h2><p class="small">Project-local memory and skills</p>' +
    '<button class="button quiet kit-outcomes-jump" type="button" id="kit-outcomes-jump">Record a memory outcome ' + icon('chevron', true) + '</button></div>' +
    '<div><p class="small">Memory store</p><code class="mono">' + esc(relativeStorage) + '</code><details><summary class="small">Show full paths</summary>' +
    '<dl><div><dt>Project root</dt><dd class="mono">' + esc(info.root) + '</dd></div><div><dt>Memory store</dt><dd class="mono">' +
    esc(info.storagePath) + '</dd></div></dl></details></div>';
}

function renderKitProfile(profile) {
  const coverage = profile.coverage || {};
  const entries = list(profile.evidence);
  const checks = list(profile.checks);
  const findings = entries.map((entry) => '<li><strong class="mono">' + esc(entry.path) + '</strong>' +
    tags([['project', nice(entry.kind)], ...list(entry.signals).map((signal) => ['memory', signal])]) + '</li>').join('');
  const commands = checks.map((check) => '<li><strong>' + esc(check.label) + '</strong><p class="small muted">' +
    esc(check.source) + '</p>' + commandMarkup(check.command) + '</li>').join('');
  $('kit-profile').innerHTML = '<div class="panel-body kit-profile"><p class="small muted">Observed ' + dateMarkup(profile.observedAt, true) +
    ' · ' + number(coverage.entries) + ' entries inspected' + (coverage.truncated ? ' (inspection limit reached)' : '') + '.</p>' +
    '<div><h3>Detected stack</h3>' + (list(profile.stack).length ? tags(profile.stack.map((value) => ['project', value])) :
      '<p class="small muted">No supported stack markers found.</p>') + '</div>' +
    (list(profile.packageManagers).length ? '<div><h3>Package managers</h3>' + tags(profile.packageManagers.map((value) => ['memory', value])) + '</div>' : '') +
    (findings ? '<details open><summary>File evidence · ' + number(entries.length) + '</summary><ul class="list kit-evidence">' + findings + '</ul></details>' : '') +
    (commands ? '<details><summary>Suggested project checks · ' + number(checks.length) + '</summary><ul class="list kit-checks">' + commands + '</ul></details>' : '') +
    list(profile.warnings).map((warning) => '<p class="small muted">' + esc(warning) + '</p>').join('') + '</div>';
}

async function loadProjectKit(force = false) {
  const gate = $('kit-gate');
  const workbench = $('kit-workbench');
  if (!state.overviewLoaded) {
    gate.hidden = false;
    gate.innerHTML = skeleton('Checking project workspace…');
    await loadOverview();
  }
  if (!state.overviewLoaded) {
    gate.innerHTML = errorMarkup('Could not check the project workspace.', 'kit-profile');
    return;
  }
  const info = state.projectKit;
  const enabled = info?.available === true;
  workbench.hidden = !enabled;
  $('kit-refresh').hidden = !enabled;
  gate.hidden = enabled;
  if (!enabled) {
    gate.innerHTML = blank('project', 'Start a project workspace', 'Run this command from the project folder to use Project Kit with a project-local store.',
      commandMarkup('shadow-brain project workspace .'));
    return;
  }
  renderKitIdentity(info);
  void loadProjectFeedback();
  const focusMemory = state.view === 'project-kit' ? routeParams().get('memory') || '' : '';
  if (focusMemory || outcomes.project !== info.projectId) void loadFeedbackMemories(focusMemory);
  if (focusMemory && (document.activeElement === $('title-project-kit') || document.activeElement === document.body)) openOutcomeEditor();
  if (kit.profileLoading || kit.profile && !force) return;
  kit.profileLoading = true;
  const target = $('kit-profile');
  $('kit-refresh').disabled = true;
  target.innerHTML = skeleton('Inspecting the pinned project…');
  setBusy(target, true);
  try {
    const profile = await api('project-profile');
    if (profile.projectId !== info.projectId) throw new Error('The server returned a different project profile.');
    kit.profile = profile;
    renderKitProfile(profile);
  } catch (error) {
    kit.profile = null;
    target.innerHTML = errorMarkup(error.message, 'kit-profile');
  } finally {
    kit.profileLoading = false;
    $('kit-refresh').disabled = false;
    setBusy(target, false);
  }
}

async function saveKitKnowledge() {
  if (kit.saving || state.projectKit?.available !== true) return;
  const title = $('kit-knowledge-title').value.trim();
  const content = $('kit-knowledge-content').value;
  const category = $('kit-knowledge-category').value.trim();
  const source = $('kit-knowledge-source').value.trim();
  if (!title || !content.trim()) {
    $('kit-knowledge-status').innerHTML = errorMarkup('Enter a title and knowledge text.');
    return;
  }
  const form = $('kit-knowledge-form');
  const status = $('kit-knowledge-status');
  const button = $('kit-knowledge-save');
  kit.saving = true;
  button.disabled = true;
  status.textContent = 'Saving to the project store…';
  try {
    const result = await api('project-knowledge', { body: { title, content, ...(category ? { category } : {}), ...(source ? { source } : {}) } });
    if (!result.ok || !result.memoryId || result.projectId !== state.projectKit.projectId) throw new Error('The server returned an unreadable saved memory.');
    kit.savedKnowledge = [title, content, source ? 'Recorded reference: ' + source : ''].filter(Boolean).join('\n\n');
    if ($('kit-knowledge-title').value.trim() === title && $('kit-knowledge-content').value === content &&
      $('kit-knowledge-category').value.trim() === category && $('kit-knowledge-source').value.trim() === source) form.reset();
    state.overviewLoaded = false;
    state.graph.snapshot = null;
    void loadFeedbackMemories();
    if (state.context.pack || state.context.pending) {
      state.context.dirty = true;
      if (!state.context.pending) renderContext();
    }
    status.innerHTML = '<div class="stack"><p class="small">Saved as user-provided project knowledge.</p><div class="form-actions">' +
      memoryLink(result.memoryId, result.projectId, 'View saved memory') + '<button class="button quiet" type="button" id="kit-use-knowledge">Use in skill</button>' +
      '<a class="button quiet" href="' + esc(routeLink('context', { project: result.projectId })) + '">Open Context Lab ' + icon('chevron', true) +
      '</a></div><p class="small muted" id="kit-use-status" role="status"></p></div>';
  } catch (error) {
    status.innerHTML = errorMarkup(error.message);
  } finally {
    kit.saving = false;
    button.disabled = false;
  }
}

function useKitKnowledge() {
  const status = $('kit-use-status');
  const field = $('kit-skill-knowledge');
  if (!status || !kit.savedKnowledge) return;
  if (field.value.includes(kit.savedKnowledge)) {
    status.textContent = 'This knowledge is already in the skill draft.';
    field.focus();
    return;
  }
  const next = [field.value, kit.savedKnowledge].filter((value) => value.trim()).join('\n\n');
  if (next.length > field.maxLength) {
    status.textContent = 'The skill draft exceeds 8,000 characters. Use a shorter excerpt from the saved memory.';
    return;
  }
  field.value = next;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  status.textContent = 'Added to the skill draft as reference material.';
  field.focus();
}

const kitFileStates = { create: ['ok', 'Ready to create'], update: ['ok', 'Ready to update'], unchanged: ['', 'Already current'], conflict: ['warn', 'Protected file'] };
const kitApplyStates = { created: 'Created', updated: 'Updated', unchanged: 'Already current' };

function renderKitPreview() {
  const target = $('kit-preview-body');
  const status = $('kit-preview-state');
  const files = list(kit.preview?.files);
  const conflict = files.some((file) => file.status === 'conflict');
  const ready = !!kit.preview && files.length > 0;
  const controls = $('kit-apply-controls');
  controls.hidden = !ready;
  $('kit-apply').disabled = !ready || conflict || kit.dirty || kit.applying || !!kit.applied;
  $('kit-preview-submit').disabled = kit.previewing || kit.applying;
  $('kit-preview').setAttribute('aria-busy', String(kit.previewing || kit.applying));
  if (kit.previewing) {
    status.textContent = 'Generating preview';
    target.innerHTML = skeleton('Building the exact file preview…');
    return;
  }
  if (kit.previewError) {
    status.textContent = 'Preview failed';
    target.innerHTML = errorMarkup(kit.previewError);
    return;
  }
  if (!ready) {
    status.textContent = '';
    target.innerHTML = blank('context', 'Ready to preview', 'Enter a requirement and choose an agent target.');
    return;
  }
  status.textContent = kit.dirty ? 'Preview out of date' : conflict ? 'Protected file' : kit.applied ? 'Applied locally' : kit.applying ? 'Applying' : 'Ready to review';
  const preview = kit.preview;
  const warnings = list(preview.warnings).map((warning) => '<p class="small muted">' + esc(warning) + '</p>').join('');
  const stale = kit.dirty ? '<p class="status small" role="status">Preview again to review the current file plan.</p>' : '';
  target.innerHTML = '<div class="panel-body stack">' + stale + warnings + files.map((file) => {
    const [tone, label] = kitFileStates[file.status] || ['', 'Review'];
    return '<div class="kit-preview-file"><div class="kit-file-header"><strong class="mono">' + esc(file.relativePath) +
      '</strong><span class="tag check-' + tone + '">' + label + '</span></div>' +
      (file.reason ? '<p class="small muted">' + esc(file.reason) + '</p>' : '') +
      '<pre class="context-preview mono" tabindex="0" aria-label="Generated skill file">' + esc(file.content) + '</pre></div>';
  }).join('') + '</div>';
}

async function previewKitSkill() {
  if (kit.previewing || kit.applying || state.projectKit?.available !== true) return;
  const requirement = $('kit-requirement').value;
  const target = $('kit-target').value;
  const name = $('kit-skill-name').value.trim();
  const knowledge = $('kit-skill-knowledge').value;
  if (!requirement.trim()) {
    kit.previewError = 'Enter a requirement for the skill.';
    renderKitPreview();
    return;
  }
  const body = { requirement, target, ...(name ? { name } : {}), ...(knowledge.trim() ? { knowledge } : {}) };
  kit.previewing = true;
  kit.preview = null;
  kit.previewInput = body;
  kit.previewError = '';
  kit.applied = null;
  kit.dirty = false;
  $('kit-apply-status').replaceChildren();
  renderKitPreview();
  try {
    const preview = await api('project-skill-preview', { body });
    if (preview.projectId !== state.projectKit.projectId || !preview.planHash || !list(preview.files).length) {
      throw new Error('The server returned an unreadable skill preview.');
    }
    kit.preview = preview;
  } catch (error) {
    kit.previewError = error.message;
  } finally {
    kit.previewing = false;
    renderKitPreview();
  }
}

async function applyKitSkill() {
  if (!kit.preview || !kit.previewInput || kit.dirty || kit.applying || kit.applied ||
    list(kit.preview.files).some((file) => file.status === 'conflict') || state.projectKit?.available !== true) return;
  const status = $('kit-apply-status');
  kit.applying = true;
  status.textContent = 'Applying the reviewed plan…';
  renderKitPreview();
  try {
    const result = await api('project-skill-apply', { body: { ...kit.previewInput, expectedPlanHash: kit.preview.planHash } });
    if (result.projectId !== state.projectKit.projectId || !list(result.files).length) throw new Error('The server returned an unreadable apply result.');
    kit.applied = result;
    status.innerHTML = '<p class="small">Skill saved in this project.</p><ul class="kit-applied-list small">' + result.files.map((file) =>
      '<li>' + esc(kitApplyStates[file.status] || nice(file.status)) + ' <code class="mono">' + esc(file.relativePath) + '</code></li>').join('') + '</ul>' +
      list(result.warnings).map((warning) => '<p class="small muted">' + esc(warning) + '</p>').join('');
  } catch (error) {
    if (error.status === 409) kit.dirty = true;
    status.innerHTML = errorMarkup(error.message);
  } finally {
    kit.applying = false;
    renderKitPreview();
  }
}

$('kit-refresh').addEventListener('click', () => { void loadProjectKit(true); });
$('kit-identity').addEventListener('click', (event) => {
  if (event.target.closest('#kit-outcomes-jump')) openOutcomeEditor();
});
$('kit-knowledge-form').addEventListener('submit', (event) => { event.preventDefault(); void saveKitKnowledge(); });
$('kit-knowledge-status').addEventListener('click', (event) => {
  if (event.target.closest('#kit-use-knowledge')) useKitKnowledge();
});
$('kit-skill-form').addEventListener('submit', (event) => { event.preventDefault(); void previewKitSkill(); });
$('kit-skill-form').addEventListener('input', () => {
  if (kit.previewInput && !kit.dirty) {
    kit.dirty = true;
    renderKitPreview();
  }
});
$('kit-apply').addEventListener('click', () => { void applyKitSkill(); });
${PROJECT_FEEDBACK_SCRIPT}
renderKitPreview();
`;
