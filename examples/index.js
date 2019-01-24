let currentExample = null

function getURLSearchParam (name) {
  const match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search)
  return match && decodeURIComponent(match[1].replace(/\+/g, ' '))
}

const searchParamName = getURLSearchParam('name')

const list = document.querySelector('.Examples-list')

let listItems = ''
window.EXAMPLES.forEach(function (example) {
  const name = example.split('.')[0]
  if (searchParamName === name) currentExample = name
  listItems += `<div><a href="?name=${name}">${name}</a></div>`
})

list.innerHTML = listItems

if (currentExample) {
  const script = document.createElement('script')
  script.type = 'text/javascript'
  script.src = `${currentExample}.bundle.js`
  document.body.appendChild(script)
}
