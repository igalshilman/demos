// Minimal fake DOM so DOM-building modules can run under the node environment.

class FakeClassList {
  constructor(el) {
    this.el = el;
  }
  _set() {
    return new Set(this.el.className.split(/\s+/).filter(Boolean));
  }
  _save(set) {
    this.el.className = [...set].join(' ');
  }
  add(...names) {
    const set = this._set();
    names.forEach((n) => set.add(n));
    this._save(set);
  }
  remove(...names) {
    const set = this._set();
    names.forEach((n) => set.delete(n));
    this._save(set);
  }
  toggle(name, force) {
    const has = this._set().has(name);
    const want = force === undefined ? !has : force;
    if (want) this.add(name);
    else this.remove(name);
    return want;
  }
  contains(name) {
    return this._set().has(name);
  }
}

export class FakeElement {
  constructor(tagName) {
    this.tagName = String(tagName).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.style = {};
    this.attributes = {};
    this.listeners = {};
    this.className = '';
    this.id = '';
    this.hidden = false;
    this.disabled = false;
    this._text = '';
    this.classList = new FakeClassList(this);
  }

  get textContent() {
    return this._text + this.children.map((c) => c.textContent).join('');
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }
  get innerHTML() {
    return this.textContent;
  }
  set innerHTML(value) {
    this.children = [];
    this._text = String(value);
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  append(...nodes) {
    nodes.forEach((n) => {
      this.appendChild(typeof n === 'string' ? makeText(n) : n);
    });
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') this.className = String(value);
  }
  getAttribute(name) {
    return name in this.attributes ? this.attributes[name] : null;
  }

  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  removeEventListener(type, fn) {
    this.listeners[type] = (this.listeners[type] || []).filter((f) => f !== fn);
  }
  dispatchEvent(event) {
    event.target = event.target || this;
    (this.listeners[event.type] || []).slice().forEach((fn) => fn.call(this, event));
    return true;
  }
  click() {
    this.dispatchEvent({ type: 'click' });
  }

  *descendants() {
    for (const child of this.children) {
      yield child;
      yield* child.descendants();
    }
  }
  _matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName === selector.toUpperCase();
  }
  querySelector(selector) {
    for (const node of this.descendants()) if (node._matches(selector)) return node;
    return null;
  }
  querySelectorAll(selector) {
    return [...this.descendants()].filter((n) => n._matches(selector));
  }
}

function makeText(text) {
  const el = new FakeElement('#text');
  el.textContent = text;
  return el;
}

export function createFakeDocument() {
  const body = new FakeElement('body');
  return {
    body,
    createElement: (tag) => new FakeElement(tag),
    createTextNode: makeText,
    getElementById: (id) => body.querySelector(`#${id}`),
    querySelector: (sel) => body.querySelector(sel),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
  };
}

import { beforeEach } from 'vitest';

beforeEach(() => {
  globalThis.document = createFakeDocument();
});
