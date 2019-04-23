const fs = require('fs')
const request = require('request')
const PNG = require('pngjs').PNG
const pixelmatch = require('pixelmatch')

const currentExample = process.argv[2]

const sourceFileURL = `https://raw.githubusercontent.com/pex-gl/pex-renderer/master/examples/screenshots/${currentExample}.png`
const comparisonFilePath = `screenshots/${currentExample}.png`

let filesRead = 0

const sourceImage = request(sourceFileURL)
  .pipe(new PNG())
  .on('parsed', onFileParse)

const comparisonImage = fs
  .createReadStream(comparisonFilePath)
  .pipe(new PNG())
  .on('parsed', onFileParse)

function onFileParse () {
  if (++filesRead < 2) return

  const diff = new PNG({ width: sourceImage.width, height: sourceImage.height })

  pixelmatch(
    sourceImage.data,
    comparisonImage.data,
    diff.data,
    sourceImage.width,
    sourceImage.height,
    {
      threshold: 0.01
    }
  )

  diff
    .pack()
    .pipe(
      fs.createWriteStream(comparisonFilePath.replace('.png', '-diff.png'))
    )
}
