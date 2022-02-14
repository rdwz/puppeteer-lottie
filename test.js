const renderLottie = require('./index.js')
// const duration = 3
// const frameRate = 30
async function hajar () {
  const injectBgColor = `body { 
      background:transparent;
  }`
  const injectStyle = {
    style: injectBgColor
  }
  // eslint-disable-next-line promise/param-names
  // const timeout = ms => new Promise(res => setTimeout(res, ms))
  // for (let index = 0; index < 3; index++) {
  // await timeout(5000)
  await renderLottie({
    path: './BiteSceneX.json',
    output: `./contoh.mp4`,
    width: 1920,
    height: 1080,
    isImageSequence: false,
    // lottieWidth: 3413,
    // lottieHeight: 1920,
    // frame: 1219,
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
  // }
}

hajar()
