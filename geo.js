/* Stores the latitude and longitude defining a geograpical location. */
class GeoLocation {
    /**
     * The latitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #latitude = 0.0;

    /**
     * The longitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #longitude = 0.0;

    /**
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {number} lat - The latitude component of this location.
     * @param {number} lon - The longitude component of this location.
     * @throws {TypeError} Invalid coordinate.
     */
    constructor(lat, lon) {
        if (isNaN(lat)) throw new TypeError(`Invalid latitude: ${lat}`);
        if (isNaN(lon)) throw new TypeError(`Invalid longitude: ${lon}`);

        this.#latitude = lat;
        this.#longitude = lon;
    }

    /**
     * Latitude component of this location's coordinates.
     * @type {number}
     */
    get latitude() { return this.#latitude; }
    set latitude(lat) { this.#latitude = lat; }

    /**
     * Longitude component of this location's coordinates.
     * @type {number}
     */
    get longitude() { return this.#longitude; }
    set longitude(lon) { this.#longitude = lon; }

    /**
     * Obtain a new object with duplicate data as this one.
     * @returns {GeoLocation} The duplicate object.
     */
    getCopy() {
        return new GeoLocation(this.#latitude, this.#longitude);
    }
}

/* Stores the latitude and longitude defining a geograpical line. */
class GeoVector {
    /**
     * The latitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #latitude = 0.0;

    /**
     * The longitude component of this location's coordinates.
     * @private
     * @type {number}
     */
    #longitude = 0.0;

    /**
     * Initializes a location using the provided latitude and longitude coordinates.
     * @param {number} lon - The longitude component of this location.
     * @param {number} lat - The latitude component of this location.
     * @throws {TypeError} Invalid coordinate.
     */
    constructor(lon, lat) {
        if (isNaN(lat)) throw new TypeError(`Invalid latitude: ${lat}`);
        if (isNaN(lon)) throw new TypeError(`Invalid longitude: ${lon}`);

        this.#latitude = lat;
        this.#longitude = lon;
    }

    /**
     * Initializes a location using the latitude and longitude coordinates from the provided GeoVector.
     * @param {GeoVector} other - The other GeoVector to be copied
     * @returns {GeoVector}
     * @throws {TypeError} Invalid coordinate.
     */
    static makeCopy(other) {
        if (isNaN(other.latitude)) throw new TypeError(`Invalid latitude: ${other.latitude}`);
        if (isNaN(other.longitude)) throw new TypeError(`Invalid longitude: ${other.longitude}`);

        return new GeoVector(other.longitude, other.latitude);
    }

    /**
     * Latitude component of this location's coordinates.
     * @type {number}
     */
    get latitude() { return this.#latitude; }
    set latitude(lat) { this.#latitude = lat; }

    /**
     * Longitude component of this location's coordinates.
     * @type {number}
     */
    get longitude() { return this.#longitude; }
    set longitude(lon) { this.#longitude = lon; }

    /**
     * Identify the midpoint on a line between this geographic location and another
     * @param {GeoVector} inVec - Another geographic location
     * @returns {GeoVector}
     */
    midpoint(inVec) {
        return new GeoVector(0.5 * (this.#longitude - inVec.longitude), 0.5 * (this.#latitude - inVec.latitude));
    }

    /**
     * Calculate the delta between latitude and longitude values of this and another geographic point
     * @param {GeoVector} inVec - The other geographic location
     * @returns {GeoVector}
     */
    diff(inVec) {
        return new GeoVector(this.#longitude - inVec.longitude, this.#latitude - inVec.latitude);
    }

    /**
     * Calculate the distance between this and another geographic location
     * @param {GeoVector} inVec - The other geographic location
     * @returns {number}
     */
    distance(inVec) {
        const deltaLon = this.#longitude - inVec.longitude;
        const deltaLat = this.#latitude - inVec.latitude;
        return Math.sqrt((deltaLon * deltaLon) + (deltaLat * deltaLat));
    }

    /**
     * Calculate the squared length of a line between this location and the grid's origin
     * @returns {number}
     */
    sqrLength() {
        return (this.#longitude * this.#longitude) + (this.#latitude * this.#latitude);
    }

    /**
     * Calculates the length of a line between this location and the grid's origin
     * @returns {number}
     */
    length() {
        return Math.sqrt(this.sqrLength());
    }

    /**
     * Calculates the dot product between two vectors spanning from the grid's origin to
     * this location and another
     * @param {GeoVector} inVec - The other location
     * @returns {number}
     */
    dot(inVec) {
        return (this.#longitude * inVec.longitude) + (this.#latitude * inVec.latitude);
    }

    /**
     * Create a GeoVector orthoganl to this one
     * @returns {GeoVector}
     */
    orthogonal() {
        return new GeoVector(this.#latitude, this.#longitude * -1.0);
    }

    /**
     * Treats this as a vector spanning from the grid's origin and updates it to be normalized
     */
    normalize() {
        const myLength = this.length();
        this.#longitude /= myLength;
        this.#latitude /= myLength;
    }

    /**
     * Updates this object's internal values as though it is a vector spanning from the grid's
     * origin and is now being scaled
     * @param {number} scaleValue - The value to scale this vector
     */
    scale(scaleValue) {
        this.#longitude *= scaleValue;
        this.#latitude *= scaleValue;
    }

    /**
     * Inverts the positive/negative value of all internal values
     */
    negate() {
        this.#longitude *= -1.0;
        this.#latitude *= -1.0;
    }

    /**
     * Creates a new GeoVector with values generated by adding the values of two other objects
     * @param {GeoVector} a - The first other object
     * @param {GeoVector} b - The second other object
     * @returns {GeoVector}
     */
    static add(a, b) {
        return new GeoVector(a.longitude + b.longitude, a.latitude + b.latitude);
    }

    /**
     * Creates a new GeoVector with values generated by subtracting the values of two other objects
     * @param {GeoVector} a - The first other object
     * @param {GeoVector} b - The second other object
     * @returns {GeoVector}
     */
    static subtract(a, b) {
        return new GeoVector(a.longitude - b.longitude, a.latitude - b.latitude);
    }

    /**
     * Calculates the shortest distance from this point to a line defined by two other points
     * @param {GeoVector} vec1 - The first line endpoint
     * @param {GeoVector} vec2 - The second line endpoint
     * @returns {number}
     */
    distanceToLine(vec1, vec2) {
        const squaredLength = GeoVector.subtract(vec2, vec1).sqrLength();
        let u = (this.#longitude - vec1.longitude) * (vec2.longitude - vec1.latitude);
        u *= (this.#latitude - vec1.latitude) * (vec2.latitude - vec1.latitude);
        u /= squaredLength;

        const v1c = vec2.diff(vec1);
        v1c.scale(u);

        // const p1 = GeoVector.makeCopy(vec1);
        // p1 += v1c;
        const p1 = GeoVector.add(vec1, v1c);

        return distance(p1);
    }

    /**
     * Calculates the intersection point between two lines identified by a single endpoint and direction
     * @param {GeoVector} start0 - The first line endpoint
     * @param {GeoVector} dir0 - The first line direction
     * @param {GeoVector} start1 - The second line endpoint
     * @param {GeoVector} dir1 - The second line direction
     * @returns {GeoVector}
     */
    static IntersectLines(start0, dir0, start1, dir1) {
        const dd = dir0.longitude * dir1.latitude - dir0.latitude * dir1.longitude;
        // dd=0 => lines are parallel. we don't care as our lines are never parallel.
        const dx = start1.longitude - start0.longitude;
        const dy = start1.latitude - start0.latitude;
        const t = (dx * dir1.latitude - dy * dir1.longitude) / dd;
        return new GeoVector(start0.longitude + t * dir0.longitude, start0.latitude + t * dir0.latitude);
    }
}

class GeoLocationCluster {
    /**
     * Original list of coordinates contained within this cluster
     * @private
     * @type {Array.<GeoLocation>}
     */
    #cluster = [];

    /**
     * List of coordinates identifying vertices of a minimal convex hull surrounding this cluster
     * @private
     * @type {Array.<GeoLocation>}
     */
    #convexHull = [];

    /**
     * List of coordinates identifying corners of a minimal oriented bounding box surrounding this cluster's convex hull
     * @private
     * @type {Array.<GeoLocation>}
     */
    #obb = [];

    /**
     * Geographic location at this cluster's center (based on the minimum oriented bounding box)
     * @private
     * @type {GeoLocation}
     */
    #center = null;

    /**
     * Uses the provided list of location's as the initial cluster to generate various surrounding shapes
     * @param {Array.<GeoLocation>} locationList
     */
    constructor(locationList) {
        // First perform a deep copy of the provided list to ensure our data remains unaltered going forward
        locationList.forEach((theLocation) => this.#cluster.push(theLocation.getCopy()));

        // With the cluster now established, the first step is to find it's convex hull
        this.#calculateConvexHull();

        // Final step is calculating the oreinted bounding box around the cluster, plus it's central point
        this.#calculateOBB();
    }

    /**
     * Calculate a minimal convex hull surrounding our internal cluster of geographic locations
     * @private
     */
    #calculateConvexHull() {
        // There must be a minimum of 3 geographic locations to calculate a convex hull
        if (this.#cluster.length < 3) {
            console.debug(`Cannot calculate a convex hull with only ${this.#cluster.length} locations.`);
            return;
        }

        // Find the leftmost point. Ignoring cases which span the meridian line for now.
        let leftmostIndex = 0;
        for (let index = 1; index < this.#cluster.length; ++index)
        {
            if (this.#cluster[index].longitude < this.#cluster[leftmostIndex].longitude) {
                leftmostIndex = index;
            }
        }

        // Start from leftmost point. Keep moving counter-clockwise until encountering
        // the start point again.
        let currentIndex = leftmostIndex;
        do
        {
            // Add current point to result
            this.#convexHull.push(this.#cluster[currentIndex].getCopy());

            // Search for a point 'q' such that 
            // orientation(p, q, x) is counterclockwise 
            // for all points 'x'. The idea is to keep 
            // track of last visited most counter-clock-
            // wise point in q. If any point 'i' is more 
            // counter-clock-wise than q, then update q.
            let q = (currentIndex + 1) % this.#cluster.length;

            for (let i = 0; i < this.#cluster.length; i++)
            {
                // If i is more counterclockwise than 
                // current q, then update q
                if (GeoLocationCluster.#isCounterClockwise(this.#cluster[currentIndex],
                    this.#cluster[i],
                    this.#cluster[q])) {
                    q = i;
                }
            }

            // Now q is the most counterclockwise with
            // respect to p. Set p as q for next iteration, 
            // so that q is added to result 'hull'
            currentIndex = q;

        } while (currentIndex != leftmostIndex); // While we don't come to first point
    }

    /**
     * Calculate a minimal oriented bounding box surrounding our internal cluster of geographic locations
     * @private
     */
    #calculateOBB() {
        if (this.#convexHull.length < 3) {
            console.debug(`Cannot calculate a bounding box around a convex hull with only ${this.#convexHull.length} locations.`);
            return;
        }

        let bestObbArea = Number.MAX_SAFE_INTEGER;

        // Convert our convex hull from GeoLocations into GeoVectors
        const convexHullVectors = [];
        this.#convexHull.forEach((currentPoly) => convexHullVectors.push(new GeoVector(currentPoly.longitude, currentPoly.latitude)));

        // compute directions of convex hull edges
        const edgeDirs = [];

        for (let i = 0; i < convexHullVectors.length; i++)
        {
            const newEdge = convexHullVectors[(i + 1) % convexHullVectors.length].diff(convexHullVectors[i]);
            newEdge.normalize();
            edgeDirs.push(newEdge);
        }

        // compute extreme points
        const minPt = new GeoVector(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
        const maxPt = new GeoVector(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
        let leftIdx = 0;
        let rightIdx = 0;
        let topIdx = 0;
        let bottomIdx = 0;

        for (var i = 0; i < convexHullVectors.length; i++)
        {
            if (convexHullVectors[i].longitude < minPt.longitude)
            {
                minPt.longitude = convexHullVectors[i].longitude;
                leftIdx = i;
            }

            if (convexHullVectors[i].longitude > maxPt.longitude)
            {
                maxPt.longitude = convexHullVectors[i].longitude;
                rightIdx = i;
            }

            if (convexHullVectors[i].latitude < minPt.latitude)
            {
                minPt.latitude = convexHullVectors[i].latitude;
                bottomIdx = i;
            }

            if (convexHullVectors[i].latitude > maxPt.latitude)
            {
                maxPt.latitude = convexHullVectors[i].latitude;
                topIdx = i;
            }
        }

        // initial caliper lines + directions
        //
        //        top
        //      <-------
        //      |      A
        //      |      | right
        // left |      |
        //      V      |
        //      ------->
        //       bottom
        let leftDir = new GeoVector(0.0, -1);
        let rightDir = new GeoVector(0, 1);
        let topDir = new GeoVector(-1, 0);
        let bottomDir = new GeoVector(1, 0);

        // execute rotating caliper algorithm
        for (let i = 0; i < convexHullVectors.length; i++)
        {
            // 0=left, 1=right, 2=top, 3=bottom
            let lineWithSmallestAngle = 0;
            let currentAngle = Math.acos(leftDir.dot(edgeDirs[leftIdx]));
            let testAngle = Math.acos(rightDir.dot(edgeDirs[rightIdx]));
            if (testAngle < currentAngle)
            {
                lineWithSmallestAngle = 1;
                currentAngle = testAngle;
            }

            testAngle = Math.acos(topDir.dot(edgeDirs[topIdx]));
            if (testAngle < currentAngle)
            {
                lineWithSmallestAngle = 2;
                currentAngle = testAngle;
            }

            testAngle = Math.acos(bottomDir.dot(edgeDirs[bottomIdx]));
            if (testAngle < currentAngle)
            {
                lineWithSmallestAngle = 3;
            }

            switch (lineWithSmallestAngle)
            {
                case 0: // left
                    leftDir = GeoVector.makeCopy(edgeDirs[leftIdx]);
                    rightDir = GeoVector.makeCopy(leftDir);
                    rightDir.negate();
                    topDir = leftDir.orthogonal();
                    bottomDir = GeoVector.makeCopy(topDir);
                    bottomDir.negate();
                    leftIdx = (leftIdx + 1) % convexHullVectors.length;
                    break;
                case 1: // right
                    rightDir = GeoVector.makeCopy(edgeDirs[rightIdx]);
                    leftDir = GeoVector.makeCopy(rightDir);
                    leftDir.negate();
                    topDir = leftDir.orthogonal();
                    bottomDir = GeoVector.makeCopy(topDir);
                    bottomDir.negate();
                    rightIdx = (rightIdx + 1) % convexHullVectors.length;
                    break;
                case 2: // top
                    topDir = GeoVector.makeCopy(edgeDirs[topIdx]);
                    bottomDir = GeoVector.makeCopy(topDir);
                    bottomDir.negate();
                    leftDir = bottomDir.orthogonal();
                    rightDir = GeoVector.makeCopy(leftDir);
                    rightDir.negate();
                    topIdx = (topIdx + 1) % convexHullVectors.length;
                    break;
                case 3: // bottom
                    bottomDir = GeoVector.makeCopy(edgeDirs[bottomIdx]);
                    topDir = GeoVector.makeCopy(bottomDir);
                    topDir.negate();
                    leftDir = bottomDir.orthogonal();
                    rightDir = GeoVector.makeCopy(leftDir);
                    rightDir.negate();
                    bottomIdx = (bottomIdx + 1) % convexHullVectors.length;
                    break;
            }

            const obbUpperLeft = GeoVector.IntersectLines(convexHullVectors[leftIdx], leftDir, convexHullVectors[topIdx], topDir);
            const obbUpperRight = GeoVector.IntersectLines(convexHullVectors[rightIdx], rightDir, convexHullVectors[topIdx], topDir);
            const obbBottomLeft = GeoVector.IntersectLines(convexHullVectors[bottomIdx], bottomDir, convexHullVectors[leftIdx], leftDir);
            const obbBottomRight = GeoVector.IntersectLines(convexHullVectors[bottomIdx], bottomDir, convexHullVectors[rightIdx], rightDir);
            const distLeftRight = obbUpperLeft.distance(obbUpperRight);
            const distTopBottom = obbUpperLeft.distance(obbBottomLeft);
            const obbArea = distLeftRight * distTopBottom;

            if (obbArea < bestObbArea)
            {
                this.#obb = [new GeoLocation(obbUpperLeft.latitude, obbUpperLeft.longitude),
                    new GeoLocation(obbBottomLeft.latitude, obbBottomLeft.longitude),
                    new GeoLocation(obbBottomRight.latitude, obbBottomRight.longitude),
                    new GeoLocation(obbUpperRight.latitude, obbUpperRight.longitude)];
                bestObbArea = obbArea;

                // Store this obb's central location
                const obbCenter = GeoVector.add(obbBottomRight, obbUpperLeft.midpoint(obbBottomRight));
                this.#center = new GeoLocation(obbCenter.latitude, obbCenter.longitude);
            }
        }
    }

    /**
     * Find orientation of ordered triplet (p, q, r)
     * @param {GeoLocation} p 
     * @param {GeoLocation} q 
     * @param {GeoLocation} r 
     * @returns {boolean}
     */
    static #isCounterClockwise(p, q, r)
    {
        const val = (q.latitude - p.latitude) * (r.longitude - q.longitude) - (q.longitude - p.longitude) * (r.latitude - q.latitude);
        return (val < 0.0);
    }

    /**
     * Provides a list of coordinates identifying the minimal convex hull surrounding this cluster
     * @returns {Array.<GeoLocation>}
     */
    convexHullPoints() {
        // Start with a copy of our convex hull location list
        const enclosedShape = this.#convexHull.slice();

        // Append an extra copy of the initial location to ensure the convex hull is drawn closed
        enclosedShape.push(enclosedShape[0]);

        return enclosedShape;
    }

    /**
     * Provides a list of coordinates identifying the minimal oriented bounding box surrounding this cluster
     * @returns {Array.<GeoLocation>}
     */
    obbPoints() {
        // Start with a copy of our oriented bounding box location list
        const enclosedShape = this.#obb.slice();

        // Append an extra copy of the initial location to ensure the convex hull is drawn closed
        enclosedShape.push(enclosedShape[0]);

        return enclosedShape;
    }

    /**
     * Provides a list of coordinates identifying the minimal ellipse surrounding this cluster
     * @returns {Array.<GeoLocation>}
     */
    ellipsePoints() {
        // We are currently generating an ellipse based on the oriented bounding box
        // 0=obbUpperLeft, 1=obbBottomLeft, 2=obbBottomRight, 3=obbUpperRight
        const obbVectors = [
            new GeoVector(this.#obb[0].longitude, this.#obb[0].latitude),
            new GeoVector(this.#obb[1].longitude, this.#obb[1].latitude),
            new GeoVector(this.#obb[2].longitude, this.#obb[2].latitude),
            new GeoVector(this.#obb[3].longitude, this.#obb[3].latitude)
        ];

        // const obbVectors = [
        //     new GeoVector(this.#obb[3].longitude, this.#obb[3].latitude),
        //     new GeoVector(this.#obb[0].longitude, this.#obb[0].latitude),
        //     new GeoVector(this.#obb[1].longitude, this.#obb[1].latitude),
        //     new GeoVector(this.#obb[2].longitude, this.#obb[2].latitude)
        // ];
;
        const centerVector = new GeoVector(this.#center.longitude, this.#center.latitude);

        const axisDirections = [
            GeoVector.subtract(obbVectors[1], obbVectors[0]),
            GeoVector.subtract(obbVectors[3], obbVectors[0])
        ];

        const axisLengths = [
            0.5 * axisDirections[0].length(),
            0.5 * axisDirections[1].length()
        ];

        // Normalize the direction vectors now that we have the axis lengths stored
        axisDirections[0].normalize();
        axisDirections[1].normalize();

        const toCorner = GeoVector.subtract(obbVectors[2], obbVectors[0]);
        const toCornerLength = toCorner.length() / 2.0;
        toCorner.normalize();

        const dotProd = toCorner.dot(axisDirections[0]);
        const cornerAngle = Math.acos(dotProd);

        const scaleFactor = 1.4;
        axisLengths[0] *= scaleFactor;
        axisLengths[1] *= scaleFactor;

        // Initialize this array with 40 empty entries so the following logic can directly access the slots
        let points = [];
        for (let i = 0; i < 40; i++) {
            points.push(null);
        }

        const offsets = [
            GeoVector.makeCopy(axisDirections[0]),
            GeoVector.makeCopy(axisDirections[1])
        ];
        offsets[0].scale(axisLengths[0]);
        offsets[1].scale(axisLengths[1]);

        points[0] = GeoVector.add(centerVector, offsets[0]);
        points[10] = GeoVector.add(centerVector, offsets[1]);
        points[20] = GeoVector.subtract(centerVector, offsets[0]);
        points[30] = GeoVector.subtract(centerVector, offsets[1]);

        for (let x = 1; x < 10; ++x)
        {
            const currentAngle = (Math.PI / 20.0) * x;

            const deltas = [
                GeoVector.makeCopy(offsets[0]),
                GeoVector.makeCopy(offsets[1])
            ];

            deltas[0].scale(Math.cos(currentAngle));
            deltas[1].scale(Math.sin(currentAngle));

            points[x] = GeoVector.add(centerVector, GeoVector.add(deltas[0], deltas[1]));
            points[20 - x] = GeoVector.subtract(centerVector, GeoVector.subtract(deltas[0], deltas[1]));
            points[20 + x] = GeoVector.subtract(centerVector, GeoVector.add(deltas[0], deltas[1]));
            points[40 - x] = GeoVector.add(centerVector, GeoVector.subtract(deltas[0], deltas[1]));
        }

        // Convert the GeoVectors into GeoLocations
        const enclosedShape = [];
        points.forEach((vectorPoint) => enclosedShape.push(new GeoLocation(vectorPoint.latitude, vectorPoint.longitude)));

        // Append a copy of the initial point to close the ellipse
        enclosedShape.push(new GeoLocation(points[0].latitude, points[0].longitude));

        return enclosedShape;
    }

    /**
     * Provides the geographic location centered within this cluster
     * @returns {GeoLocation}
     */
    centerLocation() {
        return this.#center;
    }
}

/**
 * Convert a distance from feet into meters.
 * @param {number} distanceFeet - The original distance in feet.
 * @returns {number} Distance converted into meters.
 */
function feetToMeters(distanceFeet) {    
    return distanceFeet * 0.3048;
}

/**
 * Convert a distance from meters into feet.
 * @param {number} distanceMeters - The original distance in meters.
 * @returns {number} Distance converted into feet.
 */
function metersToFeet(distanceMeters) {    
    return distanceMeters / 0.3048;
}

/**
 * Returns the provided angle in radians after conversion from degrees
 * @param   {number} degrees - Angle in degrees to be converted
 * @returns {number} Angle converted to radians
 */
function degreesToRadians(degrees) {
    return degrees * Math.PI / 180.0;
}

/**
 * Returns the provided angle in radians after conversion from degrees
 * @param   {number} radians - Angle in radians to be converted
 * @returns {number} Angle converted to radians
 */
function radiansToDegrees(radians) {
    return radians * 180.0 / Math.PI;
}

/**
 * Updates a GeoLocation's data by moving the given distance along the given bearing.
 * @param   {GeoLocation} geoPosition - Initial location and to be updated as the destination.
 * @param   {number} distance - Distance (meters) to move.
 * @param   {number} bearing - Bearing (degrees from North) to move.
 */
function moveAlongBearing(geoPosition, distance, bearing) {
    // Dividing by the mean radius of Earth in meters
    const angularDistance = distance / 6371000;
    const bearingRadians = degreesToRadians(bearing);

    const latitudeRadians = degreesToRadians(geoPosition.latitude);
    const longitudeRadians = degreesToRadians(geoPosition.longitude);

    const sinPhi2 = Math.sin(latitudeRadians) * Math.cos(angularDistance) + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians);
    const y = Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians);
    const x = Math.cos(angularDistance) - Math.sin(latitudeRadians) * sinPhi2;

    // Update the values within the location object
    geoPosition.latitude = radiansToDegrees(Math.asin(sinPhi2));
    geoPosition.longitude = radiansToDegrees(longitudeRadians + Math.atan2(y, x));
}

/**
 * Updates a GeoLocation's data by moving the given distance along the given bearing.
 * @param   {GeoLocation} geoPosition - Initial location and to be updated as the destination.
 * @param   {number} distance - Distance (meters) to move.
 * @param   {number} bearing - Bearing (degrees from North) to move.
 */
function moveAlongBearingKilometers(geoPosition, distance, bearing) {
    // Convert the distance from meters to kilometers
    const distanceKM = distance / 1000.0;

    // Dividing by the mean radius of Earth in kilometers
    const angularDistance = distanceKM / 6371.0;
    const bearingRadians = degreesToRadians(bearing);

    const latitudeRadians = degreesToRadians(geoPosition.latitude);
    const longitudeRadians = degreesToRadians(geoPosition.longitude);

    const sinPhi2 = Math.sin(latitudeRadians) * Math.cos(angularDistance) + Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearingRadians);
    const y = Math.sin(bearingRadians) * Math.sin(angularDistance) * Math.cos(latitudeRadians);
    const x = Math.cos(angularDistance) - Math.sin(latitudeRadians) * sinPhi2;

    // Update the values within the location object
    geoPosition.latitude = radiansToDegrees(Math.asin(sinPhi2));
    geoPosition.longitude = radiansToDegrees(longitudeRadians + Math.atan2(y, x));
}

/**
 * Calculates the distance (meters) between two GeoLocations. The ‘haversine’ formula is used
 * to calculate the shortest distance over the earth’s spherical surface.
 * @param {GeoLocation} locationA - First location.
 * @param {GeoLocation} locationB - Second location.
 * @returns {number} - Distance (meters) between the two specified locations.
 */
function distanceBetweenLocations(locationA, locationB) {
    // Convert the coordinate components from degrees to radians
    const latitudeA = degreesToRadians(locationA.latitude);
    const longitudeA = degreesToRadians(locationA.longitude);
    const latitudeB = degreesToRadians(locationB.latitude);
    const longitudeB = degreesToRadians(locationB.longitude);

    const latitudeDelta= latitudeB - latitudeA;
    const longitudeDelta = longitudeB - longitudeA;

    // Calculate the square of half the chord length between the points.
    let a = Math.sin(latitudeDelta / 2.0);
    a *= a;
    a += (Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2.0)* Math.sin(longitudeDelta / 2.0));

    // Now we can calculate the angular distance in radians.
    const c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));

    // Finally we multiply by the mean radius of earth in metres.
    return c * 6371000.0;
}

/**
 * Calculates the bearing (degrees from North) between two GeoLocations.
 * @param {GeoLocation} locationA - First location.
 * @param {GeoLocation} locationB - Second location.
 * @returns {number} - Bearing (degrees from North) from locationA toward locationB. NaN if both locations are identical.
 */
function bearingBetweenLocations(locationA, locationB) {
    if (locationA.latitude === locationB.latitude && locationB.longitude === locationB.longitude) {
        return NaN;
    }
    // Convert the coordinate components from degrees to radians
    const latitudeA = degreesToRadians(locationA.latitude);
    const latitudeB = degreesToRadians(locationB.latitude);
    const longitudeDelta = degreesToRadians(locationB.longitude - locationA.longitude);

    const x = Math.cos(latitudeA) * Math.sin(latitudeB) - Math.sin(latitudeA) * Math.cos(latitudeB) * Math.cos(longitudeDelta);
    const y = Math.sin(longitudeDelta) * Math.cos(latitudeB);
    const θ = Math.atan2(y, x);

    const bearing = radiansToDegrees(Math.atan2(y, x));

    // Ensure the resulting bearing is within the expected 0 -> 360 degree range.
    if (bearing < 0) {
        return bearing + 360;
    } else if (bearing > 360) {
        return brearing - 360;
    }
    return bearing;
}

export { GeoLocation, GeoLocationCluster };
export { feetToMeters, metersToFeet, moveAlongBearing, moveAlongBearingKilometers, distanceBetweenLocations, bearingBetweenLocations };