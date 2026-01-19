import {
  Component,
  input,
  output,
  signal,
  effect,
  ViewChild,
  ElementRef,
  AfterViewInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-html-content-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './html-content-editor.html',
  styleUrls: ['./html-content-editor.css']
})
export class HtmlContentEditorComponent implements AfterViewInit {
  @ViewChild('editorContent') editorContentRef!: ElementRef<HTMLDivElement>;

  // Inputs
  htmlContent = input<string>('');
  readonly = input(false);
  label = input('Content');

  // Outputs
  contentChange = output<string>();
  save = output<string>();

  // State
  viewMode = signal<'wysiwyg' | 'html'>('wysiwyg');
  htmlSource = signal('');
  isDirty = signal(false);
  lastSavedContent = signal('');

  constructor() {
    // Update editor when htmlContent input changes
    effect(() => {
      const content = this.htmlContent();
      if (content !== this.lastSavedContent()) {
        this.htmlSource.set(content);
        this.updateEditorContent(content);
        this.lastSavedContent.set(content);
        this.isDirty.set(false);
      }
    });
  }

  ngAfterViewInit() {
    this.updateEditorContent(this.htmlContent());
  }

  private updateEditorContent(html: string) {
    if (this.editorContentRef?.nativeElement && this.viewMode() === 'wysiwyg') {
      this.editorContentRef.nativeElement.innerHTML = html;
    }
  }

  onContentInput() {
    if (this.viewMode() === 'wysiwyg' && this.editorContentRef) {
      const newContent = this.editorContentRef.nativeElement.innerHTML;
      this.htmlSource.set(newContent);
      this.isDirty.set(true);
      this.contentChange.emit(newContent);
    }
  }

  onHtmlSourceChange(newHtml: string) {
    this.htmlSource.set(newHtml);
    this.isDirty.set(true);
    this.contentChange.emit(newHtml);
  }

  toggleViewMode() {
    if (this.viewMode() === 'wysiwyg') {
      // Switching to HTML view
      if (this.editorContentRef) {
        this.htmlSource.set(this.editorContentRef.nativeElement.innerHTML);
      }
      this.viewMode.set('html');
    } else {
      // Switching to WYSIWYG view
      this.viewMode.set('wysiwyg');
      setTimeout(() => {
        this.updateEditorContent(this.htmlSource());
      }, 0);
    }
  }

  onSave() {
    const currentContent = this.viewMode() === 'wysiwyg'
      ? this.editorContentRef.nativeElement.innerHTML
      : this.htmlSource();

    this.lastSavedContent.set(currentContent);
    this.isDirty.set(false);
    this.save.emit(currentContent);
  }

  // Formatting commands for WYSIWYG
  execCommand(command: string, value: string | null = null) {
    document.execCommand(command, false, value || undefined);
    this.onContentInput();
  }

  insertHeading(level: number) {
    this.execCommand('formatBlock', `h${level}`);
  }

  clearFormatting() {
    this.execCommand('removeFormat');
  }
}
