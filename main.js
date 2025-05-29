import * as constructors from "./constructors.js"
import { outOfBounds, drawBackground, mapPolygonCoords, deregisterClick } from "./helpers.js"

// let gc = {
//     canvas: null, context: null,
//     sounds: [], imagesLoaded: 0
// };
class GameContext {
    constructor() {
        this.canvas = document.querySelector("canvas");
        this.context = this.canvas.getContext("2d");
        this.sounds = [];
        this.fpsInterval = 1000 / 30; // the denominator is frames-per-second
        this.then = Date.now();
        this.bullet_sequence = [];
        this.projectiles = [];
        this.sounds = [];
        this.images = [];
        this.imagesLoaded = 0;
        this.lastDirection = "R";
        this.start_time = Date.now();
        this.moveLeft = false;
        this.moveRight = false;
        this.moveUp = false;
        this.moveDown = false;
        this.spaceDown = false;
        this.animationId;
        // add keyboard event listeners

    }
    init() {
        window.addEventListener("keydown", activateWrapper, false);
        window.addEventListener("keyup", deactivateWrapper, false);
        // set a stop button
        let button = document.querySelector("#stop");
        button.addEventListener("click", stopWrapper, false);
        let restartButton = document.querySelector("#restart");
        restartButton.addEventListener("click", restartGame, false);
        // set player start position
        this.player = new constructors.Tank(this);
        this.enemy = new constructors.EnemyTank(this);
        this.player.x = Math.round(this.canvas.width / 2);
        this.player.y = Math.round((this.canvas.height / 2) + (this.canvas.height / 4)) + 70;
        this.player.id = "player";

        this.enemy.x = Math.round(this.canvas.width / 2);
        this.enemy.y = Math.round((this.canvas.height / 2) - (this.canvas.height / 4));

        this.myAI = new constructors.AI(this.enemy, this.player, this.canvas, this.context);
        this.handleImageLoad = (e) => {
            e.target.removeEventListener('load', this.handleImageLoad);
            this.imagesLoaded += 1;
            if (this.imagesLoaded === this.images.length) {
                this.draw();
            }
        };
        this.handleImageError = (e) => {
            e.target.removeEventListener('error', this.handleImageError);
            console.log("Error loading the image: " + e.message);
        };
        this.loadImages();
    }
    loadImages() {
        const grassTile = new Image();
        grassTile.src = "./assets/myTiles/grass.png";
        this.images.push(grassTile);
        const marshTile = new Image();
        marshTile.src = "./assets/myTiles/marsh_tile.png";
        this.images.push(marshTile);
        let trees = ["tree1.png", "tree2.png", "tree3.png", "tree4.png"];
        for (let each of trees) {
            let im = new Image();
            im.src = "./assets/trees/" + each;
            this.images.push(im);

        }
        this.checkIfLoaded();

    }
    checkIfLoaded() {
        for (let each of this.images) {
            if (!each.complete) {
                each.addEventListener('load', this.handleImageLoad);
                each.addEventListener('error', this.handleImageError);
            }
            else{
                this.imagesLoaded += 1;
                if(this.imagesLoaded === this.images.length){
                    this.draw();
                }
            }
            
        }
    }
    stop() {
        window.cancelAnimationFrame(this.animationId);
        this.pauseSounds();

    }
    pauseSounds() {
        for (let tank of [this.player, this.enemy]) {
            // let highestVol = 0;
            for (let sound of tank.sounds) {
                sound.volume = 0;
            }
        }
    }
    playSounds() {
        for (let tank of [this.player, this.enemy]) {
            // let highestVol = 0;
            for (let sound of tank.sounds) {
                sound.volume = 0.5;
            }
        }
    }

    draw() {
        // MAIN PROGRAM LOOP
        this.animationId = window.requestAnimationFrame(drawWrapper);
        // ENSURE PROGRAMS DOES NOT RUN TOO FAST
        let now = Date.now();
        let elapsed = now - this.then;
        if (elapsed <= this.fpsInterval) {
            return;
        }
        this.then = now - (elapsed % this.fpsInterval);

        let program_time = Date.now() - this.start_time
        document.querySelector('#timer').innerHTML = Math.round(program_time / 1000);
        let canvas = this.canvas;
        let context = this.context;
        // draw background
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.beginPath();
        context.rect(0, 0, canvas.width, canvas.height)
        context.fillStyle = "#42f590";
        context.fill();
        context.closePath();

        let obstacles = drawBackground(context, this.images);

        let player = this.player;
        let enemy = this.enemy;
        player.checkBounds();
        enemy.checkBounds();


        // player.checkRotation();
        // enemy.checkRotation();

        if (this.moveLeft) {
            player.rotate(-2);
        }
        if (this.moveRight) {
            player.rotate(2);
        }

        if (this.moveUp || this.moveDown) {
            player.throttleSound();
            if (player.throttleLocked === false) {
                if (this.moveDown) {
                    player.driveBackward();
                    player.direction = "backward";
                }
                if (this.moveUp) {
                    player.driveForward();
                    player.direction = "forward"
                }
            }
        }
        if (!this.moveUp && !this.moveDown) {
            player.decelerate();
            player.engineIdle();

        }
        console.log(player.rotation);

        if (this.spaceDown) {
            player.fire();
        }
        // if(!spaceDown){
        //     // this.bullet_sequence.push(0);
        //     // this.bullet_sequence = this.bullet_sequence.slice(player.fireGap*-1,-1);
        // }

        // context.beginPath();

        this.myAI.handle();

        //DRAW THE PLAYER
        player.handleVectors();
        enemy.handleVectors();
        console.log("Player speed: " + player.speed);
        //move the player
        player.updateCoords();
        enemy.updateCoords();
        if (player.broadPhase(enemy)) {
            enemy.driveBackward();
        }
        //CHECK IF EITHER TANK HIT AN OBSTACLE (i.e. a tree)
        for (let obstacle of obstacles) {
            if (player.hitObstacle(obstacle)) {
                console.log("Player hit an obstacle!")
                player.driveBackward();
            }
            if (enemy.hitObstacle(obstacle)) {
                console.log("Enemy hit an obstacle!")
                enemy.driveBackward();
            }

        }

        player.draw();
        enemy.draw();

        //draw projectiles
        let garbage = [];
        for (let z = 0; z < this.projectiles.length; z++) {
            let p = this.projectiles[z];
            p.updateCoords();
            p.draw();
            // check if projectile has left canvas
            if (outOfBounds(p, canvas)) {
                garbage.push(z);
            }
            //check if bullet hits a tree
            for (let obstacle of obstacles) {
                if (p.hitObstacle(obstacle)) {
                    garbage.push(z);
                    if (p.tankID === "player") {
                        player.bulletStrike = true;
                    }
                    else if (p.tankID === "enemy") {
                        this.myAI.obstacleHit = true;
                    }
                    break;
                }
            }

            // check for vehicle strike
            if (p.tankID != "player" && player.isHit(p)) {
                player.health -= 10;
                garbage.push(z);

                continue;

            }
            if (p.tankID != "enemy" && enemy.isHit(p)) {
                enemy.health -= 10;
                enemy.hit = true;
                garbage.push(z);

                // player.bulletStrike = true;
                continue;
            }

        }
        // delete the projectiles once they leave the canvas
        for (let each of garbage) {
            this.projectiles.splice(each, 1);
        }
        if (player.health <= 0) {
            this.lose();
        }
        else if (enemy.health <= 0) {
            this.win();
        }

    }
    win() {
        this.context.fillStyle = "white";
        this.context.font = "100px Arial";
        this.context.fillText("You won!", this.canvas.width / 2 - 200, this.canvas.height / 2);
        this.stop();
    }
    lose() {
        this.context.fillStyle = "white";
        this.context.font = "100px Arial";
        this.context.fillText("You lost!", this.canvas.width / 2 - 200, this.canvas.height / 2);
        this.stop();
    }
    activate(event) {
        "use strict";
        let key = event.key;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight"
            || event.key === "ArrowUp" ||
            event.key === "ArrowDown" || event.key === " " || event.key == "c") {
            event.preventDefault();
        }

        if (key === "ArrowLeft") {
            this.moveLeft = true;
        }
        if (key === "ArrowUp") {
            this.moveUp = true;
        }
        if (key === "ArrowRight") {
            this.moveRight = true;
        }
        if (key === "ArrowDown") {
            this.moveDown = true;
        }
        if (key === " ") {
            this.spaceDown = true;
        }
        if (key === "p") {

            this.stop();
            this.unregisterKeyEvents();
            this.context.fillStyle = "gray";
            this.context.fillRect(this.canvas.width / 2 - 100, this.canvas.height / 2 - 100, 340, 55);
            this.context.fillStyle = "white";
            this.context.font = "50px Arial";
            this.context.fillText("Game Paused", this.canvas.width / 2 - 100, this.canvas.height / 2 - 60);
            let handlePlay = (e) => {
                if (e.key === "p") {
                    this.registerKeyEvents();
                    window.removeEventListener('keydown', handlePlay);
                    deregisterClick();
                    this.playSounds();
                    this.draw();
                }
            };
            let now = Date.now();
            let then = now + 1000;
            while (Date.now() < then) {

            }
            window.addEventListener('keydown', handlePlay);
            mapPolygonCoords();
            return;

        }
        let player = this.player;
        if (key === "d") {
            player.turretRotation += 2;
            console.log(player.turretRotation);
        }
        if (key === "a") {
            player.turretRotation -= 2;
            console.log(player.turretRotation);
        }
        if (key === "h") {
            player.health += 100
            if (player.health > 200) {
                player.health = 200;
            }
        }

        console.log(key);
        console.log(this.lastDirection);
    }
    deactivate(event) {
        let key = event.key;
        if (key === "ArrowLeft") {
            this.moveLeft = false

        }
        if (key === "ArrowUp") {
            this.moveUp = false
        }
        if (key === "ArrowRight") {
            this.moveRight = false
        }
        if (key === "ArrowDown") {
            this.moveDown = false
        }
        if (key === " ") {
            this.spaceDown = false;
        }

    }
    unregisterKeyEvents() {
        window.removeEventListener("keydown", activateWrapper, false);
        window.removeEventListener("keyup", deactivateWrapper, false);
    }
    registerKeyEvents() {
        window.addEventListener("keydown", activateWrapper, false);
        window.addEventListener("keyup", deactivateWrapper, false);
    }

}
let gc = new GameContext();
function drawWrapper(){
    gc.draw();
}
function activateWrapper(event){
    gc.activate(event);
}
function deactivateWrapper(event){
    gc.deactivate(event);
}
function stopWrapper(){
    gc.stop();
}
function loadGame(gc) {
    while (document.readyState === "loading") {

    }
    gc.init();
}

loadGame(gc);

function restartGame(){
    gc = null;
    gc = new GameContext();
    gc.init();
}
// document.addEventListener("DOMContentLoaded", gc.init, false);