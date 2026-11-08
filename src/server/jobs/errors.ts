export class JobBusyError extends Error {
  constructor() {
    super("busy");
    this.name = "JobBusyError";
  }
}

export class JobInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobInputError";
  }
}
