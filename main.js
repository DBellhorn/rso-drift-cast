import { GeoLocation, GeoLocationCluster } from "./geo.js";
import { DrawShapeTypes, ShapeFillTypes, DrawPathTypes, DrawMarkerTypes, createAltitudeDriftDocument, saveKmlFile } from "./kml.js";
import { LaunchTimeData, LaunchLocationData } from "./launch.js";
import { WindForecastData, getOpenMeteoWindPredictionData } from "./wind.js";

import { AltitudeDriftResult, driftSimulation } from './drift_simulation.js';
import { RocketApogee } from './rocket.js';

// Container of all detail cards
const dataEntrySection = document.getElementById('data-entry-section');
const detailCardContainer = document.getElementById('detail-card-container');

// Class names for displaying individual detail cards
const eventDetailCardClass = 'detail-card-one';
const driftDetailCardClass = 'detail-card-two';
const drawDetailCardClass = 'detail-card-three';

// Launch site input elements
const launchSiteLatitudeElement = document.getElementById('launch_site_latitude');
const launchSiteLongitudeElement = document.getElementById('launch_site_longitude');

// Launch time input elements
const launchDateElement = document.getElementById('launch_date');
const startTimeElement = document.getElementById('start_time');
const endTimeElement = document.getElementById('end_time');
const mainDescentRateElement = document.getElementById('decent_rate_main');
const mainEventAltitudeElement = document.getElementById('main_event_altitude');
const drogueDecentRateElement = document.getElementById('decent_rate_drogue');

// Launch altitude input elements
const launchAltitudeMaxElement = document.getElementById('altitude-max');
const launchAltitudeStepElement = document.getElementById('altitude-step');

// Weather option elements
const weatherModelSelect = document.getElementById('weather-model-select');
const weatherModelBestMatch = 'best_match';
const weatherModelEcmwf = 'ecmwf_ifs025';
const weatherModelGfs = 'gfs_seamless';
const weatherModelIcon = 'icon_seamless';

// KML shape drawing option elements
const kmlShapeSelect = document.getElementById('kml-shape-select');
const kmlShapeFillSelect = document.getElementById('kml-shape-fill-select');
const kmlPathSelect = document.getElementById('kml-path-select');
const kmlMarkerSelect = document.getElementById('kml-marker-select');

// Button elements
const eventNextButton = document.getElementById('btn-event-next');
const driftPreviousButton = document.getElementById('btn-drift-prev');
const driftNextButton = document.getElementById('btn-drift-next');
const drawPreviousButton = document.getElementById('btn-draw-prev');
const saveKmlFileButton = document.getElementById('btn-save-kml-file');

// Drift result display elements
const statusDisplayElement = document.getElementById('status-display');
const windAltitudeDisplayElement = document.getElementById('wind-altitude-display');
const windAltitudeDisplayTableId = 'wind-altitude-table';

const mapPreviewElement = document.getElementById('map');

/**
 * Store all wind data from various weather forecast models obtained from Open-Meteo
 * @type {WindForecastData}
 */
let windModelForecasts = null;

/**
 * Stores the results of wind drift simulation from a specific altitude
 * @type {Array.<AltitudeDriftResult}
 */
let altitudeDriftResults = [];

// Values used to limit forecast requests
const secondsInDay = 86400000;
const maxDaysPreviousOpenMeteo = 9;
const maxDaysFutureOpenMeteo = 15;

/**
 * Stores details about the rocket launch event provided by the user.
 * @type {LaunchLocationData}
 */
let launchLocationDetails = null;

/**
 * Stores all date and time values that a launch is active.
 * @type {LaunchTimeData}
 */
let launchTimes = null;

/**
 * List of altitudes (feet AGL) from which drift simulations will be performed.
 * @type {Array.<number>}
 */
let launchAltitudeBands = null;

/**
 * Colors used to draw lines and shapes on the preview map.  Location icons were
 * created with identical color values so everything is visually cohesive.
 *                       orange    yellow     sky       lime     purple     aqua      navy     green      blue       red      grey      black     white
 * @type {Array.<string>}
 */
const leafletColors = [ 'f57c00', 'ffff00', '1a93fa', '00ff00', '800080', '00ffff', '000080', '66bb6a', '0000ff', 'ff0000', 'bdbdbd', '000000', 'ffffff' ];

/**
 * Contains icon definitions with colors matching our line and shape values.
 * @type {Array.<L.Icon>}
 */
const leafletIcons = [
    new L.Icon({
        iconUrl: 'images/markers/marker-orange.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-yellow.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-sky.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-lime.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-purple.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-aqua.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-navy.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-green.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-blue.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-red.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-grey.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-black.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    }),
    new L.Icon({
        iconUrl: 'images/markers/marker-white.png',
        shadowUrl: 'images/markers/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    })
];

let map_preview = null;
let landingAreas = [];
let osmLayer = null;
let topoLayer = null;
let imageryLayer = null;
let baseMaps = null;
let launchMarker = null;
let launchMarkerLabel = null;

/** Stores information used to draw drift simulation results within a Leaflet map instance. */
class LeafletDriftResult {
    /**
     * Text of the time associated with this drift.
     * @private
     * @type {string}
     */
    #timeText = '';

    /**
     * Coordinates of this drift result's landing location.
     * @private
     * @type {GeoLocation}
     */
    #landingLocation = null;

    /**
     * Index into the array of available colors.
     * @private
     * @type {number}
     */
    #colorIndex = 0;

    /**
     * Leaflet tooltip indicating what time this drift occurs.
     * @private
     * @type {L.tooltip}
     */
    #timeLabel = null;

    /**
     * Leaflet marker placed at the landing location.
     * @private
     * @type {L.marker}
     */
    #marker = null;

    /**
     * Leaflet line following the travel path along the ground due to wind drift.
     * @private
     * @type {L.polyline}
     */
    #groundPath = null;

    /**
     * @param {LaunchSimulationData} simData - Contains results from the drift simulation to be represented.
     * @param {number} colorIndex - Index into the array of available Leaflet colors.
     */
    constructor(simData, colorIndex) {
        this.#colorIndex = colorIndex;
        this.#timeText = simData.getLaunchTime();
        this.#landingLocation = simData.getLandingLocation().getCopy();

        const driftPathCoordinates = [];
        simData.launchPath.forEach((pathPoint) => {
            driftPathCoordinates.push([pathPoint.location.latitude, pathPoint.location.longitude]);
        });

        // The drift path will remain constant, so just create it now without adding it to the map.
        this.#groundPath = L.polyline(driftPathCoordinates,
            {
                color: `#${leafletColors[colorIndex]}`,
                opacity: 0.25,
                weight: 1
            });
    }

    /**
     * Get the landing location coordinates for this drift result.
     * @returns {GeoLocation}
     */
    landingLocation() {
        return this.#landingLocation.getCopy();
    }

    /**
     * Create a marker instance and add it to the provided map object.
     * @param {L.map} map - Map object where the marker will be displayed.
     * @param {boolean} showLabel - Indicates if a label containing the time should appear with this marker.
     */
    showMarker(map, showLabel) {
        // Cleanup any existing assets.  Maybe try to keep them in the future to avoid thrashing memory?
        this.hideMarker();

        // Create the new marker
        this.#marker = L.marker([this.#landingLocation.latitude, this.#landingLocation.longitude],
            {
                icon: leafletIcons[this.#colorIndex],
                draggable: false
            });

        if (showLabel) {
            // Create the new time label.
            this.#timeLabel = L.tooltip({
                content: this.#timeText,
                permanent: true
            });
            this.#marker.bindTooltip(this.#timeLabel);
        }
        this.#marker.addTo(map);
    }

    /** Remove the marker and it's label from the map before destroying their assets. */
    hideMarker() {
        if (null !== this.#timeLabel) {
            this.#marker.unbindTooltip();
            this.#timeLabel = null;
        }
        if (null !== this.#marker) {
            this.#marker.remove();
            this.#marker = null;
        }
    }

    /**
     * Add the polyline created in our constructor to the map for display.
     * @param {L.map} map - Map object where the marker will be displayed.
     */
    showPath(map) {
        this.#groundPath.remove();
        this.#groundPath.addTo(map);
    }

    /** Remove our polyline from the map currently displaying it. */
    hidePath() {
        this.#groundPath.remove();
    }
}

/** Contains information for drawing the area surrounding a cluster of landing locations with a Leaflet map */
class LeafletLandingArea {
    /**
     * Apogee from which drift was simulated to produce this landing area's cluster.
     * @private
     * @type {number}
     */
    #apogee = 0;

    /**
     * Displays the altitude associated with this landing area.
     * @private
     * @type {L.popup}
     */
    #apogeeTooltip = null;

    /**
     * Index into the array of available colors.
     * @private
     * @type {number}
     */
    #colorIndex = 0;

    /**
     * Cluster of landing locations defining this landing area.
     * @private
     * @type {GeoLocationCluster}
     */
    #landingCluster = null;

    /**
     * List of drift results defining this landing area
     * @private
     * @type {Array.<LeafletDriftResult>}
     */
    #driftResults = [];

    /**
     * Leaflet polygon representing landing area.  Actual shape depends on the user's selection.
     * @private
     * @type {L.polygon}
     */
    #landingArea = null;

    /**
     * Coordinates of the upper-left and lower-right corners of a bounding box surrounding this landing area.
     * @private
     * @type {Array.<Array.<number>>}
     */
    #bounds = [];

    /**
     * @param {AltitudeDriftResult} altDriftResult 
     * @param {number} colorIndex - Identifies which color from our array should be used when drawing shapes.
     */
    constructor(altDriftResult, colorIndex) {
        this.#apogee = altDriftResult.apogee();
        this.#colorIndex = colorIndex;

        // Intialize our corner coordinates with worst case values.
        let upperLatitude = -90.0;
        let lowerLatitude = 90.0;
        let leftLongitude = 180.0;
        let rightLongitude = -180.0;

        // Iterate over each drift simulation inside this altitude band
        altDriftResult.simList().forEach((simData) => {
            this.#driftResults.push(new LeafletDriftResult(simData, colorIndex));
            this.#landingCluster = new GeoLocationCluster(altDriftResult.landingLocations());

            // Update our bounds with this drift simulation's path coordinates.
            simData.launchPath.forEach((pathPoint) => {
                if (pathPoint.location.latitude > upperLatitude)
                    upperLatitude = pathPoint.location.latitude;
                if (pathPoint.location.latitude < lowerLatitude)
                    lowerLatitude = pathPoint.location.latitude;
                if (pathPoint.location.longitude > rightLongitude)
                    rightLongitude = pathPoint.location.longitude;
                if (pathPoint.location.longitude < leftLongitude)
                    leftLongitude = pathPoint.location.longitude;
            });
        });

        this.#bounds.push([upperLatitude, leftLongitude]);
        this.#bounds.push([lowerLatitude, rightLongitude]);
    }

    /**
     * Creates Leaflet markers and associated text label to be displayed by the provided map object.
     * @param {L.map} map - The map object which will display the markers.
     * @param {booleam} showLabels - Indicates if there should be text markers attached to the markers.
     */
    showMarkers(map, showLabels) {
        this.#driftResults.forEach((driftResult) => {
            driftResult.showMarker(map, showLabels);
        });
    }

    /** Hides all Leaflet markers currently being displayed. */
    hideMarkers() {
        this.#driftResults.forEach((driftResult) => {
            driftResult.hideMarker();
        });
    }

    /**
     * Creates Leaflet polylines within the provided map representing drift paths associasted with this landing area.
     * @param {L.map} map - The map object which will display the paths.
     */
    showPaths(map) {
        this.#driftResults.forEach((driftResult) => {
            driftResult.showPath(map);
        });
    }

    /** Hides all Leaflet polylines currently being displayed. */
    hidePaths() {
        this.#driftResults.forEach((driftResult) => {
            driftResult.hidePath();
        });
    }

    /**
     * Creates a Leaflet polygon surrounding this landing area and adds it onto the provided map object.
     * @param {L.map} map - The Leaflet map object which will display the landing area.
     * @param {DrawShapeTypes} shapeType - Indicates what type of polygon shape should be created.
     * @param {ShapeFillTypes} fillType - Indicates if the polygon should be filled with color.
     */
    showLandingArea(map, shapeType, fillType) {
        if (null !== this.#landingArea) {
            this.#landingArea.remove();
            this.#landingArea = null;
        }
        if (null === this.#landingCluster)
            return;

        const polygonPoints = [];
        if (DrawShapeTypes.ELLIPSE === shapeType) {
            this.#landingCluster.ellipsePoints().forEach((ellipsePoint) => {
                polygonPoints.push([ellipsePoint.latitude, ellipsePoint.longitude]);
            });
        } else if (DrawShapeTypes.POLYGON === shapeType) {
            this.#landingCluster.convexHullPoints().forEach((hullPoint) => {
                polygonPoints.push([hullPoint.latitude, hullPoint.longitude]);
            });
        } else if (DrawShapeTypes.BOX === shapeType) {
            this.#landingCluster.obbPoints().forEach((boxPoint) => {
                polygonPoints.push([boxPoint.latitude, boxPoint.longitude]);
            });
        } else {
            return;
        }

        let polygonOpacity = 0.0;
        if (ShapeFillTypes.SOLID === fillType) {
            polygonOpacity = 1.0;
        } else if (ShapeFillTypes.TRANSPARENT === fillType) {
            polygonOpacity = 0.5;
        }

        this.#landingArea = L.polygon(polygonPoints,
            {
                color: `#${leafletColors[this.#colorIndex]}`,
                fillColor: `#${leafletColors[this.#colorIndex]}`,
                fillOpacity: polygonOpacity
            });
        this.#landingArea.addTo(map);

        if (null != this.#apogee && this.#apogee > 0) {
            const labelLocation = this.#landingCluster.centerLocation();

            // Create the apogee tooltip.
            this.#apogeeTooltip = L.tooltip()
                .setLatLng([labelLocation.latitude, labelLocation.longitude])
                .setContent(`<p>${this.#apogee} ft</p>`)
                .addTo(map);
        }
    }

    /** Hides the polygon surrounding this landing area before cleaning up the assets. */
    hideLandingArea() {
        if (null !== this.#landingArea) {
            this.#landingArea.remove();
            this.#landingArea = null;
        }
    }

    /** Hides all Leaflet layers owned by this object. */
    hideAll() {
        this.hideMarkers();
        this.hidePaths();
        this.hideLandingArea();
    }

    /**
     * Calculates the bounds surrounding all Leaflet objects within this landing area.
     * @returns {Array.<Array.<number>>} - Contains coordinates for the upper-left and lower-right corners
     */
    getBounds() {
        return this.#bounds;
    }
}

/**
 * Convert the proviced hour value (0-23) into a time input element compatible string.
 * @param {number} hour - The hour value to be converted.
 * @returns {string} String compatible with a time input element.
 */
function convertHourForTimeInput(hour) {
    let convertedHour = '';

    if (isNaN(hour) || hour > 23) {
        convertedHour = '00:00';
    } else if (hour < 10) {
        convertedHour = `0${hour}:00`;
    } else {
        convertedHour = `${hour}:00`;
    }

    return convertedHour;
}

/**
 * Update the value stored and displayed in the launch start time field.
 * @param {number} startHour - The new start hour for the launch.
 * @throws {TypeError} Invalid start hour value.
 */
function setStartTimeValue(startHour) {
    if (null === startTimeElement)
        return;

    if (isNaN(startHour))
        throw new TypeError(`Invalid start hour: ${startHour}.`);

    startTimeElement.value = convertHourForTimeInput(startHour);
}

/**
 * Update the value stored and displayed in the launch end time field.
 * @param {number} endHour - The new end hour for the launch.
 * @throws {TypeError} Invalid end hour value.
 */
function setEndTimeValue(endHour) {
    if (null === endTimeElement)
        return;

    if (isNaN(endHour))
        throw new TypeError(`Invalid end hour: ${endHour}.`);

    endTimeElement.value = convertHourForTimeInput(endHour);
}

/**
 * Create an object containing a launch site location based on the current UI data.
 * @returns {GeoLocation} Coordinates of launch site if successful. Otherwise returns null.
 */
function getLaunchSiteLocation() {
    const latitude = parseFloat(launchSiteLatitudeElement.value);
    if (isNaN(latitude)) {
        return null;
    } else if ((latitude > 90.0) || (latitude < -90.0)) {
        return null;
    }

    const longitude = parseFloat(launchSiteLongitudeElement.value);
    if (isNaN(longitude)) {
        return null;
    } else if ((longitude > 180.0) || (longitude < -180.0)) {
        return null;
    }

    return new GeoLocation(latitude, longitude);
}

/**
 * Change the text content of the status-display element and ensure it is visible.
 * @param {string} statusMessage - The text to be displayed within the element
 */
function updateStatusDisplay(statusMessage) {
    statusDisplayElement.textContent = statusMessage;
    statusDisplayElement.hidden = false;
    statusDisplayElement.scrollIntoView({ behavior: "instant", block: "end" });
}

/**
 * Determine the barb SVG file name to represent the provided wind speed.
 * @param {number} windSpeed - Speed (knots) of the wind
 * @returns {string} Pathless name of a barb SVG
 */
function getWindBarbSvgName(windSpeed) {
    // Determine which barb image should be displayed.
    const filteredSpeed = Math.round(Math.abs(windSpeed));

    let barbSpeed = 5 * Math.floor(filteredSpeed / 5);
    if ((filteredSpeed % 5) > 2) {
        barbSpeed += 5;
    }
    if (barbSpeed > 145) {
        // The largest available barb image is for 145 knots, so just clamp it for now.
        barbSpeed = 145;
    }
    return `wind-barb-${barbSpeed}.svg`;
}

/**
 * Determines the best CSS class name for a barb image representing the provided wind bearing.
 * @param {number} windBearing - Degrees from zero North
 * @returns {string} CSS class name which best matches the provided wind bearing
 */
function getWindBearingClass(windBearing) {
    // Wind barb standard calls for 36 possible bearing directions, or every 10°.
    // Divide by 10 so rounding will provide the expected class identifyer.
    // Example: 114° / 10 = 11.4 which rounds to 11, so re-multiplying by 10 gets us 110.
    //          227° / 10 = 22.7 with rounds to 23, so re-multiplying by 10 gets us 230.
    let barbBearing = 10 * Math.round(windBearing / 10);

    // Check for edge cases just to be safe.
    if (barbBearing > 359 || barbBearing < 0) {
        barbBearing = 0;
    }
    return `wind-barb-${barbBearing}`;
}

/**
 * Creates a table for display of drifting calucation results if one does not exist.
 * If one does exist, it clears all previous contents before adding the latest data.
 */
function updateWindAtAltitudeDisplay() {
    // Remove any existing table since a new one is about to be created.
    const existingTable = document.getElementById(windAltitudeDisplayTableId);
    if (null != existingTable) {
        windAltitudeDisplayElement.removeChild(existingTable);
    }
    
    if (null == windModelForecasts || null == launchTimes) {
        // Nothing to do without valid data to process.
        return;
    }
    
    // First step is of course to create the table itself.
    const windAltTable = document.createElement('table');
    windAltTable.setAttribute('id', windAltitudeDisplayTableId);

    // Next step is creating a header for the table starting with Time.
    const windAltTableHeader = document.createElement('thead');
    const windAltTableHeaderRow = document.createElement('tr');
    const windAltTableHeaderTime = document.createElement('th');
    windAltTableHeaderTime.innerHTML = 'Time';
    windAltTableHeaderRow.appendChild(windAltTableHeaderTime);

    // Column indicating which weather model's wind is being displayed.
    const windAltTableHeaderModel = document.createElement('th');
    windAltTableHeaderModel.innerHTML = 'Model';
    windAltTableHeaderRow.appendChild(windAltTableHeaderModel);

    // Ground Level covers 2 columns for speed and direction displays.
    const windAltTableHeaderGroundLevel = document.createElement('th');
    windAltTableHeaderGroundLevel.setAttribute('colspan', '2');
    windAltTableHeaderGroundLevel.innerHTML = 'Ground Level';
    windAltTableHeaderRow.appendChild(windAltTableHeaderGroundLevel);

    if (null != launchAltitudeBands) {
        launchAltitudeBands.forEach((altBand) => {
            const altBandHeader = document.createElement('th');

            // Ensure the value is an integer for simplest display.
            const altBandInt = Math.floor(altBand);

            // Insert commas if the text version will be over four characters.
            //const altBandText = (altBandInt >= 10000) ? `${Math.floor(altBandInt / 1000)},${Math.floor(altBandInt % 1000)}` : `${altBandInt}`;
            const altBandText = `${Math.floor(altBandInt / 1000)}`;
            //console.log(`Alt band ${altBand}, floor ${altBandInt}, text ${altBandText}`);

            //altBandHeader.innerHTML = `${altBandText} ft`;
            altBandHeader.innerHTML = `${altBandText}k ft`;
            windAltTableHeaderRow.appendChild(altBandHeader);
        });
    }

    windAltTableHeader.appendChild(windAltTableHeaderRow);
    windAltTable.appendChild(windAltTableHeader);

    // Now move on to displaying useful data in the body.
    const windAltTableBody = document.createElement('tbody');

    // Check which weather model the user would like to use for this drift simulation
    let weatherModelName = weatherModelBestMatch;
    switch (weatherModelSelect.value) {
        case 'weather-model-ecmwf': { weatherModelName = weatherModelEcmwf; break; }
        case 'weather-model-noaa': { weatherModelName = weatherModelGfs; break; }
        case 'weather-model-icon': { weatherModelName = weatherModelIcon; break; }
    }

    const windModelForecast = windModelForecasts.getWindModelForecast(weatherModelName);

    windModelForecast.forEach((windForecast) => {
        // Create a new row for this hour's wind values.
        const row = document.createElement('tr');

        // The time associated with this row's wind data.
        const timeCell = document.createElement('td');
        timeCell.innerHTML = windForecast.time;
        row.appendChild(timeCell);

        // Wind forecast model.
        const forecastModelCell = document.createElement('td');
        forecastModelCell.innerHTML = windForecast.model;
        row.appendChild(forecastModelCell);

        // Wind speed at ground level converted to MPH.
        const groundWindSpeedMph = Math.round(Math.abs(windForecast.groundWindSpeed * 1.15078));
        const windSpeedCell = document.createElement('td');

        // Indicate level of safety by transitioning background color from green to yellow to red.
        switch (groundWindSpeedMph) {
            case 0:
            case 1:
            case 2:
                windSpeedCell.style.background = '#32CD32';
                break;
            case 3:
            case 4:
                windSpeedCell.style.background = '#00FF00';
                break;
            case 5:
            case 6:
                windSpeedCell.style.background = '#40ff00';
                break;
            case 7:
            case 8:
                windSpeedCell.style.background = '#80ff00';
                break;
            case 9:
            case 10:
                windSpeedCell.style.background = '#bfff00';
                break;
            case 11:
            case 12:
                windSpeedCell.style.background = '#ffff00';
                break;
            case 13:
            case 14:
                windSpeedCell.style.background = '#ffbf00';
                break;
            case 15:
            case 16:
                windSpeedCell.style.background = '#ff8000';
                break;
            case 17:
            case 18:
            case 19:
                windSpeedCell.style.background = '#ff4000';
                break;
            default:
                windSpeedCell.style.background = '#ff0000';
                break;
        }
        windSpeedCell.appendChild(document.createTextNode(`${groundWindSpeedMph} MPH`));
        row.appendChild(windSpeedCell);

        // Average wind direction at ground level.
        const windDirectionCell = document.createElement('td');
        windDirectionCell.classList.add('wind-barb-cell');

        const windBarbContainer = document.createElement('div');
        windBarbContainer.classList.add('wind-barb-container');

        const windBarbImage = document.createElement('img');
        windBarbImage.setAttribute('src', `./images/wind-barbs/${getWindBarbSvgName(windForecast.groundWindSpeed)}`);
        windBarbImage.classList.add(getWindBearingClass(windForecast.groundWindDirection));
        windBarbImage.classList.add('wind-barb');

        windBarbContainer.appendChild(windBarbImage);
        windDirectionCell.appendChild(windBarbContainer);
        row.appendChild(windDirectionCell);

        if (null != launchAltitudeBands) {
            launchAltitudeBands.forEach((altBand) => {
                const altitudeBarbCell = document.createElement('td');
                altitudeBarbCell.classList.add('wind-barb-cell');

                const altitudeBarbContainer = document.createElement('div');
                altitudeBarbContainer.classList.add('wind-barb-container');

                const altitudeBarbImage = document.createElement('img');
                const windAtAlt = windForecast.getWindAtAltitude(altBand);
                altitudeBarbImage.setAttribute('src', `./images/wind-barbs/${getWindBarbSvgName(windAtAlt.speed)}`);
                altitudeBarbImage.classList.add(getWindBearingClass(windAtAlt.bearing));
                altitudeBarbImage.classList.add('wind-barb');

                altitudeBarbContainer.appendChild(altitudeBarbImage);
                altitudeBarbCell.appendChild(altitudeBarbContainer);
                row.appendChild(altitudeBarbCell);
            });
        }

        windAltTableBody.appendChild(row);
    });

    // Place our new body full of drift result data into the table.
    windAltTable.appendChild(windAltTableBody);
    windAltitudeDisplayElement.appendChild(windAltTable);
}

/** Creates a Leaflet map for display of drifting calucation results if one does not exist. */
async function updateMapDisplay(forceNewDriftResults = false) {
    const launchLocation = getLaunchSiteLocation();
    if (null === launchLocation)
        return;

    if (forceNewDriftResults || 0 === altitudeDriftResults.length) {
        // Try generating the drift results.
        await calculateDriftResults();

        if (0 === altitudeDriftResults.length)
            return;
    }

    mapPreviewElement.hidden = false;

    if (null === map_preview) {
        // Initialize the map display
        map_preview = L.map('map').setView([launchLocation.latitude, launchLocation.longitude], 13);

        // Add a tile layer with OpenStreetMap data
        osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });
        osmLayer.addTo(map_preview);

        // Add a tile layer with USGS topgraphic data
        topoLayer = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSTopo/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 16,
            attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
        });

        // Add a tile layer with USGS satellite imagery
        imageryLayer = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryTopo/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 16,
            attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
        });

        // Create a layer selector within the map object
        baseMaps = {
            'Streets': osmLayer,
            'Terrain': topoLayer,
            'Imagery': imageryLayer
        };
        L.control.layers(baseMaps).addTo(map_preview);
    }

    // Place a red marker at the launch site's location.
    if (null !== launchMarker) {
        launchMarker.setLatLng([launchLocation.latitude, launchLocation.longitude]);
    } else {
        launchMarker = L.marker([launchLocation.latitude, launchLocation.longitude],
            {
                icon: leafletIcons[9],
                draggable: false
            }
        );

        launchMarkerLabel = L.tooltip({
            content: 'Launch Site',
            permanent: true
        });
        launchMarker.bindTooltip(launchMarkerLabel);
        launchMarker.addTo(map_preview);
    }

    // Clear out any previously generated landing areas
    if (landingAreas.length > 0) {
        landingAreas.forEach((landingArea) => {
            landingArea.hideAll();
        })

        landingAreas = [];
    }

    let leafletColorIndex = 0;
    let driftBounds = [[-90.0, 180.0], [90.0, -180.0]];

    altitudeDriftResults.forEach((altDriftResult) => {
        let landingArea = new LeafletLandingArea(altDriftResult, leafletColorIndex++);
        const landingAreaBounds = landingArea.getBounds();

        if (landingAreaBounds[0][0] > driftBounds[0][0])
            driftBounds[0][0] = landingAreaBounds[0][0];
        if (landingAreaBounds[0][1] < driftBounds[0][1])
            driftBounds[0][1] = landingAreaBounds[0][1];
        if (landingAreaBounds[1][0] < driftBounds[1][0])
            driftBounds[1][0] = landingAreaBounds[1][0];
        if (landingAreaBounds[1][1] > driftBounds[1][1])
            driftBounds[1][1] = landingAreaBounds[1][1];

        landingAreas.push(landingArea);

        if (leafletColorIndex >= 13) {
            leafletColorIndex = 0;
        }
    });

    map_preview.fitBounds(driftBounds);

    // Identify which KML drawing options the user selected beginning with the shape
    let mapShapeType = DrawShapeTypes.ELLIPSE;
    switch (kmlShapeSelect.value) {
        case 'kml-shape-polygon': { mapShapeType = DrawShapeTypes.POLYGON; break; }
        case 'kml-shape-box': { mapShapeType = DrawShapeTypes.BOX; break; }
        case 'kml-shape-none': { mapShapeType = DrawShapeTypes.NONE; break; }
    }

    // Next check how the user would like the shapes to be filled
    let mapShapeFill = ShapeFillTypes.TRANSPARENT;
    if ('kml-shape-fill-solid' === kmlShapeFillSelect.value) { mapShapeFill = ShapeFillTypes.SOLID; }
    else if ('kml-shape-fill-none' === kmlShapeFillSelect.value) { mapShapeFill = ShapeFillTypes.NONE; }

    // The final option is what type of paths to draw
    let mapPathType = DrawPathTypes.GROUND;
    switch (kmlPathSelect.value) {
        case 'kml-path-flight': { mapPathType = DrawPathTypes.FLIGHT; break; }
        case 'kml-path-both': { mapPathType = DrawPathTypes.BOTH; break; }
        case 'kml-path-none': { mapPathType = DrawPathTypes.NONE; break; }
    }

    let kmlMarkerType = DrawMarkerTypes.NONE;
    if ('kml-marker-time' === kmlMarkerSelect.value) {
        kmlMarkerType = DrawMarkerTypes.TIMES;
    } else if ('kml-marker-no-label' === kmlMarkerSelect.value) {
        kmlMarkerType = DrawMarkerTypes.NO_LABEL;
    }

    // Add order is not supposed to effect render order, but duplicating KML behavior just to be safe.
    if (mapPathType !== DrawPathTypes.NONE) {
        landingAreas.forEach((landingArea) => { landingArea.showPaths(map_preview); });
    }
    landingAreas.forEach((landingArea) => { landingArea.showLandingArea(map_preview, mapShapeType, mapShapeFill); });

    if (kmlMarkerType !== DrawMarkerTypes.NONE) {
        const showLabels = kmlMarkerType === DrawMarkerTypes.TIMES;
        landingAreas.forEach((landingArea) => { landingArea.showMarkers(map_preview, showLabels); });
    }
}

/** Removes the map display and associated assets. */
async function hideMapPreview() {
    if (null === map_preview)
        return;
    
    // Clear out any previously generated landing areas
    landingAreas.forEach((landingArea) => {
        landingArea.hideAll();
    });
    landingAreas = [];

    mapPreviewElement.hidden = true;
}

/**
 * Fired when the whole page has loaded, including all dependent resources except
 * those that are loaded lazily.
 */
window.onload = () => {
    // Print a version into the log to help keep track between iterations.
    console.log('GPS DriftCast - RSO Edition 0.5');

    let launchDate = new Date();
    let launchStartHour = launchDate.getHours();

    // Defaulting to 4pm due to personal bias
    let launchEndHour = 16;

    // Use Saturday as initial value if the current day is earlier in the week
    const launchDay = launchDate.getDay();
    if (launchDay < 6) {
        launchDate.setTime(launchDate.getTime() + ((6 - launchDay) * secondsInDay));

        // Set the start time based on typical launch hours
        launchStartHour = 9;
    } else if (launchStartHour < 16) {
        // Today is a Saturday, so just update the start and end times
        if (launchStartHour > 9) {
            --launchStartHour;
        } else {
            launchStartHour = 9;
        }
    } else if (launchStartHour < 23) {
        launchEndHour = launchStartHour + 1;
    } else {
        // It appears start and end times will span across days, so skip ahead to the following Saturday
        launchDate.setTime(launchDate.getTime() + (7 * secondsInDay));
        launchStartHour = 9;
    }

    // Add leading zeros if the numbers are single digit
    let monthString;
    if (launchDate.getMonth() < 9) {
        monthString = '0' + (launchDate.getMonth() + 1).toString();
    } else {
        monthString = (launchDate.getMonth() + 1).toString();
    }

    let dayString;
    if (launchDate.getDate() < 10) {
        dayString = '0' + launchDate.getDate().toString();
    } else {
        dayString = launchDate.getDate().toString();
    }

    // Initialize the date and time elements
    launchDateElement.value = `${launchDate.getFullYear()}-${monthString}-${dayString}`;

    setStartTimeValue(launchStartHour);
    setEndTimeValue(launchEndHour);

    // Prevent the user from selecting a date too far into the future
    const maxDate = new Date();
    maxDate.setTime(maxDate.getTime() + (maxDaysFutureOpenMeteo * secondsInDay));
    launchDateElement.max = `${maxDate.getFullYear()}-${(maxDate.getMonth() + 1).toString().padStart(2, '0')}-${maxDate.getDate().toString().padStart(2, '0')}`;

    // Ensure the launch date is within the range for which wind forecasts are available
    launchDateElement.addEventListener('change', (event) => {
        // Convert into just a date ignoring hours, minutes, and seconds
        let launchDay = new Date();
        let numYear = parseInt(event.target.value.substring(0, 4));
        let numMonth = parseInt(event.target.value.substring(5, 7));
        let numDay = parseInt(event.target.value.substring(8, 10));
        launchDay = new Date(numYear, numMonth - 1, numDay);

        let today = new Date();
        today = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        let deltaDays = (launchDay - today) / secondsInDay;
        if (numYear < 2022) {
            console.debug('Weather history before 2022 is not available.');
        } else if (deltaDays > maxDaysFutureOpenMeteo) {
            console.debug('Too far in the future.');
        }
    });

    // Try to keep the end time within a valid range of the start time
    startTimeElement.addEventListener('change', (event) => {
        // Get the current start and end times
        const startHour = parseInt(event.target.value.substring(0, 2));
        var endHour = parseInt(endTimeElement.value.substring(0, 2));

        if (endHour <= startHour) {
            // The end time cannot be earlier than our start time
            setEndTimeValue(startHour + 1);
        } else if ((endHour - startHour) > 11) {
            // Maximum launch duration is capped at 12 hours
            setEndTimeValue(startHour + 11);
        }
    });

    // Update recovery related UI fields when the users switches between single and dual deployment
    document.querySelectorAll("input[name='deploy_mode']").forEach((input) => {
        input.addEventListener(
            'click',
            (event) => {
                if (event.target.value == 'single_deploy') {
                    drogueDecentRateElement.disabled = true;
                    mainEventAltitudeElement.disabled = true;
                } else {
                    if ('' == drogueDecentRateElement.value) {
                        drogueDecentRateElement.value = 75;
                    }
                    if ('' == mainEventAltitudeElement.value) {
                        mainEventAltitudeElement.value = 500;
                    }
                    drogueDecentRateElement.disabled = false;
                    mainEventAltitudeElement.disabled = false;
                }
            }
        );
    });

    eventNextButton.addEventListener('click', () => { processEventDetails(); });

    driftPreviousButton.addEventListener('click', () => {
        windModelForecasts = null;
        launchTimes = null;
        updateWindAtAltitudeDisplay();

        detailCardContainer.classList.remove(driftDetailCardClass);
        detailCardContainer.classList.add(eventDetailCardClass);
    });

    driftNextButton.addEventListener('click', () => { processLaunchAltitudeBands(); });

    weatherModelSelect.addEventListener('change', () => {
        updateWindAtAltitudeDisplay();
        updateMapDisplay(true);
    });

    kmlShapeSelect.addEventListener('change', () => { updateMapDisplay(); });
    kmlShapeFillSelect.addEventListener('change', () => { updateMapDisplay(); });
    kmlPathSelect.addEventListener('change', () => { updateMapDisplay(); });
    kmlMarkerSelect.addEventListener('change', () => { updateMapDisplay(); });

    drawPreviousButton.addEventListener('click', () => {
        // Clear the existing list of altitude bands.
        launchAltitudeBands = null;
        altitudeDriftResults = [];

        // Update the winds at altitude display to reflect no altitude bands are currently defined.
        updateWindAtAltitudeDisplay();

        // Re-enable the Drift Detail pane's button.
        driftNextButton.disabled = false;

        detailCardContainer.classList.remove(drawDetailCardClass);
        detailCardContainer.classList.add(driftDetailCardClass);

        hideMapPreview();
    });

    saveKmlFileButton.addEventListener('click', async () => {
        // Let the user know something is happening in the background.
        updateStatusDisplay('Generating KML file...');

        // Calculate new drift and landing results
        saveDriftResultsKML();
    });
}

/**
 * Reads and verifies data from the Event Details card.  Report any errors to
 * the user.  If everything looks okay, send the weather forecast request to
 * Open-Meteo before transitioning to the Drift Details card.
 */
async function processEventDetails() {
    launchTimes = null;
    try {
        launchTimes = new LaunchTimeData( launchDateElement.value,
                                        startTimeElement.value,
                                        endTimeElement.value);
    } catch (e) {
        updateStatusDisplay(e.message);
        return;
    }

    // Verify the launch hour offsets are within our expectations
    if ((launchTimes.endHour < launchTimes.startHour) && (launchTimes.endHour > 0)) {
        updateStatusDisplay('The launch cannot end before it starts.');
        return;
    }
    if (launchTimes.endHourOffset > (24 * maxDaysFutureOpenMeteo)) {
        updateStatusDisplay(`Cannot forecast more than ${maxDaysFutureOpenMeteo} days into the future.`);
        return;
    }

    // Default to using the launch site's location for our apogee position
    const launchLocation = getLaunchSiteLocation();
    if (null == launchLocation) {
        //window.alert('Unable to get wind forecast without valid launch site coordinates.');
        console.debug('Unable to get wind forecast without valid launch site coordinates.');
        return;
    }

    // Ensure the user is unable to trigger KML generation before the wind data is ready
    saveKmlFileButton.disabled = true;

    // Transition the UI to display our Drift Details card
    detailCardContainer.classList.remove(eventDetailCardClass);
    detailCardContainer.classList.add(driftDetailCardClass);

    // Let the user know we have requested the weather forecast data
    updateStatusDisplay('Waiting for wind forecast...');

    // Perform up to three requests for weather predition data from Open-Meteo
    windModelForecasts = await getOpenMeteoWindPredictionData(launchLocation, launchTimes);
    if (null == windModelForecasts) {
        updateStatusDisplay('Sending another request for wind forecast...');

        windModelForecasts = await getOpenMeteoWindPredictionData(launchLocation, launchTimes);
        if (null == windModelForecasts) {
            updateStatusDisplay('Final attempt for wind forecast...');

            windModelForecasts = await getOpenMeteoWindPredictionData(launchLocation, launchTimes);
            if (null == windModelForecasts) {
                updateStatusDisplay('Wind forecast is not available!');
                return;
            }
        }
    }

    // Enable/disable which weather models are selectable based on what wind data is available
    const availableModelNames = windModelForecasts.getModelNames();

    for (let i = 0; i < weatherModelSelect.options.length; i++) {
        switch (weatherModelSelect.options[i].value) {
            case 'weather-model-auto': {
                weatherModelSelect.options[i].disabled = !availableModelNames.includes('best_match');
                break;
            }
            case 'weather-model-ecmwf': {
                weatherModelSelect.options[i].disabled = !availableModelNames.includes('ecmwf_ifs025');
                break;
            }
            case 'weather-model-noaa': {
                weatherModelSelect.options[i].disabled = !availableModelNames.includes('gfs_seamless');
                break;
            }
            case 'weather-model-icon': {
                weatherModelSelect.options[i].disabled = !availableModelNames.includes('icon_seamless');
                break;
            }
        }
    }

    // Instantiate a new object to store the current launch event's details.
    launchLocationDetails = new LaunchLocationData(launchLocation, windModelForecasts.getGroundElevation(), '');

    // Everything worked as expected.  Allow the user to request drift simulation results.
    updateStatusDisplay('Wind forecast is ready.');
    saveKmlFileButton.disabled = false;

    updateWindAtAltitudeDisplay();
    calculateDriftResults();
}

/** Utilize the user provided values to produce the launch's altitude bands. */
async function processLaunchAltitudeBands() {
    const launchAltMax = Math.abs(parseInt(launchAltitudeMaxElement.value.replaceAll(',', '')));
    if (isNaN(launchAltMax) || launchAltMax <= 0 || launchAltMax > 101000) {
        updateStatusDisplay(`Unable to calculate drift distance with an invalid maximum launch altitude: ${launchAltMax}`);
        return;
    }

    const launchAltStep = Math.abs(parseInt(launchAltitudeStepElement.value.replaceAll(',', '')));
    if (isNaN(launchAltStep)) {
        updateStatusDisplay(`Unable to calculate drift distance with an invalid launch altitude step: ${launchAltStep}`);
        return;
    }

    // Disable the triggering button to prevent simultaneous data processing.
    driftNextButton.disabled = true;

    // Now a list of altitude bands can be calculated
    launchAltitudeBands = [];

    if (launchAltStep <= 0 || launchAltStep >= launchAltMax) {
        // Skip lower altitudes using just the maximum in this case
        launchAltitudeBands.push(launchAltMax);
    } else {
        let currentAltitude = launchAltStep;

        // Iterate increasing altitude by the step distance each loop
        while (currentAltitude < launchAltMax) {
            launchAltitudeBands.push(currentAltitude);
            currentAltitude += launchAltStep;
        }

        // Include the specified maximum altitude as the final entry
        launchAltitudeBands.push(launchAltMax);
    }

    updateWindAtAltitudeDisplay();
    updateMapDisplay();

    // Everything looks okay. Transition to the next detail card.
    detailCardContainer.classList.remove(driftDetailCardClass);
    detailCardContainer.classList.add(drawDetailCardClass);
}

/**
 * Requests a file name and location for later saving the generated KML file.
 * Reads in all information entered int our UI by the user.
 * Perform drift simulations for all provided altitudes.
 * Use the resulting data to generate a KML file and save it.
 */
async function calculateDriftResults() {
    // Unable to proceed if the weather forecast fetch is still pending.
    if (null === windModelForecasts)
        return;

    // Unable to proceed if the weather forecast is received before launch altitudes are defined.
    if (null === launchAltitudeBands)
        return;

    // Verify the launch event location is valid
    if (null == launchLocationDetails) {
        updateStatusDisplay('Unable to calculate drift without a valid event location.');
        return;
    }

    // Verify the launch event date and times are valid
    if (null == launchTimes) {
        updateStatusDisplay('Unable to calculate drift without a valid date and time range.');
        return;
    }

    // Read in all of the expected descent rate values
    const drogueDecentRate = Math.abs(parseInt(drogueDecentRateElement.value));
    if (isNaN(drogueDecentRate) || drogueDecentRate <= 0.0) {
        updateStatusDisplay(`Unable to calculate drift distance with an invalid main decent rate: ${drogueDecentRate}`);
        return;
    }

    const mainDescentRate = parseFloat(mainDescentRateElement.value);
    if (isNaN(mainDescentRate) || mainDescentRate <= 0.0) {
        updateStatusDisplay(`Unable to calculate drift distance with an invalid main decent rate: ${mainDescentRate}`);
        return;
    }

    const mainDeployAltitude = Math.abs(parseInt(mainEventAltitudeElement.value.replaceAll(',', '')));
    if (isNaN(mainDeployAltitude) || mainDeployAltitude <= 0.0) {
        updateStatusDisplay(`Unable to calculate drift distance with an invalid main decent rate: ${mainDeployAltitude}`);
        return;
    }

    // Check which weather model the user would like to use for this drift simulation
    let weatherModelName = 'best_match';
    switch (weatherModelSelect.value) {
        case 'weather-model-ecmwf': { weatherModelName = 'ecmwf_ifs025'; break; }
        case 'weather-model-noaa': { weatherModelName = 'gfs_seamless'; break; }
        case 'weather-model-icon': { weatherModelName = 'icon_seamless'; break; }
    }

    // Clear out any previous drift results from previous simulations
    altitudeDriftResults = [];

    launchAltitudeBands.forEach((currentAltitude) => {
        const simulationList = [];

        // Create a rocket with an apogee of the current altitude
        let rocketDetails = new RocketApogee(currentAltitude);
        rocketDetails.setDualDeployment(drogueDecentRate, mainDeployAltitude, mainDescentRate);
        //rocketDetails.setSingleDeployment(mainDescentRate);

        let forecastHour = new Date(launchTimes.launchDate);

        const windModelForecast = windModelForecasts.getWindModelForecast(weatherModelName);

        windModelForecast.forEach((windForecast) => {
            if (null == windForecast || 0 == windForecast.length) {
                console.debug('Failed to obtain a wind forecast.');
                simulationList.push(null);
            } else {
                const launchSimulation = driftSimulation(launchLocationDetails,
                    forecastHour,
                    rocketDetails,
                    windForecast
                );

                // Add this completed simulation to the list
                simulationList.push(launchSimulation);

                // Move the launch time forward one hour
                forecastHour.setTime(forecastHour.getTime() + 3600000);
            }
        });

        // Add drift results for this altitude band to our overall launch object
        altitudeDriftResults.push(new AltitudeDriftResult(currentAltitude, simulationList));
    });

    if (altitudeDriftResults.length > 0) {
        updateStatusDisplay('Drift simulation complete.');
    } else {
        // Let the user know something bad happened.
        updateStatusDisplay('An error occurred while simulating drift.');
    }
}

/** Use the previously calculated drift simulations to generate and save a KML file. */
async function saveDriftResultsKML() {
    if (0 === altitudeDriftResults.length) {
        updateStatusDisplay('Drift simulation results are not currently available.');
        return;
    }

    // Disable the triggering button until this save process has completed.
    saveKmlFileButton.disabled = true;

    // Identify which KML drawing options the user selected beginning with the shape
    let kmlShapeType = DrawShapeTypes.ELLIPSE;
    switch (kmlShapeSelect.value) {
        case 'kml-shape-polygon': { kmlShapeType = DrawShapeTypes.POLYGON; break; }
        case 'kml-shape-box': { kmlShapeType = DrawShapeTypes.BOX; break; }
        case 'kml-shape-none': { kmlShapeType = DrawShapeTypes.NONE; break; }
    }

    // Next check how the user would like the shapes to be filled
    let kmlShapeFill = ShapeFillTypes.TRANSPARENT;
    if ('kml-shape-fill-solid' === kmlShapeFillSelect.value) { kmlShapeFill = ShapeFillTypes.SOLID; }
    else if ('kml-shape-fill-none' === kmlShapeFillSelect.value) { kmlShapeFill = ShapeFillTypes.NONE; }

    // The final option is what type of paths to draw
    let kmlPathType = DrawPathTypes.GROUND;
    switch (kmlPathSelect.value) {
        case 'kml-path-flight': { kmlPathType = DrawPathTypes.FLIGHT; break; }
        case 'kml-path-both': { kmlPathType = DrawPathTypes.BOTH; break; }
        case 'kml-path-none': { kmlPathType = DrawPathTypes.NONE; break; }
    }

    let kmlMarkerType = DrawMarkerTypes.NONE;
    if ('kml-marker-time' === kmlMarkerSelect.value) {
        kmlMarkerType = DrawMarkerTypes.TIMES;
    } else if ('kml-marker-no-label' === kmlMarkerSelect.value) {
        kmlMarkerType = DrawMarkerTypes.NO_LABEL;
    }

    const kmlDoc = createAltitudeDriftDocument(altitudeDriftResults, kmlPathType, kmlShapeType, kmlShapeFill, kmlMarkerType);

    // DOM does not consider this line valid XML, so add it directly as a string.
    let xmlStrings = ['<?xml version="1.0" encoding="utf-8"?>'];

    const serializer = new XMLSerializer();
    xmlStrings.push(serializer.serializeToString(kmlDoc));

    const kmlBlob = new Blob(xmlStrings, { type: "application/vnd.google-earth.kml+xml", });
    saveKmlFile(kmlBlob, 'RSO_Drift.kml');

    // Re-enable the triggering button.
    saveKmlFileButton.disabled = false;

    updateStatusDisplay('KML file save complete.');
}
