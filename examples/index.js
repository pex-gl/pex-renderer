(async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const examples = [
    // Engine features
    "basic",
    "engine",
    "gltf",
    "helpers",
    "instancing",

    // View
    // "layers",
    "cameras",
    "frustum-culling",
    "multi-view",
    "camera-cinematic-dof",

    // Lighting
    "lights",
    "skybox",

    // Materials
    "materials",
    "brdf",
    "refraction",
    "clear-coat",
    "point-size",

    // Post-Processing
    "post-processing",
    // "ao",
    // "blocks",
  ];
  window.pexExamples = examples;

  const list = document.querySelector(".Examples-list");
  if (params.has("screenshot")) {
    list.classList.add("u-hide");
  } else if (id) {
    list.classList.add("Examples-list--side");
  }

  list.innerHTML = examples.reduce(
    (html, example) =>
      (html += `<div class="Examples-list-item"><a href="?id=${example}">
      <img src="examples/screenshots/${example}.png" /><h3>${example}</h3></a></div>`),
    !id
      ? ""
      : '<div class="Examples-list-item"><a href="/"><h3>home</h3></a></div>'
  );

  if (id) {
    document.querySelector(".MainHeader").remove();
    document.querySelector("body").style.backgroundColor = getComputedStyle(
      document.body
    ).getPropertyValue("--color-grey");

    try {
      await importShim(`./examples/${id}.js`);
    } catch (error) {
      console.error(error);
    }

    list.querySelector(`a[href="?id=${id}"]`)?.scrollIntoView(true);
  }
})();
