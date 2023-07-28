import OLMap from "ol/Map";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorSource from "ol/source/Vector";
import VectorLayer from "ol/layer/Vector";
import { GeoJSON } from "ol/format";
import { Modify } from "ol/interaction";
import { View } from "ol";
import { fromLonLat, transformExtent } from "ol/proj";
import ColorizeFilter from "ol-ext/filter/Colorize";
import data from "./assets/data.json";
import { circle, featureCollection, union } from "@turf/turf";
import Crop from "ol-ext/filter/Crop.js";
import { toStyle } from "ol/style/flat";

// Set up sources and layers
const sources = {
  topo4: new XYZ({
    url: "https://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4&zoom={z}&x={x}&y={y}",
    attributions: ['<a href="http://www.kartverket.no/">Kartverket</a>'],
  }),
  topo4grayscale: new XYZ({
    url: "https://opencache.statkart.no/gatekeeper/gk/gk.open_gmaps?layers=topo4graatone&zoom={z}&x={x}&y={y}",
    attributions: '<a href="http://www.kartverket.no/">Kartverket</a>',
  }),
  osm: new OSM(),
  satellite: new XYZ({
    transition: 0, // should be set to 0 when opacity is < 1
    attributions:
      "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  }),
};

const gjs = new GeoJSON({
  featureProjection: "EPSG:3857",
  dataProjection: "EPSG:4326",
});

const editableFeaturesSource = new VectorSource({
  features: gjs.readFeatures(data), // load geojson data
});

const rangeRingSource = new VectorSource();

const tileLayerA = new TileLayer({
  source: sources.topo4,
  extent: transformExtent([2, 57, 33, 72], "EPSG:4326", "EPSG:3857"),
});

const tileLayerB = new TileLayer({
  source: sources.osm,
  extent: transformExtent([2, 57, 33, 72], "EPSG:4326", "EPSG:3857"),
});

const editableFeaturesLayer = new VectorLayer({
  source: editableFeaturesSource,
  style: toStyle({
    "circle-radius": 6,
    "circle-fill-color": "rgba(255,0,0,0.8)",
  }),
});

const rangeRingLayer = new VectorLayer({
  source: rangeRingSource,
  style: toStyle({ "stroke-color": "red", "stroke-width": 2 }),
});

const layers = [tileLayerA, tileLayerB, rangeRingLayer, editableFeaturesLayer];

const layerAFilter = new ColorizeFilter();
const layerBFilter = new Crop({
  feature: rangeRingLayer.getSource().getFeatures()[0],
  wrapX: true,
  inner: false,
  shadowWidth: 15,
});

layers[0].addFilter(layerAFilter);
layers[1].addFilter(layerBFilter);

function createRangeRings() {
  rangeRingLayer.getSource().clear();
  // convert editable features to geojson for use with Turf.js
  const centers = gjs.writeFeaturesObject(editableFeaturesSource.getFeatures());
  const rangeRings = featureCollection(
    centers.features.map((f) => {
      const center = f.geometry.coordinates;
      const range = f.properties.range || 4;
      return circle(center, range, { steps: 64 });
    }),
  );

  const mergedRangeRings = union(rangeRings);
  rangeRingLayer.getSource().addFeatures(gjs.readFeatures(mergedRangeRings));
}

createRangeRings();

const modify = new Modify({
  source: editableFeaturesSource,
});

modify.on("modifyend", (event) => {
  createRangeRings();
  // This is a hack to get the Crop filter to update
  layerBFilter.feature_ = rangeRingLayer.getSource().getFeatures()[0];
});

const olMap = new OLMap({
  layers,
  view: new View({
    center: fromLonLat([5.257432292631307, 61.93262171483414]),
    maxTilesLoading: 200,
    zoom: 10,
  }),
});

olMap.addInteraction(modify);

export function useMap(target = null) {
  if (target) olMap.setTarget(target);

  function changeSources(sourceNameA, sourceNameB) {
    tileLayerA.setSource(sources[sourceNameA]);
    tileLayerB.setSource(sources[sourceNameB]);
  }

  function fitMap() {
    olMap.getView().fit(rangeRingLayer.getSource().getExtent(), {
      padding: [10, 10, 10, 10],
    });
  }

  return { olMap, layerAFilter, layerBFilter, changeSources, fitMap };
}
