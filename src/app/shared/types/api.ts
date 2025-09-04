
export interface Response<T> {
  quantity: number
  itens: T[]
}

export interface Paginator {
  limit: number
  offset: number
  orderBy: string
  direction: string
}
