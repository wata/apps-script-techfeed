import contentType from 'content-type'
import assign from 'object-assign'
import * as moment from 'moment'
import Util from './Util'

class AylienText {
  constructor (id, key, sentencesNumber) {
    this.apiUrl = 'https://api.aylien.com/api/v1/summarize'
    this.fetchParams = {
      method: 'post',
      headers: {
        'X-AYLIEN-TextAPI-Application-ID': id,
        'X-AYLIEN-TextAPI-Application-Key': key
      },
      payload: {}
    }
  }

  summarize (url, sentencesNumber) {
    this.fetchParams['payload']['url'] = url
    this.fetchParams['payload']['sentences_number'] = sentencesNumber.toString()
    let res = Util.fetch(this.apiUrl, this.fetchParams)
    if (!res) { return [] }
    let results = JSON.parse(res.getContentText())
    return results['sentences']
  }
}

export default class Crawler {
  constructor (args) {
    this.collector = new Collector()
    this.extractor = new Extractor()
    this.editor = new Editor({
      aylienApiId: args.aylienApiId,
      aylienApiKey: args.aylienApiKey
    })
  }

  crawl (entries) {
    let that = this

    // ソース記事をクローリングし、記事のメタ情報とHTMLドキュメントを収集する
    let seeds = that.collector.collect(entries)

    return seeds.map((seed, i) => {
      // HTMLドキュメントから記事情報を抜き出す
      let extracted = that.extractor.extract(seed['content'])

      // 集めたデータを整形、加工、補完する
      let data = that.editor.edit(assign(seed, extracted))

      return data
    })
  }
}

class Collector {
  constructor () {}

  collect (entries) {
    return entries
      .map((entry) => {
        let res = Util.fetch(entry['url'])
        if (!res) { return }

        let content = res.getContentText()
        let seed = assign(entry, { content: content })

        try {
          let headers = res.getHeaders()
          let parsed = contentType.parse(headers['Content-Type'])
          seed = assign(seed, {
            contentType: parsed['type'],
            charset: parsed['parameters']['charset'] ? parsed['parameters']['charset'].toLowerCase() : undefined
          })
        } catch (e) {
          Logger.log(e)
        }

        return seed
      })
      .filter((seed) => {
        return seed // null除外
      })
  }
}

class Extractor {
  constructor () {}

  getImages (content) {
    let images = []
    let match = null

    // og画像を探す
    let ogRegExpList = [
      /<\s*meta\s*property=["']?og:image["']?\s*content=["']?([^"']*)["']?\s*\/?>/ig,
      /<\s*meta\s*content=["']?([^"']*)["']?\s*property=["']?og:image["']?\s*\/?>/ig,
      /<\s*meta\s*content=["']?([^"']*)["']?\s*name=["']?og:image["']?\s*\/?>/ig // for Designer News
    ]
    ogRegExpList.map((regexp) => {
      while ((match = regexp.exec(content))) {
        images.push(match[1]) // マッチした括弧指定で記憶された文字列
      }
    })

    // HTML全体から画像ファイルを探す
    let imgRegExp = /(https?)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)\.(jpg|jpeg|gif|png)/ig
    while ((match = imgRegExp.exec(content))) {
      images.push(match[0]) // マッチした文字列
    }

    // 背景用画像、空画像、など除外
    return images.filter((imageUrl) => {
      let urlObj = Util.parseURL(imageUrl)
      let ignoreRegExp = /gradient|blank/i
      return urlObj['filename'].match(ignoreRegExp) === null
    })
  }

  extract (content) {
    let extracted = {}

    extracted['images'] = this.getImages(content)

    return extracted
  }
}

const TRANSLATE_DICT = {
  // for Hacker News
  'ショー HN:': 'Show HN:',
  'HN を頼みなさい:': 'Ask HN:',
  '表示HN：': 'Show HN: ',
  'HNを表示：': 'Show HN: ',
  'HNを確認して下さい：': 'Ask HN: ',

  // for Designer News
  'ショーDN：': 'Show DN: ',
  'DNを確認して下さい': 'Ask DN: '
}

class Editor {
  constructor (args) {
    this.noimage = 'https://bootstrap.tokyo/assets/noimage.png'
    this.thumbnailWidth = 270
    this.thumbnailHeight = 180
    this.sentencesNumber = 3
    this.aylienText = new AylienText(args['aylienApiId'], args['aylienApiKey'])
  }

  getHost (url) {
    let urlObj = Util.parseURL(url)
    return urlObj.host
  }

  getThumbnails (url, images) {
    let that = this
    let thumbnails = []

    // リンク切れ画像を除外
    if (images && images.length > 0) {
      thumbnails = images
        .map((imageUrl) => {
          return {
            imageUrl: Util.getResizeImage(imageUrl, that.thumbnailWidth, that.thumbnailHeight),
            width: that.thumbnailWidth,
            height: that.thumbnailHeight
          }
        })
        .filter((thumbnail) => {
          let res = Util.fetch(thumbnail['imageUrl'])
          return res && res.getResponseCode() === 200
        })
    }

      // 画像無しの場合はスクリーンショットを返す
    if (thumbnails.length === 0) {
      thumbnails = [{
        imageUrl: Util.getScreenshot(url, that.thumbnailWidth, that.thumbnailHeight),
        width: that.thumbnailWidth,
        height: that.thumbnailHeight
      }]
    }

    return thumbnails
  }

  getSummary (url) {
    let sentences = this.aylienText.summarize(url, this.sentencesNumber)
    return sentences[0]
  }

  getTranslation (text) {
    let translation = LanguageApp.translate(text, 'en', 'ja')

    // 翻訳結果を修正する
    Object.keys(TRANSLATE_DICT).forEach((k) => {
      translation = translation.replace(k, TRANSLATE_DICT[k])
    })

    return translation
  }

  edit (data) {
    let editted = {}

    // ドメイン, タイトル, タイムスタンプ
    editted['host'] = this.getHost(data['url'])
    editted['titleJa'] = this.getTranslation(data['title'])
    editted['timestamp'] = moment.default().format()

    // サムネイル
    if (data['thumbnails'] && data['thumbnails'].length > 0) {
        // do nothing
    } else {
      editted['thumbnails'] = this.getThumbnails(data['url'], data['images'])
    }

    // 要約, 翻訳
    if (data['summary']) {
      editted['summaryJa'] = this.getTranslation(data['summary'])
    } else {
      editted['summary'] = this.getSummary(data['url'])
      editted['summaryJa'] = editted['summary'] && this.getTranslation(editted['summary'])
    }

    return assign(data, editted)
  }
}
