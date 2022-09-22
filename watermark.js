const watermark = require('jimp-watermark')

module.exports = async (filePath, watermarkPath, finalUrl, type) => {
  return new Promise((resolve, reject) => {
    watermark.addWatermark(filePath, watermarkPath, {
      'ratio': 1, // Should be less than one
      'opacity': 1, // Should be less than one
      'dstPath': finalUrl
    }).then(data => {
      resolve(data)
    }).catch(err => {
      console.log(err)
      reject(new Error(err))
    })
  })
}
