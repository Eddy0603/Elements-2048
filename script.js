document.addEventListener("DOMContentLoaded", function () {
  // Wait till the browser is ready to render the game (avoids glitches)
  window.requestAnimationFrame(function () {
    var manager = new GameManager(5, KeyboardInputManager, HTMLActuator);
  });
});

function GameManager(size, InputManager, Actuator) {
  this.size         = size; // Size of the grid
  this.inputManager = new InputManager;
  this.actuator     = new Actuator;

  this.startTiles   = 1;

  this.inputManager.on("move", this.move.bind(this));
  this.inputManager.on("restart", this.restart.bind(this));

  this.setup();
}

// Restart the game
GameManager.prototype.restart = function () {
  this.actuator.restart();
  this.setup();
};

// Set up the game
GameManager.prototype.setup = function () {
  this.grid         = new Grid(this.size);

  this.score        = 0;
  this.over         = false;
  this.won          = false;

  // Add the initial tiles
  this.addStartTiles();

  // Update the actuator
  this.actuate();

  // Play Kahoot music
  var audio = new Audio('src/kahootMusic.mp3');
  audio.loop = true;
  audio.play();
};

// Set up the initial tiles to start the game with
GameManager.prototype.addStartTiles = function () {
  for (var i = 0; i < this.startTiles; i++) {
    if (this.grid.cellsAvailable()) {
    var value = 1;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    this.grid.insertTile(tile);
    }
  }
};

// Adds a tile in a random position
GameManager.prototype.addRandomTile = function () {
  if (this.grid.cellsAvailable()) {
    var value = Math.random() < 0.9 ? 1 : 2;
    var tile = new Tile(this.grid.randomAvailableCell(), value);

    compareSize(value);

    this.grid.insertTile(tile);
  }
};

// Sends the updated grid to the actuator
GameManager.prototype.actuate = function () {
  this.actuator.actuate(this.grid, {
    score: this.score,
    over:  this.over,
    won:   this.won
  });
};

// Save all tile positions and remove merger info
GameManager.prototype.prepareTiles = function () {
  this.grid.eachCell(function (x, y, tile) {
    if (tile) {
      tile.mergedFrom = null;
      tile.savePosition();
    }
  });
};

// Move a tile and its representation
GameManager.prototype.moveTile = function (tile, cell) {
  this.grid.cells[tile.x][tile.y] = null;
  this.grid.cells[cell.x][cell.y] = tile;
  tile.updatePosition(cell);
};

// Move tiles on the grid in the specified direction
GameManager.prototype.move = function (direction) {
  // 0: up, 1: right, 2: down, 3: left
  var self = this;

  if (this.over || this.won || asking) return; // Don't do anything if the game's over

  var cell, tile;

  var vector     = this.getVector(direction);
  var traversals = this.buildTraversals(vector);
  var moved      = false;

  // Save the current tile positions and remove merger information
  this.prepareTiles();

  // Traverse the grid in the right direction and move tiles
  traversals.x.forEach(function (x) {
    traversals.y.forEach(function (y) {
      cell = { x: x, y: y };
      tile = self.grid.cellContent(cell);

      if (tile) {
        var positions = self.findFarthestPosition(cell, vector);
        var next      = self.grid.cellContent(positions.next);

        // Only one merger per row traversal?
        if (next && next.value === tile.value && !next.mergedFrom) {
          var merged = new Tile(positions.next, tile.value + 1);
          compareSize(tile.value + 1);
          merged.mergedFrom = [tile, next];

          self.grid.insertTile(merged);
          self.grid.removeTile(tile);

          // Converge the two tiles' positions
          tile.updatePosition(positions.next);

          // Update the score
          self.score += merged.value;

          // The mighty Calcium tile
          if (merged.value === 20) self.won = true;
        } else {
          self.moveTile(tile, positions.farthest);
        }

        if (!self.positionsEqual(cell, tile)) {
          moved = true; // The tile moved from its original cell!
        }
      }
    });
  });

  if (moved) {
    setTimeout(this.addRandomTile(), 100);

    if (!this.movesAvailable()) {
      this.over = true; // Game over!
    }

    this.actuate();
  }
};

// Get the vector representing the chosen direction
GameManager.prototype.getVector = function (direction) {
  // Vectors representing tile movement
  var map = {
    0: { x: 0,  y: -1 }, // up
    1: { x: 1,  y: 0 },  // right
    2: { x: 0,  y: 1 },  // down
    3: { x: -1, y: 0 }   // left
  };

  return map[direction];
};

// Build a list of positions to traverse in the right order
GameManager.prototype.buildTraversals = function (vector) {
  var traversals = { x: [], y: [] };

  for (var pos = 0; pos < this.size; pos++) {
    traversals.x.push(pos);
    traversals.y.push(pos);
  }

  // Always traverse from the farthest cell in the chosen direction
  if (vector.x === 1) traversals.x = traversals.x.reverse();
  if (vector.y === 1) traversals.y = traversals.y.reverse();

  return traversals;
};

GameManager.prototype.findFarthestPosition = function (cell, vector) {
  var previous;

  // Progress towards the vector direction until an obstacle is found
  do {
    previous = cell;
    cell     = { x: previous.x + vector.x, y: previous.y + vector.y };
  } while (this.grid.withinBounds(cell) &&
           this.grid.cellAvailable(cell));

  return {
    farthest: previous,
    next: cell // Used to check if a merge is required
  };
};

GameManager.prototype.movesAvailable = function () {
  return this.grid.cellsAvailable() || this.tileMatchesAvailable();
};

// Check for available matches between tiles (more expensive check)
GameManager.prototype.tileMatchesAvailable = function () {
  var self = this;

  var tile;

  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      tile = this.grid.cellContent({ x: x, y: y });

      if (tile) {
        for (var direction = 0; direction < 4; direction++) {
          var vector = self.getVector(direction);
          var cell   = { x: x + vector.x, y: y + vector.y };

          var other  = self.grid.cellContent(cell);
          if (other) {
          }

          if (other && other.value === tile.value) {
            return true; // These two tiles can be merged
          }
        }
      }
    }
  }

  return false;
};

var heavyElement = 1;

var asking = false;

let questions = [
  {
    prompt: "",
    answer: ""
  },
  { // Hydrogen Q1
    prompt: "What state is Hydrogen in RTP?\n(a) Solid\n(b) Liquid\n(c) Gas",
    answer: "c"
  },
  { // Hydrogen Q2
    prompt: "Which of these compounds contain Hydrogen?\n(a) Water\n(b) Thermite\n(c) Calcium Carbonate",
    answer: "a"
  },
  { // Hydrogen Q3
    prompt: "What is a use of Pure Hydrogen Gas?\n(a) Fuel\n(b) Building Materials\n(c) Swimming Pool Liquid",
    answer: "a"
  },
  { // Helium Q1
    prompt: "What colour is Helium Gas?\n(a) Blue\n(b) Green\n(c) Colourless",
    answer: "c"
  },
  { // Helium Q2
    prompt: "What rank is the abundance of Helium in the universe?\n(a) 1st\n(b) 2nd\n(c) 3rd",
    answer: "b"
  },
  { // Helium Q3
    prompt: "Is Helium Toxic?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Lithium Q1
    prompt: "What colour is Lithium?\n(a) Silvery Grey\n(b) White\n(c) Colourless",
    answer: "a"
  },
  { // Lithium Q2
    prompt: "Is Lithium usually found in its pure metal form?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Lithium Q3
    prompt: "When was Lithium discovered?\n(a) 1812\n(b) 1816\n(c) 1819",
    answer: "c"
  },
  { // Beryllium Q1
    prompt: "What colour is Beryllium?\n(a) Silvery Grey\n(b) Silvery White\n(c) Dark Black",
    answer: "b"
  },
  { // Beryllium Q2
    prompt: "Is Beryllium denser than Lithium?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Beryllium Q3
    prompt: "How is Beryllium usually prepared?\n" +
    "(a) Reducing Beryllium Fluoride with Magnesium\n" +
    "(b) Mined as an ore, then melting\n" +
    "(c) Sifted from soil",
    answer: "a"
  },
  { // Boron Q1
    prompt: "How does Boron powder look like?\n(a) Light Coloured\n(b) Dark Coloured\n(c) Crystal like and Colourless",
    answer: "b"
  },
  { // Boron Q2
    prompt: "Boron is formed as an acid in which of these places?\n(a) A Volcano\n(b) A river\n(c) A pond",
    answer: "a"
  },
  { // Boron Q3
    prompt: "What group is Boron in?\n(a) 1\n(b) 2\n(c) 3",
    answer: "c"
  },
  { // Carbon Q1
    prompt: "What is the melting point of Carbon?\n(a) 3000ºC\n(b) 4000ºC\n(c) It sublimes before melting",
    answer: "c"
  },
  { // Carbon Q2
    prompt: "At what temperature will Carbon sublime?\n(a) 3225ºC\n(b) 3825ºC\n(c) 3885ºC",
    answer: "b"
  },
  { // Carbon Q3
    prompt: "In which of these objects will you find Carbon?\n(a) Stars with at least 0.4 Solar Masses\n(b) Red Drawfs\n(c) Limestone",
    answer: "a"
  },
  { // Nitrogen Q1
    prompt: "What colour is Nitrogen Gas?\n(a) Green\n(b) Grey\n(c) Colourless",
    answer: "c"
  },
  { // Nitrogen Q2
    prompt: "What percentage of air is Nitrogen?\n(a) 70%\n(b) 75%\n(c) 78%",
    answer: "c"
  },
  { // Nitrogen Q3
    prompt: "Is Nitrogen found in living organisms?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Oxygen Q1
    prompt: "Is Oxygen radioactive?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Oxygen Q2
    prompt: "What colour is Oxygen Gas?\n(a) Green\n(b) Grey\n(c) Colourless",
    answer: "c"
  },
  { // Oxygen Q3
    prompt: "How are most of the Oxygen produced in Nature?\n(a) Photosynthesis\n(b) Volcanic Eruptions\c(c) Rainfall",
    answer: "a"
  },
  { // Fluorine Q1
    prompt: "How abundant is Fluorine in the Earth's crust?\n(a) 5th most common\n(b) 11th most common\n(c) 13th most common",
    answer: "c"
  },
  { // Fluorine Q2
    prompt: "Chemicals with Fluorine in them are usually classified as:\n(a) Fluorine-Based\n(b) Fluorochemical\n(c) Fluoride",
    answer: "b"
  },
  { // Fluorine Q3
    prompt: "What period is Fluorine in?\n(a) 1\n(b) 2\n(c) 3",
    answer: "b"
  },
  { // Neon Q1
    prompt: "What is the atomic number of Neon?\n(a) 2\n(b) 10\n(c) 18",
    answer: "b"
  },
  { // Neon Q2
    prompt: "Is Neon reactive?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Neon Q3
    prompt: "Is Neon used in both cryogenic refridgerant and Neon Lights?\n(a) Yes\n (b) No",
    answer: "a"
  },
  { // Sodium Q1
    prompt: "Does Sodium Carbonate harden or soften Water?\n(a) Harden\n(b) Soften",
    answer: "b"
  },
  { // Sodium Q2
    prompt: "Is Sodium radioactive?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Sodium Q3
    prompt: "Is Sodium\n(a) Soft\n(b) Hard",
    answer: "a"
  },
  { // Magnesium Q1
    prompt: "Which of the following is not a use of Magnesium?\n(a) Fireworks\n(b) Cutlery\n(c) Laptops\n(d) Car construction",
    answer: "b"
  },
  { // Magnesium Q2
    prompt: "What colour is Magnesium?\n(a) Silvery White\n(b) Silvery Grey\n(c) Black",
    answer: "a"
  },
  { // Magnesium Q3
    prompt: "Is Magnesium toxic?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Aluminium Q1
    prompt: "What is the rank of abundance in the Earth’s crust of Aluminium?\n(a) First\n(b) Second\n(c) Not abundant",
    answer: "a"
  },
  { // Aluminium Q2
    prompt: "What does 'alumen' mean?\n(a) Bitter salt\n(b) Sour\n(c) Sugary sweet",
    answer: "a"
  },
  { // Aluminium Q3
    prompt: "Is Aluminium malleable?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Silicon Q1
    prompt: "Does Silicon have any allotropes?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Silicon Q2
    prompt: "What colour is Silicon?\n(a) Silvery Grey\n(b) Aqua Green\n(c) Blue Grey",
    answer: "c"
  },
  { // Silicon Q3
    prompt: "What period is Silicon?\n(a) 1\n(b) 2\n(c) 3",
    answer: "c"
  },
  { // Phosphorus Q1
    prompt: "What does Phosphorus smell like?\n(a) Lemon\n(b) Mint\n(c) Garlic",
    answer: "c"
  },
  { // Phosphorus Q2
    prompt: "What is the Melting Point of Phosphorus?\n(a) 44ºC\n(b) 64ºC\n(c) 84ºC",
    answer: "a"
  },
  { // Phosphorus Q3
    prompt: "What is the smell of Phosphorus?\n(a) Garlic\n(b) Lemon\n(c) Ginger",
    answer: "a"
  },
  { // Sulphur Q1
    prompt: "What is the appearance of Sulphur at room temperature?\n(a) Orange Gas\n(b) Yellow powder\n(c) Red Liquid",
    answer: "b"
  },
  { // Sulphur Q2
    prompt: "What is the Electron Configuration of Sulphur?\n(a) 2, 8, 4\n(b) 2, 8, 5\n(c) 2, 8, 6",
    answer: "c"
  },
  { // Sulphur Q3
    prompt: "Which is the densest of all of the following Elements?\n(a) Hydrogen\n(b) Helium\n(c) Aluminium\n(d) Sulphur",
    answer: "c"
  },
  { // Chlorine Q1
    prompt: "Which type of these Chlorine products are still used?\n(a) Chemical Weapons\n(b) Disinfectant\n(c) Anaesthetic",
    answer: "b"
  },
  { // Chlorine Q2
    prompt: "Does Chlorine have any allotropes?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Chlorine Q3
    prompt: "Is Chlorine Gas Toxic?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Argon Q1
    prompt: "Is Argon reactive?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Argon Q2
    prompt: "How does Argon smell like?\n(a) Garlic\n(b) Lemon\n(c) Odourless",
    answer: "c"
  },
  { // Argon Q3
    prompt: "Is Argon radioactive?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Potassium Q1
    prompt: "Is Potassium found in your body?\n(a) Yes\n(b) No",
    answer: "a"
  },
  { // Potassium Q2
    prompt: "Is Potassium\n(a) Soft\n(b) Hard",
    answer: "a"
  },
  { // Potassium Q3
    prompt: "Is Potassium toxic?\n(a) Yes\n(b) No",
    answer: "b"
  },
  { // Calcium Q1
    prompt: "Where could you find Calcium?\n(a) Bones\n(b) Glass\n(c) Sand",
    answer: "a"
  },
  { // Calcium Q2
    prompt: "How many Electron Shells are in Calcium?\n(a) 1\n(b) 2\n(c) 3\n(d) 4",
    answer: "d"
  },
  { // Calcium Q3
    prompt: "What colour is Calcium?\n(a) Silvery Grey\n(b) Silvery White\n(c) Dark Black",
    answer: "b"
  }
];

var myTimeout;

GameManager.prototype.positionsEqual = function (first, second) {
  return first.x === second.x && first.y === second.y;
};

function searchVendor() {
  clearTimeout(myTimeout);
}

function skipTimer() {
  searchVendor();
}

function askQuestion(atomicNum, questionNum) {
  var response = window.prompt(questions[atomicNum * 3 + questionNum - 3].prompt);
  if(response == questions[atomicNum * 3 + questionNum - 3].answer) {
    alert("Correct!");
  } else {
    alert("Incorrect!");
    location.reload();
  }
  asking = false;
}

function introduceElement(atomicNum) {
  var audio = new Audio('src/ding.mp3');
  audio.play();
  var questionNum = Math.floor(Math.random() * 3 + 1);
  asking = true;

  questionNum = Math.floor(Math.random() * 3 + 1);
  switch(atomicNum) {
    case 1:
      break;
    case 2:
      window.open('ele02Index.html', '_blank');
      break;
    case 3:
      window.open('ele03Index.html', '_blank');
      break;
    case 4:
      window.open('ele04Index.html', '_blank');
      break;
    case 5:
      window.open('ele05Index.html', '_blank');
      break;
    case 6:
      window.open('ele06Index.html', '_blank');
      break;
    case 7:
      window.open('ele07Index.html', '_blank');
      break;
    case 8:
      window.open('ele08Index.html', '_blank');
      break;
    case 9:
      window.open('ele09Index.html', '_blank');
      break;
    case 10:
      window.open('ele10Index.html', '_blank');
      break;
    case 11:
      window.open('ele11Index.html', '_blank');
      break;
    case 12:
      window.open('ele12Index.html', '_blank');
      break;
    case 13:
      window.open('ele13Index.html', '_blank');
      break;
    case 14:
      window.open('ele14Index.html', '_blank');
      break;
    case 15:
      window.open('ele15Index.html', '_blank');
      break;
    case 16:
      window.open('ele16Index.html', '_blank');
      break;
    case 17:
      window.open('ele17Index.html', '_blank');
      break;
    case 18:
      window.open('ele18Index.html', '_blank');
      break;
    case 19:
      window.open('ele19Index.html', '_blank');
      break;
    case 20:
      window.open('ele20Index.html', '_blank');
      break;
  }
  myTimeout = setTimeout(() => askQuestion(atomicNum, questionNum), 5000);
}

function compareSize(atomicNum) {
  if (atomicNum > heavyElement) {
    heavyElement = atomicNum;
    introduceElement(atomicNum);
  }
}

function findElement(atomicNum) { // changing number into symbol
  switch(atomicNum) {
    case 1:
      return "H";
      break;
    case 2:
      return "He";
      break;
    case 3:
      return "Li";
      break;
    case 4:
      return "Be";
      break;
    case 5:
      return "B";
      break;
    case 6:
      return "C";
      break;
    case 7:
      return "N";
      break;
    case 8:
      return "O";
      break;
    case 9:
      return "F";
      break;
    case 10:
      return "Ne";
      break;
    case 11:
      return "Na";
      break;
    case 12:
      return "Mg";
      break;
    case 13:
      return "Al";
      break;
    case 14:
      return "Si";
      break;
    case 15:
      return "P";
      break;
    case 16:
      return "S";
      break;
    case 17:
      return "Cl";
      break;
    case 18:
      return "Ar";
      break;
    case 19:
      return "K";
      break;
    case 20:
      return "Ca";
      break;
  }
}

function Grid(size) {
  this.size = size;

  this.cells = [];

  this.build();
}

// Build a grid of the specified size
Grid.prototype.build = function () {
  for (var x = 0; x < this.size; x++) {
    var row = this.cells[x] = [];

    for (var y = 0; y < this.size; y++) {
      row.push(null);
    }
  }
};

// Find the first available random position
Grid.prototype.randomAvailableCell = function () {
  var cells = this.availableCells();

  if (cells.length) {
    return cells[Math.floor(Math.random() * cells.length)];
  }
};

Grid.prototype.availableCells = function () {
  var cells = [];

  this.eachCell(function (x, y, tile) {
    if (!tile) {
      cells.push({ x: x, y: y });
    }
  });

  return cells;
};

// Call callback for every cell
Grid.prototype.eachCell = function (callback) {
  for (var x = 0; x < this.size; x++) {
    for (var y = 0; y < this.size; y++) {
      callback(x, y, this.cells[x][y]);
    }
  }
};

// Check if there are any cells available
Grid.prototype.cellsAvailable = function () {
  return !!this.availableCells().length;
};

// Check if the specified cell is taken
Grid.prototype.cellAvailable = function (cell) {
  return !this.cellOccupied(cell);
};

Grid.prototype.cellOccupied = function (cell) {
  return !!this.cellContent(cell);
};

Grid.prototype.cellContent = function (cell) {
  if (this.withinBounds(cell)) {
    return this.cells[cell.x][cell.y];
  } else {
    return null;
  }
};

// Inserts a tile at its position
Grid.prototype.insertTile = function (tile) {
  this.cells[tile.x][tile.y] = tile;
};

Grid.prototype.removeTile = function (tile) {
  this.cells[tile.x][tile.y] = null;
};

Grid.prototype.withinBounds = function (position) {
  return position.x >= 0 && position.x < this.size &&
         position.y >= 0 && position.y < this.size;
};


function HTMLActuator() {
  this.tileContainer    = document.getElementsByClassName("tile-container")[0];
  this.scoreContainer   = document.getElementsByClassName("score-container")[0];
  this.messageContainer = document.getElementsByClassName("game-message")[0];

  this.score = 0;
}

HTMLActuator.prototype.actuate = function (grid, metadata) {
  var self = this;

  window.requestAnimationFrame(function () {
    self.clearContainer(self.tileContainer);

    grid.cells.forEach(function (column) {
      column.forEach(function (cell) {
        if (cell) {
          self.addTile(cell);
        }
      });
    });

    self.updateScore(metadata.score);

    if (metadata.over) self.message(false); // You lose
    if (metadata.won) self.message(true); // You win!
  });
};

HTMLActuator.prototype.restart = function () {
  this.clearMessage();
};

HTMLActuator.prototype.clearContainer = function (container) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
};

HTMLActuator.prototype.addTile = function (tile) {
  var self = this;

  var element   = document.createElement("div");
  var position  = tile.previousPosition || { x: tile.x, y: tile.y };
  positionClass = this.positionClass(position);

  // We can't use classlist because it somehow glitches when replacing classes
  var classes = ["tile", "tile-" + tile.value, positionClass];
  this.applyClasses(element, classes);

  element.textContent = findElement(tile.value);

  if (tile.previousPosition) {
    // Make sure that the tile gets rendered in the previous position first
    window.requestAnimationFrame(function () {
      classes[2] = self.positionClass({ x: tile.x, y: tile.y });
      self.applyClasses(element, classes); // Update the position
    });
  } else if (tile.mergedFrom) {
    classes.push("tile-merged");
    this.applyClasses(element, classes);

    // Render the tiles that merged
    tile.mergedFrom.forEach(function (merged) {
      self.addTile(merged);
    });
  } else {
    classes.push("tile-new");
    this.applyClasses(element, classes);
  }

  // Put the tile on the board
  this.tileContainer.appendChild(element);
};

HTMLActuator.prototype.applyClasses = function (element, classes) {
  element.setAttribute("class", classes.join(" "));
};

HTMLActuator.prototype.normalizePosition = function (position) {
  return { x: position.x + 1, y: position.y + 1 };
};

HTMLActuator.prototype.positionClass = function (position) {
  position = this.normalizePosition(position);
  return "tile-position-" + position.x + "-" + position.y;
};

HTMLActuator.prototype.updateScore = function (score) {
  this.clearContainer(this.scoreContainer);

  var difference = score - this.score;
  this.score = score;

  this.scoreContainer.textContent = this.score;

  if (difference > 0) {
    var addition = document.createElement("div");
    addition.classList.add("score-addition");
    addition.textContent = "+" + difference;

    this.scoreContainer.appendChild(addition);
  }
};

HTMLActuator.prototype.message = function (won) {
  var type    = won ? "game-won" : "game-over";
  var message = won ? "You win!" : "Game over!"

  // if (ga) ga("send", "event", "game", "end", type, this.score);

  this.messageContainer.classList.add(type);
  this.messageContainer.getElementsByTagName("p")[0].textContent = message;
};

HTMLActuator.prototype.clearMessage = function () {
  this.messageContainer.classList.remove("game-won", "game-over");
};



function KeyboardInputManager() {
  this.events = {};

  this.listen();
}

KeyboardInputManager.prototype.on = function (event, callback) {
  if (!this.events[event]) {
    this.events[event] = [];
  }
  this.events[event].push(callback);
};

KeyboardInputManager.prototype.emit = function (event, data) {
  var callbacks = this.events[event];
  if (callbacks) {
    callbacks.forEach(function (callback) {
      callback(data);
    });
  }
};

KeyboardInputManager.prototype.listen = function () {
  var self = this;

  var map = {
    38: 0, // Up
    39: 1, // Right
    40: 2, // Down
    37: 3, // Left
    75: 0, // vim keybindings
    76: 1,
    74: 2,
    72: 3,
    87: 0, // wsad keybindings
    68: 1,
    83: 2, 
    65: 3
  };

  document.addEventListener("keydown", function (event) {
    var modifiers = event.altKey || event.ctrlKey || event.metaKey ||
                    event.shiftKey;
    var mapped    = map[event.which];

    if (!modifiers) {
      if (mapped !== undefined) {
        event.preventDefault();
        self.emit("move", mapped);
      }

      if (event.which === 32) self.restart.bind(self)(event);
    }
  });

  var retry = document.getElementsByClassName("retry-button")[0];
  retry.addEventListener("click", this.restart.bind(this));

  // Listen to swipe events
  var gestures = [Hammer.DIRECTION_UP, Hammer.DIRECTION_RIGHT,
                  Hammer.DIRECTION_DOWN, Hammer.DIRECTION_LEFT];

  var gameContainer = document.getElementsByClassName("game-container")[0];
  var handler       = Hammer(gameContainer, {
    drag_block_horizontal: true,
    drag_block_vertical: true
  });
  
  handler.on("swipe", function (event) {
    event.gesture.preventDefault();
    mapped = gestures.indexOf(event.gesture.direction);

    if (mapped !== -1) self.emit("move", mapped);
  });
};

KeyboardInputManager.prototype.restart = function (event) {
  event.preventDefault();
  this.emit("restart");
};

function Tile(position, value) {
  this.x                = position.x;
  this.y                = position.y;
  this.value            = value || 2;

  this.previousPosition = null;
  this.mergedFrom       = null; // Tracks tiles that merged together
}

Tile.prototype.savePosition = function () {
  this.previousPosition = { x: this.x, y: this.y };
};

Tile.prototype.updatePosition = function (position) {
  this.x = position.x;
  this.y = position.y;
};