/**
 * Custom Min-Heap implementation (no external libraries)
 */
export class MinHeap {
  constructor(compareFn = (a, b) => (a < b ? -1 : a > b ? 1 : 0)) {
    this.compare = compareFn;
    this.heap = [];
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0] : null;
  }

  insert(item) {
    this.heap.push(item);
    this._bubbleUp(this.heap.length - 1);
  }

  push(item) {
    this.insert(item);
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    const min = this.heap[0];
    const end = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this._bubbleDown(0);
    }
    return min;
  }

  pop() {
    return this.extractMin();
  }

  rebuild(items = null) {
    if (items !== null) {
      this.heap = [...items];
    }
    for (let i = Math.floor(this.heap.length / 2) - 1; i >= 0; i--) {
      this._bubbleDown(i);
    }
  }

  toArray() {
    return [...this.heap];
  }

  _bubbleUp(idx) {
    let currentIdx = idx;
    while (currentIdx > 0) {
      const parentIdx = Math.floor((currentIdx - 1) / 2);
      if (this.compare(this.heap[currentIdx], this.heap[parentIdx]) < 0) {
        this._swap(currentIdx, parentIdx);
        currentIdx = parentIdx;
      } else {
        break;
      }
    }
  }

  _bubbleDown(idx) {
    let currentIdx = idx;
    const length = this.heap.length;

    while (true) {
      let smallest = currentIdx;
      const leftChild = 2 * currentIdx + 1;
      const rightChild = 2 * currentIdx + 2;

      if (
        leftChild < length &&
        this.compare(this.heap[leftChild], this.heap[smallest]) < 0
      ) {
        smallest = leftChild;
      }

      if (
        rightChild < length &&
        this.compare(this.heap[rightChild], this.heap[smallest]) < 0
      ) {
        smallest = rightChild;
      }

      if (smallest !== currentIdx) {
        this._swap(currentIdx, smallest);
        currentIdx = smallest;
      } else {
        break;
      }
    }
  }

  _swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}
