const renderLottie = require('./index.js')
const duration = 2
const frameRate = 30
async function hajar () {
  const injectBgColor = `body { 
      background:transparent;
  }`
  const injectStyle = {
    style: injectBgColor
  }
  await renderLottie({
    path: 'D:\\project\\lottie-puppeteer-fikuri\\wuxi.json',
    output: 'D:\\project\\lottie-puppeteer-fikuri\\test3.png',
    width: 1920,
    height: 1080,
    isImageSequence: true,
    // lottieWidth: 3413,
    // lottieHeight: 1920,
    // frame: 140,
    customDuration: duration * frameRate,
    inFrame: 140,
    outFrame: 240,
    omitBackground: true,
    inject: injectStyle,
    // style: {
    //   width: '3413px',
    //   height: '1920px',
    //   transform: 'translate(-1167px, -9px)'
    // },
    puppeteerOptions: {
      headless: true,
      args: ['--no-sandbox', '--auto-open-devtools-for-tabs']
    },
    rendererSettings: {
      // preserveAspectRatio: 'none',
      // viewBoxSize: '0 0 3413px 1920px',
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
