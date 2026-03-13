import { GeoLocation, GeoLocationCluster, feetToMeters } from "./geo.js";
import { AltitudeDriftResult } from './drift_simulation.js';
import { LaunchPathPoint, LaunchSimulationData } from "./launch.js";

// ff / 2 = af
// ff / 3 = 55
// ff / 4 = 3f
// ff / 5 = 33             orange    yellow     sky       lime     purple     aqua      navy     green      blue       red      grey      black     white
const kmlShapeColors =  [ '007cf5', '00ffff', 'fa931a', '00ff00', '800080', 'ffff00', '800000', '6abb66', 'ff0000', '0000ff', 'bdbdbd', '000000', 'ffffff' ];
const kmlMarkerColors = [ 'f57c00', 'ffff00', '1a93fa', '00ff00', '800080', '00ffff', '000080', '66bb6a', '0000ff', 'ff0000', 'bdbdbd', '000000', 'ffffff' ];

const DrawShapeTypes = Object.freeze({
    ELLIPSE: 0,
    POLYGON: 1,
    BOX: 2,
    NONE: 3
});

const ShapeFillTypes = Object.freeze({
    SOLID: 0,
    TRANSPARENT: 1,
    NONE: 2
});

const DrawPathTypes = Object.freeze({
    GROUND: 0,
    FLIGHT: 1,
    BOTH: 2,
    NONE: 3
});

const DrawMarkerTypes = Object.freeze({
    NONE: 0,
    TIMES: 1,
    NO_LABEL: 2
});

/**
 * Create a KML Element containing the name associated with the parent Element
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @returns {Element}
 */
function createKmlName(kmlDoc, name) {
    const nameElem = kmlDoc.createElement('name');
    nameElem.innerHTML = name;
    return nameElem;
}

/**
 * Create a KML Element defining the style used to draw a line
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} color - Color to be used when drawing the associated line
 * @param {number} width - Identifies how wide the associated line should be drawn
 * @returns {Element}
 */
function createKmlLineStyle(kmlDoc, color, width) {
    const lineStyleElem = kmlDoc.createElement('LineStyle');
    const lineColorElem = kmlDoc.createElement('color');
    lineColorElem.innerHTML = color;
    lineStyleElem.appendChild(lineColorElem);

    const lineWidthElem = kmlDoc.createElement('width');
    lineWidthElem.innerHTML = `${width}`;
    lineStyleElem.appendChild(lineWidthElem);

    return lineStyleElem;
}

/**
 * Create a KML Element defining the style used to draw a polygon
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} color - Color to be used when drawing the associated polygon
 * @returns {Element}
 */
function createKmlPolyStyle(kmlDoc, color) {
    const styleElem = kmlDoc.createElement('PolyStyle');
    const colorElem = kmlDoc.createElement('color');
    colorElem.innerHTML = color;
    styleElem.appendChild(colorElem);
    return styleElem;
}

/**
 * Create a KML Element defining the style used to draw a shape
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} outlineColor - Color to be used when drawing the associated shape's outline
 * @param {string} fillColor - Color to be used when drawing the associated shape's fill
 * @returns {Element}
 */
function createKmlShapeStyle(kmlDoc, outlineColor, fillColor) {
    const styleElem = kmlDoc.createElement('Style');
    styleElem.appendChild(createKmlLineStyle(kmlDoc, outlineColor, 2));
    styleElem.appendChild(createKmlPolyStyle(kmlDoc, fillColor));
    return styleElem;
}

/**
 * Create a KML Element containing a list of space separated geo-coordinates
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {Array.<GeoLocation>} coordinates - List of coordinates the Element will contain
 * @returns {Element}
 */
function createKmlCoordinates(kmlDoc, coordinates) {
    const coordinatesElem = kmlDoc.createElement('coordinates');
    coordinates.forEach((coord) => coordinatesElem.innerHTML += `${coord.longitude},${coord.latitude},0 `);
    return coordinatesElem;
}

/**
 * Create a KML Element containing a list of space separated geo-coordinates
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {Array.<LaunchPathPoint>} launchPath - List of points defining a flight path to be displayed
 * @param {boolean} clampToGround - Indicates if the lines should be clamped to the ground
 * @returns {Element}
 */
function createKmlLaunchPath(kmlDoc, launchPath, clampToGround) {
    const coordinatesElem = kmlDoc.createElement('coordinates');
    launchPath.forEach((pathPoint) => coordinatesElem.innerHTML += `${pathPoint.location.longitude},${pathPoint.location.latitude},${clampToGround ? 0 : feetToMeters(pathPoint.altitude)} `);
    return coordinatesElem;
}

/**
 * Create a KML Element defining a text label displayed without a marker icon
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {GeoLocation} coordinate - The coordinates where this label should be placed
 * @returns {Element}
 */
function createKmlLabel(kmlDoc, name, coordinate, agl = 0) {
    const labelElem = kmlDoc.createElement('Placemark');
    labelElem.setAttribute('xsi:type', 'KmlLabel');

    const nameElem = kmlDoc.createElement('name');
    nameElem.innerHTML = name;
    labelElem.appendChild(nameElem);

    const styleElem = kmlDoc.createElement('Style');
    const iconStyleElem = kmlDoc.createElement('IconStyle');
    const iconScaleElem = kmlDoc.createElement('scale');
    iconScaleElem.innerHTML = '0';
    iconStyleElem.appendChild(iconScaleElem);
    styleElem.appendChild(iconStyleElem);
    labelElem.appendChild(styleElem);

    const pointElem = kmlDoc.createElement('Point');
    const altModeElem = kmlDoc.createElement('altitudeMode');
    altModeElem.innerHTML = (0 === agl) ? 'clampToGround' : 'relativeToGround';
    pointElem.appendChild(altModeElem);

    const coordElem = kmlDoc.createElement('coordinates');
    coordElem.innerHTML = `${coordinate.longitude},${coordinate.latitude},${agl}`;
    pointElem.appendChild(coordElem);
    labelElem.appendChild(pointElem);

    return labelElem;
}

/**
 * Create a KML Element defining the display style for a marker
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {number} iconScale - Scale of the label's icon
 * @param {number} labelScale - Scale of the label's text
 * @param {string} color - Color to be used for displaying the marker's icon
 * @returns 
 */
function createKmlMarkerStyle(kmlDoc, iconScale, labelScale, color) {
    const styleElem = kmlDoc.createElement('Style');
    const iconStyleElem = kmlDoc.createElement('IconStyle');
    const iconStyleScaleElem = kmlDoc.createElement('scale');
    iconStyleScaleElem.innerHTML = iconScale;
    iconStyleElem.appendChild(iconStyleScaleElem);

    const iconElem = kmlDoc.createElement('Icon');
    const hrefElem = kmlDoc.createElement('href');
    hrefElem.innerHTML = `https://earth.google.com/earth/document/icon?color=${color}&amp;id=2000&amp;scale=4`;
    iconElem.appendChild(hrefElem);
    iconStyleElem.appendChild(iconElem);

    const hotSpotElem = kmlDoc.createElement('hotSpot');
    hotSpotElem.setAttribute('x', '64');
    hotSpotElem.setAttribute('y', '128');
    hotSpotElem.setAttribute('xunits', 'pixels');
    hotSpotElem.setAttribute('yunits', 'insetPixels');
    iconStyleElem.appendChild(hotSpotElem);

    const labelStyleElem = kmlDoc.createElement('labelStyle');
    const labelStyleScaleElem = kmlDoc.createElement('scale');
    labelStyleScaleElem.innerHTML = labelScale;
    labelStyleElem.appendChild(labelStyleScaleElem);
    iconStyleElem.appendChild(labelStyleElem);
    styleElem.appendChild(iconStyleElem);
    return styleElem;
}

/**
 * Create a KML Element defining a marker with an icon and text which reacts to being highlighted
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {string} color - The color to be used when drawing this marker's icon
 * @param {GeoLocation} location - Coordinates identifying where this icon should be placed
 * @returns 
 */
function createKmlMarker(kmlDoc, name, color, location) {
    const placemarkElem = kmlDoc.createElement('Placemark');
    placemarkElem.appendChild(createKmlName(kmlDoc, name));

    const styleMapElem = kmlDoc.createElement('StyleMap');
    const normalPairElem = kmlDoc.createElement('Pair');
    const normalKeyElem = kmlDoc.createElement('key');
    normalKeyElem.innerHTML = 'normal';
    normalPairElem.appendChild(normalKeyElem);
    normalPairElem.appendChild(createKmlMarkerStyle(kmlDoc, 0.75, 0.75, color));
    styleMapElem.appendChild(normalPairElem);

    const highlightPairElem = kmlDoc.createElement('Pair');
    const highlightKeyElem = kmlDoc.createElement('key');
    highlightKeyElem.innerHTML = 'highlight';
    highlightPairElem.appendChild(highlightKeyElem);
    highlightPairElem.appendChild(createKmlMarkerStyle(kmlDoc, 0.9, 0.75, color));
    styleMapElem.appendChild(highlightPairElem);
    placemarkElem.appendChild(styleMapElem);

    const pointElem = kmlDoc.createElement('Point');
    const altitudeModeElem = kmlDoc.createElement('altitudeMode');
    altitudeModeElem.innerHTML = 'clampToGround';
    pointElem.appendChild(altitudeModeElem);

    const coordinatesElem = kmlDoc.createElement('coordinates');
    coordinatesElem.innerHTML = `${location.longitude},${location.latitude},0`;
    pointElem.appendChild(coordinatesElem);
    placemarkElem.appendChild(pointElem);
    return placemarkElem;
}

/**
 * Create a KML Element defining a line displayed along the ground
 * @param {XMLDocument} kmlDoc - Parent Document to which this Element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {color} color - The color to be used when drawing this line
 * @param {boolean} clampToGround - Indicates if the lines should be clamped to the ground
 * @param {Array.<LaunchPathPoint>} flightPath - List of points defining the flight path to be drawn
 * @returns {Element}
 */
function createKmlLine(kmlDoc, name, color, clampToGround, flightPath) {
    const lineElem = kmlDoc.createElement('Placemark');
    lineElem.setAttribute('xsi:type', 'KmlLine');

    lineElem.appendChild(createKmlName(kmlDoc, name));

    const styleElem = kmlDoc.createElement('Style');
    styleElem.appendChild(createKmlLineStyle(kmlDoc, color, 1));
    lineElem.appendChild(styleElem);

    const lineStringElem = kmlDoc.createElement('LineString');
    const altModeElem = kmlDoc.createElement('altitudeMode');
    altModeElem.innerHTML = clampToGround ? 'clampToGround' : 'relativeToGround';
    lineStringElem.appendChild(altModeElem);

    const tessellateElem = kmlDoc.createElement('tessellate');
    tessellateElem.innerHTML = '1';
    lineStringElem.appendChild(tessellateElem);
    lineStringElem.appendChild(createKmlLaunchPath(kmlDoc, flightPath, clampToGround));
    lineElem.appendChild(lineStringElem);

    return lineElem;
}

/**
 * Create a KML Element which defines a polygon on the ground
 * @param {XMLDocument} kmlDoc - The XMLDocument parent to which the element will be appended
 * @param {Array.<GeoLocation>} coordinates - List of GeoLocations defining a convex polygon outline
 * @returns {Element} Polygon Element that was created
 */
function createKmlPolygon(kmlDoc, coordinates) {
    const polygonElem = kmlDoc.createElement('Polygon');

    const extrudeElem = kmlDoc.createElement('extrude');
    extrudeElem.innerHTML = 0;
    polygonElem.appendChild(extrudeElem);

    const altitudeModeElem = kmlDoc.createElement('altitudeMode');
    altitudeModeElem.innerHTML = 'clampToGround';
    polygonElem.appendChild(altitudeModeElem);

    const outerBoundaryElem = kmlDoc.createElement('outerBoundaryIs');
    const linearRingElem = kmlDoc.createElement('LinearRing');
    linearRingElem.appendChild(createKmlCoordinates(kmlDoc, coordinates));

    outerBoundaryElem.appendChild(linearRingElem);
    polygonElem.appendChild(outerBoundaryElem);
    return polygonElem;
}

/**
 * Create a KML Element which draws a shape displayed on the ground
 * @param {XMLDocument} kmlDoc - The XMLDocument parent to which the element will be appended
 * @param {string} name - Name to be assigned to the Element
 * @param {string} outlineColor - Color to be used when displaying the shape's outline
 * @param {string} fillColor - Color to be used when displaying the shape's fill
 * @param {Array.<GeoLocation>} coordinates - List of coordinates defining the ellipse outline
 * @returns {Element} - Ellipse Element that was created
 */
function createKmlShape(kmlDoc, name, outlineColor, fillColor, coordinates) {
    const placemarkElem = kmlDoc.createElement('Placemark');
    placemarkElem.setAttribute('xsi:type', 'KmlShape');

    placemarkElem.appendChild(createKmlName(kmlDoc, name));
    placemarkElem.appendChild(createKmlShapeStyle(kmlDoc, outlineColor, fillColor));
    placemarkElem.appendChild(createKmlPolygon(kmlDoc, coordinates));

    return placemarkElem;
}

/**
 * Convert the drift results into KML shape Elements inside an XMLDocument
 * @type {Array.<AltitudeDriftResult} altitudeDriftResults - List of drift results for each altitude
 * @type {DrawPathTypes} pathType - Indicates which type of simulation paths should be drawn
 * @type {DrawShapeTypes} shapeType - Indicates which type of shape around landing locations should be drawn
 * @type {ShapeFillTypes} fillType - Indicates how the landing location shapes should appear
 * @type {DrawMarkerTypes} markerType - Indicates which type of marker should be drawn
 * @returns {XMLDocument}
 */
function createAltitudeDriftDocument(altitudeDriftResults, pathType, shapeType, fillType, markerType) {
    const kmlDoc = document.implementation.createDocument(null, null);
    
    const kmlElem = kmlDoc.createElement('kml');
    kmlElem.setAttribute('xmlns', 'http://www.opengis.net/kml/2.2');
    kmlElem.setAttribute('xmlns:gx', 'http://www.google.com/kml/ext/2.2');
    kmlElem.setAttribute('xmlns:kml', 'http://www.opengis.net/kml/2.2');
    kmlElem.setAttribute('xmlns:atom', 'http://www.w3.org/2005/Atom');
    kmlElem.setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
    kmlElem.setAttribute('xmlns:xsd', 'http://www.w3.org/2001/XMLSchema');

    const documentElem = kmlDoc.createElement('Document');

    // Keep track of the color index seperately just in case we need it to wrap around
    let kmlColorIndex = 0;

    if (DrawPathTypes.GROUND === pathType || DrawPathTypes.BOTH === pathType) {
        // Store ground paths in an array so they can be appended as children in reverse order.
        // That way shorter drift paths from lower altitudes will be drawn on top.
        let groundPathElements = [];

        // Iterate over each altitude band
        altitudeDriftResults.forEach((altDriftResult) => {
            // Iterate over each drift simulation inside this altitude band
            altDriftResult.simList().forEach((simData) => {
                // Draw ground paths as mostly transparent since landing zones are the priority
                groundPathElements.unshift(createKmlLine(kmlDoc,
                    `${altDriftResult.apogee()}_${simData.getLaunchTime()}`,
                    `3f${kmlShapeColors[kmlColorIndex]}`,
                    true,
                    simData.launchPath));
            });

            // Move to the next color wrapping back to the beginning if neccessary
            if (++kmlColorIndex >= kmlShapeColors.length) {
                kmlColorIndex = 0;
            }
        });

        // Now looping over each array element will append them in the reverse order of creation for better visibility
        groundPathElements.forEach((groundPathElem) => { documentElem.appendChild(groundPathElem); });
    }

    if (DrawPathTypes.FLIGHT === pathType || DrawPathTypes.BOTH === pathType) {
        // Reset our color index
        kmlColorIndex = 0;

        // Draw order is not important for flight paths since they do not overlap as with ground paths
        // Iterate over each altitude band
        altitudeDriftResults.forEach((altDriftResult) => {
            // Iterate over each drift simulation inside this altitude band
            altDriftResult.simList().forEach((simData) => {
                // Draw flight paths as opaque since they do not directly overlap with landing zones
                documentElem.appendChild(createKmlLine(kmlDoc,
                    `${altDriftResult.apogee()}_${simData.getLaunchTime()}`,
                    `07${kmlShapeColors[kmlColorIndex]}`,
                    false,
                    simData.launchPath));
            });

            // Move to the next color wrapping back to the beginning if neccessary
            if (++kmlColorIndex >= kmlShapeColors.length) {
                kmlColorIndex = 0;
            }
        });
    }

    // Reset our color index
    kmlColorIndex = 0;

    // Create landing location markers to help visualize what is happening while debugging
    altitudeDriftResults.forEach((altDriftResult) => {
        const clusterName = `${altDriftResult.apogee()} Feet`;
        const outlineColor = `ff${kmlShapeColors[kmlColorIndex]}`;
        let fillColor;
        if (ShapeFillTypes.SOLID === fillType) {
            fillColor = `ff${kmlShapeColors[kmlColorIndex]}`;
        } else if (ShapeFillTypes.TRANSPARENT === fillType) {
            fillColor = `af${kmlShapeColors[kmlColorIndex]}`;
        } else {
            fillColor = `00${kmlShapeColors[kmlColorIndex]}`;
        }
        const landingCluster = new GeoLocationCluster(altDriftResult.landingLocations());

        switch (shapeType) {
            case DrawShapeTypes.ELLIPSE: {
                documentElem.appendChild(createKmlShape(kmlDoc, clusterName, outlineColor, fillColor, landingCluster.ellipsePoints()));
                break;
            }
            case DrawShapeTypes.POLYGON: {
                documentElem.appendChild(createKmlShape(kmlDoc, clusterName, outlineColor, fillColor, landingCluster.convexHullPoints()));
                break;
            }
            case DrawShapeTypes.BOX: {
                documentElem.appendChild(createKmlShape(kmlDoc, clusterName, outlineColor, fillColor, landingCluster.obbPoints()));
                break;
            }
        }

        if (DrawMarkerTypes.NONE != markerType) {
            altDriftResult.simList().forEach((simResult) => {
                documentElem.appendChild(createKmlMarker(kmlDoc,
                    markerType === DrawMarkerTypes.TIMES ? simResult.getLaunchTime() : '',
                    kmlMarkerColors[kmlColorIndex],
                    simResult.getLandingLocation()));
            });
        }

        // Display a text only label at the shape's center
        documentElem.appendChild(createKmlLabel(kmlDoc, clusterName, landingCluster.centerLocation()));

        // // Display a text only label at the flight path's apogee
        // const lSimData = altDriftResult.simList()[0];
        // documentElem.appendChild(createKmlLabel(kmlDoc, clusterName, lSimData.getApogeeLocation(), feetToMeters(lSimData.getApogee())));

        // Move to the next color wrapping back to the beginning if neccessary
        if (++kmlColorIndex >= kmlShapeColors.length) {
            kmlColorIndex = 0;
        }
    });

    // Create a marker showing where the original launch site is located
    documentElem.appendChild(createKmlMarker(kmlDoc, 'Launch Site', 'ff0000', altitudeDriftResults[0].simList()[0].getLaunchLocation()));

    kmlElem.appendChild(documentElem);
    kmlDoc.appendChild(kmlElem);

    return kmlDoc;
}

/**
 * Attempts to write a Blob's contents into a file designated by the user.
 * @param {Blob} kmlBlob - Text formated in the KML standard to be saved.
 * @param {string} defaultName - Name to be suggested when the user selects a destination file.
 */
async function saveKmlFile(kmlBlob, defaultName) {
    // Feature detection. The API needs to be supported
    // and the app not run in an iframe.
    const supportsFileSystemAccess = 'showSaveFilePicker' in window && (() => {
        try {
            return window.self === window.top;
        } catch {
            return false;
        }
    })();

    // If the File System Access API is supported
    if (supportsFileSystemAccess) {
        try {
            const filePickerOptions = {
                types: [
                    {
                        description: "Google Earth file",
                        accept: { "application/vnd.google-earth.kml+xml": [".kml"] },
                    },
                ],
                excludeAcceptAllOption: true,
                multiple: false,
                suggestedName: defaultName,
            };

            // Create a file save dialog for the user to select a location and name
            const saveFileHandle = await showSaveFilePicker(filePickerOptions);

            // Create a FileSystemWritableFileStream we can write to
            const writableFile = await saveFileHandle.createWritable();
            
            // Write our blob's contents to the file
            await writableFile.write(kmlBlob);

            // Close the file and write the contents to disk
            await writableFile.close();
        } catch (err) {
            // Fail silently if the user has simply canceled the dialog.
            if (err.name !== 'AbortError') {
                console.error(err.name, err.message);
            }
        }
    } else {
        // Fallback if the File System Access API is not supported
        // Create the blob URL
        const blobURL = URL.createObjectURL(kmlBlob);

        // Create the `<a download>` element and append it invisibly.
        const a = document.createElement('a');
        a.href = blobURL;
        a.download = defaultName;
        a.style.display = 'none';
        document.body.append(a);

        // Programmatically click the element.
        a.click();

        // Revoke the blob URL and remove the element.
        setTimeout(() => {
            URL.revokeObjectURL(blobURL);
            a.remove();
        }, 1000);
    }
};

export { DrawShapeTypes, ShapeFillTypes, DrawPathTypes, DrawMarkerTypes, createAltitudeDriftDocument, saveKmlFile };