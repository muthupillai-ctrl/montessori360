import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ParentStateService {
  children      = signal<any[]>([]);
  activeChildId = signal<string | null>(null);

  activeChild = computed(() =>
    this.children().find(c => c.id === this.activeChildId()) ?? this.children()[0] ?? null
  );

  setChildren(children: any[]) {
    this.children.set(children);
    // Always reset to first child — prevents stale ID from a previous parent login
    // in the same browser session surviving into a new login.
    if (children.length) this.activeChildId.set(children[0].id);
    else this.activeChildId.set(null);
  }

  reset() {
    this.children.set([]);
    this.activeChildId.set(null);
  }

  selectChild(id: string) { this.activeChildId.set(id); }
}
