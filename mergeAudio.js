'use strict'
var ffmpeg = require('fluent-ffmpeg')

module.exports = () => {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput('./1643882396489-CheeseCakelicious.mp4')
      .addInput('./1643880610920-mixkit-cinematic-mysterious-riser-brass-2283.wav')
      .setDuration(14)
      .on('start', (a) => {
        console.log(a)
      })
      .on('progress', (a) => {
        console.log('progress', a)
      })
      .on('end', (e) => {
        resolve()
      })
      .on('error', (err) => {
        return reject(new Error(err))
      })
      .saveToFile('./fikuri2.mp4')
  })
}
