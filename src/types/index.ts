import { ChildProcess } from "child_process";

export interface Command {
  name: string;
  cmd: string;
  color: string;
  group?: string;
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
