export type CustomVAlidator = (value: string) => string | null

export type CustomMask = (value: string) => string | null

export interface InputOption {
  label: string
  value: string
  selected?: boolean
}
