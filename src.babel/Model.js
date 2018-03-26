import assign from 'object-assign'
import Util from './Util'

class Model {
  constructor (id, sheetName) {
    this.sheet = SpreadSheetsSQL.open(id, sheetName)
  }

  _toUnderscore (data) {
    if (!Array.isArray(data)) { data = [data] }
    return data.map((item) => {
      return Object.keys(item)
        .map((k) => {
          let obj = {}
          let _key = Util.toUnderscore(k)
          obj[_key] = item[k]
          return obj
        })
        .reduce((previous, current) => {
          return assign({}, previous, current)
        })
    })
  }

  result () {
    return this.sheet.result()
  }

  select (selects) {
    return this.sheet.select(selects)
  }

  filter (filter) {
    return this.sheet.filter(filter)
  }

  orderBy (orderBy, asc = true) {
    return this.sheet.orderBy(orderBy, asc)
  }

  insertRows (data) {
    return this.sheet.insertRows(this._toUnderscore(data))
  }

  updateRows (data, filter = '') {
    return this.sheet.updateRows(this._toUnderscore(data), filter)
  }

  deleteRows (filter = '') {
    return this.sheet.deleteRows(filter)
  }

  resizeToFit () {
    return this.sheet.resizeToFit()
  }

  replaceRows (data, filter = '') {
    this.sheet.deleteRows(filter)
    return this.insertRows(data)
  }
}

const FEED_COLUMNS = [
  'type',
  'source',
  'url',
  'host',
  'title',
  'title_ja',
  'description',
  'published',
  'timestamp',
  'thumbnail_url',
  'thumbnail_width',
  'thumbnail_height',
  'summary',
  'summary_ja'
]

export class Feed extends Model {
  constructor (id) {
    super(id, 'feed')
  }

  select (selects = FEED_COLUMNS) {
    return super.select(selects)
  }
}

const META_COLUMNS = [
  'key',
  'value'
]

export class Meta extends Model {
  constructor (id) {
    super(id, 'meta')
  }

  flatten () {
    return super.select(META_COLUMNS).result()
      .map((item) => {
        let obj = {}
        obj[item.key] = item.value
        return obj
      })
      .reduce((previous, current, i, array) => {
        return assign({}, previous, current)
      })
  }
}
