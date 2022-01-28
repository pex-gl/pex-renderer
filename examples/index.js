const path = require('path')

const examplesNames = require
  .context('./', false, /^(?!.*\/(index|webpack.config|scripts|build|assets)).*js$/) // Match only .js files at the root
  .keys()
  .map((example) => path.basename(example, path.extname(example)))

const ExamplesModules = Object.fromEntries(
  new Map(
    examplesNames.map((example) => [
      example,
      () =>
        import(/* webpackChunkName: "[request]" */
        /* webpackInclude: /^(?!.*\/(index|webpack.config|scripts|build|assets)).*js$/ */
        `./${example}.js`)
    ])
  )
)

const searchParams = new URLSearchParams(window.location.search)
const currentExample = searchParams.get('name')

if (currentExample && ExamplesModules[currentExample]) {
  document.querySelector('.MainHeader').remove()
  document.querySelector('body').style.backgroundColor = getComputedStyle(
    document.body
  ).getPropertyValue('--color-black')
  ExamplesModules[currentExample]()
}

const list = document.querySelector('.Examples-list')
if (searchParams.has('screenshot')) {
  list.classList.add('u-hide')
} else if (currentExample) {
  list.classList.add('Examples-list--side')
}

const listItems = !currentExample
  ? ''
  : '<div class="Examples-list-item"><a href="/"><h3>home</h3></a></div>'
list.innerHTML = examplesNames.reduce(
  (html, example) =>
    (html += `<div class="Examples-list-item"><a href="?name=${example}">
    <img src="screenshots/${example}.png" /><h3>${example}</h3></a></div>`),
  listItems
)
