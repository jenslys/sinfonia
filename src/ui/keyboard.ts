import type { ProcessManager } from "../process/manager.js";

export function setupKeyboardHandlers(manager: ProcessManager): void {
  process.stdin.on("keypress", (str, key) => {
    if (manager.isSearchMode()) {
      handleSearchMode(str, key, manager);
      return;
    }

    handleNormalMode(key, manager);
  });
}

function handleSearchMode(
  str: string | undefined,
  key: { name?: string; ctrl?: boolean },
  manager: ProcessManager
): void {
  if (key.name === "escape" || (key.ctrl && key.name === "c")) {
    manager.toggleSearch();
    return;
  }

  if (key.name === "return") {
    manager.submitSearch();
    return;
  }

  if (key.name === "backspace") {
    manager.updateSearchBuffer((prev) => prev.slice(0, -1));
    return;
  }

  if (str && !key.ctrl) {
    manager.updateSearchBuffer((prev) => prev + str);
  }
}

function handleNormalMode(key: { name?: string; ctrl?: boolean }, manager: ProcessManager): void {
  if (key.ctrl && key.name === "c") {
    manager.cleanup();
    return;
  }

  if (key.name === "f") {
    manager.toggleSearch();
    return;
  }

  if (key.name === "up" || key.name === "down") {
    manager.navigateFilter(key.name === "up" ? "up" : "down");
    return;
  }

  if (key.name === "r" && manager.getCurrentFilter()) {
    const filter = manager.getCurrentFilter();
    if (filter?.startsWith("group:")) {
      manager.restartGroup(filter.replace("group:", ""));
    } else if (filter) {
      manager.restartProcess(filter);
    }
  }

  if (key.name === "s" && manager.getCurrentFilter()) {
    const filter = manager.getCurrentFilter();
    if (filter?.startsWith("group:")) {
      manager.toggleGroup(filter.replace("group:", ""));
    } else if (filter) {
      manager.toggleProcess(filter);
    }
  }
}
