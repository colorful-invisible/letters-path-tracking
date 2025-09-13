import p5 from "p5";
import { mediaPipe } from "./poseModelMediaPipe";
import { initializeCamCapture, updateFeedDimensions } from "./videoFeedUtils";
import { getMappedLandmarks } from "./landmarksHandler";
import { saveSnapshot } from "./utils";
import typeface from "../assets/fonts/LeagueGothicRegular.ttf";

new p5((sk) => {
  let camFeed;
  let type;
  let defaultDensity;

  // Message and tracking
  const message = "EVERYWHERE IS THE SAME PLACE";
  let messageIndex = 0;
  let drawnLetters = []; // Store all drawn letters

  // Video display
  let videoOpacity = 255;

  // Drawing state
  let isWritingEnabled = false;
  let accumulatedDistance = 0;
  let lastActiveX = 0;
  let lastActiveY = 0;
  let previousActiveX = 0;
  let previousActiveY = 0;

  sk.preload = () => {
    type = sk.loadFont(typeface);
  };

  sk.setup = () => {
    defaultDensity = sk.displayDensity();
    sk.createCanvas(sk.windowWidth, sk.windowHeight);
    sk.textFont(type);
    sk.textAlign(sk.CENTER, sk.CENTER);
    sk.noStroke();

    // Initialize camera feed
    camFeed = initializeCamCapture(sk, mediaPipe);
  };

  sk.draw = () => {
    // Clear background every frame
    sk.background(255);

    // Draw video feed if visible
    if (videoOpacity > 0) {
      sk.push();
      sk.tint(255, videoOpacity);
      sk.image(
        camFeed,
        camFeed.x || 0,
        camFeed.y || 0,
        camFeed.scaledWidth || sk.width,
        camFeed.scaledHeight || sk.height
      );
      sk.noTint();
      sk.pop();
    }

    // Get landmarks for both hands
    const landmarksIndex = [7, 8, 21, 22];
    const LM = getMappedLandmarks(sk, mediaPipe, camFeed, landmarksIndex);

    // Check which hand is designated as drawing hand based on landmark distances
    const distance7_21 = sk.dist(LM.X7, LM.Y7, LM.X21, LM.Y21);
    const distance8_22 = sk.dist(LM.X8, LM.Y8, LM.X22, LM.Y22);

    let currentActiveX, currentActiveY;
    let drawingHandDesignated = false;

    // Determine drawing hand based on close landmark distances
    if (distance7_21 < 80) {
      // Landmark 22 is the drawing hand
      currentActiveX = LM.X22;
      currentActiveY = LM.Y22;
      drawingHandDesignated = true;
      isWritingEnabled = true;
    } else if (distance8_22 < 80) {
      // Landmark 21 is the drawing hand
      currentActiveX = LM.X21;
      currentActiveY = LM.Y21;
      drawingHandDesignated = true;
      isWritingEnabled = true;
    } else {
      // No drawing hand designated - writing disabled
      isWritingEnabled = false;
      // Default to landmark 21 for position tracking
      currentActiveX = LM.X21;
      currentActiveY = LM.Y21;
    }

    // Draw landmark circles - WHITE when that hand is the drawing hand, YELLOW when disabled
    sk.push();
    sk.noStroke();

    // Draw landmark 21
    if (isWritingEnabled && distance8_22 < 80) {
      sk.fill(255); // WHITE - this is the drawing hand
    } else {
      sk.fill(255, 255, 0); // YELLOW - not the drawing hand
    }
    sk.ellipse(LM.X21, LM.Y21, 16, 16);

    // Draw landmark 22
    if (isWritingEnabled && distance7_21 < 80) {
      sk.fill(255); // WHITE - this is the drawing hand
    } else {
      sk.fill(255, 255, 0); // YELLOW - not the drawing hand
    }
    sk.ellipse(LM.X22, LM.Y22, 16, 16);
    sk.pop();

    // Calculate movement distance and velocity from previous frame
    const deltaX = currentActiveX - previousActiveX;
    const deltaY = currentActiveY - previousActiveY;
    const distanceMoved = sk.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Drawing logic
    if (isWritingEnabled && distanceMoved > 0 && previousActiveX !== 0) {
      accumulatedDistance += distanceMoved;

      const currentChar = message.charAt(messageIndex % message.length);
      const requiredDistance = currentChar === " " ? 90 : 60;

      if (accumulatedDistance >= requiredDistance) {
        // Calculate font size based on velocity: 24px to 240px
        const velocity = distanceMoved;
        const minSize = 24;
        const maxSize = 240;

        // Make velocity less sensitive - require more movement for bigger letters
        // Only scale up significantly when velocity is above a threshold
        let fontSize;
        if (velocity < 5) {
          fontSize = minSize; // Small movements = small font
        } else if (velocity < 15) {
          fontSize = minSize + (velocity - 5) * 3; // Gradual increase
        } else {
          fontSize = minSize + 30 + (velocity - 15) * 8; // Faster increase for fast movements
        }

        fontSize = sk.constrain(fontSize, minSize, maxSize);

        // Store the letter (skip spaces visually but advance index)
        if (currentChar !== " ") {
          drawnLetters.push({
            char: currentChar,
            x: currentActiveX,
            y: currentActiveY,
            size: fontSize,
          });
        }

        messageIndex++;
        accumulatedDistance = 0;
      }
    }

    // Reset when hands come together
    if (!isWritingEnabled) {
      accumulatedDistance = 0;
    }

    // Update previous position for next frame velocity calculation
    previousActiveX = currentActiveX;
    previousActiveY = currentActiveY;

    // Redraw all stored letters in WHITE
    sk.push();
    sk.fill(255); // WHITE letters
    for (let letter of drawnLetters) {
      sk.textSize(letter.size);
      sk.text(letter.char, letter.x, letter.y);
    }
    sk.pop();
  };

  sk.windowResized = () => {
    sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
    updateFeedDimensions(sk, camFeed, false);
  };

  sk.keyPressed = () => {
    if (sk.key === "s" || sk.key === "S") {
      saveSnapshot(sk, defaultDensity, 2);
    } else if (sk.key === "h" || sk.key === "H") {
      videoOpacity = videoOpacity === 255 ? 0 : 255;
    } else if (sk.key === "c" || sk.key === "C") {
      // Clear all letters and reset
      drawnLetters = [];
      messageIndex = 0;
      accumulatedDistance = 0;
    }
  };
});
