"use strict";
(() => {
    class Vector2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        add(vector) {
            return new Vector2(this.x + vector.x, this.y + vector.y);
        }
        subtract(vector) {
            return new Vector2(this.x - vector.x, this.y - vector.y);
        }
        scale(amount) {
            return new Vector2(this.x * amount, this.y * amount);
        }
        magnitudeSquared() {
            return this.x * this.x + this.y * this.y;
        }
        magnitude() {
            return Math.sqrt(this.magnitudeSquared());
        }
        normalize() {
            const length = this.magnitude();
            if (length === 0) {
                return new Vector2();
            }
            return this.scale(1 / length);
        }
        limit(maximum) {
            const length = this.magnitude();
            if (length <= maximum || length === 0) {
                return this;
            }
            return this.scale(maximum / length);
        }
        static fromAngle(angle) {
            return new Vector2(Math.cos(angle), Math.sin(angle));
        }
    }
    const canvas = getElement("game");
    const renderingContext = canvas.getContext("2d");
    if (!renderingContext) {
        throw new Error("Canvas 2D context is unavailable.");
    }
    const context = renderingContext;
    const massValue = getElement("massValue");
    const speedValue = getElement("speedValue");
    const altitudeValue = getElement("altitudeValue");
    const dustValue = getElement("dustValue");
    const stateValue = getElement("stateValue");
    const gravityConstant = 1;
    const sunMass = 760000;
    const sunRadius = 54;
    const baseShipMass = 42;
    const minimumShipMass = 22;
    const shipRadius = 12;
    const thrustForce = 3150;
    const rotationSpeed = 3.35;
    const dustMassLoss = 0.08;
    const dustDropInterval = 0.048;
    const dustMomentumLoss = 0.00085;
    const trailLimit = 50;
    const fixedStep = 1 / 120;
    const maximumFrameTime = 0.08;
    const maximumShipSpeed = 760;
    const keys = new Set();
    const sunPosition = new Vector2();
    const ship = {
        position: new Vector2(),
        velocity: new Vector2(),
        angle: -Math.PI / 2,
        mass: baseShipMass,
        radius: shipRadius,
    };
    const dustParticles = [];
    const trail = [];
    const stars = [];
    let viewportWidth = window.innerWidth;
    let viewportHeight = window.innerHeight;
    let pixelRatio = 1;
    let dustTimer = 0;
    let trailTimer = 0;
    let stateMessage = "Stable orbit";
    let stateTimer = 0;
    let previousTime = performance.now();
    let accumulator = 0;
    function getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            throw new Error(`Missing element: #${id}`);
        }
        return element;
    }
    function resizeCanvas() {
        viewportWidth = window.innerWidth;
        viewportHeight = window.innerHeight;
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewportWidth * pixelRatio);
        canvas.height = Math.floor(viewportHeight * pixelRatio);
        canvas.style.width = `${viewportWidth}px`;
        canvas.style.height = `${viewportHeight}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        createStars();
    }
    function createStars() {
        stars.length = 0;
        const starCount = Math.round(Math.min(260, Math.max(90, (viewportWidth * viewportHeight) / 7200)));
        for (let index = 0; index < starCount; index += 1) {
            stars.push({
                x: Math.random() * viewportWidth,
                y: Math.random() * viewportHeight,
                radius: Math.random() * 1.45 + 0.25,
                alpha: Math.random() * 0.62 + 0.2,
            });
        }
    }
    function orbitRadius() {
        return Math.min(330, Math.max(180, Math.min(viewportWidth, viewportHeight) * 0.31));
    }
    function lostRadius() {
        return Math.max(orbitRadius() * 3.45, Math.max(viewportWidth, viewportHeight) * 0.68);
    }
    function resetShip(reason = "Stable orbit") {
        const radius = orbitRadius();
        const circularOrbitSpeed = Math.sqrt((gravityConstant * sunMass) / radius);
        ship.position = new Vector2(radius, 0);
        ship.velocity = new Vector2(0, -circularOrbitSpeed);
        ship.angle = -Math.PI / 2;
        ship.mass = baseShipMass;
        trail.length = 0;
        dustParticles.length = 0;
        dustTimer = 0;
        trailTimer = 0;
        stateMessage = reason;
        stateTimer = reason === "Stable orbit" ? 0 : 2.4;
    }
    function gravityAcceleration(position, gravitationalMass, inertiaMass) {
        const toSun = sunPosition.subtract(position);
        const distanceSquared = Math.max(toSun.magnitudeSquared(), sunRadius * sunRadius);
        const force = (gravityConstant * sunMass * gravitationalMass) / distanceSquared;
        return toSun.normalize().scale(force / inertiaMass);
    }
    function updateShip(deltaTime) {
        if (keys.has("KeyA")) {
            ship.angle -= rotationSpeed * deltaTime;
        }
        if (keys.has("KeyD")) {
            ship.angle += rotationSpeed * deltaTime;
        }
        let acceleration = gravityAcceleration(ship.position, ship.mass, baseShipMass);
        if (keys.has("KeyW")) {
            const thrustDirection = Vector2.fromAngle(ship.angle);
            acceleration = acceleration.add(thrustDirection.scale(thrustForce / ship.mass));
        }
        ship.velocity = ship.velocity.add(acceleration.scale(deltaTime)).limit(maximumShipSpeed);
        ship.position = ship.position.add(ship.velocity.scale(deltaTime));
        dustTimer -= deltaTime;
        if (keys.has("Space") && dustTimer <= 0) {
            dropDust();
            dustTimer = dustDropInterval;
        }
        trailTimer += deltaTime;
        if (trailTimer >= 0.1) {
            trail.push(ship.position);
            while (trail.length > trailLimit) {
                trail.shift();
            }
            trailTimer = 0;
        }
        const distanceFromSun = ship.position.magnitude();
        if (distanceFromSun <= sunRadius + ship.radius) {
            resetShip("Solar impact reset");
            return;
        }
        if (distanceFromSun >= lostRadius()) {
            resetShip("Signal lost reset");
        }
    }
    function dropDust() {
        if (ship.mass <= minimumShipMass) {
            return;
        }
        const behindShip = Vector2.fromAngle(ship.angle + Math.PI);
        const sideScatter = Vector2.fromAngle(ship.angle + Math.PI / 2).scale((Math.random() - 0.5) * 9);
        const speedScatter = Vector2.fromAngle(ship.angle + (Math.random() - 0.5) * 1.2).scale((Math.random() - 0.5) * 10);
        dustParticles.push({
            position: ship.position.add(behindShip.scale(ship.radius + 7)).add(sideScatter),
            velocity: ship.velocity.add(behindShip.scale(30 + Math.random() * 18)).add(speedScatter),
            mass: dustMassLoss,
            radius: 1.7 + Math.random() * 1.8,
            age: 0,
            life: 2.4 + Math.random() * 1.3,
        });
        ship.mass = Math.max(minimumShipMass, ship.mass - dustMassLoss);
        ship.velocity = ship.velocity.scale(1 - dustMomentumLoss);
        stateMessage = "Dust shedding";
        stateTimer = 0.35;
    }
    function updateDust(deltaTime) {
        for (let index = dustParticles.length - 1; index >= 0; index -= 1) {
            const particle = dustParticles[index];
            const acceleration = gravityAcceleration(particle.position, particle.mass, particle.mass);
            particle.velocity = particle.velocity.add(acceleration.scale(deltaTime));
            particle.position = particle.position.add(particle.velocity.scale(deltaTime));
            particle.age += deltaTime;
            if (particle.age >= particle.life || particle.position.magnitude() >= lostRadius() * 1.1) {
                dustParticles.splice(index, 1);
            }
        }
    }
    function update(deltaTime) {
        updateShip(deltaTime);
        updateDust(deltaTime);
        if (stateTimer > 0) {
            stateTimer -= deltaTime;
            if (stateTimer <= 0) {
                stateMessage = "Stable orbit";
            }
        }
    }
    function render() {
        context.clearRect(0, 0, viewportWidth, viewportHeight);
        drawBackground();
        drawBoundary();
        drawTrail();
        drawDust();
        drawSun();
        drawShip();
        updateHud();
    }
    function worldToScreen(position) {
        return new Vector2(viewportWidth / 2 + position.x, viewportHeight / 2 + position.y);
    }
    function drawBackground() {
        context.save();
        for (const star of stars) {
            context.globalAlpha = star.alpha;
            context.fillStyle = "#dff6ff";
            context.beginPath();
            context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }
    function drawBoundary() {
        const center = worldToScreen(sunPosition);
        context.save();
        context.strokeStyle = "rgba(135, 188, 255, 0.14)";
        context.lineWidth = 1;
        context.setLineDash([7, 12]);
        context.beginPath();
        context.arc(center.x, center.y, lostRadius(), 0, Math.PI * 2);
        context.stroke();
        context.setLineDash([]);
        context.strokeStyle = "rgba(255, 209, 130, 0.1)";
        context.beginPath();
        context.arc(center.x, center.y, orbitRadius(), 0, Math.PI * 2);
        context.stroke();
        context.restore();
    }
    function drawTrail() {
        if (trail.length < 2) {
            return;
        }
        context.save();
        context.lineWidth = 2;
        context.lineCap = "round";
        for (let index = 1; index < trail.length; index += 1) {
            const previous = worldToScreen(trail[index - 1]);
            const current = worldToScreen(trail[index]);
            const alpha = index / trail.length;
            context.strokeStyle = `rgba(95, 218, 255, ${0.08 + alpha * 0.54})`;
            context.beginPath();
            context.moveTo(previous.x, previous.y);
            context.lineTo(current.x, current.y);
            context.stroke();
        }
        context.restore();
    }
    function drawDust() {
        context.save();
        for (const particle of dustParticles) {
            const screenPosition = worldToScreen(particle.position);
            const alpha = Math.max(0, 1 - particle.age / particle.life);
            context.fillStyle = `rgba(180, 225, 255, ${alpha * 0.72})`;
            context.beginPath();
            context.arc(screenPosition.x, screenPosition.y, particle.radius * (0.7 + alpha), 0, Math.PI * 2);
            context.fill();
        }
        context.restore();
    }
    function drawSun() {
        const center = worldToScreen(sunPosition);
        const glow = context.createRadialGradient(center.x, center.y, sunRadius * 0.15, center.x, center.y, sunRadius * 3.25);
        glow.addColorStop(0, "rgba(255, 244, 174, 1)");
        glow.addColorStop(0.26, "rgba(255, 157, 64, 0.92)");
        glow.addColorStop(0.46, "rgba(255, 86, 49, 0.34)");
        glow.addColorStop(1, "rgba(255, 86, 49, 0)");
        context.save();
        context.fillStyle = glow;
        context.beginPath();
        context.arc(center.x, center.y, sunRadius * 3.25, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#fff2a8";
        context.beginPath();
        context.arc(center.x, center.y, sunRadius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = "rgba(255, 255, 255, 0.42)";
        context.lineWidth = 2;
        context.beginPath();
        context.arc(center.x, center.y, sunRadius * 0.82, -0.4, Math.PI * 1.38);
        context.stroke();
        context.restore();
    }
    function drawShip() {
        const screenPosition = worldToScreen(ship.position);
        const nose = Vector2.fromAngle(ship.angle);
        context.save();
        context.translate(screenPosition.x, screenPosition.y);
        context.rotate(ship.angle);
        if (keys.has("KeyW")) {
            const flameLength = 15 + Math.sin(performance.now() / 42) * 3;
            context.fillStyle = "rgba(107, 224, 255, 0.72)";
            context.beginPath();
            context.moveTo(-10, -5);
            context.lineTo(-10 - flameLength, 0);
            context.lineTo(-10, 5);
            context.closePath();
            context.fill();
            context.fillStyle = "rgba(255, 214, 129, 0.92)";
            context.beginPath();
            context.moveTo(-9, -3);
            context.lineTo(-9 - flameLength * 0.55, 0);
            context.lineTo(-9, 3);
            context.closePath();
            context.fill();
        }
        context.fillStyle = "#d8f7ff";
        context.strokeStyle = "#47d6ff";
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(15, 0);
        context.lineTo(-10, -8);
        context.lineTo(-6, 0);
        context.lineTo(-10, 8);
        context.closePath();
        context.fill();
        context.stroke();
        context.fillStyle = "#08131d";
        context.beginPath();
        context.arc(3, 0, 3.2, 0, Math.PI * 2);
        context.fill();
        context.restore();
        context.save();
        context.strokeStyle = "rgba(103, 227, 255, 0.35)";
        context.lineWidth = 1.5;
        context.beginPath();
        context.moveTo(screenPosition.x, screenPosition.y);
        context.lineTo(screenPosition.x + nose.x * 28, screenPosition.y + nose.y * 28);
        context.stroke();
        context.restore();
    }
    function updateHud() {
        const altitude = Math.max(0, ship.position.magnitude() - sunRadius);
        massValue.textContent = ship.mass.toFixed(2);
        speedValue.textContent = ship.velocity.magnitude().toFixed(1);
        altitudeValue.textContent = Math.round(altitude).toString();
        dustValue.textContent = dustParticles.length.toString();
        stateValue.textContent = stateMessage;
    }
    function frame(time) {
        const deltaTime = Math.min((time - previousTime) / 1000, maximumFrameTime);
        previousTime = time;
        accumulator += deltaTime;
        let steps = 0;
        while (accumulator >= fixedStep && steps < 12) {
            update(fixedStep);
            accumulator -= fixedStep;
            steps += 1;
        }
        if (steps === 12) {
            accumulator = 0;
        }
        render();
        window.requestAnimationFrame(frame);
    }
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("keydown", (event) => {
        if (["KeyW", "KeyA", "KeyD", "Space"].includes(event.code)) {
            event.preventDefault();
            keys.add(event.code);
        }
    });
    window.addEventListener("keyup", (event) => {
        keys.delete(event.code);
    });
    window.addEventListener("blur", () => {
        keys.clear();
    });
    resizeCanvas();
    resetShip();
    window.requestAnimationFrame(frame);
})();
//# sourceMappingURL=main.js.map