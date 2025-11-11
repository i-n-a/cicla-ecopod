// =======================================================
// CICLA Bike Comfort Map – Weather-style demo
// -------------------------------------------------------
// GENERATIVE AGENT (MapAgent):
//   Builds a comfortMap[x][y] from:
//     • temperature gradient
//     • moving rain cloud
//     • distance to eco-pods
//   Then draws a blue→red heatmap.
//
// REACTIVE AGENTS (Cyclist):
//   Yellow dots that:
//     • sample the comfort field around them
//     • move in the direction of increasing comfort
//     • respawn when they leave the map or stay in
//       very low comfort locations.
//
// Keys:
//   1 = sunny   2 = rain   3 = heatwave
// =======================================================

let cols = 70;
let rows = 105;
let cellW, cellH;

let comfortMap = [];
let mapAgent;

let cyclists = [];
let numCyclists = 12;

let weather = "sunny";  // "sunny", "rain", "heat"

let ecoPods = [];

// -------------------------------------------------------
function setup() {
  createCanvas(600, 900);
  colorMode(HSB, 360, 100, 100, 100);
  frameRate(30);

  cellW = width / cols;
  cellH = height / rows;

  // init comfort map
  for (let i = 0; i < cols; i++) {
    comfortMap[i] = [];
    for (let j = 0; j < rows; j++) {
      comfortMap[i][j] = 0;
    }
  }

  // Some eco-pod stations (pretend Lisbon: riverside, etc.)
  ecoPods = [
    { x: width * 0.3, y: height * 0.25 },
    { x: width * 0.65, y: height * 0.35 },
    { x: width * 0.4, y: height * 0.6 },
    { x: width * 0.7, y: height * 0.8 }
  ];

  mapAgent = new MapAgent();

  // Create cyclists
  for (let k = 0; k < numCyclists; k++) {
    cyclists.push(new Cyclist());
  }
}

// -------------------------------------------------------
function draw() {
  background(0, 0, 95); // soft paper background

  // GENERATIVE LAYER
  mapAgent.perceive();
  mapAgent.decide();
  mapAgent.act();   // fills comfortMap + draws color overlay

  // Draw eco-pods on top
  drawEcoPods();

  // REACTIVE LAYER
  for (let c of cyclists) {
    c.perceive();
    c.decide();
    c.act();
  }

  drawUI();
}

// =======================================================
// GENERATIVE AGENT – builds "comfortMap" & draws heatmap
// =======================================================
class MapAgent {
  constructor() {
    this.mode = "sunny";
  }

  perceive() {
    this.perception = { weather: weather };
  }

  decide() {
    this.mode = this.perception.weather;
  }

  act() {
    // define moving "rain cloud" center
    let t = frameCount * 0.01;
    let rainCx = width * (0.5 + 0.3 * sin(t * 0.7));
    let rainCy = height * (0.5 + 0.2 * cos(t * 0.4));
    let rainRadius = width * 0.45;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = (i + 0.5) * cellW;
        let y = (j + 0.5) * cellH;

        // Base "city fabric" noise
        let base = noise(i * 0.08, j * 0.08);

        // Temperature: top hotter, bottom cooler
        // temp in [0,1]: 1 = very hot
        let temp = map(j, 0, rows - 1, 1, 0);

        // Rain intensity from moving cloud (0 = dry, 1 = heavy rain)
        let dRain = dist(x, y, rainCx, rainCy);
        let rain = exp(-sq(dRain / rainRadius)); // gaussian-ish

        // Eco-pod proximity: 1 when very close, 0 when far
        let minPod = 9999;
        for (let p of ecoPods) {
          let dp = dist(x, y, p.x, p.y);
          if (dp < minPod) minPod = dp;
        }
        let eco = map(minPod, 0, width * 0.4, 1, 0);
        eco = constrain(eco, 0, 1);

        // Combine depending on weather mode
        let comfort;

        if (this.mode === "sunny") {
          // Balanced: pleasant near pods & cooler areas,
          // light penalty for rain.
          comfort =
            0.35 * (1 - temp) +    // cooler slightly nicer
            0.35 * eco +
            0.20 * (1 - rain) +
            0.10 * base;
        } else if (this.mode === "rain") {
          // Rainy: staying dry + eco-pods matter most.
          comfort =
            0.15 * (1 - temp) +
            0.45 * eco +
            0.30 * (1 - rain) +
            0.10 * base;
        } else { // "heat"
          // Heatwave: temperature dominates.
          comfort =
            0.55 * (1 - temp) +    // cool areas very important
            0.20 * eco +
            0.15 * (1 - rain) +
            0.10 * base;
        }

        comfort = constrain(comfort, 0, 1);
        comfortMap[i][j] = comfort;

        // Map comfort to color:
        //  comfort 0 → red (uncomfortable)
        //  comfort 1 → blue (very comfortable)
        let h = map(comfort, 0, 1, 0, 210); // red→yellow→green→blue
        let s = 70;
        let b = 90;

        // small texture variation
        let brightJitter = map(noise(i * 0.1, j * 0.1, t), 0, 1, -8, 8);
        fill(h, s, b + brightJitter, 95);
        noStroke();
        rect(i * cellW, j * cellH, cellW + 1, cellH + 1);
      }
    }
  }
}

// Draw eco-pod icons
function drawEcoPods() {
  for (let p of ecoPods) {
    // shadow
    noStroke();
    fill(0, 0, 0, 25);
    ellipse(p.x + 2, p.y + 3, 20, 10);

    // pin
    fill(0, 0, 100);
    ellipse(p.x, p.y, 22, 22);

    noFill();
    stroke(130, 80, 80, 100); // green ring
    strokeWeight(3);
    ellipse(p.x, p.y, 20, 20);

    noStroke();
    fill(130, 80, 90);
    ellipse(p.x, p.y, 9, 9);
  }
}

// =======================================================
// REACTIVE AGENT – cyclists following the comfort gradient
// =======================================================
class Cyclist {
  constructor() {
    this.trail = [];
    this.respawn();
  }

  respawn() {
    // start near a random eco-pod with small offset
    let p = random(ecoPods);
    let angle = random(TWO_PI);
    let radius = random(10, 60);
    this.x = p.x + cos(angle) * radius;
    this.y = p.y + sin(angle) * radius;

    this.vel = createVector(random(-1, 1), random(-1, 1));
    this.trail = [];
  }

  perceive() {
    // Sample comfort around the cyclist in 4 directions
    let eps = 10;
    let cCenter = comfortAt(this.x, this.y);
    let cRight  = comfortAt(this.x + eps, this.y);
    let cLeft   = comfortAt(this.x - eps, this.y);
    let cUp     = comfortAt(this.x, this.y - eps);
    let cDown   = comfortAt(this.x, this.y + eps);

    // Approximate gradient (direction of increasing comfort)
    let gradX = (cRight - cLeft) / (2 * eps);
    let gradY = (cDown - cUp) / (2 * eps);

    this.perceivedGradient = createVector(gradX, gradY);
    this.localComfort = cCenter;
  }

  decide() {
    // If gradient is almost flat, wander a bit
    let g = this.perceivedGradient.copy();
    if (g.mag() < 0.0005) {
      g = createVector(random(-0.5, 0.5), random(-0.5, 0.5));
    }
    g.normalize();

    // Blend current velocity with gradient direction
    this.vel.mult(0.75);
    g.mult(0.25);
    this.vel.add(g);

    // Limit speed
    let maxSpeed = 2.0;
    if (this.vel.mag() > maxSpeed) {
      this.vel.normalize().mult(maxSpeed);
    }
  }

  act() {
    // Move
    this.x += this.vel.x;
    this.y += this.vel.y;

    // Add to trail
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 80) this.trail.shift();

    // If off-screen or stuck in low-comfort area, respawn
    if (
      this.x < -40 || this.x > width + 40 ||
      this.y < -40 || this.y > height + 40 ||
      this.localComfort < 0.18
    ) {
      this.respawn();
      return;
    }

    // Draw trail
    noFill();
    stroke(45, 40, 20, 40);
    strokeWeight(2);
    beginShape();
    for (let t of this.trail) {
      vertex(t.x, t.y);
    }
    endShape();

    // Draw cyclist
    noStroke();
    fill(45, 90, 100);
    ellipse(this.x, this.y, 10, 10);

    // halo
    noFill();
    stroke(0, 0, 100, 80);
    strokeWeight(1);
    ellipse(this.x, this.y, 16, 16);
  }
}

// -------------------------------------------------------
function comfortAt(x, y) {
  if (x < 0 || x >= width || y < 0 || y >= height) return 0;
  let i = floor(x / cellW);
  let j = floor(y / cellH);
  i = constrain(i, 0, cols - 1);
  j = constrain(j, 0, rows - 1);
  return comfortMap[i][j];
}

// =======================================================
// UI + controls
// =======================================================
function keyPressed() {
  if (key === '1') weather = "sunny";
  if (key === '2') weather = "rain";
  if (key === '3') weather = "heat";
}

function drawUI() {
  // legend panel
  let boxW = 280;
  let boxH = 150;
  noStroke();
  fill(0, 0, 0, 45);
  rect(16, 16, boxW, boxH, 12);

  fill(0, 0, 100);
  textAlign(LEFT, TOP);
  textSize(14);
  text("CICLA Bike Comfort Map", 26, 22);

  textSize(11);
  let y = 44;
  text("Color (generative agent):", 26, y);
  y += 14;

  // gradient bar: red → blue (uncomfortable → comfortable)
  let barX = 26;
  let barY = y;
  let barW = 180;
  let barH = 10;

  for (let x = 0; x < barW; x++) {
    let t = x / (barW - 1);
    let h = map(t, 0, 1, 0, 210);
    stroke(h, 70, 90);
    line(barX + x, barY, barX + x, barY + barH);
  }
  noStroke();
  fill(0, 0, 100);
  textSize(10);
  text("Uncomfortable", barX, barY + barH + 10);
  text("Comfortable", barX + barW - 70, barY + barH + 10);

  y += 38;
  text("Yellow dots: cyclists (reactive agents)\n" +
       "  move toward more comfortable areas.\n" +
       "White pins: eco-pod stations.", 26, y);

  y += 44;
  let modeIcon = weather === "sunny" ? "☀️"
                  : weather === "rain" ? "🌧"
                  : "🔥";
  text("Weather mode: " + modeIcon + " " + weather, 26, y);

  y += 18;
  text("Keys: 1 = sunny   2 = rain   3 = heatwave", 26, y);
}
