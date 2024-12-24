import { ChildProcess } from "child_process";

export interface Command {
  name: string;
  cmd: string;
  color: string;
}

export interface Processes {
  [key: string]: ChildProcess;
}

export interface Config {
  commands: Command[];
}
