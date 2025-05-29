import { randint } from "./helpers.js"

function getXHeading(angle) {
    // formula from https://math.stackexchange.com/questions/180874/convert-angle-radians-to-a-heading-vector
    return Math.sin((angle / 360) * 2 * Math.PI) * -1;
}
function getYHeading(angle) {
    // formula from https://math.stackexchange.com/questions/180874/convert-angle-radians-to-a-heading-vector
    return Math.cos((angle / 360) * 2 * Math.PI);
}
function getHeading(a, b) {
    // formula from https://stackoverflow.com/questions/6247153/angle-from-2d-unit-vector
    return Math.atan2(b, a);
}
function nearWall(object, canvas) {
    let magicNum = 50;
    let bounds = { t: magicNum, b: canvas.height - magicNum, l: magicNum, r: canvas.width - magicNum }
    let axis = "";
    if (object.y > bounds.b) {
        axis += "b";
    }
    if (object.y < bounds.t) {
        axis += "t";
    }
    if (object.x > bounds.r) {
        axis += "r";
    }
    if (object.x < bounds.l) {
        axis += "l";
    }


    if (axis === "") {
        return null;
    }
    return axis;
}


class Tank {
    constructor(gc) {
        this.id = "player";
        this.gc = gc;
        this.context = gc.context;
        this.canvas = gc.canvas;
        this.centre = {};
        this.bullet_sequence = [];
        this.projectiles = gc.projectiles;
        this.x; this.y;
        this.xChange = 0;
        this.yChange = 0;
        this.nx = 0;
        this.ny = 0;
        this.width = 67;
        this.height = 94;
        this.orientation = "left";
        this.rotation = 180;
        this.speed = 0;
        this.startSpeed = 4;
        this.turretRotation = 0;
        this.sounds = [];
        this.revSound = new Audio();
        this.revSound.src = "./assets/sounds/tank_rev.mp3";
        this.sounds.push(this.revSound);
        this.runningSound = new Audio();
        this.runningSound.src = "./assets/sounds/tank_running.mp3";
        this.sounds.push(this.runningSound);
        this.idleSound = new Audio();
        this.idleSound.src = "./assets/sounds/tank_idle.mp3";
        this.sounds.push(this.idleSound);
        this.fireSound = new Audio();
        this.fireSound.src = "./assets/sounds/tank_firing.mp3"
        this.sounds.push(this.fireSound);
        for(let sound of this.sounds){
            sound.volume = 0.5;
        }
        this.acceleration = 0.125;
        this.deceleration = -0.125;
        this.topSpeed = 5;
        this.fireGap = 5; //denominated in fps

        this.tankImage = new Image();
        this.turretImage = new Image();
        this.tankImage.src = "./assets/PanzerBase_cropped.png"; //67X94
        this.turretImage.src = "./assets/PanzerTower_cropped.png";
        this.health = 200;
        this.throttleLocked = false;
    }
    /**
     * @param {number} value
     */
    set rotation(value) {
        this._rotation = value;
        this._rotation = this._rotation < 0 ? this._rotation + 360 : this._rotation;
        this._rotation %= 360;
        return;
    }
    get rotation() {
        return this._rotation;
    }
    set turretRotation(value) {
        this._turretRotation = value;
        this._turretRotation %= 360;
        return;
    }
    get turretRotation() {
        return this._turretRotation;
    }
    getCentre() {
        this.centre.x = this.x + (this.width / 2);
        this.centre.y = this.y + (this.height / 2);
        return this.centre;
    }
    getRotatedCoords() {
        let newCoords = [];
        for (let each of Object.values(this.coords)) {
            let n = this.rotateOnPlayer(each.x, each.y, this.rotation);
            newCoords.push(n);
        }
        return newCoords;
    }
    checkBounds() {
        if (!this.coords) {
            return;
        }
        let rotatedCoords = this.getRotatedCoords();
        
        // vector normalization formula: https://www.khanacademy.org/computing/computer-programming/programming-natural-simulations/programming-vectors/a/vector-magnitude-normalization
        let magnitude = Math.sqrt(this.xChange * this.xChange + this.yChange * this.yChange);
        if (magnitude === 0) {
            return false;
        }
        let normalizedX = this.xChange / magnitude;
        // this.x = round(this.x, 2);
        let normalizedY = this.yChange / magnitude;

        for (let each of Object.values(rotatedCoords)) {
            let hitBounds = false;
            if (each.x < 0) {
                let nudge = normalizedX * each.x;
                nudge = nudge > 0 ? nudge : nudge * -1;
                this.x += nudge;
                hitBounds = true;

                // return true;

            }
            if (each.x > this.canvas.width) {
                let nudge = normalizedX * -1 * (each.x - this.canvas.width);
                nudge = nudge < 0 ? nudge : nudge * -1;
                this.x += nudge;
                hitBounds = true;
                // return true;
            }
            if (each.y < 0) {
                let nudge = normalizedY * each.y;
                nudge = nudge > 0 ? nudge : nudge * -1;
                this.y += nudge;
                hitBounds = true;
                // return true;
            }
            if (each.y > this.canvas.height) {
                let nudge = normalizedY * -1 * (each.y - this.canvas.height);
                nudge = nudge < 0 ? nudge : nudge * -1;
                this.y += nudge;
                hitBounds = true;

                // return true;
            }
            if (hitBounds) {
                break;
            }
        }


    }

    driveForward() {
        if (this.obstacleHit) {
            this.obstacleHit = false;
            return;
        }
        let angle = this.rotation;
        if (this.speed <= 1) {
            this.speed = 1;
        }
        if (this.speed < this.topSpeed) {
            this.speed += this.acceleration;
        }

        this.nx = getXHeading(angle);
        this.nx.toFixed(2);
        this.nx = parseFloat(this.nx);

        this.ny = getYHeading(angle);
        this.ny.toFixed(2);
        this.ny = parseFloat(this.ny);
    }
    driveBackward() {

        let angle = this.rotation;
        if (this.speed <= 1) {
            this.speed = 1;
        }
        this.accelerate();

        this.nx = getXHeading(angle + 180);
        this.nx.toFixed(2);
        this.nx = parseFloat(this.nx);

        this.ny = getYHeading(angle + 180);
        this.ny.toFixed(2);
        this.ny = parseFloat(this.ny);
    }
    // checkRotation() {
    //     if (this.rotation <= 0) {
    //         this.rotation = 360;
    //     }
    //     if (this.rotation > 360) {
    //         this.rotation = this.rotation % 360;
    //     }
    //     if (this.turretRotation <= 0) {
    //         this.turretRotation += 360;
    //     }
    // }
    rotate(amount) {
        this.rotation += amount;
    }
    decelerate() {
        if (this.speed >= 1.1) {
            this.speed += this.deceleration;

        }
    }
    accelerate() {
        if (this.speed < this.topSpeed) {
            this.speed += this.acceleration;
        }
    }
    handleVectors() {
        if (this.speed > 1 && this.nx != 0) {
            this.xChange = this.nx * this.speed;
        }
        if (this.speed > 1 && this.ny != 0) {
            this.yChange = this.ny * this.speed;
        }
        else {
            this.xChange = 0;
            this.yChange = 0;
        }
    }
    drawVertices(coords, color) {
        this.context.beginPath();

        for (let vertex of Object.values(coords)) {
            this.context.moveTo(vertex.x, vertex.y);
            this.context.lineTo(vertex.x, vertex.y);
        }
        this.context.closePath();
        this.context.strokeStyle = color;
        this.context.stroke();
    }
    updateCoords() {
        this.x = this.x + this.xChange;
        this.y = this.y + this.yChange;

        let coords = {
            tl: { x: this.x, y: this.y },
            tr: { x: this.x + this.width, y: this.y },
            br: { x: this.x + this.width, y: this.y + this.height },
            bl: { x: this.x, y: this.y + this.height }
        };
        // DRAW UNROTATED TANK

        // this.drawVertices(coords, "black");

        // // ROTATE THE COORDINATES
        // for (let vertex of Object.values(coords)) {
        //     vertex = this.rotateCoords(vertex.x, vertex.y);
        // }
        // //DRAW ROTATED TANK
        this.coords = coords;

        // this.drawVertices(coords, "white");
    }
    fire() {
        //exclude if any of last two rounds are bullets

        if (this.bullet_sequence.length > this.fireGap) {
            this.bullet_sequence = this.bullet_sequence.slice(this.fireGap * -1, -1);
        }
        let previousBullets = this.bullet_sequence.includes(1);

        if (previousBullets === false) {
            let b = new Bullet(this.centre.x, this.centre.y, 0, 0, this.context);
            b.tankID = this.id;
            let angle = (this.rotation + this.turretRotation) % 360;
            b.computeVector(angle);
            this.projectiles.push(b);
            this.bullet_sequence.push(1);
            this.fireSound.play();
            return true;
        }
        this.bullet_sequence.push(0);
        return false;
    }
    throttleSound() {
        // let d = this.revSound.duration;
        this.idleSound.pause();
        this.runningSound.play();
        this.runningSound.loop = true;

        // if (!this.revSound.currentTime > 0 && !this.runningSound.currentTime>0) {
        //     this.revSound.play();
        // }
    }
    engineIdle() {

        if (this.runningSound.currentTime > 0) {
            this.runningSound.pause();
            this.runningSound.currentTime = 0;
        }
        this.idleSound.play();
        this.idleSound.loop = true;
        this.runningSound.pause();
        this.runningSound.currentTime = 0;
    }
    reverseDirection() {
        this.xChange *= -1;
        this.yChange *= -1;
    }
    draw() {
        this.context.save();


        let centre = { x: this.x + this.width / 2, y: this.y + this.height / 2 }
        this.centre = centre;
        this.context.translate(centre.x, centre.y);
        this.context.rotate(2 * Math.PI * (this.rotation / 360));
        this.context.translate(-centre.x, -centre.y);

        //DRAW TANK
        this.context.drawImage(this.tankImage, this.x, this.y, this.width, this.height);
        this.context.translate(this.centre.x, this.centre.y);
        // this.context.rotate(-1*(2 * Math.PI * (this.rotation / 360)))
        this.context.rotate(2 * Math.PI * (this.turretRotation / 360));
        this.context.translate(-this.centre.x, -this.centre.y);
        //DRAW TURRET
        this.context.drawImage(this.turretImage, this.x, this.y + 27, this.width, this.height);
        this.context.restore();
        //DRAW HEALTH BAR
        this.context.fillStyle = "green";
        let greenBarLength = 50 * (this.health / 200);
        this.context.fillRect(this.centre.x, this.centre.y - 60, greenBarLength, 4);

        this.context.fillStyle = "red";
        let redBarLength = 50 * ((200 - this.health) / 200)
        this.context.fillRect(this.centre.x + greenBarLength, this.centre.y - 60, redBarLength, 4);

        this.context.fillStyle = "white";
        this.context.font = "10px Arial";
        this.context.fillText(this.health + "/" + "200", this.centre.x, this.centre.y - 60);
    }

    rotateOnPlayer(x, y, degrees) {
        // formula from https://math.stackexchange.com/questions/4240275/calculating-xy-coordinates-of-a-rectangle-that-is-rotated-with-a-given-rotation
        let angle = (degrees / 360) * 2 * Math.PI;
        let x_rotated = (x - this.centre.x) * Math.cos(angle) - (y - this.centre.y) * Math.sin(angle) + this.centre.x;
        let y_rotated = (x - this.centre.x) * Math.sin(angle) + (y - this.centre.y) * Math.cos(angle) + this.centre.y;
        return { x: x_rotated, y: y_rotated };
    }

    isHit(p) {
        // BROAD PHASE (USING A RADIUS, i.e. height of tank)
        let v = new Vector(p.x, p.y, this.centre.x, this.centre.y);
        if (v.euclidian < this.width / 2) {

            let p_coords = this.rotateOnPlayer(p.x, p.y, (360 - this.rotation));
            let yValues = [];
            let xValues = [];
            let unrotatedCoords = [[this.x, this.y], [this.x + this.width, this.y], [this.x, this.y + this.height], [this.x + this.width, this.y + this.height]];

            for (let coords of unrotatedCoords) {
                yValues.push(coords[1]);
                xValues.push(coords[0]);
            }
            let minY = Math.min(...yValues);
            let maxY = Math.max(...yValues);
            let minX = Math.min(...xValues);
            let maxX = Math.max(...xValues);

            if (p_coords.x > minX && p_coords.x < maxX && p_coords.y > minY && p_coords.y < maxY) {
                return true;
            }

        }
        return false;
    }
    broadPhase(enemy) {
        let myVector = new Vector(this.centre.x, this.centre.y, enemy.centre.x, enemy.centre.y);
        if (myVector.euclidian < this.height) {
            if (this.projectVertices(enemy.coords)) {
                return true;
            }
        }
        this.throttleLocked = false;
        return false;

    }
    getAxes(coords) {
        let vertices = Object.values(coords); // Get vertices as an array
        let i = 0;
        let axes = [];

        for (let vertex of vertices) {
            i += 1;
            let myV = new Vector(vertex.x, vertex.y,
                vertices[i].x, vertices[i].y
            );

            myV.normalize();
            axes.push(myV);

            if (axes.length >= 2) {
                break;
            }
        }

        for (let a of axes) {
            let interim = a.x;
            a.x = a.y * -1;
            a.y = interim;
        }

        return axes;
    }
    projectVertices(otherCoords) {
        // SAT algorithm based on https://dyn4j.org/2010/01/sat/
        this.axes = [];
        this.vertices = [];
        // METHOD
        // get the points of the rectangle
        // convert each side (i.e. axis) into a unit vector
        // make it a perpendicular vector
        // project the vertices of each rectangle onto all unique axes from both
        // find the min and max for each rectangle and see if there is an overlap
        // if there is no overlap there is no collision

        let axes1 = this.getAxes(this.coords);
        let axes2 = this.getAxes(otherCoords);
        let axes = [...axes1, ...axes2]; // Combine axes

        //project the vertices
        function projectVertex(vertex, axis) {
            return (vertex.x * axis.x) + (vertex.y * axis.y);
        }

        this.projections = [];
        let otherProjections = [];
        let minOverlap = Infinity;
        let collisionNormal = { x: 0, y: 0 };

        for (let a of axes) {
            for (let v of Object.values(this.coords)) {
                this.projections.push(projectVertex(v, a))
            }
            for (let v of Object.values(otherCoords)) {
                otherProjections.push(projectVertex(v, a))
            }

            let min1 = Math.min(...this.projections);
            let max1 = Math.max(...this.projections);
            let min2 = Math.min(...otherProjections);
            let max2 = Math.max(...otherProjections);
            this.tankCollision = max1 >= min2 && max2 >= min1;
            if (!this.tankCollision) {
                this.throttleLocked = false;
                return false;
            }
            let overlap = Math.min(max1, max2) - Math.max(min1, min2);
            if (overlap < minOverlap) {
                minOverlap = overlap;
                collisionNormal = a;
            }

        }
        this.throttleLocked = true;
        // this.speed = 0;
        if (this.direction === "forward") {
            this.driveBackward();
        }
        else if (this.direction === "backward") {
            this.driveForward();
        }
        // this.driveBackward();

        console.log("Tanks collided!")
        return true;
    }
    hitObstacle(obstacle) {
        let x = obstacle[0];
        let y = obstacle[1];

        if (!this.coords) {
            return;
        }
        let rotatedCoords = this.getRotatedCoords();
        for (let each of rotatedCoords) {
            let vector = new Vector(each.x, each.y, x + 64, y + 64);
            if (vector.euclidian < 50) {
                this.obstacleHit = true;
                return true;
            }
        }
        // let yValues = [];
        // let xValues = [];
        // for (let vertex of obstacle) {
        //     yValues.push(vertex.y);
        //     xValues.push(vertex.x);
        // }
        // let minY = Math.min(...yValues);
        // let maxY = Math.max(...yValues);
        // let minX = Math.min(...xValues);
        // let maxX = Math.max(...xValues);
        return false;
    }
    // hitObstacle(obstacle) {
    //     if (!this.coords) {
    //         return;
    //     }
    //     let rotatedCoords = this.getRotatedCoords();
    //     let x = obstacle[0] + 64;
    //     let y = obstacle[1] + 64;
    //     for (let c of rotatedCoords) {
    //         let vector = new Vector(c.x, c.y, x, y);
    //         if (vector.euclidian < 64) {
    //             let magnitude = Math.sqrt(this.xChange * this.xChange + this.yChange * this.yChange);
    //             if (magnitude === 0) {
    //                 return false;
    //             }
    //             let normalizedX = this.xChange / magnitude;
    //             // this.x = round(this.x, 2);
    //             let normalizedY = this.yChange / magnitude;
    //             let collisionDepth = 64 - vector.euclidian;
    //             let xChange = normalizedX * collisionDepth * -1;
    //             let yChange = normalizedY * collisionDepth * -1;

    //             this.x += xChange;
    //             this.y += yChange;
    //             return true;

    //         }
    //     }
    //     return false;
    // }

}

class EnemyTank extends Tank {
    constructor(gc) {
        super(gc);
        this.tankImage.src = "./assets/EnemyPanzerBase.png"; //67X94
        this.turretImage.src = "./assets/EnemyTurret.png";
        this.id = "enemy";
        this.topSpeed = 4;
        this.hit = false;
    }
}

//VECTOR CONSTRUCTOR
class Vector {
    constructor(x1, y1, x2, y2) {
        this.x = x2 - x1;
        this.y = y2 - y1;
        this.euclidianDist();
    }
    normalize() {
        // vector normalization formula from: https://www.khanacademy.org/computing/computer-programming/programming-natural-simulations/programming-vectors/a/vector-magnitude-normalization
        let magnitude = Math.sqrt(this.x * this.x + this.y * this.y);
        if (magnitude === 0) {
            return false;
        }
        this.x /= magnitude;
        // this.x = round(this.x, 2);
        this.y /= magnitude;
        // this.y = round(this.y, 2);
        return true;
    }
    multiply(multiplier) {
        this.x *= multiplier;
        this.y *= multiplier;
    }
    vectorToAngle() {

        let heading = getHeading(this.x, this.y)
        // handle zero cases
        if (this.x === 0 && this.y === 0) {
            return NaN;
        }
        if (this.x === 0 && this.y > 0) {
            return 180;
        }
        if (this.x === 0 && this.y < 0) {
            return 0;
        }
        if (this.y === 0 && this.x > 0) {
            return 90;
        }
        if (this.y === 0 && this.x < 0) {
            return 270;
        }
        heading *= 57.2958; // radians to degrees
        heading = Math.round(heading);
        // console.log("Heading:", heading);

        if (this.y < 0 && this.x < 0) {
            return (180 - (heading * -1) + 270);
        }
        return Math.round((90 + heading) % 360);


    }
    euclidianDist() {
        this.euclidian = Math.sqrt(this.x ** 2 + this.y ** 2);
    }
}

class Bullet {
    instances = []
    expired = [];
    constructor(x, y, xChange, yChange, context) {
        this.context = context;
        this.x = x;
        this.y = y;
        this.r = 2;
        this.xChange = xChange;
        this.yChange = yChange;
        this.speed = 15;
    }
    computeVector(angle) {
        this.nx = getXHeading(angle);
        this.xChange = this.nx * this.speed;
        // this.xChange.toFixed(2);
        this.ny = getYHeading(angle);
        this.yChange = this.ny * this.speed;
        this.y = this.y + (this.ny * 54);
        this.x = this.x + (this.nx * 54);
    }
    updateCoords() {
        this.x = this.x + this.xChange;
        this.y = this.y + this.yChange;
    }
    draw() {
        this.context.beginPath();
        this.context.arc(this.x, this.y, this.r, 0, 2 * Math.PI);
        this.context.fillStyle = "yellow";
        this.context.fill();
    }

    hitObstacle(obstacle) {
        let x = obstacle[0] + 64;
        let y = obstacle[1] + 64;

        let vector = new Vector(this.x, this.y, x, y);
        if (vector.euclidian < 64) {
            this.obstacleHit = true;
            return true;
        }
        return false;
    }

}
class AI {
    constructor(supervisee, player, canvas, context) {
        this.player = player;
        this.target = player.centre;
        this.supervisee = supervisee;
        this.newHeading();
        this.actionStart = 0;
        this.actionElapsed = 0;
        this.actionTime = 2000;
        this.canvas = canvas;
        this.context = context;
        this.collision = false;
        this.clockRunning = false;
        this.clockReset = true;
        this.rotationDirectionSet = false;
        this.hitWall = false;
        this.turretDirectionSet = false;
        this.headings = [0, 90, 180, 270]
        this.headingPointer = 1;
        this.targetLocked = false;
        this.obstacleHit = false;

    }
    getTarget() {
        let target = this.player.getCentre();
        let myCentre = this.supervisee.getCentre();
        let v = new Vector(myCentre.x, myCentre.y, target.x, target.y);
        return v.vectorToAngle();
    }
    rotateTank(amount) {
        this.supervisee.rotate(amount);
    }
    

    handle() {
        if (!this.heading) {
            this.newHeading();
            return;
        }
        if (this.hitWall === null) {
            this.hitWall = nearWall(this.supervisee, this.canvas);
            if (this.hitWall != null) {
                switch (this.hitWall) {
                    case "r":
                        this.heading = 270;
                        break;
                    case "br":
                        this.heading = 315;
                        break;
                    case "tr":
                        this.heading = 225;
                        break;
                    case "l":
                        this.heading = 90;
                        break;
                    case "tl":
                        this.heading = 135;
                        break;
                    case "bl":
                        this.heading = 45;
                        break;
                    case "b":
                        this.heading = 0;
                        break;
                    case "t":
                        this.heading = 180;
                        break;
                    default:
                        break;
                }
            }

        }


        this.rotateTurret();
        this.handleMove();
    }
    rotateTurret() {
        // this.getTarget();
        this.targetDegrees = this.getTarget();
        if (this.targetDegrees % 2 != 0) {
            this.targetDegrees += 1;
        }
        // console.log("Target degrees: ", this.targetDegrees);
        // console.log("Turret rotation: ", this.supervisee.turretRotation);
        let currentHeading = (this.supervisee.turretRotation) % 360
        // console.log("Current heading: ", currentHeading);
        currentHeading = (this.supervisee.turretRotation + (this.supervisee.rotation + 180)) % 360;
        let scope = 7;
        if((currentHeading > (this.targetDegrees - scope) && currentHeading < (this.targetDegrees + scope))){
            this.targetLocked = false;
            this.supervisee.fire();
        }
        else if(this.targetDegrees === currentHeading){
            this.supervisee.fire();
            this.targetLocked = true;
            return;
        }
        else {
            this.targetLocked = false;
            if (this.player.y > this.supervisee.y) {
                this.supervisee.turretDirection = 2;
            }
            else {
                this.supervisee.turretDirection = -2;
            }
            // if(this.clockRunning){
            //     this.supervisee.turretDirection = 0;
            // }
            this.turretDirectionSet = true;

            this.supervisee.turretRotation += this.supervisee.turretDirection;
        }
        
    }
    handleMove() {
        // if (this.targetLocked && !this.obstacleHit) {
        if (this.targetLocked) {
            return;
        }
        if (this.supervisee.hit) {
            this.supervisee.hit = false;
            this.clockReset = true;
            this.clockRunning = false;
            this.drive();
            return;
        }
        let heading = this.headings[this.headingPointer];

        if ((this.supervisee.rotation + 180) % 360 != heading) {
            this.rotateTank(2);
            return;
        }
        this.drive();
    }
    drive() {
        if (this.clockReset) {
            this.clockReset = false;
            this.clockRunning = true;
            this.actionStart = Date.now();
            return;
        }
        this.actionElapsed = Date.now() - this.actionStart;
        // if clock reset === false ...
        // if(this.targetLocked){
        //     this.clockReset = true;
        //     this.clockRunning = false;
        // }
        if (this.clockRunning && this.actionElapsed < this.actionTime) {
            this.supervisee.driveForward();
            return;
        }

        this.supervisee.decelerate();

        if (this.supervisee.speed <= 1) {

            // get a new heading from the list
            if (this.headingPointer < this.headings.length - 1) {
                this.headingPointer += 1
            }
            else {
                this.headingPointer = 0;
            }
            this.clockRunning = false;
            this.clockReset = true;
            this.actionTime = randint(1000,3000);
        }

    }

    rotate(num) {
        this.supervisee.rotate(num);
    }
    newHeading() {
        this.heading = 2 * randint(0, 180);
    }


}

export { Tank, EnemyTank, Vector, Bullet, AI }

