export class InternalSet {
  state = {};

  constructor(oldState?: InternalSet) {
    Object.keys(oldState?.state || {}).forEach(k=>this.state[k] = true)
    return this;
  }

  add(k) {
    this.state[k] = true;
    return this;
  }

  has(k: string): boolean {
    return this.state[k];
  }
}
