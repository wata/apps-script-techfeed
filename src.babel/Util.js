import assign from 'object-assign'

export default class Util {
  static fetch (url, params = {}) {
    let res = null
    try {
      res = UrlFetchApp.fetch(url, assign(params, {
        followRedirects: false,
        muteHttpExceptions: true
      }))
    } catch (e) {
      Logger.log(e)
    }
    return res
  }

  static getResizeImage (imageUrl, width, height) {
    let urlObj = this.parseURL(imageUrl)
    return 'https://i0.wp.com/' + urlObj['host'] + urlObj['pathname'] + '?resize=' + width + ',' + height
  }

  static getScreenshot (siteUrl, width, height) {
    return 'https://s.wordpress.com/mshots/v1/' + siteUrl + '?w=' + width + '&h=' + height
  }

  static arrayUnique (array) {
    return array.filter((v, i, a) => {
      return a.indexOf(v) === i
    })
  }

  // https://garafu.blogspot.jp/2015/02/javascript_15.html
  static arrayShuffle (array) {
    let i, j, tmp, length
    for (length = array.length, i = length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1))
      tmp = array[i]
      array[i] = array[j]
      array[j] = tmp
    }
    return array
  }

  // http://qiita.com/PianoScoreJP/items/f0ff7345229871039672
  static objectArraySort (objectArray, orderBy, asc = true) {
    let sorted = objectArray
    sorted.sort((a, b) => {
      if (a[orderBy] > b[orderBy]) { return -1 };
      if (a[orderBy] < b[orderBy]) { return 1 };
      return 0
    })
    return sorted
  }

  // http://qiita.com/hrfmmymt/items/350dd409bd82106e752a
  static objectArrayUnique (objectArray, uniqueBy) {
    var arrObj = {}
    for (var i = 0; i < objectArray.length; i++) {
      arrObj[objectArray[i][uniqueBy]] = objectArray[i]
    }
    let filtered = []
    for (var key in arrObj) {
      filtered.push(arrObj[key])
    }
    return filtered
  }

  static toUnderscore (camel) {
    return camel.replace(/(?:^|\.?)([A-Z])/g, (x, y) => { return '_' + y.toLowerCase() }).replace(/^_/, '')
  }

  static parseURL (url) {
    // http://tokkono.cute.coocan.jp/blog/slow/index.php/bbs-spam/parsing-url-and-domain-extraction/
    let urlRegExp = /^(([^:/?#]+):)?(\/\/([^/?#]*))?([^?#]*)(\?([^#]*))?(#(.*))?/
    let match = urlRegExp.exec(url)

    return {
      protocol: match[1],
      origin: match[1] + match[3],
      host: match[4],
      pathname: match[5],
      filename: url.substring(url.lastIndexOf('/') + 1), // http://befused.com/javascript/get-filename-url
      search: match[6],
      hash: match[8]
    }
  }

  static parseQueryString (queryString) {
    return queryString.split('&').reduce((obj, v) => {
      var pair = v.split('=')
      obj[pair[0]] = decodeURIComponent(pair[1])
      return obj
    })
  }

  static buildQueryString (obj) {
    return Object.keys(obj).map((k) => {
      return k + '=' + encodeURIComponent(obj[k])
    }).join('&')
  }
}

export class CONTENT_TYPE {
  static get HTML () {
    return 'text/html'
  }

  static get JSON () {
    return 'application/json'
  }

  static get RSS () {
    return 'application/rss+xml'
  }

  static get ATOM () {
    return 'application/atom+xml'
  }
}

export class CHARSET {
  static get UTF_8 () {
    return 'UTF-8'
  }

  static get SHIFT_JIS () {
    return 'Shift_JIS'
  }
}
