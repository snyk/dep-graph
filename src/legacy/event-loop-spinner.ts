export class EventLoopSpinner {
  private lastSpin: number;

  constructor(private thresholdMs: number = 10) {
    this.lastSpin = Date.now();
  }

  public isStarving(): boolean {
    return (Date.now() - this.lastSpin) > this.thresholdMs;
  }

  public async spin() {
    this.lastSpin = Date.now();
    return new Promise((resolve) => setImmediate(resolve));
  }
}
