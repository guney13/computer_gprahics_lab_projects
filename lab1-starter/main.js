
// CS405 · Lab 1 — your first triangle in WebGPU (starter)
// Work through the TODOs in order. After each one, check the matching
// checkpoint on the lab slides. The reference solution is in ../lab1-solution/.

const canvas = document.querySelector('canvas');
if (!navigator.gpu) throw new Error("WebGPU not available");

// ---------------------------------------------------------------------------
// TODO 1 — get a device and configure the canvas
//   a) check navigator.gpu exists, throw a clear error if not
const adapter = await navigator.gpu.requestAdapter();
if (!adapter) throw new Error("No WebGPU adapter found!");
const device = await adapter.requestDevice()

const context = canvas.getContext('webgpu')
const format = navigator.gpu.getPreferredCanvasFormat()
context.configure({ device, format, alphaMode: 'opaque' })
console.log('WebGPU format is:', format)
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// TODO 2 — a shader module and a render pipeline
//   The vertex shader returns clip-space positions for vertex_index 0, 1, 2.
//   The fragment shader returns a solid colour.
const SHADER = `
  struct U { 
    time: f32, 
    aspect: f32, 
    mouse: vec2f
  };

  @group(0) @binding(0) var<uniform> u: U;

  struct VSOut {
    @builtin(position) pos: vec4f,
    @location(0) colour: vec4f
  };
  

  @vertex fn vs(@builtin(vertex_index) i : u32) -> VSOut {
    var p = array<vec2f, 4>(
      vec2f(-0.5, 0.5),   // top left
      vec2f(-0.5, -0.5), // bottom left
      vec2f(0.5, -0.5),  // bottom right
      vec2f(0.5, 0.5),   // top right
    );

    var c = array<vec3f, 4>(
      vec3f(1.0, 0.0, 0.0),
      vec3f(0.0, 1.0, 0.0),
      vec3f(0.0, 0.0, 1.0),
      vec3f(1.0, 1.0, 0.0)
    );

    var idx = array<u32, 6>(0u, 1u, 2u, 0u, 2u, 3u);
    let k = idx[i];

    let a = u.time;
    let R = mat2x2f( 
      cos(a), sin(a), // column 0 where x lands 
      -sin(a), cos(a) // column 1 where y lands
    );
    
    let S = mat2x2f(
      1.5, 0.0, 
      0.0, 0.6
    ); // non-uniform scale

    var q = p[k];

    q = R * q;               // plain rotation
    // q = R * S * q;        // scale, then rotate: a turning rectangle
    // q = S * R * q;        // rotate, then scale: shears as it turns
    // q = transpose(R) * q; // R^-1 = R^T: spins the other way

    var out: VSOut;
    out.pos = vec4f(
      q.x / u.aspect + u.mouse.x, 
      q.y + u.mouse.y, 
      0.0, 
      1.0
    );

    out.colour = vec4f(c[k], 1.0);
    return out;
  }


  @fragment fn fs(in: VSOut) -> @location(0) vec4f {
    return in.colour;
  }
`;
const module = device.createShaderModule({ code: SHADER });
const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: { module, entryPoint: 'vs' },
  fragment: { module, entryPoint: 'fs', targets: [{ format }]}
});


// TODO 3 — a colour per vertex
//   Return a struct from the vertex shader with @location(0) colour,
//   take it as the fragment shader's input, and watch it interpolate.
// ---------------------------------------------------------------------------


const ubuf = device.createBuffer({
  size: 16,
  usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
});

const bind = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [{ binding: 0, resource: {buffer: ubuf} }]
});


// ---------------------------------------------------------------------------
// TODO 4 — a uniform buffer with the time, and rotate the triangle
//   size 16 bytes, usage UNIFORM | COPY_DST
//   bind group from pipeline.getBindGroupLayout(0)
//   device.queue.writeBuffer(...) every frame
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// TODO 5 — your turn: a square (two triangles), correct aspect ratio,
//   and the shape following the mouse.
// ---------------------------------------------------------------------------

const t0 = performance.now();

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
}
window.addEventListener('resize', resize);
resize();


let mouseX = 0, mouseY = 0;
window.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
  mouseY = -(((e.clientY - r.top)  / r.height) * 2 - 1);
});

function frame() {

  const t = (performance.now() - t0) * 0.001;
  // 16 bytes for ubuf, 
  // 32-bit float = 4 bytes,
  // 4 * 4 = 16

  device.queue.writeBuffer(ubuf, 0, new Float32Array([ t, canvas.width / canvas.height, mouseX, mouseY ])); 

  const encoder = device.createCommandEncoder();
  const pass = encoder.beginRenderPass({  
    colorAttachments: [{
      view: context.getCurrentTexture().createView(),
      clearValue: { r: 0.05, g: 0.2, b: 0.09, a: 1 },
      loadOp: 'clear', storeOp: 'store',
    }]
  });

  pass.setPipeline(pipeline);
  pass.setBindGroup(0, bind);
  pass.draw(6);
  pass.end();

  device.queue.submit([encoder.finish()]);

  requestAnimationFrame(frame);
}
frame();
