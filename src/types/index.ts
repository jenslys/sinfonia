import { ChildProcess } from "child_process";

export interface ReadyPatterns {
  [key: string]: string;
}

export interface Command {
  name: string;
  cmd: string;
  color: string;
  group?: string;
  dependsOn?: string[];
  readyPatterns?: ReadyPatterns;
}

export interface Group {
  name: string;
  color: string;
  commands: string[];
}

export interface Processes {
  [key: string]: ChildProcess;
}

export interface Config {
  commands: Command[];
  groups?: Group[];
}
