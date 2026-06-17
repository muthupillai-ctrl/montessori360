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
    if (children.length && !this.activeChildId()) {
      this.activeChildId.set(children[0].id);
    }
  }

  selectChild(id: string) { this.activeChildId.set(id); }
}
