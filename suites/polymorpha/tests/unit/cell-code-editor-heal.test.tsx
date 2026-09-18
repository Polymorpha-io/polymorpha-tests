import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

/**
 * Dead-model self-heal regression (jsdom, fake Monaco).
 *
 * The bug: a Monaco model disposed while its editor stays mounted leaves the
 * editor blank — Monaco detaches the model, the @monaco-editor/react value
 * sync no longer lands, and state writes (Stella "Fix with AI" applies,
 * Undo) display nowhere: results stay, the code looks lost. The pane-level
 * suites stub the editor, so this file mocks the Monaco modules directly
 * and drives the real CellCodeEditor heal path.
 */

class FakeModel {
  value: string;
  readonly uri: string;
  disposed = false;
  constructor(value: string, uri: string) {
    this.value = value;
    this.uri = uri;
  }
  getValue(): string {
    if (this.disposed) throw new Error("Model is disposed!");
    return this.value;
  }
  setValue(next: string): void {
    if (this.disposed) throw new Error("Model is disposed!");
    this.value = next;
  }
  isDisposed(): boolean {
    return this.disposed;
  }
  dispose(): void {
    this.disposed = true;
  }
}

const models = new Map<string, FakeModel>();
const uri = (path: string) => ({ toString: () => path });
const modelAt = (path: string): FakeModel | null => models.get(path) ?? null;
const createAt = (value: string, path: string): FakeModel => {
  const m = new FakeModel(value, path);
  models.set(path, m);
  return m;
};

class FakeEditor {
  model: FakeModel | null = null;
  getModel(): FakeModel | null {
    return this.model;
  }
  setModel(m: FakeModel | null): void {
    this.model = m;
  }
  addCommand(): void {}
  getContentHeight(): number {
    return 40;
  }
  onDidContentSizeChange(): { dispose(): void } {
    return { dispose: () => {} };
  }
  getDomNode(): null {
    return null;
  }
}

// Fake monaco namespace: the model registry is shared between the wrapper
// mount (getModel/createModel) and the self-heal effect under test.
vi.mock("monaco-editor/esm/vs/editor/editor.api", () => ({
  Uri: { parse: (path: string) => uri(path) },
  editor: {
    getModel: (u: { toString(): string }) => modelAt(u.toString()),
    createModel: (value: string, _lang: string, u: { toString(): string }) =>
      createAt(value, u.toString()),
    getModels: () => [...models.values()],
    getEditors: () => [],
  },
  KeyMod: { Shift: 1 },
  KeyCode: { Enter: 3 },
  languages: { registerCompletionItemProvider: () => ({ dispose: () => {} }) },
}));

vi.mock(
  "monaco-editor/esm/vs/basic-languages/python/python.contribution",
  () => ({}),
);
vi.mock("monaco-editor/min/vs/editor/editor.main.css", () => ({}));
vi.mock("monaco-editor/esm/vs/editor/editor.worker?worker", () => ({
  default: class {},
}));

// Fake @monaco-editor/react: attach whatever getModel returns on mount —
// INCLUDING a disposed model — exactly like the real wrapper (its getModel
// does not filter dead models). No value sync here: the self-heal effect is
// the mechanism under test.
const mounted: FakeEditor[] = [];
vi.mock("@monaco-editor/react", async () => {
  const React = await import("react");
  const FakeEditorComponent = (props: {
    value: string;
    path?: string;
    onMount?: (editor: FakeEditor) => void;
  }) => {
    React.useEffect(() => {
      const editor = new FakeEditor();
      const path = props.path ?? "";
      editor.setModel(path ? modelAt(path) : createAt(props.value, path));
      mounted.push(editor);
      props.onMount?.(editor);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return React.createElement("div");
  };
  return { default: FakeEditorComponent, loader: { config: () => {} } };
});

import CellCodeEditor, {
  disposeCellModel,
} from "@/components/DataPreview/CellCodeEditor";

const PATH = "inmemory://nbcell/c1";

function editorOf(): FakeEditor {
  expect(mounted).toHaveLength(1);
  return mounted[0];
}

beforeEach(() => {
  models.clear();
  mounted.length = 0;
});

describe("CellCodeEditor dead-model self-heal", () => {
  it("creates a live model seeded from value on mount when the kept model is dead", () => {
    // Pre-kill: a stale disposed model at the URI (e.g. an async disposal
    // raced the remount). The real wrapper attaches the dead model — the
    // pre-heal code rendered blank from the first frame.
    createAt("old code", PATH).dispose();
    render(
      <CellCodeEditor
        value="print('healed')"
        onChange={() => {}}
        label="Cell 1"
        modelPath={PATH}
      />,
    );
    const model = editorOf().getModel();
    expect(model).not.toBeNull();
    expect(model!.isDisposed()).toBe(false);
    expect(model!.getValue()).toBe("print('healed')");
  });

  it("reattaches a live model with the new value after the model dies mid-session", () => {
    const view = render(
      <CellCodeEditor
        value="x = 1"
        onChange={() => {}}
        label="Cell 1"
        modelPath={PATH}
      />,
    );
    const editor = editorOf();
    // Death: disposal + Monaco's detach (setModel(null)).
    disposeCellModel("c1");
    editor.setModel(null);
    // The Stella-apply scenario: state writes a new source, the editor
    // must display it instead of staying blank.
    view.rerender(
      <CellCodeEditor
        value="print(df.head().to_string())"
        onChange={() => {}}
        label="Cell 1"
        modelPath={PATH}
      />,
    );
    const healed = editor.getModel();
    expect(healed).not.toBeNull();
    expect(healed!.isDisposed()).toBe(false);
    expect(healed!.getValue()).toBe("print(df.head().to_string())");
  });

  it("keeps the mounted live model untouched when it already matches value", () => {
    const view = render(
      <CellCodeEditor
        value="x = 1"
        onChange={() => {}}
        label="Cell 1"
        modelPath={PATH}
      />,
    );
    const editor = editorOf();
    const before = editor.getModel();
    view.rerender(
      <CellCodeEditor
        value="x = 1"
        onChange={() => {}}
        label="Cell 1"
        modelPath={PATH}
      />,
    );
    expect(editor.getModel()).toBe(before);
    expect(before!.getValue()).toBe("x = 1");
    expect(before!.isDisposed()).toBe(false);
  });
});
