import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LegalInlineSegment, parseLegalMarkdown } from './legal-markdown';
import { LegalDocumentType } from './legal.types';

@Component({
  selector: 'app-legal-markdown',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <div class="legal-markdown">
      <ng-template #inlineTemplate let-segments>
        @for (segment of segments; track $index) {
          @switch (segment.kind) {
            @case ('bold') { <strong>{{ segment.text }}</strong> }
            @case ('italic') { <em>{{ segment.text }}</em> }
            @case ('code') { <code>{{ segment.text }}</code> }
            @case ('link') {
              <a
                [href]="segment.href"
                [attr.target]="isExternal(segment.href) ? '_blank' : null"
                [attr.rel]="isExternal(segment.href) ? 'noopener noreferrer' : null"
                (click)="onLinkClick($event, segment)"
              >{{ segment.label }}</a>
            }
            @default { {{ segment.text }} }
          }
        }
      </ng-template>

      @for (block of blocks(); track $index) {
        @switch (block.kind) {
          @case ('heading') {
            @if (block.level === 1) {
              <h1><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: block.segments }"></ng-container></h1>
            } @else if (block.level === 2) {
              <h2><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: block.segments }"></ng-container></h2>
            } @else {
              <h3><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: block.segments }"></ng-container></h3>
            }
          }
          @case ('blockquote') {
            <blockquote>
              @for (paragraph of block.paragraphs; track $index) {
                <p><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: paragraph }"></ng-container></p>
              }
            </blockquote>
          }
          @case ('hr') { <hr> }
          @case ('list') {
            @if (block.ordered) {
              <ol>
                @for (item of block.items; track $index) {
                  <li><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container></li>
                }
              </ol>
            } @else {
              <ul>
                @for (item of block.items; track $index) {
                  <li><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: item }"></ng-container></li>
                }
              </ul>
            }
          }
          @case ('table') {
            <div class="legal-table-wrap">
              <table>
                <thead>
                  <tr>
                    @for (header of block.headers; track $index) {
                      <th><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: header }"></ng-container></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of block.rows; track $index) {
                    <tr>
                      @for (cell of row; track $index) {
                        <td><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: cell }"></ng-container></td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @default {
            <p><ng-container [ngTemplateOutlet]="inlineTemplate" [ngTemplateOutletContext]="{ $implicit: block.segments }"></ng-container></p>
          }
        }
      }
    </div>
  `,
})
export class LegalMarkdownComponent {
  readonly content = input<string>('');
  readonly interceptDocumentLinks = input<boolean>(false);
  readonly documentNavigate = output<LegalDocumentType>();

  readonly blocks = computed(() => parseLegalMarkdown(this.content()));

  isExternal(href: string): boolean {
    return href.startsWith('http://') || href.startsWith('https://');
  }

  onLinkClick(event: Event, segment: Extract<LegalInlineSegment, { kind: 'link' }>): void {
    if (!this.interceptDocumentLinks()) return;
    if (segment.href === '#/termos') {
      event.preventDefault();
      this.documentNavigate.emit('terms');
    } else if (segment.href === '#/privacidade') {
      event.preventDefault();
      this.documentNavigate.emit('privacy');
    }
  }
}
