import { ValidationErrors } from '@angular/forms'
import * as utils from '../../services/utils/utils.functions'
import { isValidDate } from '../../services/utils/utils.functions'

export function minMax(min: number, max: number) {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const numValue = Number(value)
    return numValue >= min && numValue <= max
      ? null
      : `O valor deve estar entre ${min} e ${max}`
  }
}

export function minMaxLength(min: number, max: number) {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    return value.length >= min && value.length <= max
      ? null
      : `O texto deve ter entre ${min} e ${max} caracteres`
  }
}

export function isEmail() {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value) ? null : 'O e-mail não é válido'
  }
}

export function contains(substring: string) {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    return value.includes(substring)
      ? null
      : `O valor deve conter "${substring}"`
  }
}

export function hasXWords(wordCount: number) {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const words = value.trim().split(/\s+/).length
    return words >= wordCount
      ? null
      : `O texto deve ter pelo menos ${wordCount} palavras`
  }
}

export function required() {
  return (value: string): string | null => {
    if (typeof value !== 'string') {
      return null
    }
    return value.trim() !== '' ? null : 'O campo é obrigatório'
  }
}

export function isStrongPassword() {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const regex =
      /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+-={}|[\]:";'<>,.?/~`]).{8,}$/
    return regex.test(value)
      ? null
      : 'A senha precisa ter pelo menos 8 caracteres, uma letra maiúscula, uma letra minúscula, um número e um caractere especial (!@#$%^&*()_+-={}|[]:";\'<>,.?/~`).'
  }
}

export function dateAfter(date: Date) {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const inputDate = new Date(value)
    return inputDate > date
      ? null
      : 'A data deve ser posterior a ' + utils.DateToLocalDate(date)
  }
}

export function isValidCpf() {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const regex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/
    if (!regex.test(value)) return 'O CPF possui formato inválido.'

    const cleanValue = value.replace(/\D/g, '')

    if (/^(\d)\1{10}$/.test(cleanValue)) return 'O CPF é inválido'

    let sum = 0
    let remainder

    for (let i = 1; i <= 9; i++) {
      sum += parseInt(cleanValue.substring(i - 1, i)) * (11 - i)
    }
    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cleanValue.substring(9, 10))) {
      return 'O CPF é inválido'
    }

    sum = 0
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(cleanValue.substring(i - 1, i)) * (12 - i)
    }
    remainder = (sum * 10) % 11
    if (remainder === 10 || remainder === 11) remainder = 0
    if (remainder !== parseInt(cleanValue.substring(10, 11))) {
      return 'O CPF é inválido'
    }

    return null
  }
}

export function equalValues(value1: string, label: string) {
  return (value2?: string): string | null => {
    if (!value2) return null
    return value1 === value2
      ? null
      : 'O valor deve ser igual ao do campo ' + label
  }
}

export function diferentValues(value1: string, label: string) {
  return (value2?: string): string | null => {
    if (!value2) return null
    return value1 !== value2
      ? null
      : 'O valor deve ser diferente ao do campo ' + label
  }
}

export function isValidDateString() {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    const date = new Date(value)
    return dateRegex.test(value) && !isNaN(date.getTime())
      ? null
      : 'A data deve estar no formato yyyy-mm-dd'
  }
}

export function isDateStringAfterOther(date: string) {
  return (value?: string): string | null => {
    if (!value || value.length == 0) return null
    if (!isValidDate(date) || !isValidDate(value)) return null
    const inputDate = new Date(value)
    const otherDate = new Date(date)

    return inputDate > otherDate
      ? null
      : 'A data deve ser posterior a ' + utils.DateToLocalDate(otherDate)
  }
}
