// withDoks: layout-import linter. Should warn when app/layout.tsx is
// missing the side-effect import of the generated content map, and stay
// silent when the import is present.

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { withDoks } from '../dist/next/index.js';

let _origCwd;
let _origWarn;
let _captured = [];

beforeEach(() => {
  _origCwd = process.cwd();
  _origWarn = console.warn;
  _captured = [];
  console.warn = (...args) => {
    _captured.push(args.map((a) => String(a)).join(' '));
  };
});

afterEach(() => {
  process.chdir(_origCwd);
  console.warn = _origWarn;
});

function mkProject(layoutSrc) {
  const root = join(tmpdir(), `doks-withdoks-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(root, 'app'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  mkdirSync(join(root, 'content', 'docs'), { recursive: true });
  if (layoutSrc) writeFileSync(join(root, 'app', 'layout.tsx'), layoutSrc);
  process.chdir(root);
  return root;
}

const SUCCESS_LAYOUT = `
import "./globals.css";
import "@/lib/doks-content.gen";
import { siteConfig } from "@/lib/site.config";
export default function Layout({ children }) { return children; }
`;

const FAILING_LAYOUT = `
import "./globals.css";
import { siteConfig } from "@/lib/site.config";
export default function Layout({ children }) { return children; }
`;

test('withDoks: warns when layout is missing the gen import', () => {
  const root = mkProject(FAILING_LAYOUT);
  try {
    withDoks({}, { silent: true });
    const msg = _captured.join('\n');
    assert.match(msg, /does not import the bundled content map/);
    assert.match(msg, /app\/layout\.tsx/);
    assert.match(msg, /doks-content\.gen/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withDoks: silent when layout has the gen import', () => {
  const root = mkProject(SUCCESS_LAYOUT);
  try {
    withDoks({}, { silent: true });
    const msg = _captured.join('\n');
    assert.doesNotMatch(msg, /does not import the bundled content map/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withDoks: silent when no layout file exists (custom layout)', () => {
  const root = mkProject(null);
  try {
    withDoks({}, { silent: true });
    const msg = _captured.join('\n');
    assert.doesNotMatch(msg, /does not import the bundled content map/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withDoks: skipLayoutCheck silences the warning', () => {
  const root = mkProject(FAILING_LAYOUT);
  try {
    withDoks({}, { silent: true, skipLayoutCheck: true });
    const msg = _captured.join('\n');
    assert.doesNotMatch(msg, /does not import the bundled content map/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withDoks: matches relative import paths too (./lib/...)', () => {
  const layout = `
import "./globals.css";
import "./lib/doks-content.gen";
export default function Layout({ children }) { return children; }
`;
  const root = mkProject(layout);
  try {
    withDoks({}, { silent: true });
    const msg = _captured.join('\n');
    assert.doesNotMatch(msg, /does not import the bundled content map/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('withDoks: src/app/layout.tsx is also detected', () => {
  const root = join(tmpdir(), `doks-withdoks-src-${Date.now()}`);
  mkdirSync(join(root, 'src', 'app'), { recursive: true });
  mkdirSync(join(root, 'lib'), { recursive: true });
  mkdirSync(join(root, 'content', 'docs'), { recursive: true });
  writeFileSync(join(root, 'src', 'app', 'layout.tsx'), FAILING_LAYOUT);
  process.chdir(root);
  try {
    withDoks({}, { silent: true });
    const msg = _captured.join('\n');
    assert.match(msg, /src\/app\/layout\.tsx/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
