// ---- SAVE P5 CANVAS SNAPSHOT AS PNG
// -----------------------------------
let countSaved = 1;
function saveSnapshot(sk, defaultDensity, densityFactor = 2) {
  const currentDensity = sk.pixelDensity();
  sk.pixelDensity(defaultDensity * densityFactor);
  sk.redraw();
  sk.saveCanvas(`sketch_${countSaved}`, "png");
  countSaved++;
  sk.pixelDensity(currentDensity);
  sk.redraw();
}

// ---- SINOIDAL PULSE
// -------------------
function pulse(sk, min, max, time) {
  const mid = (min + max) / 2;
  const amplitude = (max - min) / 2;
  return amplitude * sk.sin(sk.frameCount * (sk.TWO_PI / time)) + mid;
}

// ---- AVERAGE LANDMARK POSITION FOR SMOOTHING
// --------------------------------------------
// Usage on index.js:
// const avgPos = averageLandmarkPosition(2);
// const noseX = avgPos("NX", landmarks.LM0X);
// const noseY = avgPos("NY", landmarks.LM0Y);

function averageLandmarkPosition(size) {
  let queues = {};

  return (key, value) => {
    if (!queues[key]) {
      queues[key] = [];
    }

    let queue = queues[key];
    queue.push(value);
    if (queue.length > size) {
      queue.shift();
    }

    // Calculate average
    let sum = queue.reduce((a, b) => a + b, 0);
    return sum / queue.length;
  };
}

// ---- CALCULATE QUAD GRID
// ------------------------

function calculateQuadGrid(x1, y1, x2, y2, x3, y3, x4, y4, numCols, numRows) {
  let vertices = [];
  let textureCoords = [];
  let xStep = 1.0 / (numCols - 1);
  let yStep = 1.0 / (numRows - 1);

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      let xProgress = col * xStep;
      let yProgress = row * yStep;

      let topX = (1 - yProgress) * x1 + yProgress * x4;
      let topY = (1 - yProgress) * y1 + yProgress * y4;
      let bottomX = (1 - yProgress) * x2 + yProgress * x3;
      let bottomY = (1 - yProgress) * y2 + yProgress * y3;

      let vertexX = (1 - xProgress) * topX + xProgress * bottomX;
      let vertexY = (1 - xProgress) * topY + xProgress * bottomY;

      let texCoordU = xProgress;
      let texCoordV = yProgress;

      vertices.push({ x: vertexX, y: vertexY });
      textureCoords.push({ u: texCoordU, v: texCoordV });
    }
  }
  return { vertices, textureCoords };
}

function drawTexturedQuad(sketch, texture, x1, y1, x2, y2, x3, y3, x4, y4) {
  if (!texture) {
    console.log("ERROR: No texture provided to drawTexturedQuad");
    return;
  }

  // Use higher resolution grid for smoother deformation
  const gridSizeX = 20; // Increased from 8 to 20
  const gridSizeY = 20; // Increased from 8 to 20

  const { vertices, textureCoords } = calculateQuadGrid(
    x1,
    y1,
    x2,
    y2,
    x3,
    y3,
    x4,
    y4,
    gridSizeX,
    gridSizeY
  );

  sketch.beginShape(sketch.TRIANGLES);
  sketch.texture(texture);

  for (let y = 0; y < gridSizeY - 1; y++) {
    for (let x = 0; x < gridSizeX - 1; x++) {
      let tl = x + y * gridSizeX;
      let tr = x + 1 + y * gridSizeX;
      let br = x + 1 + (y + 1) * gridSizeX;
      let bl = x + (y + 1) * gridSizeX;

      // First triangle
      sketch.vertex(
        vertices[tl].x,
        vertices[tl].y,
        textureCoords[tl].u * texture.width,
        textureCoords[tl].v * texture.height
      );
      sketch.vertex(
        vertices[tr].x,
        vertices[tr].y,
        textureCoords[tr].u * texture.width,
        textureCoords[tr].v * texture.height
      );
      sketch.vertex(
        vertices[br].x,
        vertices[br].y,
        textureCoords[br].u * texture.width,
        textureCoords[br].v * texture.height
      );

      // Second triangle
      sketch.vertex(
        vertices[tl].x,
        vertices[tl].y,
        textureCoords[tl].u * texture.width,
        textureCoords[tl].v * texture.height
      );
      sketch.vertex(
        vertices[br].x,
        vertices[br].y,
        textureCoords[br].u * texture.width,
        textureCoords[br].v * texture.height
      );
      sketch.vertex(
        vertices[bl].x,
        vertices[bl].y,
        textureCoords[bl].u * texture.width,
        textureCoords[bl].v * texture.height
      );
    }
  }
  sketch.endShape();
}

// ---- CREATE AND SETUP TEXTURES
// ------------------------------

function createAndSetupTextures(options) {
  const { sketch, type, wordConfigs, textureArray, fillColor = 255 } = options;

  wordConfigs.forEach((config, index) => {
    const { word, width, height, fontSize } = config;
    let graphics = sketch.createGraphics(width, height);

    graphics.clear();
    graphics.fill(fillColor);
    graphics.noStroke();
    graphics.textAlign(graphics.CENTER, graphics.CENTER);
    graphics.textFont(type);

    graphics.textSize(fontSize);

    graphics.text(word, width / 2, height / 3);
    textureArray.push(graphics);
  });
}
export { saveSnapshot, createAndSetupTextures, drawTexturedQuad };
