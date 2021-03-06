'use strict'

let fs = require('fs'),
  xml2js = require('xml2js'),
  request = require('request'),
  mkdirp = require('mkdirp'),
  async = require('async')

let config = require('./config').config


// page url
let pageUrl = config.url

// 图片计数
let count = 0

// 创建目录
let dir = config.dir

mkdirp(dir, (err) => {
  if (err) {
    console.log(err)
  }
})

let _getUrl = (cb) => {
  let url = pageUrl
          + '/api/read?type=photo&num='
          + config.freq
          + '&start='
          + config.posts

  cb(null, url)
}

let _getPosts = (url, cb) => {
  request.get(url, (err, res, body) => {
    xml2js.parseString(body, {
        explicitArray: false
    }, (err, result) => {
      if(err) {
        cb(err)
      } else {
        cb(null, result.tumblr.posts.post)
      }
    })
  })
}

let _getImages = (posts, cb) => {
  if (posts) {
    let images = []
    posts.forEach((post) => {
      let date = post['$']['date']
      if (post['photo-url']) {
        images.push({ src: post['photo-url'][0]._, date: date })
      } else if (post['photoset']) {
        let photoset = post['photoset']['photo']
        photoset.forEach((photo) => {
          images.push({ src: photo['photo-url'][0]._, date: date })
        })
      }

    })
    cb(null, images)
  } else {
    console.log('Done, total images count', count)
    process.exit()
  }
}

let _downImage = (image, cb) => {
  let url = image.src
  let d = new Date(image.date || null)
  let ds = d.toLocaleDateString().replace(/\//g, '_')

  let name = count++ + '_' + ds + '_' + url.match(/[^/]+$/)[0]
  let fileName = dir + name


  // 存在就跳过
  if(fs.existsSync(fileName)) {
    console.log('Has downloaded: ' + name)
    cb()
    return;
  }

  console.log('download image: ' + count)

  request
    .get(url)
    .pipe(fs.createWriteStream(fileName))
    .on('close', () => {
      cb()
    })
    .on('error', (err) => {
      console.log('write error', err)
      cb(err)
    })
}

let _downImages = (images, cb) => {
  const limit = 6
  async.eachLimit(images, limit, _downImage, (err) => {
    cb(err)
  })
}

let start = () => {
  async.waterfall([
    _getUrl,
    _getPosts,
    _getImages,
    _downImages
  ], (err, result) => {
    if (err) {
      console.log('出错重新下载...')
      config.posts = count = 0
      start()
    } else {
      config.posts += config.freq
      start()
    }
  })
}

console.log('Start download...')

start()
