import { describe, it, expect } from 'vitest';
import { runInNewContext } from 'node:vm';
import { V6_DASHBOARD_HTML } from '../../src/dashboard/v6-dashboard-html.js';

describe('dashboard activity log', () => {
  it('renders memory text and event labels as text instead of executable HTML', () => {
    const extract = (name: string, next: string) => V6_DASHBOARD_HTML.slice(
      V6_DASHBOARD_HTML.indexOf(`function ${name}(`),
      V6_DASHBOARD_HTML.indexOf(`function ${next}(`),
    );
    const panel = { innerHTML: '' };
    const payload = '<img src=x onerror="alert(1)"> & <script>bad()</script>';
    runInNewContext(`${extract('htmlEscape', 'fmtDate')}\n${extract('renderLogPanel', 'toggleLogPanel')}\nrenderLogPanel();`, {
      logEntries: [{ t: new Date(), source: payload, type: payload, detail: payload }],
      document: { getElementById: () => panel },
    });
    expect(panel.innerHTML).not.toContain('<img');
    expect(panel.innerHTML).not.toContain('<script');
    expect(panel.innerHTML.match(/&lt;img/g)).toHaveLength(3);
    expect(panel.innerHTML).toContain('&quot;alert(1)&quot;');
    expect(panel.innerHTML).toContain('&amp;');
  });
});
