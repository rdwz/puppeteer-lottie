const renderLottie = require('./index.js')
const duration = 20
const frameRate = 30
async function hajar () {
  await renderLottie({
    path: 'D:\\project\\lottie-puppeteer-fikuri\\1629950357387-wuxi-2.json',
    output: 'D:\\project\\lottie-puppeteer-fikuri\\fikuri.mp4',
    width: 1920,
    height: 1080,
    customDuration: duration * frameRate,
    inFrame: 140,
    outFrame: 240,
    omitBackground: true,
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox']
    },
    rendererSettings: {
      filterSize: {
        width: '200%',
        height: '200%',
        x: '-50%',
        y: '-50%'
      }
    }
  })
}

hajar()
