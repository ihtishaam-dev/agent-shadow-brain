import { describe, expect, it } from 'vitest';
import { analyzeTask, type TaskWorkflowOptions } from '../../src/brain/task-workflow.js';

function stepIds(workflow: ReturnType<typeof analyzeTask>): string[] {
  return workflow.steps.map(step => step.id);
}

describe('advisory task workflows', () => {
  it.each([
    'Translate this sentence: "Publish it to npm."',
    'What does this function do?',
    'How do I deploy this package?',
    'How to publish an npm package?',
    'Rewrite this sentence.',
    'Fix the grammar in this sentence: she go home',
    'Fix this typo in the README.',
  ])('keeps simple or instructional requests direct: %s', request => {
    const workflow = analyzeTask(request);
    expect(workflow).toMatchObject({ taskType: 'direct', mode: 'direct', skills: [], requiresAuthorization: [] });
    expect(stepIds(workflow)).toEqual(['respond']);
  });

  it('reproduces and verifies a requested fix for a failing parser test', () => {
    const workflow = analyzeTask('Fix the failing grammar parser test.');
    expect(workflow).toMatchObject({ taskType: 'debug', mode: 'direct', skills: ['shadow-workflow', 'shadow-debug'] });
    expect(stepIds(workflow)).toEqual(['reproduce', 'fix', 'verify']);
  });

  it.each([
    'Analyze only: why is this build failing?',
    'Diagnosis only: investigate this crash.',
    'Diagnose why the importer crashes without changing files.',
  ])('keeps diagnosis scoped to observation: %s', request => {
    const workflow = analyzeTask(request);
    expect(workflow).toMatchObject({ taskType: 'debug', mode: 'direct', requiresAuthorization: [] });
    expect(stepIds(workflow)).toEqual(['reproduce', 'diagnosis']);
  });

  it.each([
    'Build a new import flow across API and UI.',
    'Rewrite the authentication service across the API and UI.',
    'Convert the legacy backend to TypeScript.',
    'Give me a plan and then implement the parser changes.',
    'Plan the feature. Then implement it.',
  ])('plans and verifies a substantive implementation: %s', request => {
    const workflow = analyzeTask(request);
    expect(workflow).toMatchObject({ taskType: 'implement', mode: 'plan-then-execute' });
    expect(stepIds(workflow)).toEqual(expect.arrayContaining(['plan', 'implement', 'verify']));
  });

  it.each(['Review this PR without changing anything.', 'Review this PR and explain the fix.'])(
    'preserves read-only review scope: %s', request => {
      const workflow = analyzeTask(request);
      expect(workflow).toMatchObject({ taskType: 'review', mode: 'direct', requiresAuthorization: [] });
      expect(stepIds(workflow)).toEqual(['review', 'findings']);
    },
  );

  it('suggests scoped fixes when the review explicitly requests them', () => {
    const workflow = analyzeTask('Review this PR and fix any regressions you find.');
    expect(workflow.taskType).toBe('review');
    expect(stepIds(workflow)).toEqual(['review', 'fix', 'verify', 'findings']);
  });

  it.each([
    'Plan the migration; do not execute.',
    'Plan a storage migration; do not change code.',
    'Draft a plan only for the import flow.',
  ])('honors text limiting execution even if an execute option is present: %s', request => {
    const workflow = analyzeTask(request, { mode: 'execute' });
    expect(workflow.mode).toBe('plan-only');
    expect(stepIds(workflow)).toEqual(['inspect', 'plan']);
    expect(workflow.requiresAuthorization).toEqual([]);
  });

  it('uses source verification for research without implementation or publishing', () => {
    const workflow = analyzeTask('Research which API supports this feature.');
    expect(workflow).toMatchObject({ taskType: 'research', requiresAuthorization: [] });
    expect(stepIds(workflow)).toEqual(['sources', 'answer']);
  });

  it('separates release preparation from explicitly requested remote actions', () => {
    const checklist = analyzeTask('Prepare a release checklist but do not publish.');
    expect(checklist).toMatchObject({ taskType: 'release', mode: 'plan-only', requiresAuthorization: [] });
    const packageOnly = analyzeTask('Prepare the release artifact for publishing later.');
    expect(packageOnly).toMatchObject({ taskType: 'release', requiresAuthorization: [] });
    expect(stepIds(packageOnly)).not.toContain('release');
    const quoted = analyzeTask('Prepare the release notes from this log: "publish to npm"');
    expect(quoted.requiresAuthorization).toEqual([]);
    const publish = analyzeTask('Publish the tested package to the repository and npm.');
    expect(publish).toMatchObject({ taskType: 'release', mode: 'plan-then-execute', requiresAuthorization: ['publish'] });
    expect(stepIds(publish)).toEqual(expect.arrayContaining(['artifact', 'release', 'verify']));
  });

  it('uses supported overrides and rejects unsupported values and empty input', () => {
    const options: TaskWorkflowOptions = { taskType: 'implement', complexity: 'simple', mode: 'execute' };
    expect(analyzeTask('Please handle this change across API and UI.', options))
      .toMatchObject({ taskType: 'implement', mode: 'direct' });
    expect(analyzeTask('Build a new parser.', { mode: 'plan-only' }).mode).toBe('plan-only');
    expect(() => analyzeTask(' ')).toThrow(TypeError);
    expect(() => analyzeTask('Build a parser.', { mode: 'other' } as never)).toThrow(TypeError);
    expect(() => analyzeTask('Build a parser.', { taskType: 'unsupported' } as never)).toThrow(TypeError);
    expect(() => analyzeTask('Build a parser.', { complexity: 'unsupported' } as never)).toThrow(TypeError);
  });

  it('returns a deterministic bounded fallback and explains its language limitation', () => {
    const request = 'Bitte kurze Hinweise. ' + 'Kontext '.repeat(30_000);
    const workflow = analyzeTask(request);
    expect(workflow).toEqual(analyzeTask(request));
    expect(workflow).toMatchObject({ taskType: 'direct', skills: [], mode: 'direct' });
    expect(workflow.steps).toHaveLength(1);
    expect(workflow.limitations.some(limit => limit.includes('English'))).toBe(true);
  });
});
