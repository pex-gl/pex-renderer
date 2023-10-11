import { mat3, mat2x3 } from "pex-math";
import { pipeline as SHADERS, parser as ShaderParser } from "pex-shaders";

import { NAMESPACE, TEMP_MAT2X3 } from "../../utils.js";

export function getMaterialFlagsAndUniforms(
  ctx,
  entity,
  flagDefs,
  options = {}
) {
  const { _geometry: geometry } = entity;

  const flags = [
    //[["ctx", "capabilities", "maxColorAttachments"], "USE_DRAW_BUFFERS"
    ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
  ];
  const materialUniforms = {};

  for (let i = 0; i < flagDefs.length; i++) {
    const [path, defineName, opts = {}] = flagDefs[i];

    // Assumes defs are ordered and "requires" item was before
    if (opts.requires && !flags.includes(opts.requires)) continue;

    //TODO: GC
    const obj = { ...entity, geometry, options };
    let value = obj;

    // Parse the object path
    for (let j = 0; j < path.length; j++) {
      value = value[path[j]];
    }

    // Compute flags and uniforms
    if (opts.type === "counter") {
      flags.push(`${defineName} ${value}`);
    } else if (opts.type === "texture") {
      if (!value) continue;

      flags.push(`USE_${defineName}`);
      flags.push(`${defineName}_TEX_COORD ${value.texCoord || "0"}`);
      materialUniforms[opts.uniform] = value.texture || value;

      // Compute texture transform
      if (value.texture && (value.offset || value.rotation || value.scale)) {
        mat2x3.identity(TEMP_MAT2X3);
        mat2x3.translate(TEMP_MAT2X3, value.offset || [0, 0]);
        mat2x3.rotate(TEMP_MAT2X3, -value.rotation || 0);
        mat2x3.scale(TEMP_MAT2X3, value.scale || [1, 1]);

        value.matrix = mat3.fromMat2x3(
          value.matrix ? mat3.identity(value.matrix) : mat3.create(),
          TEMP_MAT2X3
        );
      }
      if (value.matrix) {
        flags.push(`USE_${defineName}_MATRIX`);
        materialUniforms[opts.uniform + "Matrix"] = value.matrix;
      }
      // If not nullish or has default
    } else if ((value ?? false) || opts.default !== undefined) {
      // Pass the compare test or truthy
      if (opts.compare !== undefined ? opts.compare === value : value) {
        flags.push(defineName);
      } else if (opts.fallback) {
        flags.push(opts.fallback);
      }

      // Set uniform with default if value is nullish
      if (opts.uniform) materialUniforms[opts.uniform] = value ?? opts.default;
    } else if (opts.fallback) {
      // No value and no default
      flags.push(opts.fallback);
    }
  }

  return { flags: flags.filter(Boolean), materialUniforms };
}

export class ProgramCache {
  values = [];

  get(flags, vert, frag) {
    for (let i = 0; i < this.values.length; i++) {
      const value = this.values[i];
      if (value.frag === frag && value.vert === vert) {
        if (value.flags.length === flags.length) {
          let sameFlags = true;
          for (let j = 0; j < flags.length; j++) {
            if (value.flags[j] !== flags[j]) {
              sameFlags = false;
              break;
            }
          }
          if (sameFlags) return value.program;
        }
      }
    }
  }

  set(flags, vert, frag, program) {
    this.values.push({ flags, vert, frag, program });
  }
}

// Compute a hash made of numbers, boolean coerced to a bit and nullish values to U
export function getHashFromProps(obj, props, debug) {
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
}

export function buildProgram(ctx, vert, frag) {
  let program = null;
  try {
    program = ctx.program({ vert, frag });
  } catch (error) {
    program = ctx.program({
      vert: ShaderParser.build(ctx, SHADERS.error.vert),
      frag: ShaderParser.build(ctx, SHADERS.error.frag, [
        ctx.capabilities.maxColorAttachments > 1 && "USE_DRAW_BUFFERS",
      ]),
    });
    console.error(error);
    console.warn(
      NAMESPACE,
      `glsl error\n`,
      ShaderParser.getFormattedError(error, { vert, frag })
    );
  }
  return program;
}

export function shadersPostReplace(
  descriptor,
  entity,
  materialUniforms,
  debugRender
) {
  const {
    material: { hooks },
  } = entity;

  if (debugRender) {
    const mode = debugRender.toLowerCase();

    const scale = mode.includes("normal") ? " * 0.5 + 0.5" : "";
    const pow = ["ao", "normal", "metallic", "roughness"].some((type) =>
      mode.includes(type)
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
`
    );
  }

  if (hooks) {
    if (hooks.vert) {
      for (let [hookName, hookCode] of Object.entries(hooks.vert)) {
        descriptor.vert = descriptor.vert.replace(
          `#define HOOK_VERT_${hookName}`,
          hookCode
        );
      }
    }
    if (hooks.frag) {
      for (let [hookName, hookCode] of Object.entries(hooks.frag)) {
        descriptor.frag = descriptor.frag.replace(
          `#define HOOK_FRAG_${hookName}`,
          hookCode
        );
      }
    }
    if (hooks.uniforms) {
      const hookUniforms = hooks.uniforms(entity, []);
      Object.assign(materialUniforms, hookUniforms);
    }
  }
}
