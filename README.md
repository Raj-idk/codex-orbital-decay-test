# Orbital Decay

A dependency-free HTML5 Canvas game written in Vanilla TypeScript.

## Run

```bash
npm install
npm run build
npm run serve
```

Open `http://localhost:5173`.

## Controls

- `W`: thrust along the ship nose
- `A` / `D`: rotate
- `Space`: drop space dust

## Mechanics

- The sun applies point gravity with `F = G * m1 * m2 / r^2`.
- The ship starts on a circular tangential orbit.
- Dust drops reduce ship mass and bleed a tiny amount of momentum, so repeated shedding changes the path and can decay the orbit.
- The cyan trail stores the last 50 sampled ship positions.
- Impacting the sun or crossing the dashed culling boundary resets the ship.
