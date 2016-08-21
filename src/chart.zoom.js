// hammer JS for touch support
var Hammer = require('hammerjs');
Hammer = typeof(Hammer) === 'function' ? Hammer : window.Hammer;

var Moment = require('moment')

// Get the chart variable
var Chart = require('chart.js');
Chart = typeof(Chart) === 'function' ? Chart : window.Chart;
var helpers = Chart.helpers;

// Take the zoom namespace of Chart
var zoomNS = Chart.Zoom = Chart.Zoom || {};

// Where we store functions to handle different scale types
var zoomFunctions = zoomNS.zoomFunctions = zoomNS.zoomFunctions || {};
var panFunctions = zoomNS.panFunctions = zoomNS.panFunctions || {};

// Default options if none are provided
var defaultOptions = zoomNS.defaults = {
	pan: {
		enabled: true,
		mode: 'xy',
		threshold: 10,
	},
	zoom: {
		enabled: true,
		mode: 'xy',
	}
};

function directionEnabled(mode, dir) {
	if (mode === undefined) {
		return true;
	} else if (typeof mode === 'string') {
		return mode.indexOf(dir) !== -1;
	}

	return false;
}

function zoomIndexScale(scale, zoom, center) {
}

function zoomTimeScale(scale, zoom, center) {
	var options = scale.options;

	var range;
	var min_percent;
	if (scale.isHorizontal()) {
		range = scale.right - scale.left;
		min_percent = (center.x - scale.left) / range;
	} else {
		range = scale.bottom - scale.top;
		min_percent = (center.y - scale.top) / range;
	}

	var max_percent = 1 - min_percent;
	var newDiff = range * (zoom - 1);

	var minDelta = newDiff * min_percent;
	var maxDelta = newDiff * max_percent;

	var new_min = scale.getValueForPixel(scale.getPixelForValue(scale.firstTick) + minDelta);
	var new_max = scale.getValueForPixel(scale.getPixelForValue(scale.lastTick) - maxDelta);

	var minLimit = options.time.min_limit
	var maxLimit = options.time.max_limit
	var minLimitMoment = new Moment(minLimit)
	var maxLimitMoment = new Moment(maxLimit)

	if(new_min >= minLimitMoment && new_max <= maxLimitMoment) {
		options.time.min = new_min
		options.time.max = new_max
	}
}

function zoomNumericalScale(scale, zoom, center) {
	var newDiff = (scale.max - scale.min) * (zoom - 1);

	var new_min = scale.min + (newDiff / 2);
	var new_max = scale.max - (newDiff / 2);

	var min = scale.options.ticks.min
	var max = scale.options.ticks.max

	var min_limit = scale.options.ticks.min_limit
	var max_limit = scale.options.ticks.max_limit

	if(new_min >= min_limit && new_max <= max_limit) {
		scale.options.ticks.min = new_min
		scale.options.ticks.max = new_max
	}
}

function zoomScale(scale, zoom, center) {
	var fn = zoomFunctions[scale.options.type];
	if (fn) {
		fn(scale, zoom, center);
	}
}

function doZoom(chartInstance, zoom, center) {
	var ci = chartInstance
	var ca = ci.chartArea;
	if (!center) {
		center = {
			x: (ca.left + ca.right) / 2,
			y: (ca.top + ca.bottom) / 2,
		};
	}

	var zoomOptions = ci.options.zoom;

	if (zoomOptions && helpers.getValueOrDefault(zoomOptions.enabled, defaultOptions.zoom.enabled)) {
		// Do the zoom here
		var zoomMode = helpers.getValueOrDefault(chartInstance.options.zoom.mode, defaultOptions.zoom.mode);
		helpers.each(ci.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(zoomMode, 'x')) {
					zoomScale(scale, zoom, center);
			} else if (directionEnabled(zoomMode, 'y')) {
					zoomScale(scale, zoom, center);
			}
		});

		chartInstance.update(0);
	}
}

function panIndexScale(scale, delta) {
	/*var options = scale.options;
	var labels = scale.chart.data.labels;
	var lastLabelIndex = labels.length - 1;

	var minIndex = Math.max(0, Math.round(scale.getValueForPixel(scale.getPixelForValue(null, scale.minIndex, null, true) - delta)));
	var maxIndex = Math.min(lastLabelIndex, Math.round(scale.getValueForPixel(scale.getPixelForValue(null, scale.maxIndex, null, true) - delta)))
	options.ticks.min = labels[minIndex];
	options.ticks.max = labels[maxIndex];*/
}

function panTimeScale(scale, delta) {
	var options = scale.options;

 	var new_min = scale.getValueForPixel(scale.getPixelForValue(scale.firstTick) - delta);
 	var new_max = scale.getValueForPixel(scale.getPixelForValue(scale.lastTick) - delta);

	/* Convert the limits to Moment objects, since min and max are already Moment objects. */
	var min_limit = new Moment(options.time.min_limit)
	var max_limit = new Moment(options.time.max_limit)

	if(new_min > min_limit && new_max < max_limit) {
		options.time.min = new_min
		options.time.max = new_max
	}
}

function panNumericalScale(scale, delta) {
	var tickOpts = scale.options.ticks;
	var start = scale.start,
	end = scale.end;

	/* Two possible conditions */
	var a = scale.getValueForPixel(scale.getPixelForValue(start) - delta);
	var b = scale.getValueForPixel(scale.getPixelForValue(end) - delta);

	if (tickOpts.reverse) {
		if(a < tickOpts.max_limit && b > tickOpts.min_limit) {
			tickOpts.max = a
			tickOpts.min = b
		}
	} else {
		if(b < tickOpts.max_limit && a > tickOpts.min_limit) {
			tickOpts.max = b
			tickOpts.min = a
		}
	}
}

function panScale(scale, delta) {
	var fn = panFunctions[scale.options.type];
	if (fn) {
		fn(scale, delta);
	}
}

function doPan(chartInstance, deltaX, deltaY) {
	var panOptions = chartInstance.options.pan;
	if (panOptions && helpers.getValueOrDefault(panOptions.enabled, defaultOptions.pan.enabled)) {
		var panMode = helpers.getValueOrDefault(chartInstance.options.pan.mode, defaultOptions.pan.mode);
		helpers.each(chartInstance.scales, function(scale, id) {
			if (scale.isHorizontal() && directionEnabled(panMode, 'x') && deltaX !== 0) {
				panScale(scale, deltaX);
			} else if (directionEnabled(panMode, 'y') && deltaY !== 0) {
				panScale(scale, deltaY);
			}
		});

		chartInstance.update(0);
	}
}

function positionInChartArea(chartInstance, position) {
	return 	(position.x >= chartInstance.chartArea.left && position.x <= chartInstance.chartArea.right) &&
	(position.y >= chartInstance.chartArea.top && position.y <= chartInstance.chartArea.bottom);
}

// Store these for later
zoomNS.zoomFunctions.category = zoomIndexScale;
zoomNS.zoomFunctions.time = zoomTimeScale;
zoomNS.zoomFunctions.linear = zoomNumericalScale;
zoomNS.zoomFunctions.logarithmic = zoomNumericalScale;
zoomNS.panFunctions.category = panIndexScale;
zoomNS.panFunctions.time = panTimeScale;
zoomNS.panFunctions.linear = panNumericalScale;
zoomNS.panFunctions.logarithmic = panNumericalScale;

// Chartjs Zoom Plugin
var zoomPlugin = {
	beforeInit: function(chartInstance) {
		// console.log('called beforeInit!')

		var node = chartInstance.chart.ctx.canvas;
		var options = chartInstance.options;
		var panThreshold = helpers.getValueOrDefault(options.pan ? options.pan.threshold : undefined, zoomNS.defaults.pan.threshold);

		var wheelHandler = function(e) {
			if (e.deltaY < 0) {
				/* Zooming in. */
				// console.log('wheelHandler deltaY < 0')
				doZoom(chartInstance, 1.1);
			} else {
				/* Zooming out. */
				// console.log('wheelHandler deltaY > 0')
				doZoom(chartInstance, 0.909);
			}
		};
		chartInstance._wheelHandler = wheelHandler;

		node.addEventListener('wheel', wheelHandler);

		if (Hammer) {
			var mc = new Hammer.Manager(node);
			mc.add(new Hammer.Pinch());
			mc.add(new Hammer.Pan({
				threshold: panThreshold
			}));

			// Hammer reports the total scaling. We need the incremental amount
			var currentPinchScaling;
			var handlePinch = function handlePinch(e) {
				console.log('handling pinch')
				var diff = 1 / (currentPinchScaling) * e.scale;
				doZoom(chartInstance, diff, e.center);

				// Keep track of overall scale
				currentPinchScaling = e.scale;
			};

			mc.on('pinchstart', function(e) {
				console.log('pinch start')
				currentPinchScaling = 1; // reset tracker
			});
			mc.on('pinch', handlePinch);
			mc.on('pinchend', function(e) {
				console.log('pinch end')
				handlePinch(e);
				currentPinchScaling = null; // reset
			});

			var currentDeltaX = null, currentDeltaY = null;
			var handlePan = function handlePan(e) {
				if (currentDeltaX !== null && currentDeltaY !== null) {

					var deltaX = e.deltaX - currentDeltaX;
					var deltaY = e.deltaY - currentDeltaY;
					currentDeltaX = e.deltaX;
					currentDeltaY = e.deltaY;

					/* Positive DeltaX indicates movement to the left. Negative: moving right. */
					/* Positive DeltaY indicates movement upwards. Negative: moving downwards. */
					doPan(chartInstance, deltaX, deltaY);
				}
			};

			mc.on('panstart', function(e) {
				currentDeltaX = 0;
				currentDeltaY = 0;
				handlePan(e);
			});
			mc.on('panmove', handlePan);
			mc.on('panend', function(e) {
				currentDeltaX = null;
				currentDeltaY = null;
			});
			chartInstance._mc = mc;
		}
	},

	beforeDatasetsDraw: function(chartInstance) {
		// console.log('called beforeDatasetsDraw!')
		var ctx = chartInstance.chart.ctx;
		var chartArea = chartInstance.chartArea;
		ctx.save();
		ctx.beginPath();
		ctx.rect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
		ctx.clip();
	},

	afterDatasetsDraw: function(chartInstance) {
		// console.log('called afterDatasetsDraw!')
		chartInstance.chart.ctx.restore();

		let cb = chartInstance.options.zoom.cb
		if(cb) {
			cb()
		}
	},

	destroy: function(chartInstance) {
		// console.log('called destroy!')
		var node = chartInstance.chart.ctx.canvas;

		var mc = chartInstance._mc;
		if (mc) {
			mc.remove('pinchstart');
			mc.remove('pinch');
			mc.remove('pinchend');
			mc.remove('panstart');
			mc.remove('pan');
			mc.remove('panend');
		}
	}
};

Chart.pluginService.register(zoomPlugin);
