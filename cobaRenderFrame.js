/* eslint-disable no-unused-vars */
'use strict'
const renderLottie = require('.')

async function render () {
  const bodymovin = `D:\\project\\puppeteer-lottie\\fixtures\\blahblah.json`
  const output = './fikrui.png'
  await renderLottie({
    path: bodymovin,
    quiet: true,
    output,
    frame: 75
  })
}

render()
