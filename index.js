'use strict'

const fs = require('fs-extra')
const execa = require('execa')
const ora = require('ora')
const ow = require('ow')
const path = require('path')
const pluralize = require('pluralize')
const puppeteer = require('puppeteer')
const tempy = require('tempy')
const { spawn } = require('child_process')
const { sprintf } = require('sprintf-js')
const { cssifyObject } = require('css-in-js-utils')

const lottieScript = fs.readFileSync(require.resolve('lottie-web/build/player/lottie.min'), 'utf8')
const axios = require('axios')
const injectLottie = `
<script>
  ${lottieScript}
</script>
`

/**
 * Renders the given Lottie animation via Puppeteer.
 *
 * You must pass either `path` or `animationData` to specify the Lottie animation.
 *
 * `output` must be one of the following:
 *   - An image to capture the first frame only (png or jpg)
 *   - An image pattern (eg. sprintf format 'frame-%d.png' or 'frame-%012d.jpg')
 *   - An mp4 video file (requires FFmpeg to be installed)
 *   - A GIF file (requires Gifski to be installed)
 *
 * @name renderLottie
 * @function
 *
 * @param {object} opts - Configuration options
 * @param {string} opts.output - Path or pattern to store result
 * @param {object} [opts.animationData] - JSON exported animation data
 * @param {string} [opts.path] - Relative path to the JSON file containing animation data
 * @param {number} [opts.width] - Optional output width
 * @param {number} [opts.height] - Optional output height
 * @param {object} [opts.jpegQuality=90] - JPEG quality for frames (does nothing if using png)
 * @param {object} [opts.quiet=false] - Set to true to disable console output
 * @param {number} [opts.deviceScaleFactor=1] - Window device scale factor
 * @param {string} [opts.renderer='svg'] - Which lottie-web renderer to use
 * @param {object} [opts.rendererSettings] - Optional lottie renderer settings
 * @param {object} [opts.puppeteerOptions] - Optional puppeteer launch settings
 * @param {object} [opts.gifskiOptions] - Optional gifski settings (only for GIF outputs)
 * @param {object} [opts.style={}] - Optional JS [CSS styles](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Properties_Reference) to apply to the animation container
 * @param {object} [opts.inject={}] - Optionally injects arbitrary string content into the head, style, or body elements.
 * @param {string} [opts.inject.head] - Optionally injected into the document <head>
 * @param {string} [opts.inject.style] - Optionally injected into a <style> tag within the document <head>
 * @param {string} [opts.inject.body] - Optionally injected into the document <body>
 * @param {number} [opts.browser] - Optional puppeteer instance to reuse
 * @param {number} [opts.frame] - Optional puppeteer to select frame for screenshoot
 * @param {number} [opts.inFrame] - Optional puppeteer to select frame for paused In Frame
 * @param {number} [opts.outFrame] - Optional puppeteer to select frame for play Out Frame
 * @param {number} [opts.customDuration] - Optional puppeteer to custom duration of lottie
 * @param {boolean} [opts.isImageSequence] - Optional puppeteer to customIsImageSequences
 * @param {string} [opts.progressUrl] - Optional puppeteer to custom progress url
 * @param {string} [opts.progressInterval] - Optional puppeteer to custom interval for progress url
 * @param {boolean} [opts.isCarousel] - Optional puppeteer to custom render carousel
 * @param {array} [opts.carouselFrames] - Optional puppeteer to number of frame
 * @param {array} [opts.customMaxDuration] - Optional puppeteer to number of maximal frame
 * @param {array} [opts.isWatermark] - Optional watermark flag
 * @param {array} [opts.omitBackground] - Optional omitbackground flag
 * @param {array} [opts.scene] - Optional currentScene flag
 * @param {array} [opts.maxScene] - Optional maximum number of scene flag
 * @param {array} [opts.isOffset] - Optional isOffset
 * @param {array} [opts.startOffset] - Optional startOffset
 *
 * @return {Promise}
 */
module.exports = async (opts) => {
  const {
    output,
    animationData = undefined,
    path: animationPath = undefined,
    jpegQuality = 90,
    quiet = false,
    deviceScaleFactor = 1,
    renderer = 'svg',
    rendererSettings = { },
    style = { },
    inject = { },
    puppeteerOptions = { },
    ffmpegOptions = {
      crf: 20,
      profileVideo: 'main',
      preset: 'medium'
    },
    gifskiOptions = {
      quality: 80,
      fast: false
    }
  } = opts

  let {
    width = undefined,
    height = undefined
  } = opts

  ow(output, ow.string.nonEmpty, 'output')
  ow(deviceScaleFactor, ow.number.integer.positive, 'deviceScaleFactor')
  ow(renderer, ow.string.oneOf([ 'svg', 'canvas', 'html' ], 'renderer'))
  ow(rendererSettings, ow.object.plain, 'rendererSettings')
  ow(puppeteerOptions, ow.object.plain, 'puppeteerOptions')
  ow(ffmpegOptions, ow.object.exactShape({
    crf: ow.number.is((val) => {
      return val >= 0 && val <= 51
    }),
    profileVideo: ow.string.oneOf(['baseline', 'main', 'high', 'high10', 'high422', 'high444']),
    preset: ow.string.oneOf([
      'ultrafast',
      'superfast',
      'veryfast',
      'faster',
      'fast',
      'medium',
      'slow',
      'slower',
      'veryslow',
      'placebo'])
  }))
  ow(style, ow.object.plain, 'style')
  ow(inject, ow.object.plain, 'inject')

  const ext = path.extname(output).slice(1).toLowerCase()
  const isApng = (ext === 'apng')
  const isGif = (ext === 'gif')
  const isMp4 = (ext === 'mp4' || ext === 'webm')
  const isPng = (ext === 'png')
  const isJpg = (ext === 'jpg' || ext === 'jpeg')
  const isSequence = opts && opts.isImageSequence ? opts.isImageSequence : false
  const isCarousel = opts && opts.isCarousel ? opts.isCarousel : false
  const carouselFrames = opts && opts.carouselFrames ? opts.carouselFrames : []
  const isOffset = opts && opts.isOffset ? opts.isOffset : false
  const startOffset = opts && opts.startOffset ? opts.startOffset : 0

  if (!(isApng || isGif || isMp4 || isPng || isJpg)) {
    throw new Error(`Unsupported output format "${output}"`)
  }

  const tempDir = isGif ? tempy.directory() : undefined
  const tempOutput = isGif
    ? path.join(tempDir, 'frame-%012d.png')
    : output
  const frameType = (isJpg ? 'jpeg' : 'png')
  const isMultiFrame = isApng || isMp4 || /%d|%\d{2,3}d/.test(tempOutput)

  let lottieData = animationData

  if (animationPath) {
    if (animationData) {
      throw new Error('"animationData" and "path" are mutually exclusive')
    }

    ow(animationPath, ow.string.nonEmpty, 'path')

    lottieData = fs.readJsonSync(animationPath)
  } else if (animationData) {
    ow(animationData, ow.object.plain.nonEmpty, 'animationData')
  } else {
    throw new Error('Must pass either "animationData" or "path"')
  }

  const fps = ~~lottieData.fr
  const { w = 640, h = 480 } = lottieData
  const aR = w / h

  ow(fps, ow.number.integer.positive, 'animationData.fr')
  ow(w, ow.number.integer.positive, 'animationData.w')
  ow(h, ow.number.integer.positive, 'animationData.h')

  if (!(width && height)) {
    if (width) {
      height = width / aR
    } else if (height) {
      width = height * aR
    } else {
      width = w
      height = h
    }
  }

  width = width | 0
  height = height | 0

  const html = `
<html>
<head>
  <meta charset="UTF-8">

  ${inject.head || ''}
  ${injectLottie}

  <style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: transparent;

  ${width ? 'width: ' + width + 'px;' : ''}
  ${height ? 'height: ' + height + 'px;' : ''}

  overflow: hidden;
}

#root {
  ${cssifyObject(style)}
}

  ${inject.style || ''}
  </style>
</head>

<body>
${inject.body || ''}

<div id="root"></div>

<script>
  const animationData = ${JSON.stringify(lottieData)}
  let animation = null
  let duration
  let numFrames
  let executeOnce = 0
  function onReady () {
    animation = lottie.loadAnimation({
      container: document.getElementById('root'),
      renderer: '${renderer}',
      loop: false,
      autoplay: false,
      rendererSettings: ${JSON.stringify(rendererSettings)},
      animationData
    })
    
    duration = animation.getDuration()
    numFrames = animation.getDuration(true)

    var div = document.createElement('div')
    div.className = 'ready'
    document.body.appendChild(div)
    
  }

  document.addEventListener('DOMContentLoaded', onReady)

</script>

</body>
</html>
`

  // useful for testing purposes
  // fs.writeFileSync('test.html', html)

  const spinnerB = !quiet && ora('Loading browser').start()

  const browser = opts.browser || await puppeteer.launch({
    ...puppeteerOptions
  })
  const page = await browser.newPage()
  if (!quiet) {
    page.on('console', console.log.bind(console))
    page.on('error', console.error.bind(console))
  }

  await page.setViewport({
    deviceScaleFactor,
    width,
    height
  })
  // await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 0 })
  await page.setContent(html)
  await page.waitForSelector('.ready')
  // await page.waitForSelector('img')
  const duration = await page.evaluate(() => duration)
  let numFrames = await page.evaluate(() => numFrames)
  if (opts && opts.customMaxDuration) numFrames = opts.customMaxDuration
  const customDuration = opts.customDuration ? (opts.customDuration + numFrames) : numFrames
  // if (customDuration) numFrames = customDuration
  const pageFrame = page.mainFrame()
  const rootHandle = await pageFrame.$('#root')

  const screenshotOpts = {
    omitBackground: opts.omitBackground,
    type: frameType,
    quality: frameType === 'jpeg' ? jpegQuality : undefined
  }

  if (spinnerB) {
    spinnerB.succeed()
  }

  const numOutputFrames = isMultiFrame ? customDuration : 1
  const framesLabel = pluralize('frame', numOutputFrames)
  const spinnerR = !quiet && ora(`Rendering ${numOutputFrames} ${framesLabel}`).start()

  let ffmpegP
  let ffmpeg
  let ffmpegStdin

  if (isApng || isMp4) {
    ffmpegP = new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-v', 'error',
        '-stats',
        '-hide_banner',
        '-y'
      ]

      if (isApng) {
        ffmpegArgs.push(
          '-f', 'image2pipe', '-c:v', 'png', '-r', `${fps}`, '-i', '-',
          '-plays', '0'
        )
      }

      if (isMp4) {
        let scale = `scale=${width}:-2`

        if (width % 2 !== 0) {
          if (height % 2 === 0) {
            scale = `scale=-2:${height}`
          } else {
            scale = `scale=${width + 1}:-2`
          }
        }

        ffmpegArgs.push(
          '-f', 'lavfi', '-i', `color=c=black:size=${width}x${height}`,
          '-f', 'image2pipe', '-c:v', 'png', '-r', `${fps}`, '-i', '-',
          '-filter_complex', `[0:v][1:v]overlay[o];[o]${scale}:flags=bicubic[out]`,
          '-map', '[out]',
          '-c:v', 'libx264',
          '-profile:v', ffmpegOptions.profileVideo,
          '-preset', ffmpegOptions.preset,
          '-crf', ffmpegOptions.crf,
          '-movflags', 'faststart',
          '-pix_fmt', 'yuv420p',
          '-r', fps
        )
      }

      ffmpegArgs.push(
        '-frames:v', `${numOutputFrames}`,
        '-an', output
      )

      // console.log(ffmpegArgs.join(' '))

      ffmpeg = spawn(process.env.FFMPEG_PATH || 'ffmpeg', ffmpegArgs)
      const { stdin, stdout, stderr } = ffmpeg
      // console.log('fikrui: ', ffmpegArgs.join(' '))
      if (!quiet) {
        stdout.pipe(process.stdout)
      }
      stderr.pipe(process.stderr)

      stdin.on('error', (err) => {
        if (err.code !== 'EPIPE') {
          return reject(err)
        }
      })

      ffmpeg.on('exit', async (status) => {
        if (status) {
          return reject(new Error(`FFmpeg exited with status ${status}`))
        } else {
          return resolve()
        }
      })

      ffmpegStdin = stdin
    })
  }
  const renderFrame = opts.frame || 75
  // for (let frame = 0; frame < numFrames; ++frame) {
  let frame = isOffset ? startOffset : 0
  let customFrame = isOffset ? startOffset : 0
  let frameNumber = isOffset ? startOffset : 0
  const progressUrl = opts.progressUrl || null
  const progressInterval = opts.progressInterval || 100

  if (isCarousel && carouselFrames.length > 0) {
    // console.log('custom duration', customDuration)
    console.log(carouselFrames.length)
    while (frame < carouselFrames.length) {
      let frameOutputPath = isMultiFrame
        ? sprintf(tempOutput, frame + 1)
        : tempOutput
      frameOutputPath = [frameOutputPath.slice(0, frameOutputPath.length - 4), `_${frame + 1}`, frameOutputPath.slice(frameOutputPath.length - 4)].join('')
      // console.log(frameOutputPath)
      // eslint-disable-next-line no-undef
      await page.evaluate((frame) => {
        // eslint-disable-next-line no-undef
        if (executeOnce === 0) {
          // eslint-disable-next-line no-undef
          for (let crf = 0; crf < animation.renderer.elements.length; crf++) {
            // eslint-disable-next-line eqeqeq
            if ((animationData.layers[crf].nm).substr(5, 3) == 'txt') {
              if (animationData.layers[crf].t.d.k[0].s.sz !== undefined) {
                // eslint-disable-next-line no-undef
                animation.renderer.elements[crf].canResizeFont(true)
              }
            }
          }
          // eslint-disable-next-line no-undef
          executeOnce++
        }
        // eslint-disable-next-line no-undef
        animation.goToAndStop(frame, true)
      }, carouselFrames[frame])

      if (progressUrl && frame % progressInterval === 0) {
        const progressData = {
          progress: frame,
          maxProgress: numFrames,
          scene: opts && opts.scene ? opts.scene : 0,
          max: opts && opts.maxScene ? opts.maxScene : 0
        }
        // Default options are marked with *
        try {
          await axios.post(progressUrl, progressData, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
        } catch (e) {
          console.log(e)
        }
      }

      await rootHandle.screenshot({
        path: frameOutputPath,
        ...screenshotOpts,
        clip: {
          x: 0,
          y: 0,
          width,
          height
        }
      })

      frame++
    }
  } else {
    // console.log('custom duration', customDuration)
    while (frame < numFrames) {
      let frameOutputPath = isMultiFrame
        ? sprintf(tempOutput, frame + 1)
        : tempOutput
      frameOutputPath = isSequence ? [frameOutputPath.slice(0, frameOutputPath.length - 4), `_${frameNumber}`, frameOutputPath.slice(frameOutputPath.length - 4)].join('') : frameOutputPath

      // eslint-disable-next-line no-undef
      await page.evaluate((frame) => {
        // eslint-disable-next-line no-undef
        if (executeOnce === 0) {
          // eslint-disable-next-line no-undef
          for (let crf = 0; crf < animation.renderer.elements.length; crf++) {
            // eslint-disable-next-line eqeqeq
            if ((animationData.layers[crf].nm).substr(5, 3) == 'txt') {
              if (animationData.layers[crf].t.d.k[0].s.sz !== undefined) {
                // eslint-disable-next-line no-undef
                animation.renderer.elements[crf].canResizeFont(true)
              }
            }
          }
          // eslint-disable-next-line no-undef
          executeOnce++
        }
        // eslint-disable-next-line no-undef
        animation.goToAndStop(frame, true)
      }, isMultiFrame || isSequence ? frame : renderFrame)

      if (progressUrl && frame % progressInterval === 0) {
        const progressData = {
          progress: frame,
          maxProgress: numFrames,
          scene: opts && opts.scene ? opts.scene : 0,
          max: opts && opts.maxScene ? opts.maxScene : 0
        }
        // Default options are marked with *
        try {
          await axios.post(progressUrl, progressData, {
            headers: {
              'Content-Type': 'application/json'
            }
          })
        } catch (e) {
          console.log(e)
        }
      }

      const screenshot = await rootHandle.screenshot({
        path: isMp4 ? undefined : frameOutputPath,
        ...screenshotOpts,
        clip: {
          x: 0,
          y: 0,
          width,
          height
        }
      })

      // single screenshot
      if (!isMultiFrame && !isSequence) {
        break
      }

      if (isApng || isMp4) {
        if (ffmpegStdin.writable) {
          ffmpegStdin.write(screenshot)
        }
      }
      ++customFrame
      if ((customDuration && opts.inFrame && opts.outFrame) && customFrame >= opts.inFrame && customFrame <= (customDuration - (numFrames - opts.inFrame))) {
        // @Todo:
        // console.log('custom sini dong:', customFrame, frame)
      } else {
        ++frame
        // console.log('frame biasa sana lah :', customFrame, frame)
      }
      frameNumber++
    }
  }

  // }

  await rootHandle.dispose()
  if (opts.browser) {
    await page.close()
  } else {
    await browser.close()
  }

  if (spinnerR) {
    spinnerR.succeed()
  }

  if (isApng || isMp4) {
    const spinnerF = !quiet && ora(`Generating ${isApng ? 'animated png' : 'mp4'} with FFmpeg`).start()

    ffmpegStdin.end()
    await ffmpegP

    if (spinnerF) {
      spinnerF.succeed()
    }
  } else if (isGif) {
    const spinnerG = !quiet && ora(`Generating GIF with Gifski`).start()

    const framePattern = tempOutput.replace('%012d', '*')
    const escapePath = arg => arg.replace(/(\s+)/g, '\\$1')

    const params = [
      '-o', escapePath(output),
      '--fps', Math.min(gifskiOptions.fps || fps, 50), // most of viewers do not support gifs with FPS > 50
      gifskiOptions.fast && '--fast',
      '--quality', gifskiOptions.quality,
      '--quiet',
      escapePath(framePattern)
    ].filter(Boolean)

    const executable = process.env.GIFSKI_PATH || 'gifski'
    const cmd = [ executable ].concat(params).join(' ')
    await execa.shell(cmd)

    if (spinnerG) {
      spinnerG.succeed()
    }
  }

  if (tempDir) {
    await fs.remove(tempDir)
  }

  return {
    numFrames,
    duration
  }
}
