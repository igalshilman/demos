// Minimal stand-ins for the DOM and window used by the shell tests (not a test file itself).

export class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.parent = null;
    this.handlers = new Map();
    this.attrs = {};
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.focusCount = 0;
  }

  append(...nodes) {
    for (const node of nodes) {
      node.parent = this;
      this.children.push(node);
    }
  }

  remove() {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((c) => c !== this);
      this.parent = null;
    }
  }

  setAttribute(name, value) { this.attrs[name] = value; }
  focus() { this.focusCount += 1; }
  blur() {}

  addEventListener(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this.handlers.get(type)?.delete(handler);
  }

  listenerCount(type) {
    if (type) return this.handlers.get(type)?.size ?? 0;
    let n = 0;
    for (const set of this.handlers.values()) n += set.size;
    return n;
  }

  fire(type, event = {}) {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler(event);
  }

  click() { this.fire('click', {}); }

  find(predicate) {
    const out = [];
    const walk = (node) => {
      if (predicate(node)) out.push(node);
      node.children.forEach(walk);
    };
    walk(this);
    return out;
  }

  byClass(name) {
    return this.find((n) => n.className.split(' ').includes(name));
  }
}

export function createFakeDocument() {
  const doc = new FakeNode('#document');
  doc.hidden = false;
  doc.createElement = (tag) => new FakeNode(tag);
  return doc;
}

export function createFakeWindow() {
  const win = new FakeNode('#window');
  win.innerWidth = 800;
  win.innerHeight = 600;
  win.devicePixelRatio = 3;
  return win;
}
