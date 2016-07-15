var KR = this.KR || {};

KR.KSamsokAPI = function (apiName, options) {
    'use strict';

    options = options || {};
    var requests = [];

    var BASE_URL = 'http://www.knreise.no/miniProxy/miniProxy.php/http://kulturarvsdata.se/ksamsok/api';
    var apikey = options.apikey;

    var bboxTemplate = _.template('boundingBox=/WGS84 "<%= w %> <%= s %> <%= e %> <%= n %>"');

    function _parseItems(response) {
        var features = _.map(response.items, _parseEuropeanaItem);
        return KR.Util.createFeatureCollection(features);
    }

    function _bboxQuery(bbox) {
        bbox = KR.Util.splitBbox(bbox);
        return bboxTemplate({
            s: bbox[1],
            n: bbox[3],
            w: bbox[0],
            e: bbox[2]
        });
    }

    function _parseRecord(record) {

        var properties = _.reduce(record.field, function (acc, field) {
            acc[field._name] = field.__text;
            return acc;
        }, {});

        var lon = parseFloat(properties.lon);
        var lat = parseFloat(properties.lat);

        var props = _.reduce(properties, function (acc, value, key) {
            if (key !== 'lat' && key !== 'lon') {
                acc[key] = value;
            }
            return acc;
        }, {});

        props.title = props.itemLabel;
        if (_.has(props, 'thumbnail')) {
            props.images = [props.thumbnail.replace('thumbnail', 'lowres')];
        }

        return KR.Util.createGeoJSONFeature(
            {
                lat: lat,
                lng: lon
            },
            props,
            apiName + '_' + properties.itemId
        );

        /*
        var item = record.item;
        console.log('!', item);
        if (!_.has(item, 'where')) {
            return null;
        }
        var pos = item.where.Point.coordinates.toString().split(',');

        var properties = _.chain(_.keys(item))
            .filter(function (key) {
                return !key.startsWith('__');
            })
            .reduce(function (acc, key) {
                var data = item[key];
                if (_.has(data, '__text')) {
                    acc[key] = data['__text'];
                }
                return acc;
            }, {})
            .value();
        console.log(properties.id);

        properties.title = properties.itemLabel;

        return KR.Util.createGeoJSONFeature(
            {
                lat: parseFloat(pos[1]),
                lng: parseFloat(pos[0])
            },
            properties,
            null
        );
        */
    }

    function _parseDescription(description) {

        return null;
    }

    function _parseItems(response) {

        var x2js = new X2JS();
        var json = x2js.xml2json(response);

        var features = _.chain(json.result.records.record)
            .map(_parseRecord)
            .filter(function (feature) {
                return !!feature;
            })
            .value();
        return KR.Util.createFeatureCollection(features);
    }

    function getBbox(parameters, bbox, callback, errorCallback, options) {
        var params = {
            method: 'search',
            hitsPerPage: 500,
            'x-api': apikey,
            query: _bboxQuery(bbox),
            recordSchema: 'xml',
            fields: 'itemLabel,itemDescription,lon,lat,thumbnail,url,itemLicense'
        };

        var url = BASE_URL + '?' + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, _parseItems, callback, errorCallback);
    }

    function getWithin(parameters, latLng, distance, callback, errorCallback, options) {
    }

    function getData(parameters, callback, errorCallback, options) {
    }

    function getItem() {

    }

    return {
        getWithin: getWithin,
        getItem: getItem,
        getBbox: getBbox,
        getData: getData
    };
};
