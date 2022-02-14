var mergeAudio = require('./mergeAudio')

async function start () {
  await mergeAudio()
  console.log('eksekusi dimana ini')
}

start()
