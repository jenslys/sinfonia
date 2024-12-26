import type { Command, Group } from "../types/index.js";

export interface SearchState {
  searchMode: boolean;
  searchText: string;
  searchBuffer: string;
  currentFilter: string | null;
}

export class SearchManager {
  constructor(
    private state: SearchState,
    private commands: Command[],
    private groups: Group[],
    private onUpdate: () => void
  ) {}

  isSearchMode(): boolean {
    return this.state.searchMode;
  }

  getCurrentFilter(): string | null {
    return this.state.currentFilter;
  }

  toggleSearch(): void {
    this.state.searchMode = !this.state.searchMode;
    if (!this.state.searchMode) {
      this.state.searchText = "";
      this.state.searchBuffer = "";
    }
    this.onUpdate();
  }

  submitSearch(): void {
    this.state.searchText = this.state.searchBuffer;
    this.onUpdate();
  }

  updateSearchBuffer(updater: (prev: string) => string): void {
    this.state.searchBuffer = updater(this.state.searchBuffer);
    this.onUpdate();
  }

  navigateFilter(direction: "up" | "down"): void {
    const allItems = [
      null, // ALL
      ...this.groups.flatMap((g) => [`group:${g.name}`, ...g.commands.map((cmd) => cmd)]),
      ...this.commands.filter((cmd) => !cmd.group).map((cmd) => cmd.name),
    ];

    const currentIndex = allItems.indexOf(this.state.currentFilter);
    if (direction === "up") {
      this.state.currentFilter =
        currentIndex > 0 ? allItems[currentIndex - 1] : allItems[allItems.length - 1];
    } else {
      this.state.currentFilter =
        currentIndex < allItems.length - 1 ? allItems[currentIndex + 1] : allItems[0];
    }
    this.onUpdate();
  }

  filterLogs<T extends { name: string; data: string }>(logs: T[]): T[] {
    if (!this.state.searchText) return logs;

    return logs.filter(
      (log) =>
        log.data.toLowerCase().includes(this.state.searchText.toLowerCase()) ||
        log.name.toLowerCase().includes(this.state.searchText.toLowerCase())
    );
  }

  public getSearchBuffer(): string {
    return this.state.searchBuffer;
  }

  public getSearchText(): string {
    return this.state.searchText;
  }

  public setFilter(name: string | null): void {
    this.state.currentFilter = name;
    this.onUpdate();
  }
}
