import L from 'leaflet';

/** Regex to parse style definitions. */
const regStyle = /([\w-]+): ([^;]+);/g;

/** CSS3 transform properties for different browsers. */
const css3Transforms = {
    transform : 'transform',
    WebkitTransform : '-webkit-transform',
    OTransform : '-o-transform',
    MozTransform : '-moz-transform',
    msTransform : '-ms-transform'
};

/** CSS3 transform property for this browser. */
const transformProperty = css3Transforms[L.DomUtil.TRANSFORM];

// TODO: check if this cache working right (keys don't need prefix)
const bouncingMotionsCache = {};

/**
 * Parses cssText attribute into object. Style definitions becomes the keys of the object.
 * @param cssText {string}  cssText string
 * @return {object} object with style definitions as keys
 */
export function parseCssText(cssText) {
    let styleDefinitions = {},
        match = regStyle.exec(cssText);

    while (match) {
        styleDefinitions[match[1]] = match[2];
        match = regStyle.exec(cssText);
    }

    return styleDefinitions;
}

/**
 * Renders object with style definitions as string. Created string is ready to put in cssText
 * attribute.
 * @param styleDefinitions {object}  object with style definitions
 * @return {string} cssText string
 */
export function renderCssText(styleDefinitions) {
    let cssText = '',
        key;

    for (key in styleDefinitions) {
        cssText += key + ': ' + styleDefinitions[key] + '; '
    }

    return cssText;
}

/**
 * Calculates the points to draw the continous line on the screen. Returns the array of ordered
 * point coordinates. Uses Bresenham algorithm.
 *
 * @param x {number}  x coordinate of origin
 * @param y {number}  y coordinate of origin
 * @param angle {number}  angle (radians)
 * @param length {number}  length of line (px)
 *
 * @return {[number, number][]} array of ordered point coordinates
 *
 * @see http://rosettacode.org/wiki/Bitmap/Bresenham's_line_algorithm#JavaScript
 */
export function calculateLine(x, y, angle, length) {
    // TODO: use something else than multiply length by 2 to calculate the line with defined
    // length
    let xD = Math.round(x + Math.cos(angle) * (length * 2)),
        yD = Math.round(y + Math.sin(angle) * (length * 2)),

        dx = Math.abs(xD - x),
        sx = x < xD ? 1 : -1,

        dy = Math.abs(yD - y),
        sy = y < yD ? 1 : -1,

        err = (dx > dy ? dx : -dy) / 2,
        e2,

        p = [],
        i = 0;

    while (true) {
        p.push([x, y]);
        i++;
        if (i === length)
            break;
        e2 = err;
        if (e2 > -dx) {
            err -= dy;
            x += sx;
        }
        if (e2 < dy) {
            err += dx;
            y += sy;
        }
    }

    return p;
}

/**
 * Returns calculated array of points for icon movement. Used to animate markers in browsers that
 * doesn't support 'transform' attribute.
 *
 * @param x {number}  x coordinate of original position of the marker
 * @param y {number}  y coordinate of original position of the marker
 * @param bounceHeight {number}  height of bouncing (px)
 *
 * @return {[number, number][]} array of points
 */
export function calculateIconMovePoints(x, y, bounceHeight) {
    let p = [],     // array of points
        dH = bounceHeight + 1;  // delta of height

    // Use fast inverse while loop to fill the array
    while (dH--) {
        p[dH] = [x, y - dH];
    }

    return p;
}

/**
 * Returns calculated array of points for shadow movement. Used to animate markers in browsers that
 * doesn't support 'transform' attribute.
 *
 * @param x {number}  x coordinate of original position of the marker
 * @param y {number}  y coordinate of original position of the marker
 * @param bounceHeight {number}  height of bouncing (px)
 * @param angle {number}  shadow inclination angle, if null shadow don't moves from it's initial
 *      position (radians)
 *
 * @return {[number, number][]} array of points
 */
export function calculateShadowMovePoints(x, y, bounceHeight, angle) {
    if (angle != null) {  // important: 0 is not null
        return calculateLine(x, y, angle, bounceHeight + 1);
    } else {
        const p = [];

        for (let i = 0; i <= bounceHeight; i++) {
            p[i] = [x, y];
        }

        return p;
    }
}

/**
 * Returns calculated array of transformation definitions for the animation of icon movement.
 * Function defines one transform for every pixel of shift of the icon from it's original y
 * position.
 *
 * @param x {number}  x coordinate of original position of the marker
 * @param y {number}  y coordinate of original position of the marker
 * @param bounceHeight {number}  height of bouncing (px)
 *
 * @return {string[]} array of transformation definitions
 */
export function calculateIconMoveTransforms(x, y, bounceHeight) {
    let t = [],     // array of transformations
        dY = bounceHeight + 1;      // delta Y

    // Use fast inverse while loop to fill the array
    while (dY--) {

        // Use matrix3d for hardware acceleration
        t[dY] = ' matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,' + x + ',' + (y - dY) + ',0,1) ';
    }

    return t;
}

/**
 * Returns calculated array of transformation definitions for the animation of shadow movement.
 * Function defines one transform for every pixel of shift of the shadow from it's original
 * position.
 *
 * @param x {number}  x coordinate of original position of marker
 * @param y {number}  y coordinate of original position of marker
 * @param bounceHeight {number}  height of bouncing (px)
 * @param angle {number}  shadow inclination angle, if null shadow don't moves from it's initial
 *      position (radians)
 *
 * @return {string[]} array of transformation definitions
 */
export function calculateShadowMoveTransforms(x, y, bounceHeight, angle) {
    // TODO: check this method to know if bounceHeight + 1 is normal
    let t = [],     // array of transformation definitions
        dY = bounceHeight + 1,      // delta Y
        p = [];

    if (angle != null) {  // important: 0 is not null
        p = calculateLine(x, y, angle, bounceHeight + 1);
    } else {
        for (let i = 0; i <= bounceHeight; i++) {
            p[i] = [x, y];
        }
    }

    // Use fast inverse while loop to fill the array
    while (dY--) {

        // Use matrix3d for hardware acceleration
        t[dY] = ' matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,' + p[dY][0] + ',' + p[dY][1] + ',0,1) ';
    }

    return t;
}

/**
 * Returns calculated array of transformation definitions for the animation of icon resizing.
 * Function defines one transform for every pixel of resizing of marker from it's original height.
 *
 * @param x {number}  x coordinate of original position of marker
 * @param y {number}  y coordinate of original position of marker
 * @param height {number}  original marker height (px)
 * @param contractHeight {number}  height of marker contraction (px)
 *
 * @return {string[]} array of transformation definitions
 */
export function calculateIconResizeTransforms(x, y, height, contractHeight) {
    let t = [],     // array of transformations
        dH = contractHeight + 1;    // delta of height

    // Use fast inverse while loop to fill the array
    while (dH--) {

        // Use matrix3d for hardware acceleration
        t[dH] = ' matrix3d(1,0,0,0,0,' + ((height - dH) / height) + ',0,0,0,0,1,0,' + x + ','
            + (y + dH) + ',0,1) ';
    }

    return t;
}

/**
 * Returns calculated array of animation steps. This function used to calculate both movement and
 * resizing animations. Arrays of steps are then cached in bouncingMotionsCache. Function checks
 * this cache before make any calculations.
 *
 * @param height {number}  height of movement or resizing (px)
 * @param prefix {string}  prefix of the key in the cache. Must be any string with trailing "_"
 *      character.
 *
 * @return {number[]} array of animation steps
 */
export function calculateSteps(height, prefix) {
    let key = prefix + height,
        steps = [],
        i;

    // Check the cache
    if (bouncingMotionsCache[key]) {
        return bouncingMotionsCache[key];
    }

    /* Calculate the sequence of animation steps:
     * steps = [1 .. height] concat [height-1 .. 0]
     */
    i = 1;
    while (i <= height) {
        steps.push(i++);
    }

    i = height;
    while (i--) {
        steps.push(i);
    }

    bouncingMotionsCache[key] = steps;  // save steps to the cache

    return steps;
}

/**
 * Returns calculated array of delays between animation start and the steps of animation. This
 * function used to calculate both movement and resizing animations. Element with index i of this
 * array contains the delay in milliseconds between animation start and the step number i. Those
 * delays are cached in bouncingMotionsCache. Function checks this cache before make any
 * calculations.
 *
 * @param height {number}  height of movement or resizing (px)
 * @param speed {number}  speed coefficient
 * @param prefix {string}  prefix of the key in the cache. Must be any string with trailing "_"
 *      character
 *
 * @return {number[]} array of delays before steps of animation
 */
export function calculateDelays(height, speed, prefix) {
    let key = prefix + height + '_' + speed,
        deltas = [],    // time between steps of animation
        delays = [],    // delays before steps from beginning of animation
        totalDelay = 0,
        l,
        i;

    // Check the cache
    if (bouncingMotionsCache[key]) {
        return bouncingMotionsCache[key];
    }

    // Calculate delta time for bouncing animation

    // Delta time to movement in one direction
    deltas[height] = speed;
    deltas[0] = 0;
    i = height;
    while (--i) {
        deltas[i] = Math.round(speed / (height - i));
    }

    // Delta time for movement in two directions
    i = height;
    while (i--) {
        deltas.push(deltas[i]);
    }

    // Calculate move delays (cumulated deltas)
    // TODO: instead of deltas.lenght write bounceHeight * 2 - 1
    for (i = 0, l = deltas.length; i < l; i++) {
        totalDelay += deltas[i];
        delays.push(totalDelay);
    }

    // Save move delays to cache
    bouncingMotionsCache[key] = delays;

    return delays;
}

/**
 * Calculates moveSteps, moveDelays, resizeSteps & resizeDelays for animation of supplied marker.
 *
 * Animation is defined by shifts of the marker from it's original position. Each step of the
 * animation is a shift of 1px.
 *
 * We define function f(x) - time of waiting between shift of x px and shift of x+1 px.
 *
 * We use for this the inverse function f(x) = a / x; where a is the animation speed and x is the
 * shift from original position in px.
 *
 * @param marker {Marker}  marker object
 * @return {Marker} the same updated marker
 */
export function calculateTimeline(marker) {
    const bouncingOptions = marker._bouncingOptions,
        {bounceHeight, bounceSpeed, elastic} = bouncingOptions;

    // Recalculate steps & delays of movement & resize animations
    marker._bouncingMotion.moveSteps = calculateSteps(bounceHeight, 'moveSteps_');
    marker._bouncingMotion.moveDelays = calculateDelays(bounceHeight, bounceSpeed, 'moveDelays_');

    // Calculate resize steps & delays only if elastic animation is enabled
    if (elastic) {
        const {contractHeight, contractSpeed} = bouncingOptions;

        marker._bouncingMotion.resizeSteps = calculateSteps(contractHeight, 'resizeSteps_');
        marker._bouncingMotion.resizeDelays = calculateDelays(contractHeight, contractSpeed,
            'resizeDelays_');
    }

    return marker;
}
