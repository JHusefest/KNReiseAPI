/*global L: false */

var KR = this.KR || {};
KR.Util = {};

(function (ns) {
    'use strict';

    ns.dictWithout = function (dict) {
        var keys = _.without(_.keys(dict), Array.prototype.slice.call(arguments, 1));
        return _.reduce(keys, function (acc, key) {
            acc[key] = dict[key];
            return acc;
        }, {});
    };

    ns.createQueryParameterString = function (params) {
        return _.map(params, function (value, key) {
            return encodeURIComponent(key) + '=' + encodeURIComponent(value);
        }).join('&');
    };

    ns.handleError = function (errorCallback, error, data) {
        if (errorCallback) {
            errorCallback({'error': error, 'data': data});
            return;
        }
        throw new Error(error);
    };

    ns.sendRequest = function (url, parser, callback, errorCallback) {
        return $.ajax({
            type: 'get',
            url: url,
            success: function (response) {
                if (parser) {
                    var parsed;
                    try {
                        parsed = parser(response, errorCallback);
                    } catch (e) {
                        ns.handleError(errorCallback, e.message, response);
                        return;
                    }
                    if (!_.isUndefined(parsed)) {
                        callback(parsed);
                    }
                } else {
                    callback(response);
                }
            },
            error: errorCallback
        });
    };

    ns.createGeoJSONFeature = function (latLng, properties) {
        return {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [latLng.lng, latLng.lat]
            },
            'properties': properties
        };
    };

    ns.createGeoJSONFeatureFromGeom = function (geom, properties) {
        return {
            'type': 'Feature',
            'geometry': geom,
            'properties': properties
        };
    };

    ns.createFeatureCollection = function (features) {
        return {
            'type': 'FeatureCollection',
            'features': features
        };
    };

    ns.stamp = (function () {
        var lastId = 0,
            key = '_knreise_id';
        return function (obj) {
            obj[key] = obj[key] || ++lastId;
            return obj[key];
        };
    }());

    function _toRad(value) {
        return value * Math.PI / 180;
    }

    ns.haversine = function (lat1, lon1, lat2, lon2) {
        var R = 6371000; // metres
        var phi1 = _toRad(lat1);
        var phi2 = _toRad(lat2);
        var bDeltaPhi = _toRad(lat2 - lat1);
        var bDeltaDelta = _toRad(lon2 - lon1);

        var a = Math.sin(bDeltaPhi / 2) * Math.sin(bDeltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(bDeltaDelta / 2) * Math.sin(bDeltaDelta / 2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    ns.splitBbox = function (bbox) {
        return bbox.split(',').map(parseFloat);
    };

}(KR.Util));
