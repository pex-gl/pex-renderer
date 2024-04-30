import { mat3, mat2x3 } from "pex-math";
import { pipeline as SHADERS, parser as ShaderParser } from "pex-shaders";

import { NAMESPACE, TEMP_MAT2X3 } from "../../utils.js";

import ProgramCache from "../../program-cache.js";

/**
 * Base renderer
 *
 * All renderers are composed with it.
 * @returns {import("../../types.js").RendererSystem}
 * @alias module:renderer.base
 */
export default () => ({
  cache: {
    // Cache based on: vertex source (material.vert or default), fragment source (material.frag or default), list of flags and material hooks
    programs: new ProgramCache(),
    // Cache based on: program.id, material.blend and material.id (if present)
    pipelines: {},
  },
  getProgramFlagsAndUniforms(ctx, entity, options = {}) {
    const { _geometry: geometry } = entity; //TODO MARCIN: this should be provided somehow
    const { flagDefinitions: definitions } = options; //FIXME MARCIN: incoherent name

    const flags = [
      ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
    ];
    const uniforms = {};

    for (let i = 0; i < definitions.length; i++) {
      const [path, defineName, opts = {}] = definitions[i];

      // Assumes defs are ordered and "requires/excludes" item was before
      if (
        (opts.requires && !flags.includes(opts.requires)) ||
        (opts.excludes && flags.includes(opts.excludes))
      ) {
        continue;
      }

      //TODO: GC
      const obj = { ...entity, geometry, options };
      let value = obj;

      // Parse the object path
      for (let j = 0; j < path.length; j++) {
        value = value[path[j]];
      }

      // Compute flags and uniforms
      if (opts.type === "texture") {
        if (!value) continue;

        flags.push(`USE_${defineName}`);
        flags.push(`${defineName}_TEX_COORD ${value.texCoord || "0"}`);
        uniforms[opts.uniform] = value.texture || value;

        // Compute texture transform
        if (value.texture && (value.offset || value.rotation || value.scale)) {
          mat2x3.identity(TEMP_MAT2X3);
          mat2x3.translate(TEMP_MAT2X3, value.offset || [0, 0]);
          mat2x3.rotate(TEMP_MAT2X3, -value.rotation || 0);
          mat2x3.scale(TEMP_MAT2X3, value.scale || [1, 1]);

          value.matrix = mat3.fromMat2x3(
            value.matrix ? mat3.identity(value.matrix) : mat3.create(),
            TEMP_MAT2X3,
          );
        }
        if (value.matrix) {
          flags.push(`USE_${defineName}_MATRIX`);
          uniforms[opts.uniform + "Matrix"] = value.matrix;
        }
        // If not nullish or has default
      } else if (
        !(value === undefined || value === null) ||
        opts.default !== undefined
      ) {
        // Pass the compare test
        if (opts.compare !== undefined) {
          if (opts.compare === value) flags.push(defineName);
        } else {
          // Set flag as name + value
          if (opts.type === "value") {
            flags.push(`${defineName} ${value ?? opts.default}`);
            // Set flag only if truthy
          } else if (value) {
            flags.push(defineName);
            // Set fallback flag if falsy (false, 0, "", NaN)
          } else if (opts.fallback) {
            flags.push(opts.fallback);
          }
        }

        // Set uniform with default if value is nullish
        if (opts.uniform) uniforms[opts.uniform] = value ?? opts.default;
      } else if (opts.fallback) {
        // No value and no default
        flags.push(opts.fallback);
      }
    }

    return { flags: flags.filter(Boolean), uniforms };
  },

  shadersPostReplace(descriptor, entity, uniforms, debugRender) {
    if (debugRender) {
      const mode = debugRender.toLowerCase();

      const scale = mode.includes("normal") ? " * 0.5 + 0.5" : "";
      const pow = ["ao", "normal", "metallic", "roughness"].some((type) =>
        mode.includes(type),
      )
        ? "2.2"
        : "1";

      if (mode.includes("texcoord")) debugRender = `vec3(${debugRender}, 0.0)`;

      descriptor.frag = descriptor.frag.replace(
        "#define HOOK_FRAG_END",
        /* glsl */ `#define HOOK_FRAG_END

vec4 debugColor = vec4(pow(vec3(${debugRender}${scale}), vec3(${pow})), 1.0);
#if (__VERSION__ >= 300)
  outColor = debugColor;
#else
  gl_FragData[0] = debugColor;
#endif
`,
      );
    }

    const hooks = entity.material?.hooks;
    if (hooks) {
      if (hooks.vert) {
        for (let [hookName, hookCode] of Object.entries(hooks.vert)) {
          descriptor.vert = descriptor.vert.replace(
            `#define HOOK_VERT_${hookName}`,
            hookCode,
          );
        }
      }
      if (hooks.frag) {
        for (let [hookName, hookCode] of Object.entries(hooks.frag)) {
          descriptor.frag = descriptor.frag.replace(
            `#define HOOK_FRAG_${hookName}`,
            hookCode,
          );
        }
      }
      if (hooks.uniforms) {
        const hookUniforms = hooks.uniforms(entity, []);
        Object.assign(uniforms, hookUniforms);
      }
    }
  },

  buildProgram(ctx, vert, frag, defines) {
    let program = null;
    try {
      program = ctx.program({ vert, frag });
    } catch (error) {
      program = ctx.program({
        vert: ShaderParser.build(ctx, SHADERS.error.vert, defines),
        frag: ShaderParser.build(ctx, SHADERS.error.frag, defines),
      });
      console.error(error);
      console.warn(
        NAMESPACE,
        `glsl error\n`,
        ShaderParser.getFormattedError(error, { vert, frag }),
      );
    }
    return program;
  },

  getProgram(ctx, entity, options) {
    const { flags, uniforms } = this.getProgramFlagsAndUniforms(
      ctx,
      entity,
      options,
    );

    const descriptor = {
      vert: options.vert,
      frag: options.frag,
    };

    this.shadersPostReplace(
      //TODO MARCIN: Code smell, inline mutation of descriptors
      descriptor,
      entity,
      this.uniforms,
      options.debugRender,
    );

    const { vert, frag } = descriptor;

    let program = this.cache.programs.get(flags, vert, frag);

    if (!program) {
      const defines = options.debugRender
        ? flags.filter((flag) => flag !== options.debugRender)
        : flags;
      const vertSrc = ShaderParser.build(
        ctx,
        vert,
        defines,
        entity.material?.extensions,
      );
      const fragSrc = ShaderParser.build(
        ctx,
        frag,
        defines,
        entity.material?.extensions,
      );

      if (this.debug) {
        console.debug(NAMESPACE, this.type, "new program", flags, entity);
      }
      program = this.buildProgram(
        ctx,
        ShaderParser.replaceStrings(vertSrc, options),
        ShaderParser.replaceStrings(fragSrc, options),
        defines,
      );
      this.cache.programs.set(flags, vert, frag, program);
    }

    return { program, uniforms };
  },

  // Helper to compute a hash made of numbers, boolean coerced to a bit and nullish values to U
  getHashFromProps(obj, props, debug) {
    return props
      .map((key) => {
        const value = obj[key];

        let bit = 1;
        if (Number.isFinite(value)) {
          bit = value;
        } else if (value === true || value === false) {
          bit = Number(value);
        } else {
          bit = value ?? "U";
        }
        return debug ? `${key}_${bit}` : bit;
      })
      .join(debug ? "_" : "");
  },
  getPipeline(ctx, entity, options = {}, pipelineOptions = {}) {
    const { hash } = options;
    const { program, uniforms } = this.getProgram(ctx, entity, options);
    const pipelineHash = `${program.id}_${hash}`;

    if (
      !this.cache.pipelines[pipelineHash] ||
      entity?.material?.needsPipelineUpdate
    ) {
      if (entity.material) entity.material.needsPipelineUpdate = false;
      if (this.debug) {
        console.debug(
          NAMESPACE,
          this.type,
          "new pipeline",
          pipelineHash,
          entity,
        );
      }
      this.cache.pipelines[pipelineHash] = ctx.pipeline({
        program,
        ...pipelineOptions,
      });
    }

    const pipeline = this.cache.pipelines[pipelineHash];
    return { pipeline, uniforms };
  },
  // render(renderView, entities, options) {},
  // renderBackground(renderView, entities, options) {},
  // renderShadow(renderView, entities, options) {},
  // renderOpaque(renderView, entities, options) {},
  // renderTransparent(renderView, entities, options) {},
  // renderPost(renderView, entities, options) {},
  update(_, { time }) {
    this.time = time;
  },
  // TODO:
  dispose() {},
});
