export interface HistoryCommand {
  label: string;
  undo: () => void;
  redo: () => void;
}

export class HistoryManager {
  private undoStack: HistoryCommand[] = [];
  private redoStack: HistoryCommand[] = [];

  constructor(private readonly limit = 35) {}

  push(command: HistoryCommand): void {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): string | null {
    const command = this.undoStack.pop();
    if (!command) return null;
    command.undo();
    this.redoStack.push(command);
    return command.label;
  }

  redo(): string | null {
    const command = this.redoStack.pop();
    if (!command) return null;
    command.redo();
    this.undoStack.push(command);
    return command.label;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  get counts(): { undo: number; redo: number } {
    return { undo: this.undoStack.length, redo: this.redoStack.length };
  }
}
