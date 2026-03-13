import { GeoLocation, moveAlongBearingKilometers, feetToMeters, metersToFeet } from "./geo.js";
import { LaunchTimeData } from "./launch.js";

const openMeteoWindAltitudes = [10, 80, 120];
const openMeteoPressureLevels = [1000, 975, 950, 925, 900, 850, 800, 750, 700, 650, 600, 550, 500, 450, 400, 350, 300, 250, 200, 150, 100, 70, 50, 30, 20, 15, 10];
const openMeteoModels = [
    { human: 'Best Match', api: 'best_match' },
    { human: 'ECMWF', api: 'ecmwf_ifs025' },
    { human: 'GFS', api: 'gfs_seamless' },
    { human: 'ICON', api: 'icon_seamless' }
];

/* Class storing wind speed and direction at a specific altitude. */
class WindAtAltitude {
    /**
     * The altitude (feet) where this wind is located.
     * @private
     * @type {number}
     */
    #altitude = 0;

    /**
     * The speed (knots) of the wind.
     * @private
     * @type {number}
     */
    #windSpeed = 0;

    /**
     * Direction of the wind (degrees from 0 North).
     * @private
     * @type {number}
     */
    #windDirection = 0;

    /**
     * Initializes to the provided wind speed and direction at the specified altitude.
     * @param {number} alt - Altitude (in feet).
     * @param {number} speed - Wind speed (in knots).
     * @param {number} dir - Wind direction (in degrees from North).
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(alt, speed, dir) {
        // Verify the provided values are all valid numbers
        if (isNaN(alt)) throw new TypeError(`Invalid wind altitude: ${alt}`);
        if (isNaN(speed)) throw new TypeError(`Invalid wind speed: ${speed}`);
        if (isNaN(dir)) throw new TypeError(`Invalid wind direction: ${dir}`);

        this.#altitude = alt;
        this.#windSpeed = speed;
        this.#windDirection = dir;
    }

    /**
     * Get the altitude (feet) where the described wind is located.
     * @type {number}
     */
    get altitude() {
        return this.#altitude;
    }

    /**
     * Get the wind's speed (knots) at this altitude.
     * @type {number}
     */
    get windSpeed() {
        return this.#windSpeed;
    }

    /**
     * Get the wind's direction (degrees from 0 North) at this altitude.
     * @type {number}
     */
    get windDirection() {
        return this.#windDirection;
    }

    /**
     * Get the winds's speed (MPH) at this altitude.
     * @type {number}
     */
    getWindSpeedMph() {
        return this.#windSpeed * 1.15078;
    }
}

/* Class containing wind data at all available altitudes from a particular forecast model. */
class WindModelForecastData {
    /**
     * String identifying which model (RAP or Open-Meteo) was used for this forecast.
     * @private
     * @type {string}
     */
    #model = '';

    /**
     * List of wind data (speed/direction) at various altitudes.
     * @private
     * @type {Array.<WindAtAltitude>}
     */
    #windData = [];

    /**
     * Wind speed (knots) at ground level.
     * @private
     * @type {number}
     */
    #groundWindSpeed = 0;

    /**
     * Wind direction (degrees from 0 north) at ground level.
     * @private
     * @type {number}
     */
    #groundWindDirection = 0;

    /**
     * Hour of the day this forecast was calculated for.
     * @type {string}
     */
    #time = '';
    
    /**
     * Constructor initializes members to default values.
     */
    constructor() {
        this.#model = '';
        this.#windData = [];
        this.#groundWindSpeed = 0;
        this.#groundWindDirection = 0;
        this.#time = '';
    }

    /**
     * Initializes to the provided wind speed and direction at the specified altitude.
     * @param {json} windJSON - A JSON formated object contaning raw data associated with a wind forecast.
     */
    loadWindsAloftData(windJSON) {
        this.#model = windJSON.model;

        // References to different wind data objects based on the prediction model
        var altitudes;
        var windSpeeds;
        var windDirections;

        if ('RAP' == this.#model) {
            // Ignore duplicate altitude entries
            altitudes = new Set(windJSON.altFtRaw);
            windSpeeds = windJSON.speedRaw;
            windDirections = windJSON.directionRaw;
        } else {
            // Ignore duplicate altitude entries
            altitudes = new Set(windJSON.altFt);
            windSpeeds = windJSON.speed;
            windDirections = windJSON.direction;
        }

        // Convert the altitude set into an array so it can be sorted
        altitudes = Array.from(altitudes);
        altitudes.sort((a, b) => {
            if (a < b) {
                return -1;
            } else if (a > b) {
                return 1;
            }
            return 0;
        });

        // Add a new object to our array containing data for each altitude
        for (const currentAlt of altitudes) {
            let stringAlt = currentAlt.toString();

            // Verify wind speed and direction at this altitude are available
            if (stringAlt in windSpeeds && stringAlt in windDirections) {
                this.#windData.push(new WindAtAltitude(currentAlt, parseInt(windSpeeds[stringAlt]), parseInt(windDirections[stringAlt])));
            } else {
                console.debug(`Failed to find wind data for altitude ${currentAlt}`);
            }
        }

        if ('groundSpd' in windJSON) {
            this.#groundWindSpeed = windJSON['groundSpd'];
        }
        if ('groundSpd' in windJSON) {
            this.#groundWindDirection = windJSON['groundSpd'];
        }
    }

    /**
     * Initialize members with the provided information.
     * @param {string} modelName - Identifying name for the weather forecast model used to calulate the associated winds.
     * @param {number} groundSpeed - Speed (knots) the wind is blowing at ground level. 
     * @param {number} groundDirection - Direction (degrees from 0 north) the wind is blowing at ground level.
     * @param {string} time - The hour of the day for which the provided weather forecast was calculated.
     * @param {Array.<WindAtAltitude>} windArray - List of wind data at ascending altitudes.
     */
    loadOpenMeteoData(modelName, groundSpeed, groundDirection, time, windArray) {
        this.#model = modelName;
        this.#groundWindSpeed = groundSpeed;
        this.#groundWindDirection = groundDirection;
        this.#time = time;
        this.#windData = windArray;
    }

    /**
     * Get the weather forecast model's name used to generate this object's wind data.
     * @type {string}
     */
    get model() { return this.#model; }

    /**
     * Get the list of wind data (speed/direction) at various altitudes.
     * @type {Array.<WindAtAltitude>}
     */
    get windData() { return this.#windData; }

    /**
     * The wind speed (knots) at ground level.
     * @type {number}
     */
    get groundWindSpeed() { return this.#groundWindSpeed; }

    /**
     * The wind direction (degrees from 0 north) at ground level.
     * @type {number}
     */
    get groundWindDirection() { return this.#groundWindDirection; }

    /**
     * The hour of the day (local time zone) this forecast was created to represent.
     * @type {string}
     */
    get time() { return this.#time; }

    /**
     * Provide the wind speed (knots) at the desired altitude
     * @param {number} altitude - Altitude (feet AGL) at which a wind speed is desired.
     * @returns {Object} { speed: {number}, direction: {number} }
     */
    getWindAtAltitude(altitude) {
        // Check for values outside of our available wind 
        if (altitude < 0) {
            return { speed: this.#windData[0].windSpeed, bearing: this.#windData[0].windDirection };
        } else if (altitude > this.#windData[this.#windData.length - 1].altitude) {
            return { speed: this.#windData[this.#windData.length - 1].windSpeed, bearing: this.#windData[this.#windData.length - 1].windDirection };
        }

        // Identify the altitude range the rocket's apogee fits within
        let windIndex = 1;
        for (; windIndex < this.#windData.length; ++windIndex) {
            if (this.#windData[windIndex].altitude >= altitude) {
                break;
            }
        }

        if (this.#windData.length == windIndex) {
            console.debug(`Failed to find a match for altitude ${altitude} within the ${windIndex} forecast entries.`);
            return { speed: 0, bearing: 0 };
        }

        // All following logic assumes our index refers to the current wind band's floor
        --windIndex;

        // Start with apogee
        let windBandPercentage = getWindBandPercentage(altitude, this.#windData, windIndex);
        let windSpeed = getAverageWindSpeed(windBandPercentage, this.#windData, windIndex);
        let windDirection = getAverageWindDirection(windBandPercentage, this.#windData, windIndex);
        return { speed: windSpeed, bearing: windDirection };
    }
}

/** Class storing wind data at all available altitudes from multiple forecast models. */
class WindForecastData {
    /**
     * Elevation at the location where this forecast was requested.
     * @private
     * @type {number}
     */
    #groundElevation = 0;

    /**
     * Contains wind data derived by what Open-Meteo identified as the "best match" model
     * for the specified location.
     * @private
     * @type {Array.<Object>}
     */
    #windModelForecasts = [];
    
    /**
     * Constructor initializes members to default values.
     * @param {number} elevation - Height (meters) above mean sea level at this forecast's location.
     */
    constructor(elevation) {
        this.#groundElevation = this.#groundElevation;
    }

    /**
     * The ground's elevation at location of this forecast.
     * @param {number} elevation - Height (meters) above mean sea level at this forecast's location.
     */
    setGroundElevation(elevation) { this.#groundElevation = elevation; }

    /**
     * The ground's elevation at location of this forecast.
     * @type {number}
     */
    getGroundElevation() { return this.#groundElevation; }

    /**
     * Add wind data derived along with which weather forecast model it was calculated with.
     * @param {string} modelName - String indentifier of the forecast model used to calculate this wind data
     * @param {WindModelForecastData} forecastData - The wind data
     */
    addWindModelForecast(modelName, forecastData) {
        this.#windModelForecasts.push({
            id: modelName,
            wind: forecastData
        });
    }

    /**
     * Add wind data derived along with which weather forecast model it was calculated with.
     * @param {string} modelName - String indentifier of the forecast model used to calculate this wind data
     * @returns {WindModelForecastData} The wind data if available, otherwise null
     */
    getWindModelForecast(modelName) {
        for (const windForecast of this.#windModelForecasts) {
            if (windForecast.id === modelName) {
                return windForecast.wind;
            }
        }
        return null;
    }

    /**
     * Provides an array of model names associated with the available weather forecasts.
     * @returns {Array.<string>} List of available weather forecast model names
     */
    getModelNames() {
        const modelNames = [];
        this.#windModelForecasts.forEach((windModel) => {
            modelNames.push(windModel.id);
        });
        return modelNames;
    }
}

/* Class storing expected results of weathercocking at a particular wind speed. */
class WeathercockWindData {
    /**
     * Initializes to the provided weathercocking results at the specified wind speed.
     * @param {number} speed - Wind speed (in MPH) at ground level.
     * @param {number} dist - Distance (in feet) the rocket travels up wind.
     * @param {number} alt - Altitude (in feet) the rocket is expected to reach.
     * @throws {TypeError} Invalid alt/speed/dir.
     */
    constructor(speed, dist, alt) {
        // Verify the provided values are all valid numbers
        if (isNaN(speed)) throw new TypeError(`Invalid weathercock wind speed: ${speed}`);
        if (isNaN(dist)) throw new TypeError(`Invalid weathercock distance: ${dist}`);
        if (isNaN(alt)) throw new TypeError(`Invalid weathercock altitude: ${alt}`);

        /**
         * The wind speed (in MPH) at ground level.
         * @type {number}
         */
        this.windSpeed = speed;

        /**
         * The distance (in feet) the rocket travels up wind.
         * @type {number}
         */
        this.upwindDistance = dist;

        /**
         * The altitude (in feet) the rocket is expected to reach.
         * @type {number}
         */
        this.apogee = alt;
    }
}

/**
 * Requests wind forecast data from WindsAloft server to be provided as a JSON object.
 * @param {GeoLocation} launchLocation - Coordinates of the launch location.
 * @param {number} hourOffset - Offset (in hours) from the current time of the desired forecast.
 * @returns {WindModelForecastData} Wind forecast data at the specified location and time. 'null' if an error occurred.
 */
async function getWindPredictionData(launchLocation, hourOffset) {
    let windForecast = null;

    const timeAndPlace = {
        "latitude": launchLocation.latitude,
        "longitude": launchLocation.longitude,
        "hour_offset": hourOffset
    };

    const fetchOptions = {
        "method": "POST",
        "headers": {
            "Content-Type": "application/json; charset=utf-8"
        },
        "body": JSON.stringify(timeAndPlace)
    };

    await fetch('get_wind_forecast.php', fetchOptions)
        .then((response) => {
            if (response.ok) {
                return response.json();
            } else {
                console.debug(`Request failed for winds for lat ${launchLocation.latitude}, lon ${launchLocation.longitude}, and hour offset ${hourOffset}`);
                return null;
            }
        })
        .then((windJSON) => {
            if (null != windJSON) {
                windForecast = new WindModelForecastData();
                windForecast.loadWindsAloftData(windJSON);
            }
        })
        .catch(error => {
            console.debug(`An error was caught while fetching a wind forecast. ${error.message}`);
        });

    return windForecast;

    // let theForecast = new WindModelForecastData();
    // theForecast.loadWindsAloftData(wind0900);
    // return theForecast;
}

/**
 * Requests wind forecast data from Open-Meteo API to be provided as a JSON object.
 * @param {GeoLocation} launchLocation - Coordinates of the launch location.
 * @param {LaunchTimeData} launchTimes - Date, start time, and end time of the launch.
 * @returns {WindForecastData} Wind data from multiple weather forecast models at the specified location and time.
 */
async function getOpenMeteoWindPredictionData(launchLocation, launchTimes) {
    const windModelForecasts = new WindForecastData(0);

    // Begin forming a request for Open-Meteo's API with the launch location.
    let fetchRequest = `https://api.open-meteo.com/v1/forecast?latitude=${launchLocation.latitude}&longitude=${launchLocation.longitude}`;

    // Specify the launch's active hours.
    fetchRequest += `&start_hour=${launchTimes.getStartTimeAsISOString()}&end_hour=${launchTimes.getEndTimeAsISOString()}`;

    // Use the launch site's timezone
    fetchRequest += '&timezone=auto';

    // Request wind speeds to be in knots.
    fetchRequest += '&wind_speed_unit=kn';

    // Request all global weather models
    fetchRequest += '&models=';

    for (let i = 0; i < openMeteoModels.length; i++) {
        if (i > 0) {
            fetchRequest += ',';
        }
        fetchRequest += openMeteoModels[i].api;
    }

    // Prepare for hourly forecast parameters.
    fetchRequest += '&hourly=';

    // Request wind speeds at set heights above ground level.
    let addComma = false;
    openMeteoWindAltitudes.forEach((altitude) => {
        if (addComma) {
            fetchRequest += ',';
        } else {
            addComma = true;
        }
        fetchRequest += `wind_speed_${altitude}m`;
    });

    // Request wind directions at set heights above ground level.
    openMeteoWindAltitudes.forEach((altitude) => {
        fetchRequest += `,wind_direction_${altitude}m`;
    });

    // Request wind speeds at all atmospheric pressure levels.
    openMeteoPressureLevels.forEach((pressure) => {
        fetchRequest +=`,wind_speed_${pressure}hPa`;
    });

    // Request wind directions at all atmospheric pressure levels.
    openMeteoPressureLevels.forEach((pressure) => {
        fetchRequest +=`,wind_direction_${pressure}hPa`;
    });

    // Request geopotential height at all atmospheric pressure levels.
    openMeteoPressureLevels.forEach((pressure) => {
        fetchRequest +=`,geopotential_height_${pressure}hPa`;
    });

    // In case the generated URL is required to download separate data for further debugging
    //console.log(fetchRequest);
    
    try {
        const openMeteoPromise = await fetch(fetchRequest);

        if (openMeteoPromise.ok) {
            const windJSON = await openMeteoPromise.json();

            if ('hourly' in windJSON) {
                const hourCount = launchTimes.endHourOffset - launchTimes.startHourOffset + 1;
                if ('time' in windJSON.hourly) {
                    if (hourCount != windJSON.hourly.time.length) {
                        console.log(`Hour count ${hourCount} is different from wind times count ${windJSON.hourly.time.length}.`);
                    }
                }
                const hourList = launchTimes.getLaunchTimesList();
            
                let groundElevation = 0;
                if ('elevation' in windJSON) {
                    if (null != windJSON.elevation) {
                        groundElevation = windJSON.elevation;
                    }
                }
                windModelForecasts.setGroundElevation(groundElevation);

                openMeteoModels.forEach((modelNames) => {
                    let windForecastList = [];

                    for (let hourIndex = 0; hourIndex < hourCount; ++hourIndex) {
                        // Create arrays to hold converted data.
                        let altitudeWinds = [];
                        let pressureWinds = [];
            
                        // Request wind directions at set heights above ground level.
                        for (const altitude of openMeteoWindAltitudes) {
                            const speedName = `wind_speed_${altitude}m_${modelNames.api}`;
                            const directionName = `wind_direction_${altitude}m_${modelNames.api}`;
            
                            if (speedName in windJSON.hourly && directionName in windJSON.hourly) {
                                if (hourIndex >= windJSON.hourly[speedName].length) {
                                    console.log(`Altitude wind speed list ${windJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                                    continue;
                                }
                                if (hourIndex >= windJSON.hourly[directionName].length) {
                                    console.log(`Altitude wind direction list ${windJSON.hourly[speedName].length} is too small for hour index ${hourIndex}.`);
                                    continue;
                                }
            
                                const windSpeed = windJSON.hourly[speedName][hourIndex];
                                const windDirection = windJSON.hourly[directionName][hourIndex];
            
                                if (null == windSpeed || null == windDirection) {
                                    //console.log(`Wind at altitude ${altitude} for ${modelNames.human} model at index ${hourIndex} is null.`);
                                    continue;
                                }
            
                                if (undefined == windSpeed || undefined == windDirection) {
                                    //console.log(`Wind at altitude ${altitude} for ${modelNames.human} model at index ${hourIndex} is undefined.`);
                                    continue;
                                }
            
                                altitudeWinds.push(new WindAtAltitude(metersToFeet(altitude), windSpeed, windDirection));
                            }
                        }
            
                        for (const pressure of openMeteoPressureLevels) {
                            const speedName = `wind_speed_${pressure}hPa_${modelNames.api}`;
                            const directionName = `wind_direction_${pressure}hPa_${modelNames.api}`;
                            const heightName = `geopotential_height_${pressure}hPa_${modelNames.api}`;
            
                            if (speedName in windJSON.hourly && directionName in windJSON.hourly && heightName in windJSON.hourly) {
                                if (hourIndex >= windJSON.hourly[speedName].length) {
                                    console.log(`Altitude wind speed list ${windJSON.hourly[speedName].length} for ${modelNames.human} model is too small for hour index ${hourIndex}.`);
                                    continue;
                                }
                                if (hourIndex >= windJSON.hourly[directionName].length) {
                                    console.log(`Altitude wind direction list ${windJSON.hourly[speedName].length} for ${modelNames.human} model is too small for hour index ${hourIndex}.`);
                                    continue;
                                }
                                if (hourIndex >= windJSON.hourly[heightName].length) {
                                    console.log(`Altitude height list ${windJSON.hourly[heightName].length} for ${modelNames.human} model is too small for hour index ${hourIndex}.`);
                                    continue;
                                }
            
                                const windSpeed = windJSON.hourly[speedName][hourIndex];
                                const windDirection = windJSON.hourly[directionName][hourIndex];
                                const windHeight = windJSON.hourly[heightName][hourIndex];
            
                                if (null == windSpeed || null == windDirection || null == windHeight) {
                                    //console.log(`Pressure ${pressure} wind for ${modelNames.human} model at index ${hourIndex} is null.`);
                                    continue;
                                }
            
                                if (undefined == windSpeed || undefined == windDirection || undefined == windHeight) {
                                    //console.log(`Pressure ${pressure} wind for ${modelNames.human} model at index ${hourIndex} is undefined.`);
                                    continue;
                                }
            
                                pressureWinds.push(new WindAtAltitude(metersToFeet(windHeight - groundElevation), windSpeed, windDirection));
                            }
                        }
            
                        let groundWindSpeed = 0;
                        let groundWindDirection = 0;
                        let windList = [];
                        let hourForecast = new WindModelForecastData();
                        let highestWindAltitude = -1;

                        // Use the altitude based data first.
                        for (const altWind of altitudeWinds) {
                            if (0 === windList.length) {
                                // Set ground wind values based on the lowest entry.
                                groundWindSpeed = altWind.windSpeed;
                                groundWindDirection = altWind.windDirection;
                                windList.push(new WindAtAltitude(0, groundWindSpeed, groundWindDirection));
                            }
                            windList.push(altWind);
                            highestWindAltitude = altWind.altitude;
                        }

                        // Now add all the atmospheric pressure based wind.
                        for (const presWind of pressureWinds) {
                            // Ignore any entries at lower altitude than the existing data.
                            if (presWind.altitude <= highestWindAltitude)
                                continue;

                            if (0 == windList.length) {
                                // Set ground wind values if no altitude entry was used.
                                groundWindSpeed = presWind.windSpeed;
                                groundWindDirection = presWind.windDirection;
                                windList.push(new WindAtAltitude(0, groundWindSpeed, groundWindDirection));
                            }
                            windList.push(presWind);
                        }

                        hourForecast.loadOpenMeteoData(modelNames.human, groundWindSpeed, groundWindDirection, hourList[hourIndex], windList);
                        windForecastList.push(hourForecast);
                    }

                    windModelForecasts.addWindModelForecast(modelNames.api, windForecastList);
                });
            } else {
                console.debug('JSON object returned by Open-Meteo does not contain an [hourly] member.');
                console.debug(windJSON);
            }
        } else {
            console.error(`Open-Meteo response status: ${openMeteoPromise.status}`);
        }
    } catch (error) {
        console.error(error.message);
    }

    return windModelForecasts;
}

/**
 * Calculates where a rocket's altitude is located within a wind band.
 * @param   {number} rocketAltitude - Current altitude (feet) of the rocket.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including altitudes (feet).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Percentage of this wind band above the floor where the rocket is located. -1 if outside the range.
 */
function getWindBandPercentage(rocketAltitude, windData, floorIndex) {
    // Run a safety check to avoid a potential out of bounds error.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Provided index ${floorIndex} will exceed the bounds of the wind data array ${windData.length}`);
        return -1;
    }
    // Also cannot proceed if rocket is outside this wind band's altitude range.
    const altitudeFloor = windData[floorIndex].altitude;
    const altitudeCeiling = windData[floorIndex + 1].altitude;
    if (rocketAltitude < altitudeFloor || rocketAltitude > altitudeCeiling) {
        console.debug(`Rocket altitude ${rocketAltitude} is outside the provided range between ${altitudeFloor} and ${altitudeCeiling}`);
        return -1.0;
    }
    const rangeHeight = Math.abs(altitudeCeiling - altitudeFloor);
    if (0 == rangeHeight) {
        console.debug(`Attempting linear interpolation with values resulting in a range of zero.  ${altitudeFloor} and ${altitudeCeiling}`);
        return -1.0;
    }
    return Math.abs(rocketAltitude - altitudeFloor) / rangeHeight;
}

/**
 * Obtain the average wind speed (knots) across a portion of the wind band between its floor and the rocket.
 * @param   {number} bandPercentage - Percentage of this wind band the rocket is located above its floor.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including speeds (knots).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Averaged wind speed (knots). -1 if outside the range.
 */
function getAverageWindSpeed(bandPercentage, windData, floorIndex) {
    // Verify the percentage is an expected value just in case.
    if (bandPercentage < 0.0 || bandPercentage > 1.0) {
        console.debug(`Wind band percentage ${bandPercentage} is outside the expected value range.`);
        return -1;
    }
    // Check the wind data index while we are being careful.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Wind band index ${floorIndex} is outside the expected value range ${windData.length}`);
        return -1;
    }
    const speedFloor = windData[floorIndex].windSpeed;
    const speedRange = windData[floorIndex + 1].windSpeed - speedFloor;
    const speedAtAltitude = speedFloor + (bandPercentage * speedRange);
    return (speedFloor + speedAtAltitude) / 2.0;
}

/**
 * Obtain the average wind direction (degrees from 0 north) across a portion of the wind band between its floor and the rocket.
 * @param   {number} bandPercentage - Percentage of this wind band the rocket is located above its floor.
 * @param   {Array.<WindAtAltitude>} windData - Array of data defining available wind bands including speeds (knots).
 * @param   {number} floorIndex - Index into windData identifying the floor of this wind band.
 * @returns {number} Averaged wind direction (degrees from 0 north). -1 if outside the range.
 */
function getAverageWindDirection(bandPercentage, windData, floorIndex) {
    // Verify the percentage is an expected value just in case.
    if (bandPercentage < 0.0 || bandPercentage > 1.0) {
        console.debug(`Wind band percentage ${bandPercentage} is outside the expected value range.`);
        return -1;
    }
    // Check the wind data index while we are being careful.
    if (floorIndex < 0 || (floorIndex + 1) >= windData.length) {
        console.debug(`Wind band index ${floorIndex} is outside the expected value range ${windData.length}`);
        return -1;
    }
    const directionA = windData[floorIndex].windDirection;
    const targetDirection = directionA + (bandPercentage * (windData[floorIndex + 1].windDirection - directionA));
    let averageDirection = directionA + targetDirection;
    if (Math.abs(directionA - targetDirection) < 180.0) {
        averageDirection /= 2.0;
    } else {
        // Maintain a northerly direction as the bearing oscillates around zero degrees
        averageDirection = (averageDirection - 360.0) / 2.0;
        if (averageDirection < 0.0) {
            averageDirection += 360.0;
        }
    }
    return averageDirection;
}

/**
 * Calculates a drift distance and applies it to the rocket's location.
 * @param {GeoLocation} rocketLocation - Initial location and to be updated as the destination.
 * @param {number} windSpeed - Velocity (knots) the wind is blowing.
 * @param {number} windDirection - Bearing (degrees from North) to move.
 * @param {number} decentRate - Velocity (ft/s) the rocket is currently falling.
 * @param {number} descentDistance - Distance (feet)
 */
function driftWithWind(rocketLocation, windSpeed, windDirection, decentRate, descentDistance) {
    // Ensure the decent rate is valid
    if (isNaN(decentRate) || 0 == decentRate) {
        console.debug(`Cannot use the current decent rate: ${decentRate}`);
        return;
    }
    decentRate = Math.abs(decentRate);

    // Use the average of wind speed and direction within this range to calculate drift
    const decentDuration = descentDistance / decentRate;

    // The movement function expects a distance in meters, so convert the wind speed
    // from knots into ft/s before multiplying by the decent rate.
    const driftDistance = decentDuration * (windSpeed * 1.68781);

    // Wind bearing indicates where the wind is blowing from, but we want to drift
    // downwind here.  Therefore the direction is inverted before applying movement.
    if (windDirection < 180) {
        windDirection += 180;
    } else {
        windDirection -= 180;
    }

    // Now a decent position can be calculated
    moveAlongBearingKilometers(rocketLocation, feetToMeters(driftDistance), windDirection);

    return driftDistance;
}

// Export our class definitions
export { WindAtAltitude, WindForecastData, WindModelForecastData, WeathercockWindData };

// Export our functions
export { getWindPredictionData, getOpenMeteoWindPredictionData, getWindBandPercentage, getAverageWindSpeed, getAverageWindDirection, driftWithWind };