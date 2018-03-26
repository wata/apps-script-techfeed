import * as moment from 'moment'
import Util, { CONTENT_TYPE, CHARSET } from './Util'
import { FEED_TYPE, SOURCE_TYPE } from './Def'

export class HackerNews {
  constructor () {}

  getNewsFeed (limit) {
    let apiUrl = 'https://news.ycombinator.com/rss'
    let res = Util.fetch(apiUrl)
    if (!res) { return [] }
    let results = XmlService.parse(res.getContentText())
    let feed = results.getRootElement().getChild('channel').getChildren('item').map((item) => {
      return {
        type: FEED_TYPE.NEWS,
        source: SOURCE_TYPE.HACKER_NEWS,
        url: item.getChild('link').getText(),
        title: item.getChild('title').getText(),
        published: moment.default(item.getChild('pubDate').getText(), '').format()
      }
    })

    if (limit && feed.length > limit) { feed.length = limit }

    return feed
  }
}

export class ProductHunt {
  constructor (token) {
    this.token = token
    this.headers = {
      'Accept': CONTENT_TYPE.JSON,
      'Content-Type': CONTENT_TYPE.JSON,
      'Authorization': 'Bearer ' + this.token
    }
  }

  getProductFeed (limit) {
    let apiUrl = 'https://api.producthunt.com/v1/posts'
    let res = Util.fetch(apiUrl, { headers: this.headers })
    if (!res) { return [] }
    let results = JSON.parse(res.getContentText())
    let feed = results['posts'].map((item) => {
      let childRes = Util.fetch(item['redirect_url'])
      if (!childRes) { return }
      let url = (childRes.getHeaders())['Location'].replace('?ref=producthunt', '')

      return {
        type: FEED_TYPE.PRODUCT,
        source: SOURCE_TYPE.PRODUCT_HUNT,
        url: url,
        title: item['name'],
        published: moment.default(item['created_at'], '').format(),
        summary: item['tagline'],
        thumbnails: [{
          imageUrl: item['screenshot_url']['300px'],
          width: 300,
          height: 210
        }]
      }
    })

    if (limit && feed.length > limit) { feed.length = limit }

    return feed
  }
}

export class DesignerNews {
  constructor () {}

  getNewsFeed (limit) {
    let apiUrl = 'https://www.designernews.co/api/v2/stories'
    let res = Util.fetch(apiUrl)
    if (!res) { return [] }
    let results = JSON.parse(res.getContentText())
    let feed = results['stories'].map((item) => {
      return {
        type: FEED_TYPE.NEWS,
        source: SOURCE_TYPE.DESIGNER_NEWS,
        url: item['url'],
        title: item['title'],
        published: moment.default(item['created_at'], '').format()
      }
    })

    if (limit && feed.length > limit) { feed.length = limit }

    return feed
  }
}
