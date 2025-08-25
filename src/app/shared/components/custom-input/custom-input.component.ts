import { Component, forwardRef, Input } from '@angular/core'
import {
  ControlValueAccessor,
  FormsModule,
  NG_VALUE_ACCESSOR
} from '@angular/forms'
import { CustomMask, CustomVAlidator, InputOption } from './types'
import { CommonModule } from '@angular/common'
import {
  Editor,
  NgxEditorComponent,
  NgxEditorMenuComponent,
  Toolbar
} from 'ngx-editor'

@Component({
  selector: 'app-custom-input',
  imports: [
    CommonModule,
    CommonModule,
    NgxEditorComponent,
    NgxEditorMenuComponent,
    FormsModule
  ],
  templateUrl: './custom-input.component.html',
  styleUrl: './custom-input.component.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CustomInputComponent),
      multi: true
    }
  ]
})
export class CustomInputComponent implements ControlValueAccessor {
  @Input() type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'select'
    | 'date'
    | 'area'
    | 'editor'
    | 'checkbox'
    | 'multi' = 'text'
  @Input() label: string = ''
  @Input() customValidators: CustomVAlidator[] = []
  @Input() customMask: CustomMask | null = null
  @Input() options: InputOption[] = []
  @Input() width: string = '328px'
  @Input() height: string = '56px'
  @Input() padding: string = '16px'
  @Input() areaHeight: string = '310px'
  @Input() areaWidth: string = '100%'
  @Input() outLabel: string | null = null

  showMulti = false

  editor!: Editor
  toolbar: Toolbar = [
    ['bold', 'italic'],
    ['underline'],
    ['ordered_list', 'bullet_list'],
    [{ heading: ['h1', 'h2', 'h3', 'h4'] }],
    ['link'],
    ['align_left', 'align_center', 'align_right', 'align_justify'],
    ['horizontal_rule', 'indent', 'outdent']
  ]

  value: any = this.type === 'checkbox' ? [] : ''
  errorMessages: string[] = []

  seeingPassword = false

  multiValues: string[] = []

  onChange = (value: string) => {}
  onTouched = () => {}

  inputId = 'custom-input-' + Math.random().toString(36).substring(2, 9)

  ngOnInit(): void {
    if (this.type === 'editor') {
      this.editor = new Editor()
    }
  }

  isChecked(optionValue: string): boolean {
    return this.type === 'checkbox' && this.value.includes(optionValue)
  }
  writeValue(value: any): void {
    if (this.type === 'checkbox') {
      this.value = Array.isArray(value) ? value : []
    } else if (this.type === 'number') {
      this.value = Number(value)
    } else if (this.type === 'select' && value) {
      const possibleValue = Number(value.toString() || '')
      this.value = isNaN(possibleValue) ? value : possibleValue
    } else if (this.type === 'multi') {
      this.value = Array.isArray(value) ? value : []
      this.multiValues = []
      this.options.forEach((option) => {
        if (this.value.includes(Number(option.value))) {
          option.selected = true
          this.multiValues.push(option.label)
        } else {
          option.selected = false
        }
      })
    } else {
      this.value = value || ''
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn
  }

  onInput(event: Event | string): void {
    if (typeof event === 'string') {
      this.value = event
    } else if (this.type === 'multi') {
      const input = event.target as HTMLInputElement
      this.value = this.options
        .filter((option) => option.selected)
        .map((option) => option.value)

      this.multiValues = this.options
        .filter((option) => option.selected)
        .map((option) => option.label)
    } else {
      const input = event.target as HTMLInputElement
      this.value = input.value
    }
    this.onChange(this.value)
    this.onTouched()
  }

  onCheckboxChange(optionValue: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked

    if (isChecked) {
      this.value = [...this.value, optionValue]
    } else {
      this.value = this.value.filter((v: string) => v !== optionValue)
    }

    this.onChange(this.value)
    this.onTouched()
  }

  validate(): void {
    this.errorMessages = []
    this.customValidators.forEach((validator) => {
      const result = validator(this.value)

      if (result) {
        this.errorMessages.push(result)
      }
    })
  }

  applyMask() {
    if (!this.customMask) return
    this.value = this.customMask(this.value)
  }
}
