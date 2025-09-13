// Imports
import p5 from "p5";
import { mediaPipe } from "./poseModelMediaPipe";
import { initializeCamCapture, updateFeedDimensions } from "./videoFeedUtils";
import { getMappedLandmarks } from "./landmarksHandler";
import { saveSnapshot } from "./utils";
import typeface from "../assets/fonts/LeagueGothicRegular.ttf";

// P5 Sketch
new p5((sk) => {
  // State
  let camFeed;
  let type;
  let defaultDensity;
  const message = "EVERYWHERE IS THE SAME PLACE";
  let messageIndex = 0;
  let drawnLetters = [];
  let videoOpacity = 255;
  let isWritingEnabled = false;
  let accumulatedDistance = 0;
  let lastActiveX = 0;
  let lastActiveY = 0;
  let previousActiveX = 0;
  let previousActiveY = 0;
  let bothCloseStartTime = 0;
  let lastFastEraseTime = 0;
  let wasBothClose = false;
  let lastLetterEraseTime = 0;
  let lastDrawnCharIndex = -1;

  // Preload
  sk.preload = () => {
    type = sk.loadFont(typeface);
  };

  // Setup
  sk.setup = () => {
    defaultDensity = sk.displayDensity();
    sk.createCanvas(sk.windowWidth, sk.windowHeight);
    sk.textFont(type);
    sk.textAlign(sk.CENTER, sk.CENTER);
    sk.noStroke();
    camFeed = initializeCamCapture(sk, mediaPipe);
  };

  // Main Draw Loop
  sk.draw = () => {
    sk.background(255);

    // Video
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

    // Landmarks
    const landmarksIndex = [7, 8, 11, 12, 21, 22];
    const LM = getMappedLandmarks(sk, mediaPipe, camFeed, landmarksIndex);
    const distance7_21 = sk.dist(LM.X7, LM.Y7, LM.X21, LM.Y21);
    const distance8_22 = sk.dist(LM.X8, LM.Y8, LM.X22, LM.Y22);
    const distance21_12 = sk.dist(LM.X21, LM.Y21, LM.X12, LM.Y12);
    const distance22_11 = sk.dist(LM.X22, LM.Y22, LM.X11, LM.Y11);

    // Drawing Hand Selection
    let currentActiveX, currentActiveY;
    let drawingHandDesignated = false;
    const bothClose = distance7_21 < 80 && distance8_22 < 80;
    const singleTriggerActive = distance7_21 < 80 || distance8_22 < 80;

    // Letter-by-letter erase gesture (only when not writing)
    const letterEraseActive =
      !singleTriggerActive && (distance21_12 < 80 || distance22_11 < 80);
    if (letterEraseActive && sk.millis() - lastLetterEraseTime > 800) {
      if (drawnLetters.length > 0) {
        drawnLetters.pop();
        messageIndex = lastDrawnCharIndex; // Go back to the exact position of the erased letter
        lastLetterEraseTime = sk.millis();
      }
    }

    if (letterEraseActive) {
      // Letter erase gesture is active - disable writing
      isWritingEnabled = false;
      currentActiveX = LM.X21;
      currentActiveY = LM.Y21;
    } else if (bothClose) {
      if (!wasBothClose) {
        bothCloseStartTime = sk.millis();
        wasBothClose = true;
      }

      const holdDuration = sk.millis() - bothCloseStartTime;

      if (holdDuration >= 3000) {
        // Hold for 3+ seconds: erase all
        drawnLetters = [];
        messageIndex = 0;
        accumulatedDistance = 0;
      }

      isWritingEnabled = false;
      currentActiveX = LM.X21;
      currentActiveY = LM.Y21;
    } else {
      // Just released from both close - check if it was a fast touch
      if (wasBothClose) {
        const holdDuration = sk.millis() - bothCloseStartTime;
        if (holdDuration < 800 && sk.millis() - lastFastEraseTime > 100) {
          // Fast touch completed: erase one letter
          if (drawnLetters.length > 0) {
            drawnLetters.pop();
            messageIndex = lastDrawnCharIndex; // Go back to the exact position of the erased letter
            lastFastEraseTime = sk.millis();
          }
        }
        wasBothClose = false;
      }

      // Normal drawing hand selection only when not just releasing from both close
      if (distance7_21 < 80) {
        currentActiveX = LM.X22;
        currentActiveY = LM.Y22;
        drawingHandDesignated = true;
        isWritingEnabled = true;
      } else if (distance8_22 < 80) {
        currentActiveX = LM.X21;
        currentActiveY = LM.Y21;
        drawingHandDesignated = true;
        isWritingEnabled = true;
      } else {
        isWritingEnabled = false;
        currentActiveX = LM.X21;
        currentActiveY = LM.Y21;
      }
    }

    // Landmark Circles
    sk.push();
    sk.noStroke();
    if (isWritingEnabled && distance8_22 < 80) {
      sk.fill(255);
    } else {
      sk.fill(255, 255, 0);
    }
    sk.ellipse(LM.X21, LM.Y21, 16, 16);
    if (isWritingEnabled && distance7_21 < 80) {
      sk.fill(255);
    } else {
      sk.fill(255, 255, 0);
    }
    sk.ellipse(LM.X22, LM.Y22, 16, 16);
    sk.pop();

    // Movement & Drawing
    const deltaX = currentActiveX - previousActiveX;
    const deltaY = currentActiveY - previousActiveY;
    const distanceMoved = sk.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (isWritingEnabled && distanceMoved > 0 && previousActiveX !== 0) {
      accumulatedDistance += distanceMoved;
      const currentChar = message.charAt(messageIndex % message.length);
      const velocity = distanceMoved;
      const minSize = 24;
      const maxSize = 360;
      let fontSize;
      if (velocity < 2) {
        fontSize = minSize;
      } else {
        const velocityFactor = Math.log(velocity + 1) * 35;
        fontSize = minSize + velocityFactor;
      }
      fontSize = sk.constrain(fontSize, minSize, maxSize);
      const baseDistance = currentChar === " " ? 50 : 30;
      const fontSizeRatio = fontSize / minSize;
      const scalingFactor = 1 + (fontSizeRatio - 1) * 0.2;
      const requiredDistance = baseDistance * scalingFactor;
      if (accumulatedDistance >= requiredDistance) {
        if (currentChar !== " ") {
          drawnLetters.push({
            char: currentChar,
            x: currentActiveX,
            y: currentActiveY,
            size: fontSize,
          });
          lastDrawnCharIndex = messageIndex; // Track the index of the last drawn character
        }
        messageIndex++;
        accumulatedDistance = 0;
      }
    }

    // Reset/Update Movement State
    if (!isWritingEnabled) {
      accumulatedDistance = 0;
      previousActiveX = 0;
      previousActiveY = 0;
    } else {
      previousActiveX = currentActiveX;
      previousActiveY = currentActiveY;
    }

    // Draw Letters
    sk.push();
    if (videoOpacity === 0) {
      sk.fill(0);
    } else {
      sk.fill(255);
    }
    for (let letter of drawnLetters) {
      sk.textSize(letter.size);
      sk.text(letter.char, letter.x, letter.y);
    }
    sk.pop();
  };

  // Window Resize
  sk.windowResized = () => {
    sk.resizeCanvas(sk.windowWidth, sk.windowHeight);
    updateFeedDimensions(sk, camFeed, false);
  };

  // Key Presses
  sk.keyPressed = () => {
    if (sk.key === "s" || sk.key === "S") {
      saveSnapshot(sk, defaultDensity, 2);
    } else if (sk.key === "h" || sk.key === "H") {
      videoOpacity = videoOpacity === 255 ? 0 : 255;
    } else if (sk.key === "c" || sk.key === "C") {
      drawnLetters = [];
      messageIndex = 0;
      accumulatedDistance = 0;
    }
  };
});
