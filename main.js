import { GeoLocation } from "./geo.js";
import { DrawShapeTypes, ShapeFillTypes, DrawPathTypes, DrawMarkerTypes, createAltitudeDriftDocument, saveKmlFile } from "./kml.js";
import { LaunchTimeData, LaunchLocationData } from "./launch.js";
import { getOpenMeteoWindPredictionData } from "./wind.js";

import { AltitudeDriftResult, driftSimulation } from './drift_simulation.js';
import { RocketApogee } from './rocket.js';

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

// Launch site buttons
const launchAltitudeMaxElement = document.getElementById('altitude-max');
const launchAltitudeStepElement = document.getElementById('altitude-step');

// Weather option elements
const weatherModelSelect = document.getElementById('weather-model-select');
const weatherSpeedSelect = document.getElementById('weather-speed-select');

// KML shape drawing option elements
const kmlShapeSelect = document.getElementById('kml-shape-select');
const kmlShapeFillSelect = document.getElementById('kml-shape-fill-select');
const kmlPathSelect = document.getElementById('kml-path-select');
const kmlMarkerSelect = document.getElementById('kml-marker-select');

// Button elements
const calculateDriftButton = document.getElementById('btn_calculate_drift');

// Drift result display elements
const statusDisplayElement = document.getElementById('status_display');

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
 * Update the value stored and displayed in the launch end time field.
 * @param {number} endHour - The new end hour for the launch.
 * @throws {TypeError} Invalid end hour value.
 */
function setEndTimeValue(endHour) {
    if (isNaN(endHour)) throw new TypeError(`Invalid end hour: ${endHour}.`);

    if (endHour > 23) {
        endTimeElement.value = '00:00';
    } else if (endHour < 10) {
        endTimeElement.value = `0${endHour}:00`;
    } else {
        endTimeElement.value = `${endHour}:00`;
    }
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
 * Fired when the whole page has loaded, including all dependent resources except
 * those that are loaded lazily.
 */
window.onload = () => {
    // Print a version into the log to help keep track between iterations.
    console.log('GPS DriftCast - RSO Edition 0.1');

    const currentDate = new Date();

    // Add leading zeros if the numbers are single digit
    let monthString;
    if (currentDate.getMonth() < 9) {
        monthString = '0' + (currentDate.getMonth() + 1).toString();
    } else {
        monthString = (currentDate.getMonth() + 1).toString();
    }

    let dayString;
    if (currentDate.getDate() < 10) {
        dayString = '0' + currentDate.getDate().toString();
    } else {
        dayString = currentDate.getDate().toString();
    }

    // Initialize the date element to today
    launchDateElement.value = `${currentDate.getFullYear()}-${monthString}-${dayString}`;

    // Prevent the user from selecting a date too far in the past
    let oldestDate = new Date();
    oldestDate.setTime(oldestDate.getTime() - (maxDaysPreviousOpenMeteo * secondsInDay));

    launchDateElement.min = `${oldestDate.getFullYear()}-${(oldestDate.getMonth() + 1).toString().padStart(2, '0')}-${oldestDate.getDate().toString().padStart(2, '0')}`;

    // Prevent the user from selecting a date too far into the future
    const maxDate = new Date();
    maxDate.setTime(maxDate.getTime() + (maxDaysFutureOpenMeteo * secondsInDay));

    launchDateElement.max = `${maxDate.getFullYear()}-${(maxDate.getMonth() + 1).toString().padStart(2, '0')}-${maxDate.getDate().toString().padStart(2, '0')}`;

    // Initialize the time elements to the current hour plus a max offset
    const currentHour = currentDate.getHours();
    if (currentHour < 10) {
        startTimeElement.value = `0${currentHour}:00`;
    } else {
        startTimeElement.value = `${currentHour}:00`;
    }

    // Initialize the end time for six hours after the start time
    setEndTimeValue(currentHour + 6);

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
        if (deltaDays < (-1 * maxDaysPreviousOpenMeteo)) {
            console.debug('Too far in the past.');
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

    calculateDriftButton.addEventListener('click', async () => {
        // Let the user know something is happening in the background.
        if (null != statusDisplayElement) {
            statusDisplayElement.textContent = 'Calculating drift...';
            statusDisplayElement.hidden = false;
            statusDisplayElement.scrollIntoView({ behavior: "instant", block: "end" });
        }

        // Calculate new drift and landing results
        calculateDriftResults();
    });
}

/**
 * Requests a file name and location for later saving the generated KML file.
 * Reads in all information entered int our UI by the user.
 * Perform drift simulations for all provided altitudes.
 * Use the resulting data to generate a KML file and save it.
 */
async function calculateDriftResults() {
    const launchTimes = new LaunchTimeData( launchDateElement.value,
                                            startTimeElement.value,
                                            endTimeElement.value);

    // Verify the launch hour offsets are within our expectations
    if ((launchTimes.endHour < launchTimes.startHour) && (launchTimes.endHour > 0)) {
        statusDisplayElement.textContent = 'The launch cannot end before it starts.';
        return;
    }
    if (launchTimes.startHourOffset < (-24 * maxDaysPreviousOpenMeteo)) {
        statusDisplayElement.textContent = `Wind speeds older than ${maxDaysPreviousOpenMeteo} days are not available.`;
        return;
    }
    if (launchTimes.endHourOffset > (24 * maxDaysFutureOpenMeteo)) {
        statusDisplayElement.textContent = `Cannot forecast more than ${maxDaysFutureOpenMeteo} days into the future.`;
        return;
    }

    // Default to using the launch site's location for our apogee position
    const launchLocation = getLaunchSiteLocation();
    if (null == launchLocation) {
        //window.alert('Unable to get wind forecast without valid launch site coordinates.');
        console.debug('Unable to get wind forecast without valid launch site coordinates.');
        return;
    }

    statusDisplayElement.textContent = 'Waiting for wind forecast...';

    // Find out if the user prefers a certain weather model.
    // Open-Meteo actually allows multiple options within a single request, so we can
    // just ask for everything and apply filters in our simulation in the future.
    let weatherModel = 'best_match';
    switch (weatherModelSelect.value) {
        case 'weather-model-ecmwf':
            weatherModel = 'ecmwf_ifs025';
            break;
        case 'weather-model-gem':
            weatherModel = 'gem_seamless';
            break;
        case 'weather-model-noaa':
            weatherModel = 'gfs_seamless';
            break;
        case 'weather-model-icon':
            weatherModel = 'icon_seamless';
            break;
    }

    const windForecastList = await getOpenMeteoWindPredictionData(launchLocation, launchTimes, weatherModel);
    if (null == windForecastList) {
        statusDisplayElement.textContent = 'Wind forecast request failed.';
        return;
    }

    statusDisplayElement.textContent = 'Beginning drift simulation...'
    
    // Instantiate a new object to store the current launch event's details.
    launchLocationDetails = new LaunchLocationData(launchLocation, windForecastList[0].groundElevation, '');

    // Read in all of the expected descent rate values
    const drogueDecentRate = Math.abs(parseInt(drogueDecentRateElement.value));
    if (isNaN(drogueDecentRate) || drogueDecentRate <= 0.0) {
        statusDisplayElement.textContent = `Unable to calculate drift distance with an invalid main decent rate: ${drogueDecentRate}`;
        return;
    }

    const mainDescentRate = parseFloat(mainDescentRateElement.value);
    if (isNaN(mainDescentRate) || mainDescentRate <= 0.0) {
        statusDisplayElement.textContent = `Unable to calculate drift distance with an invalid main decent rate: ${mainDescentRate}`;
        return;
    }

    const mainDeployAltitude = Math.abs(parseInt(mainEventAltitudeElement.value.replaceAll(',', '')));
    if (isNaN(mainDeployAltitude) || mainDeployAltitude <= 0.0) {
        statusDisplayElement.textContent = `Unable to calculate drift distance with an invalid main decent rate: ${mainDeployAltitude}`;
        return;
    }

    // Read in the values needed to produce the launch's altitude bands
    const launchAltMax = Math.abs(parseInt(launchAltitudeMaxElement.value.replaceAll(',', '')));
    if (isNaN(launchAltMax) || launchAltMax <= 0 || launchAltMax > 101000) {
        statusDisplayElement.textContent = `Unable to calculate drift distance with an invalid maximum launch altitude: ${launchAltMax}`;
        return;
    }

    const launchAltStep = Math.abs(parseInt(launchAltitudeStepElement.value.replaceAll(',', '')));
    if (isNaN(launchAltStep)) {
        statusDisplayElement.textContent = `Unable to calculate drift distance with an invalid launch altitude step: ${launchAltStep}`;
        return;
    }

    // Now a list of altitude bands can be calculated
    const altitudeBands = [];

    if (launchAltStep <= 0 || launchAltStep >= launchAltMax) {
        // Skip lower altitudes using just the maximum in this case
        altitudeBands.push(launchAltMax);
    } else {
        let currentAltitude = launchAltStep;

        // Iterate increasing altitude by the step distance each loop
        while (currentAltitude < launchAltMax) {
            altitudeBands.push(currentAltitude);
            currentAltitude += launchAltStep;
        }

        // Include the specified maximum altitude as the final entry
        altitudeBands.push(launchAltMax);
    }

    // Clear out any previous drift results from previous simulations
    altitudeDriftResults = [];

    altitudeBands.forEach((currentAltitude) => {
        const simulationList = [];

        // Create a rocket with an apogee of the current altitude
        let rocketDetails = new RocketApogee(currentAltitude);
        rocketDetails.setDualDeployment(drogueDecentRate, mainDeployAltitude, mainDescentRate);

        let forecastHour = new Date(launchTimes.launchDate);

        windForecastList.forEach((windForecast) => {
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
        statusDisplayElement.textContent = 'Drift simulation complete.'

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
        saveKmlFile(kmlBlob);
    } else {
        // Let the user know something bad happened.
        statusDisplayElement.textContent = 'An error occurred.'
    }
}
