const renderLottie = require('./index.js')
const duration = 10
const frameRate = 30
async function hajar () {
  await renderLottie({
    path: 'D:\\project\\lottie-puppeteer-fikuri\\1629950357387-wuxi-2.json',
    output: 'D:\\project\\lottie-puppeteer-fikuri\\test3.mp4',
    width: 1080,
    height: 1920,
    lottieWidth: 3413,
    lottieHeight: 1920,
    frame: 140,
    customDuration: duration * frameRate,
    inFrame: 140,
    outFrame: 240,
    omitBackground: true,
    style: {
      width: '3413px',
      height: '1920px',
      transform: 'translate(-1167px, -9px)'
    },
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox']
    },
    rendererSettings: {
      // preserveAspectRatio: 'none',
      // viewBoxSize: '0 0 3413px 1920px',
      progressiveLoad: true,
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
