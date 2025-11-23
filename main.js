import { GeoLocation } from "./geo.js";
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
const eventNextButton = document.getElementById('btn-event-next');
const driftPreviousButton = document.getElementById('btn-drift-prev');
const driftNextButton = document.getElementById('btn-drift-next');
const drawPreviousButton = document.getElementById('btn-draw-prev');
const calculateDriftButton = document.getElementById('btn-calculate-drift');

// Drift result display elements
const statusDisplayElement = document.getElementById('status-display');

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
 * Change the text content of the status-display element and ensure it is visible.
 * @param {string} statusMessage - The text to be displayed within the element
 */
function updateStatusDisplay(statusMessage) {
    statusDisplayElement.textContent = statusMessage;
    statusDisplayElement.hidden = false;
    statusDisplayElement.scrollIntoView({ behavior: "instant", block: "end" });
}

/**
 * Fired when the whole page has loaded, including all dependent resources except
 * those that are loaded lazily.
 */
window.onload = () => {
    // Print a version into the log to help keep track between iterations.
    console.log('GPS DriftCast - RSO Edition 0.3');

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

    eventNextButton.addEventListener('click', () => {
        processEventDetails();
    });

    driftPreviousButton.addEventListener('click', () => {
        detailCardContainer.classList.remove(driftDetailCardClass);
        detailCardContainer.classList.add(eventDetailCardClass);
    });

    driftNextButton.addEventListener('click', () => {
        detailCardContainer.classList.remove(driftDetailCardClass);
        detailCardContainer.classList.add(drawDetailCardClass);
    });

    drawPreviousButton.addEventListener('click', () => {
        detailCardContainer.classList.remove(drawDetailCardClass);
        detailCardContainer.classList.add(driftDetailCardClass);
    });

    calculateDriftButton.addEventListener('click', async () => {
        // Let the user know something is happening in the background.
        updateStatusDisplay('Calculating drift...');

        // Calculate new drift and landing results
        calculateDriftResults();
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
    if (launchTimes.startHourOffset < (-24 * maxDaysPreviousOpenMeteo)) {
        updateStatusDisplay(`Wind speeds older than ${maxDaysPreviousOpenMeteo} days are not available.`);
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
    calculateDriftButton.disabled = true;

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
    calculateDriftButton.disabled = false;
}

/**
 * Requests a file name and location for later saving the generated KML file.
 * Reads in all information entered int our UI by the user.
 * Perform drift simulations for all provided altitudes.
 * Use the resulting data to generate a KML file and save it.
 */
async function calculateDriftResults() {
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

    // Read in the values needed to produce the launch's altitude bands
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

    // Check which weather model the user would like to use for this drift simulation
    let weatherModelName = 'best_match';
    switch (weatherModelSelect.value) {
        case 'weather-model-ecmwf': { weatherModelName = 'ecmwf_ifs025'; break; }
        case 'weather-model-noaa': { weatherModelName = 'gfs_seamless'; break; }
        case 'weather-model-icon': { weatherModelName = 'icon_seamless'; break; }
    }

    // Clear out any previous drift results from previous simulations
    altitudeDriftResults = [];

    altitudeBands.forEach((currentAltitude) => {
        const simulationList = [];

        // Create a rocket with an apogee of the current altitude
        let rocketDetails = new RocketApogee(currentAltitude);
        rocketDetails.setDualDeployment(drogueDecentRate, mainDeployAltitude, mainDescentRate);

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
        updateStatusDisplay('An error occurred.');
    }
}
