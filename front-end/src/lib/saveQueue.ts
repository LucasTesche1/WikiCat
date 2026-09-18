/** Serialize captured revisions; acknowledgments never claim newer edits are saved. */
export class SaveQueue {
  private tail: Promise<unknown> = Promise.resolve();
  enqueue<T>(write: () => Promise<T>): Promise<T> {
    const next = this.tail.catch(() => undefined).then(write);
    this.tail = next;
    return next;
  }
}
