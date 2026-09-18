import { describe, expect, it, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { NOTEBOOK_MAX_COUNT } from "@/constants/ui";
import { notebookIndexKey } from "@/lib/jupyterCell";
import { useWorkspaceNotebooks } from "@/hooks/useWorkspaceNotebooks";

function seedIndex(ids: string[], ws = "ws1") {
  localStorage.setItem(
    notebookIndexKey(ws),
    JSON.stringify(ids.map((id, i) => ({ id, name: `N${i}`, updatedAt: 1 }))),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("useWorkspaceNotebooks", () => {
  it("composes rapid deletes instead of resurrecting entries", () => {
    seedIndex(["a", "b", "c"]);
    const { result } = renderHook(() => useWorkspaceNotebooks("ws1"));
    expect(result.current.notebooks.map((n) => n.id)).toEqual(["a", "b", "c"]);
    // Same-tick double delete: both calls share one render closure.
    act(() => {
      result.current.deleteNotebook("b");
      result.current.deleteNotebook("c");
    });
    expect(result.current.notebooks.map((n) => n.id)).toEqual(["a"]);
  });

  it("never deletes the last notebook", () => {
    seedIndex(["only"]);
    const { result } = renderHook(() => useWorkspaceNotebooks("ws1"));
    act(() => {
      result.current.deleteNotebook("only");
    });
    expect(result.current.notebooks.map((n) => n.id)).toEqual(["only"]);
  });

  it("heals the active pointer onto a surviving notebook", () => {
    seedIndex(["a", "b"]);
    const { result } = renderHook(() => useWorkspaceNotebooks("ws1"));
    act(() => {
      result.current.setActiveNotebook("b");
    });
    expect(result.current.activeId).toBe("b");
    act(() => {
      result.current.deleteNotebook("b");
    });
    expect(result.current.activeId).toBe("a");
  });

  it("refuses creation past the per-workspace cap", () => {
    seedIndex(Array.from({ length: NOTEBOOK_MAX_COUNT }, (_, i) => `nb${i}`));
    const { result } = renderHook(() => useWorkspaceNotebooks("ws1"));
    expect(result.current.notebooks).toHaveLength(NOTEBOOK_MAX_COUNT);
    let created: unknown = "unset";
    act(() => {
      created = result.current.createNotebook();
    });
    expect(created).toBeNull();
    expect(result.current.notebooks).toHaveLength(NOTEBOOK_MAX_COUNT);
  });
});
