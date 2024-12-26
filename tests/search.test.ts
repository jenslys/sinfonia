import { beforeEach, describe, expect, test } from "bun:test";
import { SearchManager, type SearchState } from "../src/process/search.js";
import type { Command, Group } from "../src/types/index.js";

describe("Search", () => {
  let searchManager: SearchManager;
  let state: SearchState;
  let updateCalled = false;

  const mockCommands: Command[] = [
    { name: "test1", cmd: "echo test1", color: "\x1b[34m", group: "group1" },
    { name: "test2", cmd: "echo test2", color: "\x1b[32m", group: undefined },
    { name: "test3", cmd: "echo test3", color: "\x1b[33m", group: "group2" },
  ];

  const mockGroups: Group[] = [
    {
      name: "group1",
      color: "\x1b[35m",
      commands: ["test1"],
    },
    {
      name: "group2",
      color: "\x1b[36m",
      commands: ["test3"],
    },
  ];

  beforeEach(() => {
    state = {
      searchMode: false,
      searchText: "",
      searchBuffer: "",
      currentFilter: null,
    };
    updateCalled = false;
    searchManager = new SearchManager(state, mockCommands, mockGroups, () => {
      updateCalled = true;
    });
  });

  test("should toggle search mode", () => {
    expect(searchManager.isSearchMode()).toBe(false);
    searchManager.toggleSearch();
    expect(searchManager.isSearchMode()).toBe(true);
    expect(updateCalled).toBe(true);
  });

  test("should update search buffer", () => {
    searchManager.updateSearchBuffer((prev) => `${prev}test`);
    expect(searchManager.getSearchBuffer()).toBe("test");
    expect(updateCalled).toBe(true);
  });

  test("should submit search", () => {
    searchManager.updateSearchBuffer((prev) => `${prev}test`);
    searchManager.submitSearch();
    expect(searchManager.getSearchText()).toBe("test");
    expect(updateCalled).toBe(true);
  });

  test("should navigate filters", () => {
    searchManager.navigateFilter("down");
    expect(searchManager.getCurrentFilter()).toBe("group:group1");
    searchManager.navigateFilter("down");
    expect(searchManager.getCurrentFilter()).toBe("test1");
    searchManager.navigateFilter("up");
    expect(searchManager.getCurrentFilter()).toBe("group:group1");
  });

  test("should filter logs", () => {
    const logs = [
      { name: "test1", data: "hello world" },
      { name: "test2", data: "goodbye world" },
    ];

    searchManager.updateSearchBuffer((prev) => `${prev}hello`);
    searchManager.submitSearch();
    const filtered = searchManager.filterLogs(logs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].data).toBe("hello world");
  });

  test("should filter logs by name", () => {
    const logs = [
      { name: "test1", data: "hello world" },
      { name: "test2", data: "goodbye world" },
    ];

    searchManager.updateSearchBuffer((prev) => `${prev}test1`);
    searchManager.submitSearch();
    const filtered = searchManager.filterLogs(logs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("test1");
  });

  test("should clear search on toggle off", () => {
    searchManager.updateSearchBuffer((prev) => `${prev}test`);
    searchManager.toggleSearch();
    expect(searchManager.isSearchMode()).toBe(true);
    searchManager.toggleSearch();
    expect(searchManager.isSearchMode()).toBe(false);
    expect(searchManager.getSearchBuffer()).toBe("");
    expect(searchManager.getSearchText()).toBe("");
  });

  test("should handle empty search", () => {
    const logs = [
      { name: "test1", data: "hello" },
      { name: "test2", data: "world" },
    ];

    searchManager.submitSearch();
    const filtered = searchManager.filterLogs(logs);
    expect(filtered).toHaveLength(2);
  });

  test("should handle special characters in search", () => {
    const logs = [
      { name: "test1", data: "hello (world)" },
      { name: "test2", data: "goodbye [world]" },
    ];

    searchManager.updateSearchBuffer((prev) => `${prev}(world)`);
    searchManager.submitSearch();
    const filtered = searchManager.filterLogs(logs);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].data).toBe("hello (world)");
  });

  test("should wrap around when navigating filters", () => {
    const logNavigation = (step: string) => {
      console.log(`${step}: ${searchManager.getCurrentFilter()}`);
    };

    logNavigation("Start");
    expect(searchManager.getCurrentFilter()).toBe(null); // Start at ALL

    searchManager.navigateFilter("down");
    logNavigation("After 1st down");
    expect(searchManager.getCurrentFilter()).toBe("group:group1");

    searchManager.navigateFilter("down");
    logNavigation("After 2nd down");
    expect(searchManager.getCurrentFilter()).toBe("test1"); // In group1

    searchManager.navigateFilter("down");
    logNavigation("After 3rd down");
    expect(searchManager.getCurrentFilter()).toBe("group:group2");

    searchManager.navigateFilter("down");
    logNavigation("After 4th down");
    expect(searchManager.getCurrentFilter()).toBe("test3"); // In group2

    searchManager.navigateFilter("down");
    logNavigation("After 5th down");
    expect(searchManager.getCurrentFilter()).toBe("test2"); // Ungrouped

    searchManager.navigateFilter("down");
    logNavigation("After 6th down");
    expect(searchManager.getCurrentFilter()).toBe(null); // Back to ALL

    // Test wrap around up
    searchManager.navigateFilter("up");
    logNavigation("After up");
    expect(searchManager.getCurrentFilter()).toBe("test2");
  });

  test("should handle empty groups", () => {
    const emptyGroupManager = new SearchManager(
      state,
      mockCommands,
      [...mockGroups, { name: "empty", color: "\x1b[37m", commands: [] }],
      () => {
        updateCalled = true;
      }
    );

    emptyGroupManager.navigateFilter("down");
    expect(emptyGroupManager.getCurrentFilter()).toBe("group:group1");
  });
});
