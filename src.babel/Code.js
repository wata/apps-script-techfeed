import * as moment from 'moment'
import Crawler from './Crawler'
import { HackerNews, ProductHunt, DesignerNews } from './Feed'
import { Feed, Meta } from './Model'
import Util, { CONTENT_TYPE, CHARSET } from './Util'
import { FEED_TYPE, SOURCE_TYPE } from './Def'

global.init = () => {
  // Clear all triggers
  const triggers = ScriptApp.getProjectTriggers()
  triggers.map((t) => { ScriptApp.deleteTrigger(t) })

  // Setup trigger for news
  ScriptApp.newTrigger('updateNewsFeed')
    .timeBased()
    .everyMinutes(30)
    .create()

  // Setup trigger for product
  ScriptApp.newTrigger('updateProductFeed')
    .timeBased()
    .everyHours(4)
    .create()
}

global.doGet = (e) => {
  // TODO
  // let data = 'Hello world!';
  // return ContentService.createTextOutput(data).setMimeType(ContentService.MimeType.HTML);
}

global.doPost = (e) => {
  // TODO
  // let data = JSON.parse(e['postData']['contents']);
  // MailApp.sendEmail('hogehoge@mail.com', 'Good morning!', 'Let`s eat breakfast!!');
}

global.updateNewsFeed = () => {
  _createFeed(FEED_TYPE.NEWS, 20)
  _publish()
}

global.updateProductFeed = () => {
  _createFeed(FEED_TYPE.PRODUCT, 20)
  _publish()
}

global.include = (filename) => {
  return HtmlService.createHtmlOutputFromFile(filename).getContent()
}

/* Private
-------------------------------------------------- */

global.__getSourceFeed = (type, limit) => {
  const props = PropertiesService.getScriptProperties()
  const productHuntToken = props.getProperty('PRODUCT_HUNT_DEV_TOKEN')

  let sourceFeed = []

  switch (type) {
    case FEED_TYPE.NEWS:
      [
        (new HackerNews()).getNewsFeed(limit / 2),
        (new DesignerNews()).getNewsFeed(limit / 2)
      ].map((feed) => {
        Array.prototype.push.apply(sourceFeed, feed)
      })
      break
    case FEED_TYPE.PRODUCT:
      [
        (new ProductHunt(productHuntToken)).getProductFeed(limit)
      ].map((feed) => {
        Array.prototype.push.apply(sourceFeed, feed)
      })
      break
  }

  sourceFeed = Util.objectArrayUnique(sourceFeed, 'url')
  sourceFeed = Util.objectArraySort(sourceFeed, 'published', false)

  return sourceFeed
}

global.__getNewEntries = (entries, previous) => {
  const urls = previous.map((entry) => {
    return entry['url']
  })
  const newEntries = entries.filter((entry) => {
    return urls.indexOf(entry['url']) === -1
  })
  return newEntries
}

global._createFeed = (type, limit) => {
  const props = PropertiesService.getScriptProperties()
  const ssid = props.getProperty('SPREADSHEET_ID')
  const aylienApiId = props.getProperty('AYLIEN_API_ID')
  const aylienApiKey = props.getProperty('AYLIEN_API_KEY')
  const feed = new Feed(ssid)

  // Get new entries
  const currentFeed = feed.select().filter('type = ' + type).result()
  const sourceFeed = __getSourceFeed(type, limit)
  const newEntries = __getNewEntries(sourceFeed, currentFeed)

  // Crawl
  const crawler = new Crawler({ aylienApiId: aylienApiId, aylienApiKey: aylienApiKey })
  const results = crawler.crawl(newEntries)

  // Format
  const newFeed = results.map((item) => {
    const thumbnail = item['thumbnails'][0]
    return {
      type: item['type'],
      source: item['source'],
      url: item['url'],
      host: item['host'],
      title: item['title'],
      titleJa: item['titleJa'],
      published: item['published'],
      timestamp: item['timestamp'],
      thumbnailUrl: thumbnail['imageUrl'],
      thumbnailWidth: thumbnail['width'],
      thumbnailHeight: thumbnail['height'],
      summary: item['summary'] || null,
      summaryJa: item['summaryJa'] || null
    }
  })

  // Update rows
  Array.prototype.push.apply(newFeed, currentFeed)
  if (newFeed.length > limit) { newFeed.length = limit }
  feed.replaceRows(newFeed, 'type = ' + type)
}

global._publish = () => {
  const props = PropertiesService.getScriptProperties()
  const ssid = props.getProperty('SPREADSHEET_ID')
  const meta = new Meta(ssid)
  const feed = new Feed(ssid)
  const results = feed.select().filter(`type IN ${FEED_TYPE.NEWS},${FEED_TYPE.PRODUCT}`).result()

  const data = {
    meta: meta.flatten(),
    feed: Util.objectArraySort(results, 'published', false),
    lastModified: moment.default().format()
  }

  // JSON
  _toS3(JSON.stringify(data['feed'], null, 2), CONTENT_TYPE.JSON, 'api/v0/feed.json')

  // HTML
  let html = HtmlService.createTemplateFromFile('Page')
  html['data'] = data
  _toS3(html.evaluate().getContent(), CONTENT_TYPE.HTML, 'index.html')

  // RSS
  let rss = HtmlService.createTemplateFromFile('RSS')
  rss['data'] = data
  _toS3(rss.evaluate().getContent(), CONTENT_TYPE.RSS, 'rss.xml')
}

global._toS3 = (content, contentType, objectName) => {
  const props = PropertiesService.getScriptProperties()
  const s3AccessKey = props.getProperty('S3_ACCESS_KEY')
  const s3SecretKey = props.getProperty('S3_SECRET_KEY')
  const s3BucketName = props.getProperty('S3_BUCKET_NAME')
  const blob = Utilities.newBlob('', contentType).setDataFromString(content, CHARSET.UTF_8)
  const s3 = S3.getInstance(s3AccessKey, s3SecretKey)
  s3.putObject(s3BucketName, objectName, blob, { 'logRequests': true })
}
