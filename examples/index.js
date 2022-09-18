(async () => {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const examples = [
    // "ao",
    "basic",
    "blocks",
    "refraction",
    "multi-view",
    "brdf",
    // "camera-cinematic-dof",
    // "camera-view",
    // "cameras",
    // "clear-coat",
    // "custom-shader",
    // "emissive-bloom",
    "gltf",
    "helpers",
    // "highpoly",
    // "instancing",
    // "lights",
    // "materials",
    // "orbiter",
    // "overlays",
    // "point-size",
    // "post-processing",
    // "skybox",
    // "vertex-colors",
    // "window-resize",
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
