
import { Component, Input, Output, EventEmitter, ViewChild, OnChanges, SimpleChanges } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TableData, TablePaginator, Direction, Sort } from './types'
import { Paginator } from '../../types/api'

@Component({
  selector: 'app-custom-table',
  imports: [CommonModule],
  templateUrl: './custom-table.component.html',
  styleUrl: './custom-table.component.css'
})
export class CustomTableComponent<T> implements OnChanges {
  @ViewChild('pageInput') pageInput!: HTMLInputElement

  @Output() creatingEmitter = new EventEmitter()
  @Output() paginationChangeEmitter = new EventEmitter<Paginator>()
  @Output() seeEmitter = new EventEmitter<number>()
  @Output() deleteEmitter = new EventEmitter<number>()
  @Output() inviteEmitter = new EventEmitter<number>()

  @Input() tableData: TableData<T> = {
    data: [],
    columns: []
  }
  @Input() tableWidth: number = 80
  @Input() totalItems: number = 0
  @Input() loading: boolean = false

  @Input() invite = false
  @Input() del = true
  @Input() seee = true

  paginator: TablePaginator = {
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 0,
    orderBy: '',
    direction: Direction.ASC
  }

  pageSizeOptions = [5, 10, 25, 50, 100]

  constructor() {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['totalItems']) {
      this.paginator.totalItems = this.totalItems
      this.calculateTotalPages()
    }
  }

  calculateTotalPages() {
    this.paginator.totalPages = Math.ceil(this.paginator.totalItems / this.paginator.pageSize)
  }

  create() {
    this.creatingEmitter.emit()
  }

  changePage(input: HTMLInputElement) {
    const page = +input.value
    if (
      page !== this.paginator.page &&
      page > 0 &&
      page <= this.paginator.totalPages
    ) {
      this.goToPage(page)
    } else {
      input.value = this.paginator.page.toString()
    }
  }

  goToPage(page: number) {
    if (page > 0 && page <= this.paginator.totalPages && page !== this.paginator.page) {
      this.paginator.page = page
      this.emitPaginationChange()
    }
  }

  changePageSize(newSize: number) {
    this.paginator.pageSize = newSize
    this.paginator.page = 1
    this.calculateTotalPages()
    this.emitPaginationChange()
  }

  sortByColumn(column: string) {
    const falseSort: Sort = {
      sort: false,
      direction: Direction.DESC
    }
    
    if (this.paginator.orderBy === column) {
      this.paginator.direction =
        this.paginator.direction === Direction.ASC
          ? Direction.DESC
          : Direction.ASC
    } else {
      this.tableData.columns.forEach((col) => {
        col.sort = { ...falseSort }
        if (col.name === column || col.columnReference === column) {
          col.sort = {
            sort: true,
            direction: Direction.ASC
          }
          this.paginator.direction = Direction.ASC
          this.paginator.orderBy = column
        }
      })
    }

    // Update column sort indicator
    const columnData = this.tableData.columns.find(
      (col) =>
        col.name === this.paginator.orderBy ||
        col.columnReference === this.paginator.orderBy
    )

    if (columnData) {
      columnData.sort = {
        sort: true,
        direction: this.paginator.direction
      }
    }

    // Reset to first page when sorting
    this.paginator.page = 1
    this.emitPaginationChange()
  }

  emitPaginationChange() {
    const backendPaginator: Paginator = {
      limit: this.paginator.pageSize,
      offset: (this.paginator.page - 1) * this.paginator.pageSize,
      orderBy: this.paginator.orderBy,
      direction: this.paginator.direction
    }
    this.paginationChangeEmitter.emit(backendPaginator)
  }

  delete(index: number) {
    const actualIndex = (this.paginator.page - 1) * this.paginator.pageSize + index
    this.deleteEmitter.emit(actualIndex)
  }

  see(index: number) {
    const actualIndex = (this.paginator.page - 1) * this.paginator.pageSize + index
    this.seeEmitter.emit(actualIndex)
  }

  inviteUser(index: number) {
    const actualIndex = (this.paginator.page - 1) * this.paginator.pageSize + index
    this.inviteEmitter.emit(actualIndex)
  }

  getColumnValue(item: T, column: any): any {
    const key = column.columnReference || column.name
    return (item as any)[key]
  }

  getSortIcon(column: any): string {
    if (!column.sort?.sort) return ''
    return column.sort.direction === Direction.ASC ? '↑' : '↓'
  }

  getPageNumbers(): number[] {
    const totalPages = this.paginator.totalPages
    const currentPage = this.paginator.page
    const maxVisiblePages = 5
    
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    
    const half = Math.floor(maxVisiblePages / 2)
    let start = Math.max(1, currentPage - half)
    let end = Math.min(totalPages, start + maxVisiblePages - 1)
    
    if (end - start + 1 < maxVisiblePages) {
      start = Math.max(1, end - maxVisiblePages + 1)
    }
    
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }
}
