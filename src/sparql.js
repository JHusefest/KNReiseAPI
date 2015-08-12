/*global proj4:false, wellknown:false */
var KR = this.KR || {};

KR.SparqlAPI = function (BASE_URL, apiName) {
    'use strict';

    if (typeof proj4 !== 'undefined') {
        proj4.defs([
            [
                'EPSG:32633',
                '+proj=utm +zone=33 +datum=WGS84 +units=m +no_defs'
            ]
        ]);
    }

    function _transform(coordinates) {
        if (typeof proj4 === 'undefined') {
            throw new Error('Proj4js not found!');
        }
        return proj4('EPSG:32633', 'EPSG:4326', coordinates);
    }

    function _parseGeom(geom) {
        geom = wellknown.parse(geom.value);
        if (geom.type === 'Point') {
            geom.coordinates = _transform(geom.coordinates);
        }
        if (geom.type === 'Polygon') {

            geom.coordinates = _.map(geom.coordinates, function (ring) {
                return _.map(ring, _transform);
            });
        }

        return geom;
    }

    function _parseResponse(response, errorCallback) {

        var features = _.map(response.results.bindings, function (item) {
            var keys = _.without(_.keys(item), 'point', 'omraade');
            var attrs = _.reduce(keys, function (acc, key) {
                acc[key] = item[key].value;
                return acc;
            }, {});

            if (!attrs.img) {
                attrs.img = false;
            }
            attrs.title = attrs.name;

            if (_.has(item, 'point')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.point),
                    attrs,
                    apiName + '_' + attrs.id
                );
            }
            if (_.has(item, 'omraade')) {
                return KR.Util.createGeoJSONFeatureFromGeom(
                    _parseGeom(item.omraade),
                    attrs,
                    apiName + '_' + attrs.id
                );
            }
            return null;
        });

        return KR.Util.createFeatureCollection(features);
    }

    function _parselokalitetPoly(response, errorCallback) {
        var bindings = response.results.bindings;
        if (!bindings || bindings.length === 0) {
            KR.Util.handleError(errorCallback);
            return;
        }
        bindings[0].lok.type = 'Polygon';
        return KR.Util.createGeoJSONFeatureFromGeom(_parseGeom(bindings[0].lok), {});
    }

    function _sendQuery(query, parse, callback, errorCallback) {
        var params = {
            'default-graph-uri': '',
            'query': query,
            'format': 'application/sparql-results+json',
            'timeout': 0,
            'debug': 'off'
        };

        var url = BASE_URL + '?'  + KR.Util.createQueryParameterString(params);
        KR.Util.sendRequest(url, parse, callback, errorCallback);
    }

    function _createKommuneQuery(dataset) {

        if (!dataset.kommune) {
            return;
        }

        var query = 'select distinct ?id ?name ?description ?loccatlabel ?img ?thumbnail (SAMPLE(?point) as ?point) ?url as ?link {' +
            ' ?id a ?type ;' +
            ' rdfs:label ?name ;' +
            ' <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description ;' +
            ' <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?loccat ;' +
            ' ?p <https://data.kulturminne.no/difi/geo/kommune/' + dataset.kommune + '> ;' +
            ' <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point .' +
            ' ?loccat rdfs:label ?loccatlabel .' +
            ' BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid)' +
            ' BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url)' +
            ' optional {' +
            '  ?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id .' +
            '  ?picture <https://data.kulturminne.no/schema/source-link> ?link' +
            '  BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid)' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=600&rs=0&pg=0&sr=", ?lokid) AS ?img)' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=75&rs=0&pg=0&sr=", ?lokid) AS ?thumbnail)' +
            ' }' +
            '}';
        if (dataset.limit) {
            query += 'LIMIT ' + dataset.limit;
        }
        return query;
    }

    function _createFylkeQuery(dataset) {

        if (!dataset.fylke) {
            return;
        }

        var fylke = parseInt(dataset.fylke, 10);
        if (fylke < 10) {
            fylke = '0' + fylke;
        }

        var query = 'select  ?id ?name ?description ?loccatlabel (SAMPLE(?point) as ?point) ?img ?thumbnail ?url  as ?link {' +
            ' ?id a ?type .' +
            ' ?id rdfs:label ?name .' +
            ' ?id <https://data.kulturminne.no/askeladden/schema/i-kommune> ?kommune .' +
            ' ?id <https://data.kulturminne.no/askeladden/schema/beskrivelse> ?description .' +
            ' ?id <https://data.kulturminne.no/askeladden/schema/lokalitetskategori> ?lokalitetskategori .' +
            ' ?lokalitetskategori rdfs:label ?loccatlabel .' +
            ' BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid)' +
            ' BIND(bif:concat("http://www.kulturminnesok.no/kulturminnesok/kulturminne/?LOK_ID=", ?lokid) AS ?url)' +
            ' ?id <https://data.kulturminne.no/askeladden/schema/geo/point/etrs89> ?point .' +
            ' optional {' +
            '  ?picture <https://data.kulturminne.no/bildearkivet/schema/lokalitet> ?id .' +
            '  ?picture <https://data.kulturminne.no/schema/source-link> ?link' +
            '  BIND(REPLACE(STR(?id), "https://data.kulturminne.no/askeladden/lokalitet/", "") AS ?lokid)' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=400&rs=0&pg=0&sr=", ?lokid) AS ?img)' +
            '  BIND(bif:concat("http://kulturminnebilder.ra.no/fotoweb/cmdrequest/rest/PreviewAgent.fwx?ar=5001&sz=75&rs=0&pg=0&sr=", ?lokid) AS ?thumbnail)' +
            '  }' +
            ' FILTER regex(?kommune, "^.*' + fylke + '[0-9]{2}") .' +
            ' } order by ?img';

        if (dataset.limit) {
            query += 'LIMIT ' + dataset.limit;
        }
        return query;
    }

    function _polyForLokalitetQuery(lokalitet) {
        return 'SELECT ?lok where ' +
            '{ ' +
            '  <' + lokalitet + '> <https://data.kulturminne.no/askeladden/schema/geo/area/etrs89> ?lok . ' +
            '}';
    }

    function _polyForLokalitet(dataset, callback, errorCallback) {

        var lokalitet = [];
        if (_.isArray(dataset.lokalitet)) {
            lokalitet = dataset.lokalitet;
        } else {
            lokalitet.push(dataset.lokalitet);
        }


        var features = [];
        var finished = _.after(lokalitet.length, function () {
            callback(KR.Util.createFeatureCollection(features));
        });

        _.each(lokalitet, function (lok) {
            _sendQuery(_polyForLokalitetQuery(lok), _parselokalitetPoly, function (geoJson) {
                geoJson.properties.lok = lok;
                features.push(geoJson);
                finished();
            }, errorCallback);
        });
    }

    function getData(dataset, callback, errorCallback, options) {
        dataset = _.extend({}, {geomType: 'point'}, dataset);
        if (dataset.kommune) {
            var query = _createKommuneQuery(dataset, errorCallback);
            _sendQuery(query, _parseResponse, callback, errorCallback);
        } else if (dataset.fylke) {
            var query = _createFylkeQuery(dataset, errorCallback);
            _sendQuery(query, _parseResponse, callback, errorCallback);
        } else if (dataset.lokalitet && dataset.type === 'lokalitetpoly') {
            _polyForLokalitet(dataset, callback, errorCallback);
        } else if (dataset.sparqlQuery) {
            _sendQuery(dataset.sparqlQuery, _parseResponse, callback, errorCallback);
        } else {
            KR.Util.handleError(errorCallback, 'not enough parameters');
        }
    }

    return {
        getData: getData
    };
};
