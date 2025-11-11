// =======================================================
// CICLA generative + reactive agents (V2)
// -------------------------------------------------------
// Generative agent (MapAgent):
//   - builds an internal comfortMap from
//       • bike corridors
//       • eco-pods
//       • weather mode
//   - draws animated, colourful corridors.
//
// Reactive agents (ReactiveCyclist):
//   - smooth-moving "cyclists" (yellow dots)
//   - only see local comfort values
//   - follow higher comfort; respawn if stuck.
//
// Keys:
//   1 = sunny   2 = rain (pods more attractive)
//   3 = heat    (bottom / "flatter" area nicer)
// =======================================================

let cols = 40;
let rows = 60;
let cellW, cellH;

let comfortMap = [];
let mapAgent;
let cyclists = [];

let weather = "sunny";
let ecoPods = [];
let corridors = [];

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

  // eco-pod stations (grid coordinates)
  ecoPods = [
    { i: 10, j: 18 },
    { i: 22, j: 22 },
    { i: 30, j: 12 },
    { i: 18, j: 38 }
  ];

  // colourful corridors inspired by your reference image
  corridors = [
    // vertical magenta–orange
    {
      x1: width * 0.36, y1: -100,
      x2: width * 0.36, y2: height + 100,
      baseHue: 340, width: 38, phase: 0.0
    },
    // horizontal blue–cyan
    {
      x1: -100, y1: height * 0.35,
      x2: width + 100, y2: height * 0.35,
      baseHue: 200, width: 32, phase: 1.3
    },
    // diagonal orange band
    {
      x1: width * 0.05, y1: height * 0.3,
      x2: width * 0.95, y2: height * 0.85,
      baseHue: 35, width: 36, phase: 2.1
    },
    // diagonal purple band
    {
      x1: width * 0.1, y1: height * 0.8,
      x2: width * 0.85, y2: height * 0.2,
      baseHue: 285, width: 34, phase: 3.7
    },
    // diagonal green band
    {
      x1: width * 0.25, y1: -80,
      x2: width * 0.9, y2: height * 0.45,
      baseHue: 120, width: 34, phase: 4.6
    }
  ];

  mapAgent = new MapAgent();

  // create several cyclists
  for (let k = 0; k < 6; k++) {
    cyclists.push(new ReactiveCyclist());
  }
}

function draw() {
  background(15, 5, 96); // soft paper-ish bg

  // GENERATIVE: update comfort + draw corridors
  mapAgent.perceive();
  mapAgent.decide();
  mapAgent.act();

  // overlay eco-pods
  drawEcoPods();

  // REACTIVE: move cyclists
  for (let c of cyclists) {
    c.perceive();
    c.decide();
    c.act();
  }

  drawUI();
}

// =======================================================
// GENERATIVE AGENT
// =======================================================
class MapAgent {
  constructor() {
    this.mode = "normal";
  }

  perceive() {
    this.perception = { weather: weather };
  }

  decide() {
    if (this.perception.weather === "rain") {
      this.mode = "seekShelter";
    } else if (this.perception.weather === "heat") {
      this.mode = "avoidHills";
    } else {
      this.mode = "normal";
    }
  }

  act() {
    // 1) compute comfort map
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        let x = (i + 0.5) * cellW;
        let y = (j + 0.5) * cellH;

        // city "texture"
        let base = noise(i * 0.12, j * 0.12, frameCount * 0.01);

        // distance to nearest corridor
        let minCorrDist = 999;
        for (let c of corridors) {
          let d = pointToSegmentDist(x, y, c.x1, c.y1, c.x2, c.y2);
          if (d < minCorrDist) minCorrDist = d;
        }
        let corridorScore = map(minCorrDist, 0, 120, 1, 0);
        corridorScore = constrain(corridorScore, 0, 1);

        // distance to nearest eco-pod
        let minPodDist = 999;
        for (let p of ecoPods) {
          let px = (p.i + 0.5) * cellW;
          let py = (p.j + 0.5) * cellH;
          let d = dist(x, y, px, py);
          if (d < minPodDist) minPodDist = d;
        }
        let podScore = map(minPodDist, 0, 180, 1, 0);
        podScore = constrain(podScore, 0, 1);

        // pretend top = hillier, bottom = flatter
        let hillScore = map(j, 0, rows - 1, 0, 1); // bottom nicer

        let comfort;
        if (this.mode === "normal") {
          comfort = 0.3 * base + 0.5 * corridorScore + 0.2 * podScore;
        } else if (this.mode === "seekShelter") {
          comfort = 0.25 * base + 0.35 * corridorScore + 0.4 * podScore;
        } else { // avoidHills
          comfort = 0.25 * base + 0.4 * corridorScore + 0.35 * hillScore;
        }

        comfortMap[i][j] = constrain(comfort, 0, 1);
      }
    }

    // 2) draw animated corridors (pretty layer)
    drawCorridors();
  }
}

// colourful, animated bands
function drawCorridors() {
  noFill();
  for (let c of corridors) {
    let steps = 90;
    strokeWeight(c.width);

    for (let s = 0; s < steps; s++) {
      let t1 = s / steps;
      let t2 = (s + 1) / steps;

      let x1 = lerp(c.x1, c.x2, t1);
      let y1 = lerp(c.y1, c.y2, t1);
      let x2 = lerp(c.x1, c.x2, t2);
      let y2 = lerp(c.y1, c.y2, t2);

      let phase = frameCount * 0.04 + t1 * 4 + c.phase;
      let hueShift = 45 * sin(phase);
      let h = (c.baseHue + hueShift + 360) % 360;
      let sat = 75;
      let bri = 90;

      stroke(h, sat, bri, 85);
      line(x1, y1, x2, y2);
    }
  }
}

function drawEcoPods() {
  for (let p of ecoPods) {
    let x = (p.i + 0.5) * cellW;
    let y = (p.j + 0.5) * cellH;

    // outer white circle
    noStroke();
    fill(0, 0, 100, 95);
    ellipse(x, y, 24, 24);

    // green ring
    noFill();
    stroke(130, 80, 80, 100);
    strokeWeight(3);
    ellipse(x, y, 22, 22);

    // centre dot
    noStroke();
    fill(130, 80, 90, 100);
    ellipse(x, y, 8, 8);
  }
}

// =======================================================
// REACTIVE AGENT – smooth cyclists
// =======================================================
class ReactiveCyclist {
  constructor() {
    this.trail = [];
    this.respawn();
  }

  respawn() {
    // start somewhere along a random corridor
    let c = random(corridors);
    let t = random(0.1, 0.9);
    this.x = lerp(c.x1, c.x2, t);
    this.y = lerp(c.y1, c.y2, t);
    this.trail = [];
  }

  perceive() {
    // sample comfort in 8 directions around current position
    let dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
      { dx: 0.7, dy: 0.7 },
      { dx: -0.7, dy: 0.7 },
      { dx: 0.7, dy: -0.7 },
      { dx: -0.7, dy: -0.7 }
    ];

    let senseStep = 20;
    this.options = [];

    for (let d of dirs) {
      let sx = this.x + d.dx * senseStep;
      let sy = this.y + d.dy * senseStep;
      let c = comfortAt(sx, sy);
      this.options.push({ dx: d.dx, dy: d.dy, comfort: c });
    }
  }

  decide() {
    if (this.options.length === 0) return;

    // prefer higher comfort, but with some exploration
    this.options.sort((a, b) => b.comfort - a.comfort);

    let chosen;
    if (random() < 0.8) {
      chosen = this.options[0];
    } else {
      chosen = random(this.options);
    }
    this.chosenDir = chosen;
  }

  act() {
    if (!this.chosenDir) return;

    // move
    let speed = 3.5;
    this.x += this.chosenDir.dx * speed;
    this.y += this.chosenDir.dy * speed;

    // add trail point
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 90) this.trail.shift();

    // if off-screen or in very low comfort, respawn
    let cHere = comfortAt(this.x, this.y);
    if (
      this.x < -40 || this.x > width + 40 ||
      this.y < -40 || this.y > height + 40 ||
      cHere < 0.15
    ) {
      this.respawn();
      return;
    }

    // draw trail
    noFill();
    stroke(45, 80, 30, 35);
    strokeWeight(2);
    beginShape();
    for (let t of this.trail) {
      vertex(t.x, t.y);
    }
    endShape();

    // draw cyclist dot
    noStroke();
    fill(45, 90, 100);
    ellipse(this.x, this.y, 12, 12);

    // subtle white halo
    noFill();
    stroke(0, 0, 100, 80);
    strokeWeight(1);
    ellipse(this.x, this.y, 18, 18);
  }
}

// =======================================================
// Utils + UI
// =======================================================

function comfortAt(x, y) {
  if (x < 0 || x > width || y < 0 || y > height) return 0;
  let i = floor(x / cellW);
  let j = floor(y / cellH);
  i = constrain(i, 0, cols - 1);
  j = constrain(j, 0, rows - 1);
  return comfortMap[i][j];
}

// distance from point to segment
function pointToSegmentDist(px, py, x1, y1, x2, y2) {
  let vx = x2 - x1;
  let vy = y2 - y1;
  let wx = px - x1;
  let wy = py - y1;

  let c1 = vx * wx + vy * wy;
  if (c1 <= 0) return dist(px, py, x1, y1);

  let c2 = vx * vx + vy * vy;
  if (c2 <= c1) return dist(px, py, x2, y2);

  let b = c1 / c2;
  let bx = x1 + b * vx;
  let by = y1 + b * vy;

  return dist(px, py, bx, by);
}

function keyPressed() {
  if (key === '1') weather = "sunny";
  if (key === '2') weather = "rain";
  if (key === '3') weather = "heat";
}

function drawUI() {
  let boxW = 260;
  let boxH = 125;

  noStroke();
  fill(0, 0, 0, 45);
  rect(16, 16, boxW, boxH, 10);

  fill(0, 0, 100);
  textAlign(LEFT, TOP);
  textSize(14);
  text("CICLA agents demo", 26, 22);

  textSize(11);
  let y = 42;
  text("Background: generative bike comfort map\n" +
       "  (corridors + eco-pods + weather)", 26, y);

  y += 34;
  text("Yellow dots: reactive cyclists\n" +
       "  following higher comfort.", 26, y);

  y += 30;
  text("White circles: eco-pod stations", 26, y);

  y += 20;
  text("Keys: 1 = sunny   2 = rain   3 = heat", 26, y);
}
