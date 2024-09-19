# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

# [4.0.0-alpha.55](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.54...v4.0.0-alpha.55) (2024-09-19)


### Bug Fixes

* **post-processing:** use Linear min/mag for post-processing output ([669c840](https://github.com/pex-gl/pex-renderer/commit/669c84023be9f237da7ad8ffab132db38bf9416c))


### Features

* **post-processing:** update aa for fxaa3 ([868b7c6](https://github.com/pex-gl/pex-renderer/commit/868b7c661edd5cb6ba889c99c5420abdac1bdc8a))



# [4.0.0-alpha.54](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.53...v4.0.0-alpha.54) (2024-09-19)


### Features

* **post-processing:** add lumaThreshold and subPixelQuality to postprocessing aa component ([0e27ced](https://github.com/pex-gl/pex-renderer/commit/0e27ced972b5c6ad7657a7430ab0398797ba8430))



# [4.0.0-alpha.53](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.52...v4.0.0-alpha.53) (2024-07-18)


### Bug Fixes

* **ecs:** add back time ([9a118b7](https://github.com/pex-gl/pex-renderer/commit/9a118b79cbd8951f984690e23eeceb0d17159888))
* **ecs:** bring back debug support for pipeline cache (new program/pipeline) ([c87914a](https://github.com/pex-gl/pex-renderer/commit/c87914a29d4ffa30ac09fff051decf53d7956e76))
* **ecs:** cache fov and focalLength when updating one or the other ([d1998ce](https://github.com/pex-gl/pex-renderer/commit/d1998cefca9b7be4c10457b27c5378c44e462d36))
* **ecs:** check camera component for caching camera by entity id ([c21735d](https://github.com/pex-gl/pex-renderer/commit/c21735d9338b7e42e34869260149eb61eda08e2d))
* **ecs:** return hash from props for pipeline caching ([f028a26](https://github.com/pex-gl/pex-renderer/commit/f028a2676fc475b45a258e8d69cbe3569c21bf9e))


### Features

* add depthTest and depthWrite to line material ([6fa07b9](https://github.com/pex-gl/pex-renderer/commit/6fa07b98ca9daad5ce7b037a36a802c7a4fbdab4)), closes [#385](https://github.com/pex-gl/pex-renderer/issues/385)
* **ecs:** assimilate empty strings "" as falsy when checking flags of type "value" ([d72e808](https://github.com/pex-gl/pex-renderer/commit/d72e808ca346315e1636dd5f3dcf1454bed5559a)), closes [#387](https://github.com/pex-gl/pex-renderer/issues/387)
* **ecs:** remove normalTextureScale from material component and set default in standard redererer flagDefinitions ([476971f](https://github.com/pex-gl/pex-renderer/commit/476971fb9177f30e7c42e299272efe793e62e6ba))



# [4.0.0-alpha.52](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.51...v4.0.0-alpha.52) (2024-07-15)


### Bug Fixes

* **ecs:** add intensity to ambient light component ([b10fe44](https://github.com/pex-gl/pex-renderer/commit/b10fe44137eb0fccd0f8395dccb7b699a587189c))
* **ecs:** check for offsets length before computing geometry.bounds for instanced geometry ([6276a18](https://github.com/pex-gl/pex-renderer/commit/6276a18b7334b17ae6ea49710eab6ddd76b20373)), closes [#386](https://github.com/pex-gl/pex-renderer/issues/386)


### Features

* expose back postProcessingEffects ([d7cc3ec](https://github.com/pex-gl/pex-renderer/commit/d7cc3ec16c432503b2f193de68045e2241eeefd8))



# [4.0.0-alpha.51](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.50...v4.0.0-alpha.51) (2024-06-06)


### Bug Fixes

* filter renderableEntities in standard render when options.cullFaceMode is set to Front ([cc782c1](https://github.com/pex-gl/pex-renderer/commit/cc782c109d299c8b8864ce79f12764944f152156))
* support separate sheen roughness texture ([643bb25](https://github.com/pex-gl/pex-renderer/commit/643bb255a7ab827e41f7265f22fefeacb6ba2b8a))


### Features

* rename all lights radius to bulbRadius ([41042b2](https://github.com/pex-gl/pex-renderer/commit/41042b2762c9e7324a34101cd218b5191b339820))
* render transmissive objects in two passes ([978ea80](https://github.com/pex-gl/pex-renderer/commit/978ea80763f353930d33d8e7c05ce8aa37d9cc92))



# [4.0.0-alpha.50](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.49...v4.0.0-alpha.50) (2024-05-03)



# [4.0.0-alpha.49](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.48...v4.0.0-alpha.49) (2024-05-03)


### Bug Fixes

* change default ssao scale back to 1 ([82c54dc](https://github.com/pex-gl/pex-renderer/commit/82c54dcf5edda566aec425064f586ad9d024846a))
* createPipelineCache() typo ([f32dda5](https://github.com/pex-gl/pex-renderer/commit/f32dda58b9282620e944c578805ed6512d5a39ee))
* ensure ssao mix happens before dof ([408c853](https://github.com/pex-gl/pex-renderer/commit/408c853fa3f211ffcd42e80fabe7eea436976a2e))
* make all examples run again with new render-pipeline ([a4149c6](https://github.com/pex-gl/pex-renderer/commit/a4149c6e59f98afce8ebc6adeb083f762ff201d1))
* only use color attachment for transmission pass ([27ce9f6](https://github.com/pex-gl/pex-renderer/commit/27ce9f6149fb3eb9a2e79b6fced795ee09df24a5))
* remove ssao replace in post processing final effect ([41aec01](https://github.com/pex-gl/pex-renderer/commit/41aec01e7f0857b615ea913bebbe01474caa7434))
* use uniforms instead of this.uniforms for shadersPostReplace ([041ea8b](https://github.com/pex-gl/pex-renderer/commit/041ea8b9679d53620aa2ab9392db0a6117edbf7e))
* wrong import paths in pipeline-cache ([d11858d](https://github.com/pex-gl/pex-renderer/commit/d11858da160e1de9fb546c8cf81a83e25549daf9))


### Features

* add transmission ([878490c](https://github.com/pex-gl/pex-renderer/commit/878490c3107dba697eb7ce51d0148515914181d9))
* **gltf:** warn of unsupported extensions + error required extensions ([22d972b](https://github.com/pex-gl/pex-renderer/commit/22d972b707ff871106ccd16e1d2ade0903305112))
* improve graphviz scaling ([76b26d8](https://github.com/pex-gl/pex-renderer/commit/76b26d81a5e221d493e300fedd031c6fbce07387))
* remove reflectance and old transmission aka refraction ([280bf43](https://github.com/pex-gl/pex-renderer/commit/280bf43107fbf990fed88bb46508c67799411db5))



# [4.0.0-alpha.48](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.47...v4.0.0-alpha.48) (2024-03-08)


### Bug Fixes

* **ecs:** reset geometry components properties dirty to false on geometry update ([788e1f1](https://github.com/pex-gl/pex-renderer/commit/788e1f18a6a02421691d1a708aca4347008d59c2))
* **ecs:** vertex helper early return check for typed arrays + check for isFlatArray instead of isTypedArray ([b047be3](https://github.com/pex-gl/pex-renderer/commit/b047be321011cb15dd75640cf2c114fcaa5c582c))


### Features

* **ecs:** add support for instanced geometry in vertex helpers ([ef2f5b3](https://github.com/pex-gl/pex-renderer/commit/ef2f5b3802cff537d1f0852392281f9c2d994751))
* **ecs:** update bounds computation in geometry system ([7803878](https://github.com/pex-gl/pex-renderer/commit/7803878fc99832d354aa3d823140f09fc76e5a4a))



# [4.0.0-alpha.47](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.46...v4.0.0-alpha.47) (2024-03-01)


### Bug Fixes

* **ecs:** filter entities with no layer if rendering with a camera with no layer ([de64bb4](https://github.com/pex-gl/pex-renderer/commit/de64bb41ad83af4ddcbba2174fe238d642c8e67c)), closes [#329](https://github.com/pex-gl/pex-renderer/issues/329)
* **ecs:** get layer from cameraEntity in render-pipeline ([afa10cb](https://github.com/pex-gl/pex-renderer/commit/afa10cbeadaf62406844fb6153f39265d64a373b))
* **gltf:** add back support for EXT_mesh_gpu_instancing ([3b69bf0](https://github.com/pex-gl/pex-renderer/commit/3b69bf03d68af9b78f3cddcc622e36f915bc6106))
* **gltf:** check for primitive mode as integer ([6713aa9](https://github.com/pex-gl/pex-renderer/commit/6713aa93276bda3ef6ea03a99818ceed04200f39))
* **glTF:** remove xmag and ymag halving in glTF loader ([b7ca97c](https://github.com/pex-gl/pex-renderer/commit/b7ca97c4f4fe105382eba67e7a81ae1edd8fffc3)), closes [#364](https://github.com/pex-gl/pex-renderer/issues/364)


### Features

* **ecs:** split post processing passes + rename command to passes ([9c02c54](https://github.com/pex-gl/pex-renderer/commit/9c02c54c7f23517a88d92ea5bf749876e060efca))
* **ecs:** use renderView viewport in line renderer ([89f0388](https://github.com/pex-gl/pex-renderer/commit/89f0388a1ff25585b56229f1be001f2df5407dd5))
* **pbr:** update pex-shaders (dof physical/focus scale, ssao post and bloom source/color function) ([e49a5bb](https://github.com/pex-gl/pex-renderer/commit/e49a5bbc4f26630388fe0afb18686be181c329bf))


### Performance Improvements

* **ecs:** require USE_EMISSIVE_COLOR for emissiveIntensity flag in standard renderer ([16f4dc6](https://github.com/pex-gl/pex-renderer/commit/16f4dc6b324045988e5484e69aecc49508ba87cf))



# [4.0.0-alpha.46](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.45...v4.0.0-alpha.46) (2023-10-26)


### Bug Fixes

* **ecs:** only compute projectionMatrix in camera system ([b6aac0d](https://github.com/pex-gl/pex-renderer/commit/b6aac0d71b19fefa705c9a911e5d16a1479abe60))
* **ecs:** spot light helper default radius for inner angle 0 ([618cf7c](https://github.com/pex-gl/pex-renderer/commit/618cf7cae23c5bfd36d44109a2cce42bbb15f307))


### Features

* **ecs:** add line material perspectiveScaling + change default line resolution ([f0933ac](https://github.com/pex-gl/pex-renderer/commit/f0933ac3b10bf8aed7886b0dc93dc3272ed80d3e))
* **ecs:** area light disk helper ([47ba734](https://github.com/pex-gl/pex-renderer/commit/47ba734e5c9366f1b3291dd9e419da67f6cf5707))
* **pbr) feat(ecs:** add skybox exposure ([fda28f3](https://github.com/pex-gl/pex-renderer/commit/fda28f30cb29cab917e49e335c576881d2b011e1))


### Performance Improvements

* **ecs) feat(ecs:** avoid GC when computing normal matrix ([e105939](https://github.com/pex-gl/pex-renderer/commit/e1059392fee0f16b4326806974ee923108298329))



# [4.0.0-alpha.45](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.44...v4.0.0-alpha.45) (2023-10-20)


### Bug Fixes

* **ecs:** compose shadow mapping with render-pipeline-system ([47012f7](https://github.com/pex-gl/pex-renderer/commit/47012f7b04aca1dadf7f16165a84de04ba65a274)), closes [#350](https://github.com/pex-gl/pex-renderer/issues/350)
* **ecs:** handle skybox with no sunPosition nor envMap ([cd8a8bc](https://github.com/pex-gl/pex-renderer/commit/cd8a8bc7c83a3d5fddf619f006e401ae4f1547a3)), closes [#352](https://github.com/pex-gl/pex-renderer/issues/352)


### Features

* **ecs:** add base renderer to share logic between renderers ([6da7db3](https://github.com/pex-gl/pex-renderer/commit/6da7db3ade882709ae6f606f893d1231eaed842e))
* **ecs:** add material component type check for line + upgrade line renderer ([c8f99c6](https://github.com/pex-gl/pex-renderer/commit/c8f99c617403c16959e4307362c4e0ddf8b8b965))
* **ecs:** add outputs Set to render-pipeline ([e9efd95](https://github.com/pex-gl/pex-renderer/commit/e9efd95c04056caf9e921ebc4dbc63e1c527a46f))
* **ecs:** handle post processing, drawToScreen with Linear/Gamma cameras (wip) ([3d9af59](https://github.com/pex-gl/pex-renderer/commit/3d9af59ee5d1dc2c78a2e34116c4f035447997e5))
* **ecs:** make vertex color optional for line renderer + namespace post-processing subcomponents ([dd8d2d3](https://github.com/pex-gl/pex-renderer/commit/dd8d2d348464a39ce6deb5c1c74cc4611c7d0eef))
* **pbr:** add support for tone map in render-view ([10af3c4](https://github.com/pex-gl/pex-renderer/commit/10af3c4bc06c5cb5b4909fc7c4e2da8e566ceb2c))
* update lights for PCSS + add output encoding, tonemap and exposure to camera + rename line material type from segments to line ([77b83b0](https://github.com/pex-gl/pex-renderer/commit/77b83b0a02dc59d67e653c374e5223645e873ed5))


### Reverts

* light getCorners gc ([b5b9ac3](https://github.com/pex-gl/pex-renderer/commit/b5b9ac387a10d783bb716b7066f5deb92d0e31e9))



# [4.0.0-alpha.44](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.43...v4.0.0-alpha.44) (2023-10-04)



# [4.0.0-alpha.43](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.42...v4.0.0-alpha.43) (2023-10-04)



# [4.0.0-alpha.42](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.41...v4.0.0-alpha.42) (2023-09-29)


### Bug Fixes

* add back support for error program fallback ([8b0f77b](https://github.com/pex-gl/pex-renderer/commit/8b0f77bf4b7787fda73c358267f18ca565f33339)), closes [#119](https://github.com/pex-gl/pex-renderer/issues/119) [#120](https://github.com/pex-gl/pex-renderer/issues/120)
* add missing light matrices init (wip) ([10bb224](https://github.com/pex-gl/pex-renderer/commit/10bb224a2b2a75bfbd3b30e91865ba2c1f1d6866))
* delete unused geometry attributes + support custom attributes ([bc0f182](https://github.com/pex-gl/pex-renderer/commit/bc0f1822335ebd7e04301d02c0735e6063167d7c)), closes [#95](https://github.com/pex-gl/pex-renderer/issues/95)
* **ecs:** add line system renderable entities check for geometry ([e60abdf](https://github.com/pex-gl/pex-renderer/commit/e60abdfafa015c52d23b4f2bf56cf6ca71eba114))
* **ecs:** check for nullish in geometry.primitive ([e3dba45](https://github.com/pex-gl/pex-renderer/commit/e3dba45365b3e63cee8c7e58112e17710a06d261))
* **ecs:** cleanup post processing passes ([2105c7c](https://github.com/pex-gl/pex-renderer/commit/2105c7ce8d3089e493200a5381b52da1e60fcdb6))
* **ecs:** default uniforms for castShadows false ([d08444c](https://github.com/pex-gl/pex-renderer/commit/d08444c604bc219a4013c783f6761a83e9977b77))
* **ecs:** ensure clearcoat and sheen uniforms are not set if disabled ([239658c](https://github.com/pex-gl/pex-renderer/commit/239658c9befcdad022d91aacc09e1c747adb6b67))
* **ecs:** only create update sky texture command when used ([6a6dbff](https://github.com/pex-gl/pex-renderer/commit/6a6dbff45e4431a706c8ee992bf9af3047e95e8a))
* **ecs:** only update/create sky texture if no envMap is provided ([43dc4a2](https://github.com/pex-gl/pex-renderer/commit/43dc4a2371d7d768bae1d007e3d492318c330dfb))
* **ecs:** prevent camera helper rendering in the same view as the rendered camera component ([acb1c61](https://github.com/pex-gl/pex-renderer/commit/acb1c61422f3a0b69760d4ccae9038375eeb8681)), closes [#341](https://github.com/pex-gl/pex-renderer/issues/341)
* **ecs:** rename debugMode option to debug to match pex-context ([b9abad3](https://github.com/pex-gl/pex-renderer/commit/b9abad32bfc0fbffbb1567c5686ff4cf0d82959f))


### Features

* add camera frustum culling ([9ef678a](https://github.com/pex-gl/pex-renderer/commit/9ef678a9e181d6ffbfd70424e0af85f29830d17d)), closes [#1](https://github.com/pex-gl/pex-renderer/issues/1) [#157](https://github.com/pex-gl/pex-renderer/issues/157)
* add gtao (wip) ([5fc36f8](https://github.com/pex-gl/pex-renderer/commit/5fc36f8aa46566e65f141c57d228155e79e1e82d))
* **ecs:** add back ao ([d381e81](https://github.com/pex-gl/pex-renderer/commit/d381e81301506b8238aa83ea54cde191f98401b4))
* **ecs:** add back camera view support ([04b68c6](https://github.com/pex-gl/pex-renderer/commit/04b68c6e9bc803301d688dc69baf84e85b8cd212))
* **ecs:** add back post-processing ([326e17c](https://github.com/pex-gl/pex-renderer/commit/326e17cd83058b49fef040d785acb3f39983459a))
* **ecs:** add dispose and clean up transform system ([d2ddf85](https://github.com/pex-gl/pex-renderer/commit/d2ddf85d26dc7765f773797c5af38a5d63af5800))
* **ecs:** add light system ([bd591f2](https://github.com/pex-gl/pex-renderer/commit/bd591f29bf8dfd596db02c82a384de8a12439cbf))
* **ecs:** add material.lineWidth for segments ([5cb44f2](https://github.com/pex-gl/pex-renderer/commit/5cb44f20accd9e4118620a6479d7ac16f1539376))
* **ecs:** add post-processing components + add back camera cinematic parameters ([1dbbf11](https://github.com/pex-gl/pex-renderer/commit/1dbbf11e1d7d5259fd10279e78d49cc6f93e76ea))
* **ecs:** add render-engine dispose ([5621a24](https://github.com/pex-gl/pex-renderer/commit/5621a24b0d8638eca924dfb492181605c0bd8141))
* **ecs:** add resource cache fullscreen quad ([affb8f8](https://github.com/pex-gl/pex-renderer/commit/affb8f8519ffd75683e5873b8f950aa40d1cb81b))
* **ecs:** add world dispose ([6f65c5b](https://github.com/pex-gl/pex-renderer/commit/6f65c5b683e7d8c9e9b19085617d37cbb1fa0c4d)), closes [#202](https://github.com/pex-gl/pex-renderer/issues/202) [#75](https://github.com/pex-gl/pex-renderer/issues/75)
* **ecs:** align point light bias with other light biases ([9a69046](https://github.com/pex-gl/pex-renderer/commit/9a69046d20444ef324f1a43b07fe15c7614649d1))
* **ecs:** clean up and uniformise standard renderer ([33a68f2](https://github.com/pex-gl/pex-renderer/commit/33a68f2582c43d9220b8bc57a2a4f4f2ba30767e))
* **ecs:** default projection angle to half pi for area light ([40070a8](https://github.com/pex-gl/pex-renderer/commit/40070a880c032cec3a6ce006ed6552be4cc75969))
* **ecs:** make ao radius default to 100 ([32eacfc](https://github.com/pex-gl/pex-renderer/commit/32eacfce2f464f903743560d9b6616692b5cb15d))
* **ecs:** move post processing passes handling to a renderer with renderStage post ([f6fc501](https://github.com/pex-gl/pex-renderer/commit/f6fc501989df275d837131ada84fe57a9dd8a0d0))
* **ecs:** pass entitites to render engine dispose ([12adc6c](https://github.com/pex-gl/pex-renderer/commit/12adc6cff47034d54229a27f8ef1b930b0b0513f))
* **ecs:** upgrade area lights ([c8a5503](https://github.com/pex-gl/pex-renderer/commit/c8a550349372d7a59d07cdfa45488bcd4e413bdf)), closes [#26](https://github.com/pex-gl/pex-renderer/issues/26)
* **gltf:** add transform system to gltf loader ([91d5266](https://github.com/pex-gl/pex-renderer/commit/91d52662f0ea338338e5cba78a6271337cb8161d)), closes [#317](https://github.com/pex-gl/pex-renderer/issues/317)
* **main:** cleanup directional unused condition ([f7ebdc8](https://github.com/pex-gl/pex-renderer/commit/f7ebdc8b3b02184a96f6a2d8036b57981564f117))
* **pbr:** consolidate material flags parsing and cache for basic/standard renderers ([01b12db](https://github.com/pex-gl/pex-renderer/commit/01b12db787cd34de3782bc5cf14fb6748c982010))
* **pbr:** improve point lights ([c50acf9](https://github.com/pex-gl/pex-renderer/commit/c50acf9f0c3a279cac415b1c44907fbf464cae3b)), closes [#109](https://github.com/pex-gl/pex-renderer/issues/109) [#206](https://github.com/pex-gl/pex-renderer/issues/206)
* **pbr:** rename map to texture and update flags/uniforms/texture transform definitions ([2b6c22c](https://github.com/pex-gl/pex-renderer/commit/2b6c22c464023ec7ce2ae988c1b2afb77bb01499)), closes [#318](https://github.com/pex-gl/pex-renderer/issues/318) [#310](https://github.com/pex-gl/pex-renderer/issues/310)
* **pbr:** use pex-shaders and parser.build ([d4ef7f0](https://github.com/pex-gl/pex-renderer/commit/d4ef7f019ddbf83931eecbacb5f046fb2a02be55)), closes [#326](https://github.com/pex-gl/pex-renderer/issues/326)
* remove transform.matrix from transport systems/components ([d5e2d72](https://github.com/pex-gl/pex-renderer/commit/d5e2d7253fff688094c6c808a244144660ba96ce)), closes [#195](https://github.com/pex-gl/pex-renderer/issues/195)
* split animation and skin systems ([400167a](https://github.com/pex-gl/pex-renderer/commit/400167a59b1b2b779e4e632e70702c3c241fbd14))


### Performance Improvements

* refactor remaining forEach loops ([2e0a9af](https://github.com/pex-gl/pex-renderer/commit/2e0a9afb326eb89fb1e10056c2f40d4e108351ab))



# [4.0.0-alpha.41](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.40...v4.0.0-alpha.41) (2023-06-15)


### Bug Fixes

* **ecs:** add all shadow maps for renderPass uses ([10aa2cb](https://github.com/pex-gl/pex-renderer/commit/10aa2cbafdf112c4b63b5394c8ce21959e4d862f))
* **ecs:** add flags before patching for webgl2 in line renderer ([108c17c](https://github.com/pex-gl/pex-renderer/commit/108c17c4de064eb3807f2446f8f6d9ecd8881ae8))
* **ecs:** add missing grid and helper components ([5281789](https://github.com/pex-gl/pex-renderer/commit/5281789fd139fafc7ed197f5a9d609d84c69ac28))
* **ecs:** check for material type instead of drawSegments in basic renderer ([7b39949](https://github.com/pex-gl/pex-renderer/commit/7b399492bcbc3e0f45112ae742cd6b3f53a0b434))
* **ecs:** handle camera update with no orbiter + handle ortho projection ([6dd016f](https://github.com/pex-gl/pex-renderer/commit/6dd016f90e36c70bfdf8d093cceb4667c82ec3e2))
* **ecs:** only parse shader for new programs ([b0acc62](https://github.com/pex-gl/pex-renderer/commit/b0acc62fd81b50fee374105e0fc4aae368e22366))
* **gltf:** orthographic camera bottom property ([d8c85d7](https://github.com/pex-gl/pex-renderer/commit/d8c85d7f81a3f9beb5e769acb0550c914330a8e1))


### Features

* add pex-shaders parser ([d861c4c](https://github.com/pex-gl/pex-renderer/commit/d861c4c120fbe159f4887d0b650099a772799247))
* **ecs:** add custom shadow map size ([90a39cb](https://github.com/pex-gl/pex-renderer/commit/90a39cb5b751e67eb8390aacff0ccb2bbcaa81c8))
* **ecs:** add shader parser to all renderers ([eca15fa](https://github.com/pex-gl/pex-renderer/commit/eca15fa6b683f93704bc060c959873f11e998627))
* **ecs:** add support for dirty flag on geometry attributes ([13ed415](https://github.com/pex-gl/pex-renderer/commit/13ed4154a4c7bf97fb00f7161f466415ae643022)), closes [#334](https://github.com/pex-gl/pex-renderer/issues/334)
* **ecs:** clean up helper renderer ([36d3860](https://github.com/pex-gl/pex-renderer/commit/36d3860bbdcd07658425f57b9b3e67581c0b54a1))
* **ecs:** clean up skybox renderer system ([36284bd](https://github.com/pex-gl/pex-renderer/commit/36284bd3997ec9e13241c20f873e60386f3fe55b))
* **ecs:** clean up standard renderer system ([3cc779d](https://github.com/pex-gl/pex-renderer/commit/3cc779dcff281a5c60e073d20c3088597c8e2702))
* **ecs:** cleanup render-pipeline pass calls ([836c4a6](https://github.com/pex-gl/pex-renderer/commit/836c4a62117c93c531789abd513f982b297123af))
* **ecs:** optimise basic renderer ([194f52a](https://github.com/pex-gl/pex-renderer/commit/194f52a7222398bfd87ef4b0ba411f7a784786f5))
* **ecs:** optimise line renderer ([fd244a1](https://github.com/pex-gl/pex-renderer/commit/fd244a1fbb7e456d0faae6ca4e619eb3ee7cc4e5))
* **ecs:** optimise update shadow map light ([024ccd9](https://github.com/pex-gl/pex-renderer/commit/024ccd9668ea8ae5393ff6c37d6ba9e912ad6155))
* **ecs:** use geometry attribtue dirty in morph ([406616b](https://github.com/pex-gl/pex-renderer/commit/406616bb1b0e69ad8f5984edc8de662654fdb933))
* **pbr:** only require texture lod when needed ([66e141a](https://github.com/pex-gl/pex-renderer/commit/66e141a8c8b40f467898228d6d510010f5a0f604))


### Performance Improvements

* **ecs:** optimise scene bbox for light ([b14e5db](https://github.com/pex-gl/pex-renderer/commit/b14e5db586f08084cc167a6d633c40303820e1f9))



# [4.0.0-alpha.40](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.39...v4.0.0-alpha.40) (2023-03-29)


### Bug Fixes

* **ecs:** check geometry.positions.length for typed arrays in line renderer ([ddda11f](https://github.com/pex-gl/pex-renderer/commit/ddda11f9a4dacf6d8dcdf1ada233ecb320262a41))



# [4.0.0-alpha.39](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.38...v4.0.0-alpha.39) (2023-03-29)


### Bug Fixes

* add missing prefix for alpha map texture coordinates transform ([a3baa01](https://github.com/pex-gl/pex-renderer/commit/a3baa0190b40103d9835d6144062c08c1e780ddb))
* allow typed arrays in line geometry ([b1f43da](https://github.com/pex-gl/pex-renderer/commit/b1f43dae1e4c15cfbf078c0dddaab818c0d7f7f0))
* **ecs:** add back default animation deltaTime ([2d3e4c7](https://github.com/pex-gl/pex-renderer/commit/2d3e4c7081c4fdaf12d068edb80320b104c6b902))



# [4.0.0-alpha.38](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.37...v4.0.0-alpha.38) (2023-02-21)


### Bug Fixes

* add all material defaults to pipeline cache hash ([5e75925](https://github.com/pex-gl/pex-renderer/commit/5e75925e6764623802c4845290aa7bc29d4dabab)), closes [#320](https://github.com/pex-gl/pex-renderer/issues/320)


### Features

* **pbr:** add multiDraw support ([8173d3c](https://github.com/pex-gl/pex-renderer/commit/8173d3c4ef9dcb0c35fdc3b29bf658d3a15d0483))



# [4.0.0-alpha.37](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.36...v4.0.0-alpha.37) (2023-02-08)


### Features

* **ecs:** change default line width to 1 ([bb910a7](https://github.com/pex-gl/pex-renderer/commit/bb910a70941056e4a56c22dc8ecd2ec330f50f35))



# [4.0.0-alpha.36](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.35...v4.0.0-alpha.36) (2023-02-07)


### Bug Fixes

* **ecs:** fix pass caching bug ([35484e5](https://github.com/pex-gl/pex-renderer/commit/35484e5e2e6471c53d5f8fae685a041c392de8b6))
* **ecs:** move camera position to transform ([a30b178](https://github.com/pex-gl/pex-renderer/commit/a30b178360d0da1772593e5018aee05e6e020440))


### Features

* **ecs:** add names to passes ([99c5f74](https://github.com/pex-gl/pex-renderer/commit/99c5f74b4a2cd3e3038ca5a931df13d7c5bb5285))



# [4.0.0-alpha.35](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.34...v4.0.0-alpha.35) (2023-02-07)



# [4.0.0-alpha.34](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.33...v4.0.0-alpha.34) (2023-02-02)


### Bug Fixes

* gltf isSafari check ([b2991c5](https://github.com/pex-gl/pex-renderer/commit/b2991c56c718d67a42bd38dbcabbaf6ea90283aa))



# [4.0.0-alpha.33](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.32...v4.0.0-alpha.33) (2023-01-12)


### Features

* **ecs:** add light components defaults ([21c7ce3](https://github.com/pex-gl/pex-renderer/commit/21c7ce325af7ec88899b4d4d3235ff88e38e0616)), closes [#333](https://github.com/pex-gl/pex-renderer/issues/333)
* **pbr:** add missing clearCoatNormalMapScale uniform ([5f7e6cf](https://github.com/pex-gl/pex-renderer/commit/5f7e6cf6f0805d8d50c44cd04b925ec6c12b329b))



# [4.0.0-alpha.32](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.31...v4.0.0-alpha.32) (2023-01-04)


### Bug Fixes

* **ecs:** add support for texture transform offset/rotation/scale ([7133270](https://github.com/pex-gl/pex-renderer/commit/7133270c00d24548438150e409f0cbaf40f2cdc0))
* **ecs:** handle multiple animations on entity ([c8797fd](https://github.com/pex-gl/pex-renderer/commit/c8797fdcd049601049296646ff0760aa6bfef986))


### Features

* **ecs:** add back area lights ([0368bf3](https://github.com/pex-gl/pex-renderer/commit/0368bf3e6201207adc58edb09ca7d0acc144ad14))
* **ecs:** add back grid + axes helper ([a806142](https://github.com/pex-gl/pex-renderer/commit/a8061420eeee23cb60a581d6f00b6e7c55f0889a))
* **ecs:** add missing clearCoatRoughnessMap ([df9526e](https://github.com/pex-gl/pex-renderer/commit/df9526ea932c95ed23caee04eaa632870a9c9e13))
* **ecs:** add morph system and component ([0e13c02](https://github.com/pex-gl/pex-renderer/commit/0e13c02925991254e102fff86ee0ad00b8c2dde9))
* **ecs:** add perspective camera helper ([180bc6e](https://github.com/pex-gl/pex-renderer/commit/180bc6ec3a99b66db3eb8c9ee8dae89259b1e28a))
* **ecs:** add support for texture texCoord ([ae90055](https://github.com/pex-gl/pex-renderer/commit/ae900550ac5a3038ea68186dcf49a17fb2d8649d))



# [4.0.0-alpha.31](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.30...v4.0.0-alpha.31) (2022-11-29)


### Features

* **components/camera:** add clearColor ([72b8e1d](https://github.com/pex-gl/pex-renderer/commit/72b8e1d1ea6b7f647422c1d6e47b5e3bd73adf24))



# [4.0.0-alpha.30](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.29...v4.0.0-alpha.30) (2022-11-21)


### Bug Fixes

* **render-graph:** catch errors in render graph ([1b5ca34](https://github.com/pex-gl/pex-renderer/commit/1b5ca34e85718804acd1323efc8b82f6bd54175a))



# [4.0.0-alpha.29](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.28...v4.0.0-alpha.29) (2022-11-17)


### Bug Fixes

* **reflection-probe:** fix reflection probes not updating ([e1971cd](https://github.com/pex-gl/pex-renderer/commit/e1971cde10bd467be0ec4b617a7bc35e5fc861d7))



# [4.0.0-alpha.28](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.27...v4.0.0-alpha.28) (2022-11-16)


### Bug Fixes

* **components/reflection-probe:** add default size ([f4d7e46](https://github.com/pex-gl/pex-renderer/commit/f4d7e46a82c9efc00bb6c35a1d805f73557ea20b))
* **ecs:** cast light.castShadows to boolean ([584f89e](https://github.com/pex-gl/pex-renderer/commit/584f89e06e191df9f7c16c9d2cfcda7172d4962f))
* **ecs:** pass entitiesInView in updateSpotLightShadowMap ([17f324d](https://github.com/pex-gl/pex-renderer/commit/17f324d0549564059d39eb568969b649927a540f))


### Features

* **render-engine:** always return array of textures per camera ([b257461](https://github.com/pex-gl/pex-renderer/commit/b257461789adb8d8b7825d5fb6a6e4b3562cc0d2))
* **render-engine:** update reflection probe per camera ([ccb33e4](https://github.com/pex-gl/pex-renderer/commit/ccb33e4bae9c8b2ece578199171c4c97b3964c8f))



# [4.0.0-alpha.27](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.26...v4.0.0-alpha.27) (2022-11-10)


### Bug Fixes

* **renderer/standard:** fix camera position uniform ([6c48f83](https://github.com/pex-gl/pex-renderer/commit/6c48f83f95779fe4081df4de904a378ff67024e3))


### Features

* **ecs:** add support for spot lights ([457179c](https://github.com/pex-gl/pex-renderer/commit/457179c734a9ed624d701a7827a525e374ee0045))
* **systems/layer:** add layer system with example ([2cba168](https://github.com/pex-gl/pex-renderer/commit/2cba168adfed0497340ce2cdce5d66f7e375eabd))



# [4.0.0-alpha.26](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.25...v4.0.0-alpha.26) (2022-11-09)


### Bug Fixes

* **pbr:** pass reflection probe size to skybox ([f50aa7b](https://github.com/pex-gl/pex-renderer/commit/f50aa7bea07c3b20c530393ee291bc65034c0173))
* remove unused reflectionProbeMapSize property ([07ed368](https://github.com/pex-gl/pex-renderer/commit/07ed36845bae101efa55dafd19cc22480ee4f4c3))
* **systems/reflection-probe:** fix octmap sizing bugs ([7bce9c7](https://github.com/pex-gl/pex-renderer/commit/7bce9c70a4328100004464e912446e109933042f))


### Features

* **ecs:** add back model matrix for skybox ([40514b8](https://github.com/pex-gl/pex-renderer/commit/40514b818eeb81f9b71657aee272a4d2ab053b98))
* **pbr:** add mapSize to reflection probe ([33bf95f](https://github.com/pex-gl/pex-renderer/commit/33bf95fe99d929a05c98e9809a76bd2d986ab0d3))
* **pbr:** handle reflection probe resize ([d202c26](https://github.com/pex-gl/pex-renderer/commit/d202c26173532af3db2f431a1c858fb8b75a8950))
* **renderer/standard:** add hook at the end of vertex shader ([cd5afdc](https://github.com/pex-gl/pex-renderer/commit/cd5afdc8e9b054572e7f73954024bc24b88b039e))



# [4.0.0-alpha.25](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.24...v4.0.0-alpha.25) (2022-11-07)


### Bug Fixes

* **systems/geometry:** fix bug in splitEvery ([a2db34a](https://github.com/pex-gl/pex-renderer/commit/a2db34a15b6ba24c8c5b6d83923363359763ccf0))


### Features

* **examples/basic-engine:** add hooks example ([f2feab0](https://github.com/pex-gl/pex-renderer/commit/f2feab0a63846880dcfd01d3b6684c8e4461bf65))
* **renderer/standard:** add hooks ([47904f2](https://github.com/pex-gl/pex-renderer/commit/47904f2b608d383e9e000d7557e53ae7b07b2798))
* **renderer/standard:** improve error reporting ([8357aa8](https://github.com/pex-gl/pex-renderer/commit/8357aa84a871e609c6233b250660a20cc10a7430))



# [4.0.0-alpha.24](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.23...v4.0.0-alpha.24) (2022-11-01)


### Features

* **components/material:** introduce material.type ([906f068](https://github.com/pex-gl/pex-renderer/commit/906f068347dbe53f0b979e8c4e8b78521d1a7b06))
* **render-engine:** add support for customizing renderer list ([45e568b](https://github.com/pex-gl/pex-renderer/commit/45e568b1ab8799eb1629c91695ca3fa83388b59c))



# [4.0.0-alpha.23](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.22...v4.0.0-alpha.23) (2022-10-26)


### Bug Fixes

* **pex-shaders:** use transformed tex coords for roughness map ([9d1e3c2](https://github.com/pex-gl/pex-renderer/commit/9d1e3c21f49a6a78127fd560ddd214c0949687a8))



# [4.0.0-alpha.22](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.21...v4.0.0-alpha.22) (2022-10-26)


### Features

* **renderer/standard:** add occlusion map support ([76576b0](https://github.com/pex-gl/pex-renderer/commit/76576b06b220dd8ee73e413841ef1d356931ebc8))



# [4.0.0-alpha.21](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.20...v4.0.0-alpha.21) (2022-10-26)


### Features

* **render-engine:** add option to specify render size ([c6f19ce](https://github.com/pex-gl/pex-renderer/commit/c6f19ceea4bad1ab1a08824b00514c9de99b2cfa))



# [4.0.0-alpha.20](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.19...v4.0.0-alpha.20) (2022-10-26)


### Bug Fixes

* **examples:** update gltf example with render engine ([3628546](https://github.com/pex-gl/pex-renderer/commit/3628546a4ec4d027c127f5b7bc23066e3c35399a))
* **renderer/standard:** add back missing dummyTextureCube for point lights + castShadows as boolean ([2cc21b6](https://github.com/pex-gl/pex-renderer/commit/2cc21b678188c5c1b1b37332c2d91f36d69243fe))
* **renderer/standard:** switch to DEPTH_COMPONENT24 for better depth buffer precision ([b1fe551](https://github.com/pex-gl/pex-renderer/commit/b1fe5514a7c579f2318e9266f4f33de3bbd2a396))


### Features

* **loaders:** fix getting light components ([36a11bd](https://github.com/pex-gl/pex-renderer/commit/36a11bd3826ea00ebfdac2b61d7379322141057b))
* **loaders:** preserve material.name ([58981fd](https://github.com/pex-gl/pex-renderer/commit/58981fd2d317ae086dcf35af9a6f0a5fd5591ace))
* **render-engine:** expose all used systems and renderers ([94d43ac](https://github.com/pex-gl/pex-renderer/commit/94d43acaaa17135eaa29dcb1b87b471d5f13c705))
* **renderer/*:** add type to all renderers ([f0b3fd9](https://github.com/pex-gl/pex-renderer/commit/f0b3fd97d853ba7b6bf36748e1d9c6fdc8c089aa))
* **renderer/standard:** add debugRender mode support ([41759af](https://github.com/pex-gl/pex-renderer/commit/41759af9e1652e7c050df58a0821acd8022c4b80))



# [4.0.0-alpha.19](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.18...v4.0.0-alpha.19) (2022-10-17)


### Features

* **renderer/line:** fix line drawing in webgl2 ([c095463](https://github.com/pex-gl/pex-renderer/commit/c0954637d67934eea344857b8618be583fdad467))



# [4.0.0-alpha.18](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.17...v4.0.0-alpha.18) (2022-10-17)


### Bug Fixes

* **examples/basic-engine:** fix lights rotation quaternion calculation ([762baac](https://github.com/pex-gl/pex-renderer/commit/762baacc876663b83849717953074459881bf9ac))
* **renderer/helper:** fix line drawing in webgl2 ([24dfd1a](https://github.com/pex-gl/pex-renderer/commit/24dfd1a6048f13da80268144e97f9435eef92a4d))


### Features

* **renderer/helper:** add point light helper drawing ([5318bba](https://github.com/pex-gl/pex-renderer/commit/5318bba79a0d1962bb694bd87ab23579b4e1090a))



# [4.0.0-alpha.17](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.16...v4.0.0-alpha.17) (2022-10-17)


### Bug Fixes

* **resource-cache:** handle special case for rendering to cubemap attachments ([7fa5f17](https://github.com/pex-gl/pex-renderer/commit/7fa5f1754be2de28d978c7eae3758330aee6886f))


### Features

* **systems/camera:** add support for orbiter distance, lon and lat ([11c2d82](https://github.com/pex-gl/pex-renderer/commit/11c2d82ff823eb8ff16ea3f0ff92cef4ba6efb91))
* **systems/camera:** attempt at syncing modified target or rotation back to orbiter ([36b67dc](https://github.com/pex-gl/pex-renderer/commit/36b67dce2cc1eb4051ecb57ae02012dfa0679916))
* **systems/camera:** sync modified target or rotation back to orbiter ([5b8b47a](https://github.com/pex-gl/pex-renderer/commit/5b8b47af4f27dff36221197b44cd9df155fd7b2c))
* **systems/camera:** sync transform position back to orbiter ([faf91b0](https://github.com/pex-gl/pex-renderer/commit/faf91b081e18d5f1b28d5a653315b84bc5c159e6))



# [4.0.0-alpha.16](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.15...v4.0.0-alpha.16) (2022-10-14)


### Features

* **systems/camera:** reimplement orbiter to use entity.transform ([5e399f6](https://github.com/pex-gl/pex-renderer/commit/5e399f67a075caedfac2137e6403de7507ea3a26))



# [4.0.0-alpha.15](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.14...v4.0.0-alpha.15) (2022-10-07)


### Bug Fixes

* **renderer/skybox:** make skybox work with webgl2 ([a8e06b3](https://github.com/pex-gl/pex-renderer/commit/a8e06b3e75fd90d7e3716cb809eb160f4a05d3fc))



# [4.0.0-alpha.14](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.13...v4.0.0-alpha.14) (2022-10-06)


### Bug Fixes

* **renderer/skybox:** change backgroundMode to renderingToReflectionProbe ([3b5e417](https://github.com/pex-gl/pex-renderer/commit/3b5e4177b49c6076efe16dfd83481c651d692597))



# [4.0.0-alpha.13](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.12...v4.0.0-alpha.13) (2022-10-03)


### Features

* **renderer/helper:** remove console log ([cef908d](https://github.com/pex-gl/pex-renderer/commit/cef908d4980c174a6a88df760215effb7dfde4dc))



# [4.0.0-alpha.12](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.11...v4.0.0-alpha.12) (2022-10-03)


### Bug Fixes

* **systems/reflection-probe:** make sure probe exists ([e336a6b](https://github.com/pex-gl/pex-renderer/commit/e336a6bfbaba90b8661b4320720cb5e27d33a6a3))



# [4.0.0-alpha.11](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.10...v4.0.0-alpha.11) (2022-10-03)


### Features

* **systems/reflection-probe:** add  backgroundBlur support ([a12e12c](https://github.com/pex-gl/pex-renderer/commit/a12e12cbe506c9bfc72811ecfef0f7cb9afe7864))



# [4.0.0-alpha.10](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.9...v4.0.0-alpha.10) (2022-09-29)


### Features

* **renderer/standard:** add support for controlling refraction amount ([490ad54](https://github.com/pex-gl/pex-renderer/commit/490ad540aef86f2f7d222e16fadbfe1cb36087cc))



# [4.0.0-alpha.9](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.8...v4.0.0-alpha.9) (2022-09-29)


### Features

* **render-pipeline:** remove console.log ([5d5a831](https://github.com/pex-gl/pex-renderer/commit/5d5a83166d911c8bf5a6d55f8d4f3b6c920a3311))



# [4.0.0-alpha.8](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.7...v4.0.0-alpha.8) (2022-09-28)


### Bug Fixes

* **renderer/standard:** move caches to local scope ([390be02](https://github.com/pex-gl/pex-renderer/commit/390be02af76294a3dbe169edbebadf52346f7f24))



# [4.0.0-alpha.7](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.6...v4.0.0-alpha.7) (2022-09-26)


### Bug Fixes

* **renderer/standard:** enable texture transform flags ([cd58d07](https://github.com/pex-gl/pex-renderer/commit/cd58d073981c9af3e2e25b4bdff349f68b596f6d))


### Features

* **examples/materials:** add texture scaling to materials example ([ba7bb0a](https://github.com/pex-gl/pex-renderer/commit/ba7bb0af275c1d62e9a3946bcfe65948951acd0d))
* **render-engine:** add option to disable drawToScreen ([cae9e29](https://github.com/pex-gl/pex-renderer/commit/cae9e292c47d2a9db090edf868a5830e9d782e90))



# [4.0.0-alpha.6](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.5...v4.0.0-alpha.6) (2022-09-26)


### Features

* **system/geometry:** disable geometry debugging by default ([31f3a92](https://github.com/pex-gl/pex-renderer/commit/31f3a92f6508ac9fce97e51d8594cc85df93d6ea))



# [4.0.0-alpha.5](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.4...v4.0.0-alpha.5) (2022-09-26)


### Bug Fixes

* **components/point-light:** add missing range prop ([923dbe3](https://github.com/pex-gl/pex-renderer/commit/923dbe37f21a035f3601cb7f45250db70531e3f5))
* **system/geometry:** remove console.log ([803ccc7](https://github.com/pex-gl/pex-renderer/commit/803ccc73a5b1e2967a6b2b6d33f2a114999ce91a))


### Features

* **renderer/standard:** add point light shadows support ([ccc8857](https://github.com/pex-gl/pex-renderer/commit/ccc88577c273bdcdb8fb3cccd04f155b562e9dd4))
* **resource-cache:** add support for texture cube ([78dd05b](https://github.com/pex-gl/pex-renderer/commit/78dd05b1dbe17338d72e07459f92b091231eea5a))
* **systems/render-pipeline:** add point light shadowmaps support ([5c8a915](https://github.com/pex-gl/pex-renderer/commit/5c8a9158add5e87a9f133c2dcc366c24250159da))



# [4.0.0-alpha.4](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.3...v4.0.0-alpha.4) (2022-09-23)


### Features

* **components/material:** default alphaTest to undefined / disabled ([a5bded2](https://github.com/pex-gl/pex-renderer/commit/a5bded23b18604e9777011d57487350bcf8066a1))
* **examples/basic-engine:** enable shadows ([a60d1d4](https://github.com/pex-gl/pex-renderer/commit/a60d1d4c2f67e4340873514c684f570ee28833cf))
* **pex-shaders:** move soft shadow to level 5 shadow quality ([168c9fc](https://github.com/pex-gl/pex-renderer/commit/168c9fce59074eb56d8f76c099ee8e87be19d3dc))
* **render-engine:** mark place for systems list ([ec17641](https://github.com/pex-gl/pex-renderer/commit/ec17641858d629183812d635af20577a149cf6fb))
* **renderer/standard:** add castShadows support ([f422cf5](https://github.com/pex-gl/pex-renderer/commit/f422cf5c8fe13bbdec4c2718dd9fc2ad206f2a47))
* **systems/render-pipeline:** pass shadowQuality to renderers ([17e6457](https://github.com/pex-gl/pex-renderer/commit/17e64573c645d5acaa4f0b39f64fa792c4fa98fb))



# [4.0.0-alpha.3](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.2...v4.0.0-alpha.3) (2022-09-22)


### Bug Fixes

* **renderer/helper:** don't use camera.viewport ([140044a](https://github.com/pex-gl/pex-renderer/commit/140044a808e2278ac91e6bce4ed208d856ea082e))


### Features

* **default-engine:** remove world reference ([4a79021](https://github.com/pex-gl/pex-renderer/commit/4a7902180ea26c1e900feb7060239ff0108aac7b))
* **examples/basic-engine:** remove hacky gltf scene scaling ([f697f54](https://github.com/pex-gl/pex-renderer/commit/f697f54854196b5f262881a8029efff2d4a76875))
* **render-engine:** rename default-engine to render-engine ([0ac4e76](https://github.com/pex-gl/pex-renderer/commit/0ac4e768545c1585979d22e8d46ebc9f3af02c53)), closes [#316](https://github.com/pex-gl/pex-renderer/issues/316)
* **renderer/helper:** enable depth writing ([4800708](https://github.com/pex-gl/pex-renderer/commit/4800708f68ed8146e3d6f8bbe02d610118374a54))



# [4.0.0-alpha.2](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.1...v4.0.0-alpha.2) (2022-09-21)


### Features

* **default-engine:** remove cyclic import ([3ecbb6c](https://github.com/pex-gl/pex-renderer/commit/3ecbb6ceb86ace1495b023d7208c16323d130c6e))



# [4.0.0-alpha.1](https://github.com/pex-gl/pex-renderer/compare/v4.0.0-alpha.0...v4.0.0-alpha.1) (2022-09-21)


### Bug Fixes

* **components/camera:** increase near to 0.5 to avoid depth buffer 16 precision errors ([de8b529](https://github.com/pex-gl/pex-renderer/commit/de8b529f7c1d32511ba526d44e4e491c71b50d19))


### Features

* **default-engine:** add default engine with example ([1ea2b03](https://github.com/pex-gl/pex-renderer/commit/1ea2b037f85eccca476d91febb2d1776db56d35c))
* **renderer/basic:** add full instancing support to basic material ([3eb0c19](https://github.com/pex-gl/pex-renderer/commit/3eb0c196d8b13ea2f5903fcd5e481df1e386703d))



# [4.0.0-alpha.0](https://github.com/pex-gl/pex-renderer/compare/v3.1.0...v4.0.0-alpha.0) (2022-09-19)


### Bug Fixes

* assign decodedPrimitive to be used with draco extension in gltf loader ([d491d2e](https://github.com/pex-gl/pex-renderer/commit/d491d2e5a55078565f1289ceb56c83ec0a4d74f1))
* clearcoat normal undefined normalView ([092912d](https://github.com/pex-gl/pex-renderer/commit/092912dbab361e49645e44385ef417c15d94bc17))
* **components/area-light:** return plain object ([1864f74](https://github.com/pex-gl/pex-renderer/commit/1864f7478cf58d186a7222e90a5495511989824c))
* **components/camera:** switch to invViewMatrix ([66ddd36](https://github.com/pex-gl/pex-renderer/commit/66ddd3670c6d9b798359767458c3163b7b6bf257))
* **components/directional-light:** re-enable shadows  ([e5abf07](https://github.com/pex-gl/pex-renderer/commit/e5abf0700c0b5083923a82ca00345b3162a4487a))
* **components/point-light:** return plain object ([174c424](https://github.com/pex-gl/pex-renderer/commit/174c424e226278ea69cd3bb1e8a6abb4b7c80c25))
* default material.castShadows to false ([d4dc81b](https://github.com/pex-gl/pex-renderer/commit/d4dc81b966b32c978ea1f51b7e9743c50750f8a7))
* **examples/basic:** fix typos to enable scene scaling ([f425a7f](https://github.com/pex-gl/pex-renderer/commit/f425a7f972c307959574a73013d129deae417172))
* **examples/brdf:** make label scale with window ([a821d09](https://github.com/pex-gl/pex-renderer/commit/a821d0903f1b4fc3bd35290740adf3276b808ca1))
* **examples/brdf:** speed up rendering by having render graph per view ([e1aa9bd](https://github.com/pex-gl/pex-renderer/commit/e1aa9bdedb69502b52bbe3bc6a4d6f182086ce86))
* **examples/brdf:** stop making hdr envmap darker ([12acb95](https://github.com/pex-gl/pex-renderer/commit/12acb95b56ea9c0972e47f9b79b32a6e752a732d))
* **examples/materials:** port materials example to latest api ([5f02c33](https://github.com/pex-gl/pex-renderer/commit/5f02c339b9ec085ed74af1ffbd572f270f9632ed))
* **examples/multi-view:** fix window resizing ([aa731e3](https://github.com/pex-gl/pex-renderer/commit/aa731e3f677e3b6e96bee5c7a65c19fa1ce6feb4))
* **examples:** update examples ([5cced07](https://github.com/pex-gl/pex-renderer/commit/5cced079d6b6330cf42656c57200d2c49e517806))
* handle positions data passed as ArrayBuffer ([4159c92](https://github.com/pex-gl/pex-renderer/commit/4159c925632b11d8355fe1f8b9bb95a03e3ed4d5))
* **loaders/glTF:** return light object with type ([3f71b78](https://github.com/pex-gl/pex-renderer/commit/3f71b78418f1bf577a8cd994fa986c459293dba1))
* orbiter pan ([f642330](https://github.com/pex-gl/pex-renderer/commit/f642330f86157dd7169843f44482a5b0b634124b)), closes [#304](https://github.com/pex-gl/pex-renderer/issues/304)
* **renderer/skybox:** inherit viewport and scissor instead of setting one ([ba97569](https://github.com/pex-gl/pex-renderer/commit/ba97569587dcd2293139aa915dde5ba3d8e1fa03))
* **renderer/standard:** declare dummy texture in case shadowmap is null ([c321912](https://github.com/pex-gl/pex-renderer/commit/c3219127767e532126d618790af95a642c597873))
* **systems/animation:** check for transform before accessing joint's model matrix ([d9e2e6b](https://github.com/pex-gl/pex-renderer/commit/d9e2e6bdf1654702a2b2517938c2dc6c29bf2a16))
* **systems/camera-system:** set default camera orbiter position ([53310e9](https://github.com/pex-gl/pex-renderer/commit/53310e933717266df896d9c4d0346a4bd944e52f))
* **systems/geometry-system:** calculate bounding box from positions on update ([1493f0f](https://github.com/pex-gl/pex-renderer/commit/1493f0fbbf3399bd69e0a9e9475bb2a8e7f23bb3))
* **systems/helper:** don't draw if there is no helpers to draw ([241b394](https://github.com/pex-gl/pex-renderer/commit/241b394df3d1f5d7262b32daafb599dee192c428))
* **systems/reflection-probe-system:** use half float for HDRI processing ([a0f9d99](https://github.com/pex-gl/pex-renderer/commit/a0f9d994c6cc5e29c7e481c65268bac890374ced))
* **systems/render-pipeline:** assign shadowmap to light before use ([66243a6](https://github.com/pex-gl/pex-renderer/commit/66243a6304321c98a512fac234885f5e6e916d48))
* **systems/render-pipeline:** fix all the multi viewport issues ([7808974](https://github.com/pex-gl/pex-renderer/commit/78089748db8f7810e68abda419fac816d44674e8))
* **systems/render-pipeline:** use only not null shadowmaps ([3011556](https://github.com/pex-gl/pex-renderer/commit/301155684fffe598fc4f7ba780c89d77ec1bfcab))
* **systems/render-system:** add better boolean flag checking ([8bbdbfc](https://github.com/pex-gl/pex-renderer/commit/8bbdbfc3ce908d1d422d3e0f5b9c30d38a550d05))
* **systems/render-system:** align renderer with directional light implementation in nodes ([4f3d649](https://github.com/pex-gl/pex-renderer/commit/4f3d64974473e01e4e2fca9f14be3b4244a5ab73))
* **systems/render-system:** fix loop unroll bug ([6f2921b](https://github.com/pex-gl/pex-renderer/commit/6f2921bc13e82c78f393fe80912cef2ef466a831))
* **systems/renderer/standard:** improve transparency draw call handling ([b3eaa4a](https://github.com/pex-gl/pex-renderer/commit/b3eaa4ad6893929d54dae30919f5bfdcea9c6530))
* **systems/renderer:** fix light direction ([5f5eb63](https://github.com/pex-gl/pex-renderer/commit/5f5eb63a05d48131624cb1041138cfe26b4cc229))
* use != in render system checks to handle undefines ([5c5d4af](https://github.com/pex-gl/pex-renderer/commit/5c5d4af4dda0df6f4eb70396a61d09e61325a3f7))


### Code Refactoring

* use ES modules ([8d450c6](https://github.com/pex-gl/pex-renderer/commit/8d450c6566a40d44b52d9a26e9afce94d5b18ce8))


### Features

* add camera, geometry and transform systems ([b919127](https://github.com/pex-gl/pex-renderer/commit/b9191273e91ff8507edc8cfe3ebe82b0da13f7df))
* add minimal renderer api ([9789b9b](https://github.com/pex-gl/pex-renderer/commit/9789b9bb20ecd396a0a4b7a185ed6b0e10988a48))
* add partial sheen support ([541cdec](https://github.com/pex-gl/pex-renderer/commit/541cdec8ca96584f22d0eaffe8121d23050e6b33))
* add skybox renderer ([c64bbd5](https://github.com/pex-gl/pex-renderer/commit/c64bbd559bdb110682fa63c1091d3e7735d4b75f))
* add support for clearCoatMap and clearCoatRoughnessMap ([a06d56c](https://github.com/pex-gl/pex-renderer/commit/a06d56cc25e953beb2484fdff22b0e6e9a3b809d))
* add support for more extensions (see commit body) + decode blobs as bitmap where possible (no safari) + check for alphaMode in cullFace + add duration for animation ([b37f93d](https://github.com/pex-gl/pex-renderer/commit/b37f93d29c0f764b166ed70cde8a623deabdc133))
* **assets:** replace CesiumMan with newer animation ([ed95f5b](https://github.com/pex-gl/pex-renderer/commit/ed95f5bdf6b1d17e42f910923b75a50233f72e74))
* **build:** rebase on latest v4 ([137ce5f](https://github.com/pex-gl/pex-renderer/commit/137ce5ff5f6e87bb6054b76db8867deba88d59da))
* **component/skin:** add proper skin component factory ([c9d8ff4](https://github.com/pex-gl/pex-renderer/commit/c9d8ff44f3d8701693915db4384da2b26e310a7f))
* **components/camera-helper:** add template ([20262b7](https://github.com/pex-gl/pex-renderer/commit/20262b776fa87672603bf24342eadab0c4ac2e95))
* **components/camera:** add support for multiple cameras with viewport  ([a0aa33e](https://github.com/pex-gl/pex-renderer/commit/a0aa33ece073ba7266c4ee382195105c92d7eed4))
* **components/light-helper:** add template ([b87d704](https://github.com/pex-gl/pex-renderer/commit/b87d70464b24841f746ebdcd10257fe6ab04095f))
* **components/material:** add default material blend and shadow values ([6650d75](https://github.com/pex-gl/pex-renderer/commit/6650d7569dbf864044903b5ea0150aa542cb7f26))
* **components/material:** add default prop values ([bcb1ad0](https://github.com/pex-gl/pex-renderer/commit/bcb1ad0b98e839eeaa44e988c38a902c02d0879c))
* **components/material:** default metallic and roughness to 1 ([53600dc](https://github.com/pex-gl/pex-renderer/commit/53600dcec8d678b257f3ca5a4554d5d37add30be))
* **components/spotLight:** add export ([b427269](https://github.com/pex-gl/pex-renderer/commit/b4272693bffc06210a20bf6ba03a609ee9a25f16))
* **deps:** switch from pex-shaderlib to pex-shaders ([fa1973b](https://github.com/pex-gl/pex-renderer/commit/fa1973b36d132ed00be68eee001c6b895fe21ef4))
* **examples/basic:** port to new renderer structure ([2b1a5ab](https://github.com/pex-gl/pex-renderer/commit/2b1a5ab64e09029ed1af6efb94cfb775b3603065))
* **examples/basic:** try loading draco buster drone ([4972355](https://github.com/pex-gl/pex-renderer/commit/497235577defcc340fc03b3712ed1427ad56af25))
* **examples/blocks:** port shadows example to ecs ([72c45f1](https://github.com/pex-gl/pex-renderer/commit/72c45f1d398eab7091d8e6409c993c84dacf185b))
* **examples/blocks:** update to newest api ([8966ef7](https://github.com/pex-gl/pex-renderer/commit/8966ef789a5233f813dedffa551aeb89f581e63e))
* **examples/brdf:** hide skybox after capturing reflection probe ([68a11da](https://github.com/pex-gl/pex-renderer/commit/68a11daaea59f97539966275cde6118515b87ef7))
* **examples/brdf:** port example to new ecs ([5d6ad83](https://github.com/pex-gl/pex-renderer/commit/5d6ad830777d6974d5857cea7fcd0ba661ce5d12))
* **examples/brdf:** port to ecs ([082e4f2](https://github.com/pex-gl/pex-renderer/commit/082e4f2ffb33ff34ca046bf86725a5762df95360))
* **examples/gltf:** add utils for gltf debugging ([d2b58a9](https://github.com/pex-gl/pex-renderer/commit/d2b58a9262041e23edbc9c480ce4d1f4f1700e4e))
* **examples/gltf:** make scene scaling work ([e3df80e](https://github.com/pex-gl/pex-renderer/commit/e3df80eba1d80cd483a96edab0620300314a4c34))
* **examples/gltf:** port to ECS ([4c47544](https://github.com/pex-gl/pex-renderer/commit/4c47544304e0d88f7d48ca7f806a46e3b35424f9))
* **examples/gltf:** split gui into two columns ([6c0b479](https://github.com/pex-gl/pex-renderer/commit/6c0b4798ff6ae6743fb15a8778ef14248689f9cd))
* **examples/gltf:** switch to online gltf samples ([ce113ae](https://github.com/pex-gl/pex-renderer/commit/ce113ae91b11606b0ffd851ab6f26d2758c939f1))
* **examples/helpers:** port to new API ([6a5bdc1](https://github.com/pex-gl/pex-renderer/commit/6a5bdc1ec2a3f759e39c669131615017b829ffb2))
* **examples/materials:** port materials example to ecs ([6b524af](https://github.com/pex-gl/pex-renderer/commit/6b524af4e5ffee80ddab2401561430ce3ca15016))
* **examples/materials:** replace null material with default material ([b0c891b](https://github.com/pex-gl/pex-renderer/commit/b0c891b44136493580e86f94b5ae5f1f79ef5af7))
* **examples/multi-view:** add draw call and pass logging ([dd19277](https://github.com/pex-gl/pex-renderer/commit/dd1927713e235296f4f4f33346355fd76c751488))
* implement reflection probes ([80b915d](https://github.com/pex-gl/pex-renderer/commit/80b915df47582b978eb0375593a8ccac985972f3))
* **index:** add dummy sking component ([d502e05](https://github.com/pex-gl/pex-renderer/commit/d502e05264fbee5beaae194d744892af9db5812c))
* **index:** export systems namespace ([9cb44b8](https://github.com/pex-gl/pex-renderer/commit/9cb44b86bf57674dfe9808b8a6bd67d361c29c22))
* **index:** pass options to loadScene ([424ee61](https://github.com/pex-gl/pex-renderer/commit/424ee619b3d328e7168e1d38fb34da012f262f08))
* **index:** warn if no systems were added ([888289b](https://github.com/pex-gl/pex-renderer/commit/888289bf9570283d129f8a7e215dbeab879438f2))
* move components to separate folder ([093d9a8](https://github.com/pex-gl/pex-renderer/commit/093d9a8f0831963b90bb7c066893dd233d0c2481))
* move skybox rendering and update to systems ([43233bd](https://github.com/pex-gl/pex-renderer/commit/43233bd22850634f0a3ef3c8f8095d62c5bbc31f))
* port gltf loader ([98c7915](https://github.com/pex-gl/pex-renderer/commit/98c79158143b9fb5996a1c4e337e7704de2d6067))
* **render-pipeline:** implement grab pass ([c3e1ee8](https://github.com/pex-gl/pex-renderer/commit/c3e1ee8f3c13866d31677ee3f4e45c9f6b71345a))
* render-system - implement basic flags ([c1ef4a3](https://github.com/pex-gl/pex-renderer/commit/c1ef4a3b69dbb25dfa71da3506f7d65ed6e5991c))
* render-system add skybox rendering ([ac1b3bb](https://github.com/pex-gl/pex-renderer/commit/ac1b3bb076d5825d6c197aa8b4115de07acf904f))
* **resource-cache:** expose cache array ([c6ccb1d](https://github.com/pex-gl/pex-renderer/commit/c6ccb1d0f91de708ee7b5fcc561144a94d5a2913))
* **system/reflection-probe-system:** add another dirty check ([052de3f](https://github.com/pex-gl/pex-renderer/commit/052de3f1ced23fdf1207ced31adf9254cfb95fcc))
* **system/render-system:** add support for clearCoat ([4164246](https://github.com/pex-gl/pex-renderer/commit/41642462a0da4da26478a1979b48243820290786))
* **system/render-system:** switch to automatic uniform setting ([2a873e5](https://github.com/pex-gl/pex-renderer/commit/2a873e5353fae37b6cf429b96bd7d5ae85a1d012))
* **system/skybox-system:** don’t write depth ([7a8091f](https://github.com/pex-gl/pex-renderer/commit/7a8091f1b0544a0493af8dcae15223934e4b6e13))
* **systems/animation-system:** add animation system ([fd08b87](https://github.com/pex-gl/pex-renderer/commit/fd08b8793a2a8dfa781982b7111cf6c9271689bc))
* **systems/animation-system:** add skinning support ([d69e376](https://github.com/pex-gl/pex-renderer/commit/d69e376c8dbc3265fbcd1f4d7731b70c86709aec))
* **systems/camera-system:** defaul maxDistance to camera.far ([a3030d5](https://github.com/pex-gl/pex-renderer/commit/a3030d5540020ce1e70b7bf0b91b93a6eac918d5))
* **systems/camera-system:** use orbiter position if provided ([e3a1967](https://github.com/pex-gl/pex-renderer/commit/e3a1967e7aab3df75a21ecaae5975973a82e5a4d))
* **systems/camera:** recalculate projectionMatrix on dirty ([d7d1fde](https://github.com/pex-gl/pex-renderer/commit/d7d1fdeb3f429694a110b55f2439ee5a040ff358))
* **systems/camera:** start implementing panning ([edffb08](https://github.com/pex-gl/pex-renderer/commit/edffb086d52971b7e66749b0a875942fdbb503c5))
* **systems/helper:** add helper system ([aa89c6c](https://github.com/pex-gl/pex-renderer/commit/aa89c6c56b5f3dae9ad2d07adc4b877f59702f78))
* **systems/helper:** implement directional light helper and bounding box helper color ([cd8f39a](https://github.com/pex-gl/pex-renderer/commit/cd8f39af83cb026ee40afd0218854f5c2b0c652a))
* **systems/render-pipeline:** add helpers renderer support ([6643c93](https://github.com/pex-gl/pex-renderer/commit/6643c932957c9505b0f2e6fe26b8bbb024e1f0f8))
* **systems/render-pipeline:** add shadowmapping ([db97944](https://github.com/pex-gl/pex-renderer/commit/db979447f7a22a9a6a0f1be7136fa6ea8ed88c99))
* **systems/render-pipeline:** implement customisable renderers with renderStages ([54f8ec1](https://github.com/pex-gl/pex-renderer/commit/54f8ec17e9094a7a23b6bab6138554cb93dfc51b))
* **systems/render-pipeline:** move pbr shader from renderPipeline to standard shader system ([33f9fcd](https://github.com/pex-gl/pex-renderer/commit/33f9fcd0adc1fff5c0308da85c91417752d803e2))
* **systems/render-pipeline:** split rendering into opaque and transparent passes ([b094ab0](https://github.com/pex-gl/pex-renderer/commit/b094ab0c1b802978450ea9c97e340706a7176f32))
* **systems/render-system:** add automatic gathering of materialUniforms ([1e66203](https://github.com/pex-gl/pex-renderer/commit/1e66203fac7003328423d825762f39427d534d87))
* **systems/render-system:** add clearcoat textures support ([81d8e99](https://github.com/pex-gl/pex-renderer/commit/81d8e99616d2f6c4cd65a1231f3b578d761db86e))
* **systems/render-system:** add emissiveColor support ([cb0a19c](https://github.com/pex-gl/pex-renderer/commit/cb0a19c0a92bb2d212a8c804407f724ca2fef363))
* **systems/render-system:** add reflectance support ([472f8d8](https://github.com/pex-gl/pex-renderer/commit/472f8d84870d2172ef032e4a4115578c4a45d21d))
* **systems/render-system:** add shadowmapping ([061c436](https://github.com/pex-gl/pex-renderer/commit/061c4360c054badb76d8bb5a6800d1e43b98fdcb))
* **systems/render-system:** add support for various material maps ([b8349e4](https://github.com/pex-gl/pex-renderer/commit/b8349e4c72ea5dde11ca011c8b61f6e8131e872a))
* **systems/render-system:** add transparent geometry render pass ([87ba202](https://github.com/pex-gl/pex-renderer/commit/87ba202ea949c74da25c7cb94e1f0c73f9232cd6))
* **systems/render-system:** compute light view matrix ([2d69dd5](https://github.com/pex-gl/pex-renderer/commit/2d69dd5f01a86053939643208175698fbf883ead))
* **systems/render-system:** enable more extensions  ([12070f0](https://github.com/pex-gl/pex-renderer/commit/12070f076253975562310c7e870d94b87227025b))
* **systems/render-system:** enable pbr as fallback to unlit mode ([d20a8f6](https://github.com/pex-gl/pex-renderer/commit/d20a8f603b4efdc282852e1a77a849080cc0ba57))
* **systems/render-system:** enable sheen ([0eee468](https://github.com/pex-gl/pex-renderer/commit/0eee468defe2e3a911dc4986aff3e5cbdd8387ac))
* **systems/render-system:** enable tone mapping ([79d6b11](https://github.com/pex-gl/pex-renderer/commit/79d6b11978a1ff0719bc0c68b75772ce67bedb34))
* **systems/render-system:** fallback to unlit if geom has no normals  ([e0fdad6](https://github.com/pex-gl/pex-renderer/commit/e0fdad6014aec818a05e1383ce1f9832769e9f67))
* **systems/render-system:** switch to new glsl patcher ([56955db](https://github.com/pex-gl/pex-renderer/commit/56955db46199d42bfa87cd489f4d4c1d2efd8a12))
* **systems/renderer/standard:** add basic transmission ([1fbf990](https://github.com/pex-gl/pex-renderer/commit/1fbf990a53a462f84f795ee1a50c73d1f5ce04c7))
* **systems/renderer/standard:** add soft shadows ([538a7f1](https://github.com/pex-gl/pex-renderer/commit/538a7f1c61a6f77607d231abc691876e86b0d94c))
* **systems/renderer/standard:** temp add pex-shaders locally ([f5ef4f6](https://github.com/pex-gl/pex-renderer/commit/f5ef4f6a74f2eab28710f6309a2c946cb11c7437))
* **systems/renderer:** add outputEncoding support ([a01c271](https://github.com/pex-gl/pex-renderer/commit/a01c271047ac99ac54075cb2607bea8238f92773))
* **systems/renderer:** add render graph with basic passes ([0cae193](https://github.com/pex-gl/pex-renderer/commit/0cae193da10753faf06d05bef74936dbf3995377))
* **systems/renderer:** change default exposure back to 1 ([2c2dfd5](https://github.com/pex-gl/pex-renderer/commit/2c2dfd5e594b4e9cbdc1e08d22bc3de31e9cc971))
* **systems/renderer:** rename render to renderer ([f198ab3](https://github.com/pex-gl/pex-renderer/commit/f198ab31f644bb64d3296748949c001f6b8382da))
* **systems/skybox-system:** add default values ([43f6399](https://github.com/pex-gl/pex-renderer/commit/43f639924fc720f1e27dd0406a33539568159eb2))
* use pex-shaderlib ([822989b](https://github.com/pex-gl/pex-renderer/commit/822989bed92d2785e1496d760020b0d678ba5c54))
* **world:** compute deltaTime if not provided ([8007fca](https://github.com/pex-gl/pex-renderer/commit/8007fca8e93e6e7286c1f30034b0096397de90b6))


### BREAKING CHANGES

* switch to type module



# [3.2.0-alpha.0](https://github.com/pex-gl/pex-renderer/compare/v3.1.0...v3.2.0-alpha.0) (2022-09-19)


### Bug Fixes

* assign decodedPrimitive to be used with draco extension in gltf loader ([d491d2e](https://github.com/pex-gl/pex-renderer/commit/d491d2e5a55078565f1289ceb56c83ec0a4d74f1))
* clearcoat normal undefined normalView ([092912d](https://github.com/pex-gl/pex-renderer/commit/092912dbab361e49645e44385ef417c15d94bc17))
* **components/area-light:** return plain object ([1864f74](https://github.com/pex-gl/pex-renderer/commit/1864f7478cf58d186a7222e90a5495511989824c))
* **components/camera:** switch to invViewMatrix ([66ddd36](https://github.com/pex-gl/pex-renderer/commit/66ddd3670c6d9b798359767458c3163b7b6bf257))
* **components/directional-light:** re-enable shadows  ([e5abf07](https://github.com/pex-gl/pex-renderer/commit/e5abf0700c0b5083923a82ca00345b3162a4487a))
* **components/point-light:** return plain object ([174c424](https://github.com/pex-gl/pex-renderer/commit/174c424e226278ea69cd3bb1e8a6abb4b7c80c25))
* default material.castShadows to false ([d4dc81b](https://github.com/pex-gl/pex-renderer/commit/d4dc81b966b32c978ea1f51b7e9743c50750f8a7))
* **examples/basic:** fix typos to enable scene scaling ([f425a7f](https://github.com/pex-gl/pex-renderer/commit/f425a7f972c307959574a73013d129deae417172))
* **examples/brdf:** make label scale with window ([a821d09](https://github.com/pex-gl/pex-renderer/commit/a821d0903f1b4fc3bd35290740adf3276b808ca1))
* **examples/brdf:** speed up rendering by having render graph per view ([e1aa9bd](https://github.com/pex-gl/pex-renderer/commit/e1aa9bdedb69502b52bbe3bc6a4d6f182086ce86))
* **examples/brdf:** stop making hdr envmap darker ([12acb95](https://github.com/pex-gl/pex-renderer/commit/12acb95b56ea9c0972e47f9b79b32a6e752a732d))
* **examples/materials:** port materials example to latest api ([5f02c33](https://github.com/pex-gl/pex-renderer/commit/5f02c339b9ec085ed74af1ffbd572f270f9632ed))
* **examples/multi-view:** fix window resizing ([aa731e3](https://github.com/pex-gl/pex-renderer/commit/aa731e3f677e3b6e96bee5c7a65c19fa1ce6feb4))
* **examples:** update examples ([5cced07](https://github.com/pex-gl/pex-renderer/commit/5cced079d6b6330cf42656c57200d2c49e517806))
* handle positions data passed as ArrayBuffer ([4159c92](https://github.com/pex-gl/pex-renderer/commit/4159c925632b11d8355fe1f8b9bb95a03e3ed4d5))
* **loaders/glTF:** return light object with type ([3f71b78](https://github.com/pex-gl/pex-renderer/commit/3f71b78418f1bf577a8cd994fa986c459293dba1))
* orbiter pan ([f642330](https://github.com/pex-gl/pex-renderer/commit/f642330f86157dd7169843f44482a5b0b634124b)), closes [#304](https://github.com/pex-gl/pex-renderer/issues/304)
* **renderer/skybox:** inherit viewport and scissor instead of setting one ([ba97569](https://github.com/pex-gl/pex-renderer/commit/ba97569587dcd2293139aa915dde5ba3d8e1fa03))
* **renderer/standard:** declare dummy texture in case shadowmap is null ([c321912](https://github.com/pex-gl/pex-renderer/commit/c3219127767e532126d618790af95a642c597873))
* **systems/animation:** check for transform before accessing joint's model matrix ([d9e2e6b](https://github.com/pex-gl/pex-renderer/commit/d9e2e6bdf1654702a2b2517938c2dc6c29bf2a16))
* **systems/camera-system:** set default camera orbiter position ([53310e9](https://github.com/pex-gl/pex-renderer/commit/53310e933717266df896d9c4d0346a4bd944e52f))
* **systems/geometry-system:** calculate bounding box from positions on update ([1493f0f](https://github.com/pex-gl/pex-renderer/commit/1493f0fbbf3399bd69e0a9e9475bb2a8e7f23bb3))
* **systems/helper:** don't draw if there is no helpers to draw ([241b394](https://github.com/pex-gl/pex-renderer/commit/241b394df3d1f5d7262b32daafb599dee192c428))
* **systems/reflection-probe-system:** use half float for HDRI processing ([a0f9d99](https://github.com/pex-gl/pex-renderer/commit/a0f9d994c6cc5e29c7e481c65268bac890374ced))
* **systems/render-pipeline:** assign shadowmap to light before use ([66243a6](https://github.com/pex-gl/pex-renderer/commit/66243a6304321c98a512fac234885f5e6e916d48))
* **systems/render-pipeline:** fix all the multi viewport issues ([7808974](https://github.com/pex-gl/pex-renderer/commit/78089748db8f7810e68abda419fac816d44674e8))
* **systems/render-pipeline:** use only not null shadowmaps ([3011556](https://github.com/pex-gl/pex-renderer/commit/301155684fffe598fc4f7ba780c89d77ec1bfcab))
* **systems/render-system:** add better boolean flag checking ([8bbdbfc](https://github.com/pex-gl/pex-renderer/commit/8bbdbfc3ce908d1d422d3e0f5b9c30d38a550d05))
* **systems/render-system:** align renderer with directional light implementation in nodes ([4f3d649](https://github.com/pex-gl/pex-renderer/commit/4f3d64974473e01e4e2fca9f14be3b4244a5ab73))
* **systems/render-system:** fix loop unroll bug ([6f2921b](https://github.com/pex-gl/pex-renderer/commit/6f2921bc13e82c78f393fe80912cef2ef466a831))
* **systems/renderer/standard:** improve transparency draw call handling ([b3eaa4a](https://github.com/pex-gl/pex-renderer/commit/b3eaa4ad6893929d54dae30919f5bfdcea9c6530))
* **systems/renderer:** fix light direction ([5f5eb63](https://github.com/pex-gl/pex-renderer/commit/5f5eb63a05d48131624cb1041138cfe26b4cc229))
* use != in render system checks to handle undefines ([5c5d4af](https://github.com/pex-gl/pex-renderer/commit/5c5d4af4dda0df6f4eb70396a61d09e61325a3f7))


### Code Refactoring

* use ES modules ([8d450c6](https://github.com/pex-gl/pex-renderer/commit/8d450c6566a40d44b52d9a26e9afce94d5b18ce8))


### Features

* add camera, geometry and transform systems ([b919127](https://github.com/pex-gl/pex-renderer/commit/b9191273e91ff8507edc8cfe3ebe82b0da13f7df))
* add minimal renderer api ([9789b9b](https://github.com/pex-gl/pex-renderer/commit/9789b9bb20ecd396a0a4b7a185ed6b0e10988a48))
* add partial sheen support ([541cdec](https://github.com/pex-gl/pex-renderer/commit/541cdec8ca96584f22d0eaffe8121d23050e6b33))
* add skybox renderer ([c64bbd5](https://github.com/pex-gl/pex-renderer/commit/c64bbd559bdb110682fa63c1091d3e7735d4b75f))
* add support for clearCoatMap and clearCoatRoughnessMap ([a06d56c](https://github.com/pex-gl/pex-renderer/commit/a06d56cc25e953beb2484fdff22b0e6e9a3b809d))
* add support for more extensions (see commit body) + decode blobs as bitmap where possible (no safari) + check for alphaMode in cullFace + add duration for animation ([b37f93d](https://github.com/pex-gl/pex-renderer/commit/b37f93d29c0f764b166ed70cde8a623deabdc133))
* **assets:** replace CesiumMan with newer animation ([ed95f5b](https://github.com/pex-gl/pex-renderer/commit/ed95f5bdf6b1d17e42f910923b75a50233f72e74))
* **build:** rebase on latest v4 ([137ce5f](https://github.com/pex-gl/pex-renderer/commit/137ce5ff5f6e87bb6054b76db8867deba88d59da))
* **component/skin:** add proper skin component factory ([c9d8ff4](https://github.com/pex-gl/pex-renderer/commit/c9d8ff44f3d8701693915db4384da2b26e310a7f))
* **components/camera-helper:** add template ([20262b7](https://github.com/pex-gl/pex-renderer/commit/20262b776fa87672603bf24342eadab0c4ac2e95))
* **components/camera:** add support for multiple cameras with viewport  ([a0aa33e](https://github.com/pex-gl/pex-renderer/commit/a0aa33ece073ba7266c4ee382195105c92d7eed4))
* **components/light-helper:** add template ([b87d704](https://github.com/pex-gl/pex-renderer/commit/b87d70464b24841f746ebdcd10257fe6ab04095f))
* **components/material:** add default material blend and shadow values ([6650d75](https://github.com/pex-gl/pex-renderer/commit/6650d7569dbf864044903b5ea0150aa542cb7f26))
* **components/material:** add default prop values ([bcb1ad0](https://github.com/pex-gl/pex-renderer/commit/bcb1ad0b98e839eeaa44e988c38a902c02d0879c))
* **components/material:** default metallic and roughness to 1 ([53600dc](https://github.com/pex-gl/pex-renderer/commit/53600dcec8d678b257f3ca5a4554d5d37add30be))
* **components/spotLight:** add export ([b427269](https://github.com/pex-gl/pex-renderer/commit/b4272693bffc06210a20bf6ba03a609ee9a25f16))
* **deps:** switch from pex-shaderlib to pex-shaders ([fa1973b](https://github.com/pex-gl/pex-renderer/commit/fa1973b36d132ed00be68eee001c6b895fe21ef4))
* **examples/basic:** port to new renderer structure ([2b1a5ab](https://github.com/pex-gl/pex-renderer/commit/2b1a5ab64e09029ed1af6efb94cfb775b3603065))
* **examples/basic:** try loading draco buster drone ([4972355](https://github.com/pex-gl/pex-renderer/commit/497235577defcc340fc03b3712ed1427ad56af25))
* **examples/blocks:** port shadows example to ecs ([72c45f1](https://github.com/pex-gl/pex-renderer/commit/72c45f1d398eab7091d8e6409c993c84dacf185b))
* **examples/blocks:** update to newest api ([8966ef7](https://github.com/pex-gl/pex-renderer/commit/8966ef789a5233f813dedffa551aeb89f581e63e))
* **examples/brdf:** hide skybox after capturing reflection probe ([68a11da](https://github.com/pex-gl/pex-renderer/commit/68a11daaea59f97539966275cde6118515b87ef7))
* **examples/brdf:** port example to new ecs ([5d6ad83](https://github.com/pex-gl/pex-renderer/commit/5d6ad830777d6974d5857cea7fcd0ba661ce5d12))
* **examples/brdf:** port to ecs ([082e4f2](https://github.com/pex-gl/pex-renderer/commit/082e4f2ffb33ff34ca046bf86725a5762df95360))
* **examples/gltf:** add utils for gltf debugging ([d2b58a9](https://github.com/pex-gl/pex-renderer/commit/d2b58a9262041e23edbc9c480ce4d1f4f1700e4e))
* **examples/gltf:** make scene scaling work ([e3df80e](https://github.com/pex-gl/pex-renderer/commit/e3df80eba1d80cd483a96edab0620300314a4c34))
* **examples/gltf:** port to ECS ([4c47544](https://github.com/pex-gl/pex-renderer/commit/4c47544304e0d88f7d48ca7f806a46e3b35424f9))
* **examples/gltf:** split gui into two columns ([6c0b479](https://github.com/pex-gl/pex-renderer/commit/6c0b4798ff6ae6743fb15a8778ef14248689f9cd))
* **examples/gltf:** switch to online gltf samples ([ce113ae](https://github.com/pex-gl/pex-renderer/commit/ce113ae91b11606b0ffd851ab6f26d2758c939f1))
* **examples/helpers:** port to new API ([6a5bdc1](https://github.com/pex-gl/pex-renderer/commit/6a5bdc1ec2a3f759e39c669131615017b829ffb2))
* **examples/materials:** port materials example to ecs ([6b524af](https://github.com/pex-gl/pex-renderer/commit/6b524af4e5ffee80ddab2401561430ce3ca15016))
* **examples/materials:** replace null material with default material ([b0c891b](https://github.com/pex-gl/pex-renderer/commit/b0c891b44136493580e86f94b5ae5f1f79ef5af7))
* **examples/multi-view:** add draw call and pass logging ([dd19277](https://github.com/pex-gl/pex-renderer/commit/dd1927713e235296f4f4f33346355fd76c751488))
* implement reflection probes ([80b915d](https://github.com/pex-gl/pex-renderer/commit/80b915df47582b978eb0375593a8ccac985972f3))
* **index:** add dummy sking component ([d502e05](https://github.com/pex-gl/pex-renderer/commit/d502e05264fbee5beaae194d744892af9db5812c))
* **index:** export systems namespace ([9cb44b8](https://github.com/pex-gl/pex-renderer/commit/9cb44b86bf57674dfe9808b8a6bd67d361c29c22))
* **index:** pass options to loadScene ([424ee61](https://github.com/pex-gl/pex-renderer/commit/424ee619b3d328e7168e1d38fb34da012f262f08))
* **index:** warn if no systems were added ([888289b](https://github.com/pex-gl/pex-renderer/commit/888289bf9570283d129f8a7e215dbeab879438f2))
* move components to separate folder ([093d9a8](https://github.com/pex-gl/pex-renderer/commit/093d9a8f0831963b90bb7c066893dd233d0c2481))
* move skybox rendering and update to systems ([43233bd](https://github.com/pex-gl/pex-renderer/commit/43233bd22850634f0a3ef3c8f8095d62c5bbc31f))
* port gltf loader ([98c7915](https://github.com/pex-gl/pex-renderer/commit/98c79158143b9fb5996a1c4e337e7704de2d6067))
* **render-pipeline:** implement grab pass ([c3e1ee8](https://github.com/pex-gl/pex-renderer/commit/c3e1ee8f3c13866d31677ee3f4e45c9f6b71345a))
* render-system - implement basic flags ([c1ef4a3](https://github.com/pex-gl/pex-renderer/commit/c1ef4a3b69dbb25dfa71da3506f7d65ed6e5991c))
* render-system add skybox rendering ([ac1b3bb](https://github.com/pex-gl/pex-renderer/commit/ac1b3bb076d5825d6c197aa8b4115de07acf904f))
* **resource-cache:** expose cache array ([c6ccb1d](https://github.com/pex-gl/pex-renderer/commit/c6ccb1d0f91de708ee7b5fcc561144a94d5a2913))
* **system/reflection-probe-system:** add another dirty check ([052de3f](https://github.com/pex-gl/pex-renderer/commit/052de3f1ced23fdf1207ced31adf9254cfb95fcc))
* **system/render-system:** add support for clearCoat ([4164246](https://github.com/pex-gl/pex-renderer/commit/41642462a0da4da26478a1979b48243820290786))
* **system/render-system:** switch to automatic uniform setting ([2a873e5](https://github.com/pex-gl/pex-renderer/commit/2a873e5353fae37b6cf429b96bd7d5ae85a1d012))
* **system/skybox-system:** don’t write depth ([7a8091f](https://github.com/pex-gl/pex-renderer/commit/7a8091f1b0544a0493af8dcae15223934e4b6e13))
* **systems/animation-system:** add animation system ([fd08b87](https://github.com/pex-gl/pex-renderer/commit/fd08b8793a2a8dfa781982b7111cf6c9271689bc))
* **systems/animation-system:** add skinning support ([d69e376](https://github.com/pex-gl/pex-renderer/commit/d69e376c8dbc3265fbcd1f4d7731b70c86709aec))
* **systems/camera-system:** defaul maxDistance to camera.far ([a3030d5](https://github.com/pex-gl/pex-renderer/commit/a3030d5540020ce1e70b7bf0b91b93a6eac918d5))
* **systems/camera-system:** use orbiter position if provided ([e3a1967](https://github.com/pex-gl/pex-renderer/commit/e3a1967e7aab3df75a21ecaae5975973a82e5a4d))
* **systems/camera:** recalculate projectionMatrix on dirty ([d7d1fde](https://github.com/pex-gl/pex-renderer/commit/d7d1fdeb3f429694a110b55f2439ee5a040ff358))
* **systems/camera:** start implementing panning ([edffb08](https://github.com/pex-gl/pex-renderer/commit/edffb086d52971b7e66749b0a875942fdbb503c5))
* **systems/helper:** add helper system ([aa89c6c](https://github.com/pex-gl/pex-renderer/commit/aa89c6c56b5f3dae9ad2d07adc4b877f59702f78))
* **systems/helper:** implement directional light helper and bounding box helper color ([cd8f39a](https://github.com/pex-gl/pex-renderer/commit/cd8f39af83cb026ee40afd0218854f5c2b0c652a))
* **systems/render-pipeline:** add helpers renderer support ([6643c93](https://github.com/pex-gl/pex-renderer/commit/6643c932957c9505b0f2e6fe26b8bbb024e1f0f8))
* **systems/render-pipeline:** add shadowmapping ([db97944](https://github.com/pex-gl/pex-renderer/commit/db979447f7a22a9a6a0f1be7136fa6ea8ed88c99))
* **systems/render-pipeline:** implement customisable renderers with renderStages ([54f8ec1](https://github.com/pex-gl/pex-renderer/commit/54f8ec17e9094a7a23b6bab6138554cb93dfc51b))
* **systems/render-pipeline:** move pbr shader from renderPipeline to standard shader system ([33f9fcd](https://github.com/pex-gl/pex-renderer/commit/33f9fcd0adc1fff5c0308da85c91417752d803e2))
* **systems/render-pipeline:** split rendering into opaque and transparent passes ([b094ab0](https://github.com/pex-gl/pex-renderer/commit/b094ab0c1b802978450ea9c97e340706a7176f32))
* **systems/render-system:** add automatic gathering of materialUniforms ([1e66203](https://github.com/pex-gl/pex-renderer/commit/1e66203fac7003328423d825762f39427d534d87))
* **systems/render-system:** add clearcoat textures support ([81d8e99](https://github.com/pex-gl/pex-renderer/commit/81d8e99616d2f6c4cd65a1231f3b578d761db86e))
* **systems/render-system:** add emissiveColor support ([cb0a19c](https://github.com/pex-gl/pex-renderer/commit/cb0a19c0a92bb2d212a8c804407f724ca2fef363))
* **systems/render-system:** add reflectance support ([472f8d8](https://github.com/pex-gl/pex-renderer/commit/472f8d84870d2172ef032e4a4115578c4a45d21d))
* **systems/render-system:** add shadowmapping ([061c436](https://github.com/pex-gl/pex-renderer/commit/061c4360c054badb76d8bb5a6800d1e43b98fdcb))
* **systems/render-system:** add support for various material maps ([b8349e4](https://github.com/pex-gl/pex-renderer/commit/b8349e4c72ea5dde11ca011c8b61f6e8131e872a))
* **systems/render-system:** add transparent geometry render pass ([87ba202](https://github.com/pex-gl/pex-renderer/commit/87ba202ea949c74da25c7cb94e1f0c73f9232cd6))
* **systems/render-system:** compute light view matrix ([2d69dd5](https://github.com/pex-gl/pex-renderer/commit/2d69dd5f01a86053939643208175698fbf883ead))
* **systems/render-system:** enable more extensions  ([12070f0](https://github.com/pex-gl/pex-renderer/commit/12070f076253975562310c7e870d94b87227025b))
* **systems/render-system:** enable pbr as fallback to unlit mode ([d20a8f6](https://github.com/pex-gl/pex-renderer/commit/d20a8f603b4efdc282852e1a77a849080cc0ba57))
* **systems/render-system:** enable sheen ([0eee468](https://github.com/pex-gl/pex-renderer/commit/0eee468defe2e3a911dc4986aff3e5cbdd8387ac))
* **systems/render-system:** enable tone mapping ([79d6b11](https://github.com/pex-gl/pex-renderer/commit/79d6b11978a1ff0719bc0c68b75772ce67bedb34))
* **systems/render-system:** fallback to unlit if geom has no normals  ([e0fdad6](https://github.com/pex-gl/pex-renderer/commit/e0fdad6014aec818a05e1383ce1f9832769e9f67))
* **systems/render-system:** switch to new glsl patcher ([56955db](https://github.com/pex-gl/pex-renderer/commit/56955db46199d42bfa87cd489f4d4c1d2efd8a12))
* **systems/renderer/standard:** add basic transmission ([1fbf990](https://github.com/pex-gl/pex-renderer/commit/1fbf990a53a462f84f795ee1a50c73d1f5ce04c7))
* **systems/renderer/standard:** add soft shadows ([538a7f1](https://github.com/pex-gl/pex-renderer/commit/538a7f1c61a6f77607d231abc691876e86b0d94c))
* **systems/renderer/standard:** temp add pex-shaders locally ([f5ef4f6](https://github.com/pex-gl/pex-renderer/commit/f5ef4f6a74f2eab28710f6309a2c946cb11c7437))
* **systems/renderer:** add outputEncoding support ([a01c271](https://github.com/pex-gl/pex-renderer/commit/a01c271047ac99ac54075cb2607bea8238f92773))
* **systems/renderer:** add render graph with basic passes ([0cae193](https://github.com/pex-gl/pex-renderer/commit/0cae193da10753faf06d05bef74936dbf3995377))
* **systems/renderer:** change default exposure back to 1 ([2c2dfd5](https://github.com/pex-gl/pex-renderer/commit/2c2dfd5e594b4e9cbdc1e08d22bc3de31e9cc971))
* **systems/renderer:** rename render to renderer ([f198ab3](https://github.com/pex-gl/pex-renderer/commit/f198ab31f644bb64d3296748949c001f6b8382da))
* **systems/skybox-system:** add default values ([43f6399](https://github.com/pex-gl/pex-renderer/commit/43f639924fc720f1e27dd0406a33539568159eb2))
* use pex-shaderlib ([822989b](https://github.com/pex-gl/pex-renderer/commit/822989bed92d2785e1496d760020b0d678ba5c54))
* **world:** compute deltaTime if not provided ([8007fca](https://github.com/pex-gl/pex-renderer/commit/8007fca8e93e6e7286c1f30034b0096397de90b6))


### BREAKING CHANGES

* switch to type module



# Major changes from pex-renderer@2 to pex-renderer@3

- Moved to ECS with proper systems for everything
- Removed tags in favour of layers
