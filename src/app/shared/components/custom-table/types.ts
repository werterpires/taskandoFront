
export enum Direction {
  ASC = 'ASC',
  DESC = 'DESC'
}

export interface Sort {
  sort: boolean
  direction: Direction
}

export interface TableData<T> {
  data: T[]
  columns: {
    name: keyof T
    columnReference?: keyof T
    label: string
    width: number
    sort?: Sort
  }[]
}

export interface Paginator {
  column: string
  direction: Direction
  page: number
  pagesQuantity: number
}
