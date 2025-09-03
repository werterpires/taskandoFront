
import { Component, Input, Output, EventEmitter, ViewChild } from '@angular/core'
import { CommonModule } from '@angular/common'
import { TableData, Paginator, Direction, Sort } from './types'

@Component({
  selector: 'app-custom-table',
  imports: [CommonModule],
  templateUrl: './custom-table.component.html',
  styleUrl: './custom-table.component.css'
})
export class CustomTableComponent<T> {
  @ViewChild('pageInput') pageInput!: HTMLInputElement

  @Output() creatingEmitter = new EventEmitter()
  @Output() searchEmitter = new EventEmitter()
  @Output() seeEmitter = new EventEmitter<number>()
  @Output() deleteEmitter = new EventEmitter<number>()
  @Output() inviteEmitter = new EventEmitter<number>()

  @Input() tableData: TableData<T> = {
    data: [],
    columns: []
  }
  @Input() tableWidth: number = 80

  @Input() invite = false
  @Input() del = true
  @Input() seee = true

  @Input() paginator: Paginator = {
    column: '',
    direction: Direction.ASC,
    page: 1,
    pagesQuantity: 0
  }

  constructor() {}

  create() {
    this.creatingEmitter.emit()
  }

  changePage(input: HTMLInputElement) {
    const page = +input.value
    if (
      page !== this.paginator.page &&
      page > 0 &&
      page <= this.paginator.pagesQuantity
    ) {
      this.paginator.page = page
      this.searchEmitter.emit()
    } else {
      input.value = this.paginator.page.toString()
    }
  }

  pageNavigate(page: number) {
    if (page > 0 && page <= this.paginator.pagesQuantity) {
      this.paginator.page = page
      this.pageInput.value = this.paginator.page.toString()
      this.searchEmitter.emit()
    }
  }

  sortByColumn(column: string) {
    const falseSort: Sort = {
      sort: false,
      direction: Direction.DESC
    }
    
    if (this.paginator.column === column) {
      this.paginator.direction =
        this.paginator.direction === Direction.ASC
          ? Direction.DESC
          : Direction.ASC

      const columnData = this.tableData.columns.find(
        (col) =>
          col.name === this.paginator.column ||
          col.columnReference === this.paginator.column
      )

      if (columnData) {
        columnData.sort = {
          sort: true,
          direction: this.paginator.direction
        }
      }
    } else {
      this.tableData.columns.forEach((col) => {
        col.sort = { ...falseSort }
        if (col.name === column || col.columnReference === column) {
          col.sort = {
            sort: true,
            direction: Direction.ASC
          }
          this.paginator.direction = Direction.ASC
          this.paginator.column = column
        }
      })
    }
    this.searchEmitter.emit()
  }

  delete(index: number) {
    this.deleteEmitter.emit(index)
  }

  see(index: number) {
    this.seeEmitter.emit(index)
  }

  inviteUser(index: number) {
    this.inviteEmitter.emit(index)
  }

  getColumnValue(item: T, column: any): any {
    const key = column.columnReference || column.name
    return (item as any)[key]
  }

  getSortIcon(column: any): string {
    if (!column.sort?.sort) return ''
    return column.sort.direction === Direction.ASC ? '↑' : '↓'
  }
}
