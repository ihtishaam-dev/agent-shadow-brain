export type TaskType = 'direct' | 'implement' | 'debug' | 'review' | 'research' | 'release';

export interface TaskWorkflowOptions {
  mode?: 'auto' | 'plan-only' | 'execute';
  taskType?: 'auto' | Exclude<TaskType, 'direct'>;
  complexity?: 'auto' | 'simple' | 'complex';
}

export interface TaskWorkflow {
  taskType: TaskType;
  mode: 'direct' | 'plan-only' | 'plan-then-execute';
  skills: string[];
  steps: Array<{ id: string; title: string; completion: string }>;
  reasons: string[];
  requiresAuthorization: string[];
  limitations: string[];
}

type TaskStep = TaskWorkflow['steps'][number];

const TRANSFORMATION = /^(?:(?:please|just)\s+)*(?:translate|rewrite|rephrase|summarize|summarise|proofread|format|capitalize|convert|shorten)\b/;
const SMALL_EDIT = /^(?:(?:please|just)\s+)*(?:fix|correct)\s+(?:this|the|a|one)\s+(?:typo|spelling|punctuation|grammar in (?:this|the) (?:sentence|text|paragraph))\b/;
const EXPLANATION = /^(?:(?:please|just)\s+)*(?:what (?:does|is|are|means?)|why does|how (?:does|do i|can i|to)|explain|define)\b/;
const ENGINEERING_SCOPE = /\b(?:api|backend|frontend|service|application|database|codebase|repository|entire project)\b/;
const DIAGNOSIS_ONLY = /\b(?:analy[sz]e|analysis|diagnose|diagnosis|investigate|inspection) only\b/;
const PLAN_ONLY = /\b(?:plan only|only plan|just plan|planning only|just (?:write|make|draft|give|provide)?\s*(?:me )?a plan|do not execute|don['’]t execute|without executing)\b/;
const ASK_FOR_PLAN = /^(?:(?:please|just)\s+)*(?:plan\b|outline\b|(?:make|create|draft|write|provide|give)\s+(?:me\s+)?(?:a\s+)?(?:\w+\s+){0,2}(?:plan|roadmap)\b)/;
const PLAN_THEN_EXECUTE = /\b(?:plan|outline)\b[^.!?\n]{0,120}(?:[.!?\n]\s*then|\b(?:then|and))\s+(?:(?:actually|also|then)\s+)?(?:implement|execute|fix|build|repair|apply|ship|deploy|publish)\b/;
const NO_EDITS = /\b(?:(?:do not|don['’]t|never|without|no)\s+(?:make\s+)?(?:chang(?:e|es|ing)|edit(?:s|ing)?|modify(?:ing)?|mutat(?:e|ion|ing)?|implement(?:ing)?|write|writing)|read[- ]only|leave (?:the files|everything) unchanged)\b/;
const REVIEW_REQUEST = /\b(?:review|audit|inspect|assess)\s+(?:this|the|my|our|these|a|an|changes|code|pr|pull request|patch|diff|repo(?:sitory)?|for)\b|^(?:please\s+)?(?:review|audit)\b/;
const RESEARCH_REQUEST = /\b(?:research|look up|find out|compare)\b|\b(?:which|what)\b[^.!?\n]{0,100}\b(?:current|latest|supports?|available|official)\b/;
const DEBUG_REQUEST = /\b(?:debug|diagnose|diagnosis|troubleshoot|reproduce|regression|broken|failing|fails|failure|crash(?:es|ing)?|error|bug|repair)\b/;
const DIAGNOSIS_REQUEST = /^(?:(?:please|just)\s+)*(?:diagnose|investigate|analy[sz]e|identify the cause|find out why)\b/;
const IMPLEMENT_REQUEST = /\b(?:build|implement|add|create|write|update|modify|refactor|integrate|migrate|migration|change|fix|edit|improve|rewrite|convert)\b/;
const RELEASE_REQUEST = /\b(?:release (?:checklist|plan|package|artifact|notes|preparation)|(?:prepare|stage|cut|make|create)\b[^.!?\n]{0,80}\b(?:release|artifact)|package (?:the|this|our) (?:release|project|artifact|build|application)|(?:publish|deploy|ship|push|tag)\b[^.!?\n]{0,80}\b(?:npm|production|artifact|package|release|repository|repo\b|github|version|build|live)|(?:publish|deploy)\b)/;
const COMPLEX_REQUEST = /\b(?:migration|migrate|rollout|production|architecture|cross[- ](?:service|project|platform)|multiple (?:components|services|projects|files)|across (?:the )?(?:api|ui|backend|frontend|services|projects)|(?:api|backend)\s+(?:and|plus)\s+(?:ui|frontend)|end[- ]to[- ]end|from scratch|multi[- ]step)\b/;
const NEGATIVE_CLAUSE = /\b(?:do not|don['’]t|never|without|avoid|no)\s+[^.!?;,\n]*?(?=\s+(?:but|then|however)\b|[.!?;,\n]|$)/g;

const RELEASE_CHECKLIST = /\brelease (?:checklist|roadmap|plan)\b/;

function requestedAction(phrase: string): RegExp {
  return new RegExp('(?:^|[.;!?\\n]|\\b(?:and|then|also|but|please|can you|could you|would you)\\s+)\\s*(?:' + phrase + ')\\b');
}

const REQUESTED_EDIT = requestedAction('fix|implement|repair|patch|apply|edit|update|change|modify');

const SIDE_EFFECTS: Array<[string, RegExp]> = [
  ['publish', requestedAction('publish|push\\s+(?:it|to|the|this|our)|upload\\b[^.!?\\n]{0,65}\\b(?:npm|github|repository)')],
  ['deploy', requestedAction('deploy|roll out')],
  ['destructive-change', requestedAction('force[- ]push|(?:delete|drop|purge|erase|wipe|remove)\\s+(?:all\\s+|the\\s+|our\\s+|a\\s+)*(?:production|database|accounts?|repositories|repository|backups?|customer data)')],
  ['send-external-message', requestedAction('send\\s+(?:an?\\s+|the\\s+|this\\s+)?(?:message|email|notice)|email\\s+(?:our|the|all)|notify\\s+(?:our|the|all)')],
  ['spend-money', requestedAction('purchase|buy|place (?:an?|the) order|subscribe to')],
];

function actionText(request: string): string {
  return request
    .replace(/\x60{3}[\s\S]*?(?:\x60{3}|$)|\x60[^\x60\n]*\x60|“[^”\n]*”|"[^"\n]*"|(^|\s)'[^'\n]*'(?=\s|[.!?,;]|$)/g, ' ')
    .toLowerCase()
    .trim();
}

function step(id: string, title: string, completion: string): TaskStep {
  return { id, title, completion };
}

function buildSteps(taskType: TaskType, mode: TaskWorkflow['mode'], mayEdit: boolean, external: string[]): TaskStep[] {
  if (mode === 'plan-only') {
    return [
      step('inspect', 'Inspect the relevant context', 'Identify the requested outcome, constraints, and current state using available evidence.'),
      step('plan', 'Write the requested plan', 'Describe the proposed actions and verification, then stop at the plan.'),
    ];
  }

  const steps: TaskStep[] = [];
  if (mode === 'plan-then-execute') {
    steps.push(step('plan', 'Plan the scoped work', 'Identify dependencies, material risks, and how to verify the requested outcome.'));
  }

  switch (taskType) {
    case 'direct':
      steps.push(step('respond', 'Complete the request', 'Return the requested result in the requested format.'));
      break;
    case 'implement':
      steps.push(step('inspect', 'Inspect the relevant code and constraints', 'Identify existing behavior and the acceptance criteria for the change.'));
      if (mayEdit) {
        steps.push(
          step('implement', 'Implement the scoped change', 'Deliver the requested behavior through its normal entry points.'),
          step('verify', 'Verify the affected behavior', 'Check the result against the request and report any remaining gap.'),
        );
      }
      break;
    case 'debug':
      steps.push(step('reproduce', 'Reproduce or isolate the failure', 'Identify the failing behavior and the evidence for its cause.'));
      if (mayEdit) {
        steps.push(
          step('fix', 'Fix the isolated cause', 'Make the smallest change that resolves the requested failure.'),
          step('verify', 'Verify the original failure', 'Repeat the failing path and check the related behavior for regressions.'),
        );
      } else {
        steps.push(step('diagnosis', 'Report the diagnosis', 'State the cause supported by the evidence and any remaining uncertainty.'));
      }
      break;
    case 'review':
      steps.push(step('review', 'Review the requested scope', 'Inspect the relevant changes and prioritize actionable findings with evidence.'));
      if (mayEdit) {
        steps.push(
          step('fix', 'Fix the requested findings', 'Apply scoped changes for findings the user asked to fix.'),
          step('verify', 'Verify the fixes', 'Confirm the observed problems are resolved in the affected paths.'),
        );
      }
      steps.push(step('findings', 'Report the review findings', 'Give evidence and locations for actionable findings, with remaining verification gaps.'));
      break;
    case 'research':
      steps.push(
        step('sources', 'Check the relevant sources', 'Use available primary evidence and identify gaps or conflicting information.'),
        step('answer', 'Answer the research question', 'State what the evidence supports and identify material uncertainty.'),
      );
      break;
    case 'release':
      steps.push(step('artifact', 'Prepare and verify the release artifact', 'Confirm version, artifact identity, destination when specified, and relevant checks.'));
      if (external.some(action => action === 'publish' || action === 'deploy')) {
        steps.push(
          step('release', 'Carry out the authorized release action', 'Use the intended destination and the verified artifact with existing authorization.'),
          step('verify', 'Verify the destination independently', 'Confirm the actual remote version, artifact, or deployed result.'),
        );
      } else {
        steps.push(step('report', 'Report the release preparation', 'Provide the requested checklist or release materials and any remaining dependencies.'));
      }
      break;
  }

  return steps;
}

/** Return advisory routing based on the request and explicit options. */
export function analyzeTask(request: string, options: TaskWorkflowOptions = {}): TaskWorkflow {
  if (typeof request !== 'string' || !request.trim()) throw new TypeError('A nonempty task request is required.');
  const { mode = 'auto', taskType: selectedType = 'auto', complexity = 'auto' } = options;
  if (!['auto', 'plan-only', 'execute'].includes(mode)) throw new TypeError('Unknown workflow mode.');
  if (!['auto', 'implement', 'debug', 'review', 'research', 'release'].includes(selectedType)) {
    throw new TypeError('Unknown workflow task type.');
  }
  if (!['auto', 'simple', 'complex'].includes(complexity)) throw new TypeError('Unknown workflow complexity.');

  const text = actionText(request);
  const positive = text.replace(NEGATIVE_CLAUSE, ' ');
  const noEdits = NO_EDITS.test(text) || DIAGNOSIS_ONLY.test(text) || /\bno (?:code|file|source) changes\b/.test(text);
  const explicitPlan = PLAN_ONLY.test(text);
  const thenExecute = PLAN_THEN_EXECUTE.test(positive);
  const planRequested = ASK_FOR_PLAN.test(text) || RELEASE_CHECKLIST.test(text);
  const planOnly = mode === 'plan-only' || explicitPlan || (planRequested && noEdits) ||
    (mode === 'auto' && !thenExecute && planRequested);
  const engineeringTransform = TRANSFORMATION.test(text) && ENGINEERING_SCOPE.test(text);
  const directRequest = SMALL_EDIT.test(text) || (TRANSFORMATION.test(text) && !engineeringTransform) ||
    (EXPLANATION.test(text) && !RESEARCH_REQUEST.test(text));
  let taskType: TaskType;
  const reasons: string[] = [];

  if (selectedType !== 'auto') {
    taskType = selectedType;
    reasons.push('The task type was selected explicitly.');
  } else if (directRequest) {
    taskType = 'direct';
    reasons.push('The request is a direct answer or small transformation.');
  } else if (REVIEW_REQUEST.test(positive)) {
    taskType = 'review';
    reasons.push('The request asks for findings from a review.');
  } else if (RESEARCH_REQUEST.test(positive)) {
    taskType = 'research';
    reasons.push('The request asks for source-based information or comparison.');
  } else if (RELEASE_REQUEST.test(positive)) {
    taskType = 'release';
    reasons.push('The request concerns release preparation or delivery.');
  } else if (DEBUG_REQUEST.test(positive)) {
    taskType = 'debug';
    reasons.push('The request identifies a failure or regression.');
  } else if (IMPLEMENT_REQUEST.test(positive) || thenExecute) {
    taskType = 'implement';
    reasons.push('The request asks for a scoped implementation.');
  } else {
    taskType = 'direct';
    reasons.push('The request has no clear specialized workflow cue.');
  }

  if (noEdits) reasons.push('The request limits the work to inspection.');

  const complex = complexity === 'complex' ||
    (complexity === 'auto' && taskType !== 'direct' &&
      (taskType === 'release' || engineeringTransform || COMPLEX_REQUEST.test(positive)));
  const resultMode: TaskWorkflow['mode'] = planOnly ? 'plan-only' : thenExecute || complex ? 'plan-then-execute' : 'direct';
  if (planOnly) reasons.push('The workflow stops after planning.');
  else if (thenExecute) reasons.push('The request explicitly asks to plan and then act.');
  else if (complex) reasons.push('The scope benefits from a short plan before work starts.');

  const requestedEdit = REQUESTED_EDIT.test(positive);
  const mayEdit = !noEdits && (taskType !== 'review' || requestedEdit) &&
    (taskType !== 'debug' || !DIAGNOSIS_REQUEST.test(positive) || requestedEdit);
  const sideEffects = planOnly || noEdits || taskType === 'research' || (taskType === 'review' && !mayEdit) || directRequest
    ? []
    : SIDE_EFFECTS.filter(([, pattern]) => pattern.test(positive)).map(([id]) => id);
  const skills = taskType === 'direct'
    ? (resultMode === 'direct' ? [] : ['shadow-workflow'])
    : ['shadow-workflow', 'shadow-' + taskType];
  return {
    taskType,
    mode: resultMode,
    skills,
    steps: buildSteps(taskType, resultMode, mayEdit, sideEffects),
    reasons,
    requiresAuthorization: sideEffects,
    limitations: [
      'Routing uses English request cues and explicit options.',
      'The host performs the suggested work and checks authorization already present in the conversation.',
    ],
  };
}
