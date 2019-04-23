const examples = require('./examples.js')

const ExamplesModules = Object.fromEntries(
  new Map(
    examples.map(example => [
      example,
      () => import(/* webpackChunkName: "[request]" */ `../${example}.js`)
    ])
  )
);

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
  : '<div class="Examples-list-item"><a href="/"><h3>home</h3></a></div>';
list.innerHTML = examples.reduce(
  (html, example) =>
    (html += `<div class="Examples-list-item"><a href="?name=${example}">${
      currentExample ? "" : `<img src="screenshots/${example}.png" />`
    }<h3>${example}</h3></a></div>`),
  listItems
)
