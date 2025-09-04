
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

export interface TablePaginator {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  orderBy: string
  direction: Direction
}
