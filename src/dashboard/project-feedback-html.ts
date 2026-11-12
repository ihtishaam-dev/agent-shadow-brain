/** Project-local task outcomes share the workspace memory browser and API helpers. */
export const PROJECT_FEEDBACK_STYLE = String.raw`
  .kit-outcomes { scroll-margin-top: 56px; }
  .outcomes-layout { display: grid; grid-template-columns: minmax(280px,.9fr) minmax(0,1.1fr); align-items: start; }
  .outcome-editor { display: grid; gap: 10px; }
  .outcome-history { border-left: 1px solid var(--line); min-width: 0; }
  .outcome-history .panel-head { background: var(--inset); }
  .outcome-list { max-height: 560px; overflow: auto; }
  .outcome-row { display: grid; gap: 7px; padding: 11px 15px; }
  .outcome-row h4 { margin: 0; font-size: .93rem; overflow-wrap: anywhere; }
  .outcome-row .button { min-height: 32px; }
  .outcome-search { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 6px; }
  .outcome-reason { white-space: pre-wrap; }
  .kit-identity .kit-outcomes-jump { margin-top: 8px; color: var(--signal); }
  .kit-identity .kit-outcomes-jump:hover { background: #254350; }
  @media (max-width: 985px) {
    .outcomes-layout { grid-template-columns: minmax(0,1fr); }
    .outcome-history { border-left: 0; border-top: 1px solid var(--line); }
  }
`;

export const PROJECT_FEEDBACK_MARKUP = String.raw`
          <section class="panel kit-outcomes" aria-labelledby="kit-outcomes-heading" id="kit-outcomes">
            <div class="panel-head">
              <div><h2 id="kit-outcomes-heading" tabindex="-1">Memory outcomes</h2><p class="small muted" id="kit-outcomes-policy">Adaptive retrieval can use reported outcomes when a future task matches.</p></div>
              <button class="button switch" type="button" role="switch" id="kit-feedback-enable" aria-checked="false" aria-label="Use task outcomes in Adaptive retrieval" aria-describedby="kit-outcomes-policy" disabled><span id="kit-feedback-enabled-label" aria-hidden="true">Loading</span><span class="switch-track" aria-hidden="true"></span></button>
            </div>
            <div class="outcomes-layout">
              <div class="panel-body outcome-editor">
                <form id="kit-outcome-search-form" class="outcome-search" role="search" aria-label="Find a memory to rate">
                  <label class="label" for="kit-outcome-query">Find project memory<input type="search" maxlength="500" id="kit-outcome-query" placeholder="Search by title or keyword"></label>
                  <button class="button" id="kit-outcome-search" type="submit"><span data-icon="search"></span>Find</button>
                </form>
                <p class="small muted" id="kit-outcome-memory-status" role="status"></p>
                <form id="kit-outcome-form" class="kit-form">
                  <label class="label" for="kit-outcome-memory">Memory<select id="kit-outcome-memory" required><option value="">Choose a memory</option></select></label>
                  <label class="label" for="kit-outcome-task">Task<textarea id="kit-outcome-task" rows="2" maxlength="1000" required placeholder="What were you working on?"></textarea></label>
                  <label class="label" for="kit-outcome-rating">Outcome<select id="kit-outcome-rating" required><option value="">Choose an outcome</option><option value="useful">Useful</option><option value="not-useful">Not useful</option><option value="incorrect">Incorrect</option></select></label>
                  <label class="label" for="kit-outcome-reason">Reason<textarea id="kit-outcome-reason" rows="3" maxlength="600" required placeholder="How did this memory affect the task?"></textarea></label>
                  <label class="label" for="kit-outcome-evidence">Recorded references <span class="small muted">Optional. Up to 3, one per line.</span><textarea id="kit-outcome-evidence" rows="2" maxlength="542" placeholder="tests/checkout-retry.test.ts"></textarea></label>
                  <button class="button primary" id="kit-outcome-save" type="submit" disabled>Save reported outcome</button>
                  <div id="kit-outcome-status" class="kit-form-status" role="status"></div>
                </form>
              </div>
              <div class="outcome-history">
                <div class="panel-head"><h3>Reported outcomes</h3><span class="small muted" id="kit-outcome-count"></span></div>
                <div id="kit-outcome-records" aria-busy="true"></div>
              </div>
            </div>
          </section>
`;

export const PROJECT_FEEDBACK_SCRIPT = String.raw`
const outcomes = { snapshot: null, saving: false, loading: false, memories: [], memoryRequest: 0, project: '' };
const outcomeRatings = { useful: ['ok', 'Useful'], 'not-useful': ['warn', 'Not useful'], incorrect: ['error', 'Incorrect'] };

function syncOutcomeControls() {
  const current = outcomes.snapshot;
  const toggle = $('kit-feedback-enable');
  toggle.disabled = !current || outcomes.saving;
  toggle.setAttribute('aria-checked', String(current?.enabled === true));
  $('kit-feedback-enabled-label').textContent = !current ? 'Unavailable' : current.enabled ? 'On' : 'Off';
  $('kit-outcome-save').disabled = !current || outcomes.saving || !$('kit-outcome-memory').value;
  $('kit-outcomes-policy').textContent = current?.enabled === false ?
    'Learning is off. Reports remain available for review.' : 'Adaptive retrieval can use reported outcomes when a future task matches.';
  $('kit-outcome-records').querySelectorAll('[data-outcome-remove]').forEach((button) => { button.disabled = outcomes.saving || !current; });
}

function renderOutcomeHistory() {
  const current = outcomes.snapshot;
  const target = $('kit-outcome-records');
  if (!current) return;
  const records = [...list(current.records)].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  $('kit-outcome-count').textContent = countLabel(records.length, 'report');
  const titles = new Map(outcomes.memories.map((memory) => [memory.id, memory.title]));
  target.innerHTML = records.length ? '<ul class="list outcome-list" aria-label="Task outcomes">' + records.map((record) => {
    const [tone, label] = Object.hasOwn(outcomeRatings, record.rating) ? outcomeRatings[record.rating] : ['', 'Reported'];
    return '<li class="outcome-row"><h4>' + esc(record.task) + '</h4><div class="form-actions">' +
      tags([['check-' + tone, label], ['memory', record.reporter === 'agent' ? 'Agent report' : 'User report']]) + dateMarkup(record.updatedAt, true) + '</div>' +
      '<p class="small outcome-reason">' + esc(record.reason) + '</p>' + sourceMarkup(record.evidence) + '<div class="form-actions">' +
      memoryLink(record.memoryId, record.projectId, titles.get(record.memoryId) || 'Open rated memory') +
      '<button type="button" class="button quiet" data-outcome-remove="' + esc(record.id) + '">Remove report</button></div></li>';
  }).join('') + '</ul>' : blank('activity', 'No task outcomes yet', 'Record whether a project memory helped with a specific task.');
  syncOutcomeControls();
}

async function loadProjectFeedback() {
  if (outcomes.loading || outcomes.saving || state.projectKit?.available !== true) return;
  const target = $('kit-outcome-records');
  outcomes.loading = true;
  setBusy(target, true);
  if (!outcomes.snapshot) target.innerHTML = skeleton('Reading reported outcomes…');
  try {
    const snapshot = await api('project-feedback');
    if (!Number.isSafeInteger(snapshot.revision) || typeof snapshot.enabled !== 'boolean' || !Array.isArray(snapshot.records)) {
      throw new Error('The server returned unreadable task outcomes.');
    }
    if (!outcomes.snapshot || snapshot.revision >= outcomes.snapshot.revision) outcomes.snapshot = snapshot;
    renderOutcomeHistory();
  } catch (error) {
    outcomes.snapshot = null;
    target.innerHTML = errorMarkup(error.message, 'kit-feedback');
    $('kit-outcome-count').textContent = '';
  } finally {
    outcomes.loading = false;
    setBusy(target, false);
    syncOutcomeControls();
  }
}

async function loadFeedbackMemories(focusMemory = '') {
  const info = state.projectKit;
  if (info?.available !== true) return;
  const request = ++outcomes.memoryRequest;
  const select = $('kit-outcome-memory');
  const status = $('kit-outcome-memory-status');
  const search = $('kit-outcome-search');
  const q = $('kit-outcome-query').value.trim();
  const selected = focusMemory || select.value;
  status.textContent = 'Finding project memories…';
  search.disabled = true;
  try {
    const result = await api(queryPath('memories', { project: info.projectId, q, limit: 25 }));
    if (request !== outcomes.memoryRequest) return;
    const memories = list(result.items).filter((item) => item.project === info.projectId);
    if (focusMemory && !memories.some((item) => item.id === focusMemory)) {
      try {
        const detail = await api(queryPath('memory', { project: info.projectId, id: focusMemory }));
        if (detail.memory?.project === info.projectId) memories.unshift(detail.memory);
      } catch { /* The selected memory may no longer be available. */ }
    }
    if (request !== outcomes.memoryRequest) return;
    outcomes.memories = memories;
    outcomes.project = info.projectId;
    optionSet('kit-outcome-memory', 'Choose a memory', memories.map((item) => ({ id: item.id, name: item.title || item.id })), selected);
    status.textContent = memories.length ? countLabel(memories.length, 'memory', 'memories') + ' shown. Search to narrow the list.' :
      q ? 'No memories matched this search.' : 'Save project knowledge to record a task outcome.';
    if (focusMemory && !select.value) status.textContent = 'The requested memory is unavailable in this project.';
    renderOutcomeHistory();
  } catch (error) {
    if (request === outcomes.memoryRequest) status.textContent = error.message;
  } finally {
    if (request === outcomes.memoryRequest) {
      search.disabled = false;
      syncOutcomeControls();
    }
  }
}

function openOutcomeEditor() {
  $('kit-outcomes-heading').focus();
}

async function updateProjectFeedback(command) {
  if (!outcomes.snapshot || outcomes.saving) return false;
  const status = $('kit-outcome-status');
  const before = outcomes.snapshot;
  outcomes.saving = true;
  syncOutcomeControls();
  status.textContent = 'Saving task outcomes…';
  let conflict = false;
  try {
    const result = await api('project-feedback', { body: { ...command, expectedRevision: before.revision } });
    const snapshot = result.snapshot || result;
    if (!Number.isSafeInteger(snapshot.revision) || typeof snapshot.enabled !== 'boolean' || !Array.isArray(snapshot.records)) {
      throw new Error('The server returned unreadable task outcomes.');
    }
    outcomes.snapshot = snapshot;
    state.context.dirty = !!state.context.pack || state.context.pending;
    if (state.context.pack && !state.context.pending) renderContext();
    renderOutcomeHistory();
    status.textContent = command.kind === 'record' ? 'Reported outcome saved.' : command.kind === 'remove' ? 'Report removed.' :
      command.enabled ? 'Outcome influence enabled.' : 'Outcome influence paused.';
    return true;
  } catch (error) {
    conflict = error.status === 409;
    status.innerHTML = errorMarkup(error.message);
    return false;
  } finally {
    outcomes.saving = false;
    syncOutcomeControls();
    if (conflict) void loadProjectFeedback();
  }
}

async function saveOutcome() {
  const memoryId = $('kit-outcome-memory').value;
  const task = $('kit-outcome-task').value.trim();
  const rating = $('kit-outcome-rating').value;
  const reason = $('kit-outcome-reason').value.trim();
  const referenceInput = $('kit-outcome-evidence').value;
  const evidence = referenceInput.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!memoryId || !task || !reason || !Object.hasOwn(outcomeRatings, rating)) {
    $('kit-outcome-status').innerHTML = errorMarkup('Choose a memory and provide the task, outcome, and reason.');
    return;
  }
  if (evidence.length > 3 || evidence.some((line) => line.length > 180)) {
    $('kit-outcome-status').innerHTML = errorMarkup('Enter up to three references with at most 180 characters each.');
    return;
  }
  if (await updateProjectFeedback({ kind: 'record', memoryId, task, rating, reason, ...(evidence.length ? { evidence } : {}) })) {
    if ($('kit-outcome-reason').value.trim() === reason) $('kit-outcome-reason').value = '';
    if ($('kit-outcome-evidence').value === referenceInput) $('kit-outcome-evidence').value = '';
  }
}

$('kit-feedback-enable').addEventListener('click', () => {
  if (outcomes.snapshot) void updateProjectFeedback({ kind: 'enable', enabled: !outcomes.snapshot.enabled });
});
$('kit-outcome-search-form').addEventListener('submit', (event) => { event.preventDefault(); void loadFeedbackMemories(); });
$('kit-outcome-form').addEventListener('submit', (event) => { event.preventDefault(); void saveOutcome(); });
$('kit-outcome-memory').addEventListener('change', syncOutcomeControls);
$('kit-outcome-records').addEventListener('click', (event) => {
  const button = event.target.closest('[data-outcome-remove]');
  if (button) void updateProjectFeedback({ kind: 'remove', id: button.dataset.outcomeRemove });
});
`;
