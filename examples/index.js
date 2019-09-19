const path = require('path')

let examples = require.context('./', false, /\.js$/).keys()

examples = examples.filter(
  (example) =>
    !['./index.js', './webpack.config.js'].includes(example)
)

examplesNames = examples.map((example) =>
  path.basename(example, path.extname(example))
)

const ExamplesModules = Object.fromEntries(
  new Map(
    examplesNames.map((example) => [
      example,
      () =>
        import(/* webpackChunkName: "[request]" */
        /* webpackExclude: /scripts$/ */
        `./${example}.js`)
    ])
  )
)

const searchParams = new URLSearchParams(window.location.search)
const currentExample = searchParams.get('name')

if (currentExample && ExamplesModules[currentExample]) {
  const header = document.querySelector('.MainHeader')
  header.style.display = 'none'

  ExamplesModules[currentExample]()
}

const list = document.querySelector('.Examples-list')
if (currentExample) {
  list.classList.add('Examples-list--side')
}

const listItems = !currentExample
  ? ''
  : '<div class="Examples-list-item"><a href="/"><h3>home</h3></a></div>'
list.innerHTML = examplesNames.reduce(
  (html, example) =>
    (html += `<div class="Examples-list-item"><a href="?name=${example}">${
      currentExample ? '' : `<img src="screenshots/${example}.png" />`
    }<h3>${example}</h3></a></div>`),
  listItems
)
