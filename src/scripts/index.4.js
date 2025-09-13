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
  const message = "EVERYWHERE IS THE SAME PLACE";
  let messageIndex = 0;
  let drawnLetters = [];
  let videoOpacity = 255;
  let isDrawingEnabled = false;
  let drawingHand = null; // 'left' or 'right'
  let accumulatedDistance = 0;
  let previousActiveX = 0;
  let previousActiveY = 0;

  // Gesture timing
  let earTouchStartTime = 0;
  let prayerStartTime = 0;
  let lastLetterEraseTime = 0;
  let isEarTouching = false;
  let isPraying = false;

  // Crossing detection
  let leftHandBelowChest = false;
  let rightHandBelowChest = false;
  let leftCrossCount = 0;
  let rightCrossCount = 0;

  sk.preload = () => {
    type = sk.loadFont(typeface);
  };

  sk.setup = () => {
    defaultDensity = sk.displayDensity();
    sk.createCanvas(sk.windowWidth, sk.windowHeight);
    sk.textFont(type);
    sk.textAlign(sk.CENTER, sk.CENTER);
    sk.noStroke();
    camFeed = initializeCamCapture(sk, mediaPipe);
  };

  sk.draw = () => {
    sk.background(255);

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

    // Get landmarks
    const landmarksIndex = [7, 8, 11, 12, 21, 22];
    const LM = getMappedLandmarks(sk, mediaPipe, camFeed, landmarksIndex);

    // Heart center (between landmarks 11 and 12, slightly lower)
    const heartCenterX = (LM.X11 + LM.X12) / 2;
    const heartCenterY = (LM.Y11 + LM.Y12) / 2 + 40;

    // Distances for gesture detection
    const leftHandToEar = sk.dist(LM.X21, LM.Y21, LM.X7, LM.Y7);
    const rightHandToEar = sk.dist(LM.X22, LM.Y22, LM.X8, LM.Y8);
    const handsTogether = sk.dist(LM.X21, LM.Y21, LM.X22, LM.Y22);

    // Crossing gesture detection for activation/deactivation
    const leftHandNearChestX = Math.abs(LM.X21 - heartCenterX) < 80;
    const rightHandNearChestX = Math.abs(LM.X22 - heartCenterX) < 80;

    // Left hand crossing (activates/deactivates right hand)
    if (leftHandNearChestX) {
      if (LM.Y21 > heartCenterY + 50 && !leftHandBelowChest) {
        leftHandBelowChest = true;
      } else if (LM.Y21 < heartCenterY - 50 && leftHandBelowChest) {
        leftCrossCount++;
        leftHandBelowChest = false;

        // Can always activate right hand, but only deactivate if no hand is drawing or if right hand is currently drawing
        if (leftCrossCount % 2 === 1) {
          drawingHand = "right";
          isDrawingEnabled = true;
        } else {
          if (!isDrawingEnabled || drawingHand === "right") {
            drawingHand = null;
            isDrawingEnabled = false;
            accumulatedDistance = 0;
            previousActiveX = 0;
            previousActiveY = 0;
          }
        }
      }
    }

    // Right hand crossing (activates/deactivates left hand)
    if (rightHandNearChestX) {
      if (LM.Y22 > heartCenterY + 50 && !rightHandBelowChest) {
        rightHandBelowChest = true;
      } else if (LM.Y22 < heartCenterY - 50 && rightHandBelowChest) {
        rightCrossCount++;
        rightHandBelowChest = false;

        // Can always activate left hand, but only deactivate if no hand is drawing or if left hand is currently drawing
        if (rightCrossCount % 2 === 1) {
          drawingHand = "left";
          isDrawingEnabled = true;
        } else {
          if (!isDrawingEnabled || drawingHand === "left") {
            drawingHand = null;
            isDrawingEnabled = false;
            accumulatedDistance = 0;
            previousActiveX = 0;
            previousActiveY = 0;
          }
        }
      }
    }

    // Erase all - both hands to ears for 2 seconds
    const currentEarTouching = leftHandToEar < 80 && rightHandToEar < 80;
    if (currentEarTouching && !isEarTouching) {
      earTouchStartTime = sk.millis();
      isEarTouching = true;
    } else if (!currentEarTouching) {
      isEarTouching = false;
    }

    if (isEarTouching && sk.millis() - earTouchStartTime > 2000) {
      drawnLetters = [];
      messageIndex = 0;
      accumulatedDistance = 0;
    }

    // Letter by letter erase - prayer gesture
    const currentPraying =
      handsTogether < 100 &&
      LM.Y21 > heartCenterY - 50 &&
      LM.Y21 < heartCenterY + 100;
    if (currentPraying && !isPraying) {
      prayerStartTime = sk.millis();
      isPraying = true;
    } else if (!currentPraying) {
      isPraying = false;
    }

    if (isPraying && sk.millis() - lastLetterEraseTime > 750) {
      if (drawnLetters.length > 0) {
        drawnLetters.pop();
        messageIndex = Math.max(0, messageIndex - 1);
        lastLetterEraseTime = sk.millis();
      }
    }

    // Drawing logic
    if (isDrawingEnabled && drawingHand) {
      const currentActiveX = drawingHand === "left" ? LM.X21 : LM.X22;
      const currentActiveY = drawingHand === "left" ? LM.Y21 : LM.Y22;

      const deltaX = currentActiveX - previousActiveX;
      const deltaY = currentActiveY - previousActiveY;
      const distanceMoved = sk.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distanceMoved > 0 && previousActiveX !== 0) {
        accumulatedDistance += distanceMoved;
        const currentChar = message.charAt(messageIndex % message.length);
        const velocity = distanceMoved;
        const minSize = 24;
        const maxSize = 360;
        let fontSize = minSize + Math.log(velocity + 1) * 35;
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
          }
          messageIndex++;
          accumulatedDistance = 0;
        }
      }

      previousActiveX = currentActiveX;
      previousActiveY = currentActiveY;
    }

    // Draw letters
    sk.push();
    sk.fill(videoOpacity === 0 ? 0 : 255);
    for (let letter of drawnLetters) {
      sk.textSize(letter.size);
      sk.text(letter.char, letter.x, letter.y);
    }
    sk.pop();

    // Debug circles
    sk.push();
    sk.strokeWeight(2);

    // Hands - filled green if active drawing hand, yellow outline if not
    if (isDrawingEnabled && drawingHand === "left") {
      sk.fill("#00ff00");
      sk.stroke("#00ff00");
      sk.ellipse(LM.X21, LM.Y21, 24, 24);
    } else {
      sk.noFill();
      sk.stroke("#ffff00");
      sk.ellipse(LM.X21, LM.Y21, 20, 20);
    }

    if (isDrawingEnabled && drawingHand === "right") {
      sk.fill("#00ff00");
      sk.stroke("#00ff00");
      sk.ellipse(LM.X22, LM.Y22, 24, 24);
    } else {
      sk.noFill();
      sk.stroke("#ffff00");
      sk.ellipse(LM.X22, LM.Y22, 20, 20);
    }

    // Ears
    sk.noFill();
    sk.stroke("#ff0000");
    sk.ellipse(LM.X7, LM.Y7, 16, 16);
    sk.ellipse(LM.X8, LM.Y8, 16, 16);

    // Heart center
    sk.noFill();
    sk.stroke("#0000ff");
    sk.ellipse(heartCenterX, heartCenterY, 24, 24);

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
      drawnLetters = [];
      messageIndex = 0;
      accumulatedDistance = 0;
    }
  };
});
