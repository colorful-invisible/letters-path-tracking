export const getMappedLandmarks = (sketch, mediaPipe, camFeed, indices) => {
  const mappedLandmarks = {};

  if (mediaPipe.landmarks.length > 0 && mediaPipe.landmarks[0]) {
    indices.forEach((index) => {
      if (mediaPipe.landmarks[0][index]) {
        const LMX = `X${index}`;
        const LMY = `Y${index}`;

        // Map landmarks to video feed dimensions and add offset for proper positioning
        mappedLandmarks[LMX] = sketch.map(
          mediaPipe.landmarks[0][index].x,
          1,
          0,
          camFeed.x || 0,
          (camFeed.x || 0) + (camFeed.scaledWidth || sketch.width)
        );

        mappedLandmarks[LMY] = sketch.map(
          mediaPipe.landmarks[0][index].y,
          0,
          1,
          camFeed.y || 0,
          (camFeed.y || 0) + (camFeed.scaledHeight || sketch.height)
        );
      }
    });
  }

  return mappedLandmarks;
};
